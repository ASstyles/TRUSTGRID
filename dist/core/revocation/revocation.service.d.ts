import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
export interface RevocationRecord {
    trustObjectId: string;
    revokedByDid: string;
    revocationReason: string;
    revocationProof: string;
    blockchainTxId: string;
    revokedAt: string;
}
export declare class RevocationService {
    private db;
    private blockchain;
    constructor(blockchain: BlockchainAdapter, db?: DatabaseService);
    /**
     * Cryptographically revokes a Trust Object on the blockchain trust ledger
     */
    revokeTrustObject(params: {
        trustObjectId: string;
        revokerDid: string;
        reason: string;
    }): Promise<RevocationRecord>;
    /**
     * Checks if an object has been revoked
     */
    getRevocationStatus(trustObjectId: string): RevocationRecord | null;
}
