import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
import { ProvenanceEvent } from '../trust-object/trust-object.types.js';
export declare class ProvenanceService {
    private db;
    private blockchain;
    constructor(blockchain: BlockchainAdapter, db?: DatabaseService);
    /**
     * Records a certified custody handoff or state transition on-chain
     */
    transferCustody(params: {
        trustObjectId: string;
        fromDid: string;
        toDid: string;
        location: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
        actionDescription: string;
        metadata?: Record<string, any>;
    }): Promise<ProvenanceEvent>;
    /**
     * Verifies the continuity of a provenance chain
     */
    verifyChainContinuity(events: ProvenanceEvent[]): {
        isValid: boolean;
        brokenIndex?: number;
        reason?: string;
    };
}
