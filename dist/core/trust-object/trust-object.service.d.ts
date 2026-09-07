import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
import { DidService } from '../identity/did.service.js';
import { TrustObject, TrustObjectType } from './trust-object.types.js';
export declare class TrustObjectService {
    private db;
    private blockchain;
    private didService;
    constructor(blockchain: BlockchainAdapter, db?: DatabaseService, didService?: DidService);
    /**
     * Creates, signs, anchors, and persists a Trust Object under the Trust Object Protocol (TOP)
     */
    createTrustObject<T = any>(params: {
        objectType: TrustObjectType;
        subjectId: string;
        issuerId: string;
        ownerId?: string;
        metadata: T;
        offChainData?: Record<string, any>;
        expiresAt?: string | null;
        customId?: string;
    }): Promise<TrustObject<T>>;
    /**
     * Retrieves a Trust Object by ID with full provenance history
     */
    getTrustObject(trustObjectId: string): Promise<TrustObject | null>;
    /**
     * Tamper simulation utility for testing and live SIH demonstrations
     * Modifies off-chain metadata attributes in the DB without updating blockchain proof
     */
    simulateTamper(trustObjectId: string, modifiedMetadata: Record<string, any>): void;
}
