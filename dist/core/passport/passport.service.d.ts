import { DatabaseService } from '../../database/db.service.js';
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
    reputationTrustScore: number;
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
export declare class TrustPassportService {
    private db;
    constructor(db?: DatabaseService);
    /**
     * Generates a privacy-preserving Trust Passport for any individual or organization DID
     * with cryptographic salted commitments and predicate assertions
     */
    generatePassport(did: string, selectiveDisclosure?: boolean): TrustPassport | null;
    /**
     * Cryptographically verify a disclosed attribute against its commitment and salt
     */
    verifyDisclosedAttribute(attribute: string, value: any, salt: string, expectedCommitment: string): boolean;
    /**
     * Cryptographically verify a predicate proof
     */
    verifyPredicateProof(proof: PredicateProof, actualValue: number, salt: string): boolean;
}
