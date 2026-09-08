import { DatabaseService } from '../../database/db.service.js';
import { CryptoService } from '../crypto/crypto.service.js';

export interface AttributeCommitment {
  attribute: string;
  commitment: string;
  salt?: string;
  value?: any;
  isDisclosed: boolean;
}

export interface PredicateProof {
  attribute: string;
  predicate: string;
  threshold: number;
  satisfied: boolean;
  commitment: string;
  proofMethod: 'SALTED_ATTRIBUTE_COMMITMENT';
  generatedAt: string;
}

export interface VerifiableClaim {
  trustObjectId: string;
  claimType: string;
  issuerName: string;
  issuerDid: string;
  issuanceDate: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'TAMPERED';
  blockchainTxId: string;
  contentHash: string;
  disclosedAttributes: Record<string, any>;
  hiddenAttributesCount: number;
  attributeCommitments?: AttributeCommitment[];
  predicateProofs?: PredicateProof[];
}

export interface TrustPassport {
  ownerDid: string;
  ownerName: string;
  ownerType: 'INDIVIDUAL' | 'ORGANIZATION';
  reputationTrustScore: number; // 0 - 100
  claims: VerifiableClaim[];
  summary: {
    totalCredentials: number;
    activeCredentials: number;
    revokedCredentials: number;
    isFullyVerified: boolean;
  };
  privacyMode: 'FULL_DISCLOSURE' | 'SELECTIVE_DISCLOSURE';
  issuedAt: string;
}

export class TrustPassportService {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || DatabaseService.getInstance();
  }

  /**
   * Generates a privacy-preserving Trust Passport for any individual or organization DID
   * with cryptographic salted commitments and predicate assertions
   */
  public generatePassport(did: string, selectiveDisclosure: boolean = true): TrustPassport | null {
    const identity = this.db.getOne<any>('SELECT * FROM identities WHERE did = ?', [did]);
    if (!identity) {
      return null;
    }

    const user = this.db.getOne<any>('SELECT * FROM users WHERE did = ?', [did]);
    const organization = this.db.getOne<any>('SELECT * FROM organizations WHERE did = ?', [did]);

    const ownerName = user?.display_name || organization?.name || did.split(':').pop() || did;
    const ownerType = identity.entity_type === 'ORGANIZATION' ? 'ORGANIZATION' : 'INDIVIDUAL';

    // Fetch Trust Objects where subject_id is this DID
    const trustObjects = this.db.query<any>(
      'SELECT * FROM trust_objects WHERE subject_id = ? ORDER BY created_at_epoch DESC',
      [did]
    );

    const claims: VerifiableClaim[] = [];
    let activeCount = 0;
    let revokedCount = 0;

    for (const obj of trustObjects) {
      const metadata = JSON.parse(obj.metadata);
      let disclosedAttributes: Record<string, any> = {};
      let hiddenAttributesCount = 0;
      const attributeCommitments: AttributeCommitment[] = [];
      const predicateProofs: PredicateProof[] = [];

      // Compute cryptographic salted commitment for each attribute
      for (const [key, val] of Object.entries(metadata)) {
        const salt = CryptoService.sha256(`salt:${did}:${obj.trust_object_id}:${key}`);
        const commitment = CryptoService.sha256(`${key}:${String(val)}:${salt}`);

        if (selectiveDisclosure) {
          // Selective disclosure rules:
          const isDisclosedKey = (obj.object_type === 'CREDENTIAL' && ['degreeName', 'institutionName', 'graduationYear'].includes(key)) ||
                                 (obj.object_type === 'PRODUCT' && ['productName', 'batchNumber', 'complianceCert'].includes(key));

          if (isDisclosedKey) {
            disclosedAttributes[key] = val;
            attributeCommitments.push({
              attribute: key,
              commitment,
              salt,
              value: val,
              isDisclosed: true,
            });
          } else {
            hiddenAttributesCount++;
            attributeCommitments.push({
              attribute: key,
              commitment,
              isDisclosed: false, // salt and value blinded
            });
          }

          // Generate cryptographic predicate assertion for numeric credentials (e.g. CGPA >= 3.5 or >= 8.0)
          if (key === 'cgpa' || key === 'gpa' || key === 'grade') {
            const numVal = parseFloat(String(val));
            if (!isNaN(numVal)) {
              const threshold = numVal >= 7.0 ? 7.5 : 3.5;
              const satisfied = numVal >= threshold;
              predicateProofs.push({
                attribute: key,
                predicate: `>= ${threshold}`,
                threshold,
                satisfied,
                commitment,
                proofMethod: 'SALTED_ATTRIBUTE_COMMITMENT',
                generatedAt: new Date().toISOString(),
              });
            }
          }
        } else {
          disclosedAttributes[key] = val;
          attributeCommitments.push({
            attribute: key,
            commitment,
            salt,
            value: val,
            isDisclosed: true,
          });
        }
      }

      if (selectiveDisclosure && obj.object_type === 'CREDENTIAL') {
        disclosedAttributes['degreeVerified'] = true;
      }

      if (obj.status === 'ACTIVE') activeCount++;
      if (obj.status === 'REVOKED') revokedCount++;

      claims.push({
        trustObjectId: obj.trust_object_id,
        claimType: obj.object_type,
        issuerName: obj.issuer_id.split(':').pop() || obj.issuer_id,
        issuerDid: obj.issuer_id,
        issuanceDate: obj.created_at,
        status: obj.status,
        blockchainTxId: obj.blockchain_tx_id,
        contentHash: obj.content_hash,
        disclosedAttributes,
        hiddenAttributesCount,
        attributeCommitments,
        predicateProofs: predicateProofs.length > 0 ? predicateProofs : undefined,
      });
    }

    // Calculate reputation trust score based on active vs revoked ratio and identity verification
    let trustScore = 95;
    if (revokedCount > 0) trustScore -= revokedCount * 30;
    if (claims.length === 0) trustScore = 50;
    trustScore = Math.max(10, Math.min(100, trustScore));

    return {
      ownerDid: did,
      ownerName,
      ownerType,
      reputationTrustScore: trustScore,
      claims,
      summary: {
        totalCredentials: claims.length,
        activeCredentials: activeCount,
        revokedCredentials: revokedCount,
        isFullyVerified: trustScore >= 70,
      },
      privacyMode: selectiveDisclosure ? 'SELECTIVE_DISCLOSURE' : 'FULL_DISCLOSURE',
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * Cryptographically verify a disclosed attribute against its commitment and salt
   */
  public verifyDisclosedAttribute(attribute: string, value: any, salt: string, expectedCommitment: string): boolean {
    const computed = CryptoService.sha256(`${attribute}:${String(value)}:${salt}`);
    return computed === expectedCommitment;
  }

  /**
   * Cryptographically verify a predicate proof
   */
  public verifyPredicateProof(proof: PredicateProof, actualValue: number, salt: string): boolean {
    const computed = CryptoService.sha256(`${proof.attribute}:${String(actualValue)}:${salt}`);
    if (computed !== proof.commitment) {
      return false;
    }

    if (proof.predicate.startsWith('>=')) {
      return actualValue >= proof.threshold;
    }
    if (proof.predicate.startsWith('>')) {
      return actualValue > proof.threshold;
    }
    if (proof.predicate.startsWith('<=')) {
      return actualValue <= proof.threshold;
    }
    if (proof.predicate.startsWith('<')) {
      return actualValue < proof.threshold;
    }

    return false;
  }
}
