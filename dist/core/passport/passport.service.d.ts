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
     */
    generatePassport(did: string, selectiveDisclosure?: boolean): TrustPassport | null;
}
