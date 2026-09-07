import { DatabaseService } from '../../database/db.service.js';

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

      if (selectiveDisclosure) {
        // Privacy-preserving mode: reveal only non-sensitive cryptographic & credential assertions
        if (obj.object_type === 'CREDENTIAL') {
          disclosedAttributes = {
            degreeName: metadata.degreeName,
            institutionName: metadata.institutionName,
            graduationYear: metadata.graduationYear,
            degreeVerified: true,
          };
          hiddenAttributesCount = 3; // masks GPA, roll number, student address
        } else if (obj.object_type === 'PRODUCT') {
          disclosedAttributes = {
            productName: metadata.productName,
            batchNumber: metadata.batchNumber,
            complianceCert: metadata.complianceCert,
          };
          hiddenAttributesCount = 2; // masks internal cost, supplier breakdown
        } else {
          disclosedAttributes = {
            status: obj.status,
            objectType: obj.object_type,
          };
        }
      } else {
        disclosedAttributes = metadata;
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
}
