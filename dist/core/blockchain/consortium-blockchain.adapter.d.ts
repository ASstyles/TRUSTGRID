import { DatabaseService } from '../../database/db.service.js';
import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';
import { Block, BlockchainAdapter, BlockchainTransaction } from './blockchain.interface.js';
export declare class ConsortiumBlockchainAdapter implements BlockchainAdapter {
    readonly name = "Consortium Notary Ledger";
    readonly networkType: "CONSORTIUM_LEDGER";
    private db;
    private notaryDid;
    private notaryKeyPair;
    private blocks;
    private pendingTransactions;
    private currentHeight;
    constructor(db?: DatabaseService);
    private loadOrInitLedger;
    private initGenesisBlock;
    private mineBlock;
    registerProof(params: {
        trustObjectId: string;
        contentHash: string;
        issuerId: string;
        ownerId: string;
        status: TrustObjectStatus;
        signerDid: string;
        signature: string;
        payload?: Record<string, any>;
    }): Promise<BlockchainProof>;
    verifyProof(trustObjectId: string, expectedHash: string): Promise<{
        valid: boolean;
        proof: BlockchainProof | null;
        reason?: string;
    }>;
    revokeProof(params: {
        trustObjectId: string;
        reason: string;
        revokerDid: string;
        signature: string;
    }): Promise<BlockchainProof>;
    addProvenanceEvent(event: ProvenanceEvent): Promise<{
        txId: string;
        blockHeight: number;
        blockHash: string;
    }>;
    recordSecurityEvent(params: {
        eventId: string;
        trustObjectId: string;
        deviceId: string;
        eventType: string;
        severity: string;
        expectedHash: string;
        observedHash: string;
        description: string;
        reporterDid: string;
    }): Promise<{
        txId: string;
        blockHeight: number;
        blockHash: string;
    }>;
    getProof(trustObjectId: string): Promise<BlockchainProof | null>;
    getTransaction(txId: string): Promise<BlockchainTransaction | null>;
    getAuditLedger(): Promise<Block[]>;
    private getValidatorPublicKey;
    verifyLedgerIntegrity(): Promise<{
        valid: boolean;
        totalBlocks: number;
        verifiedTxs: number;
        reason?: string;
    }>;
}
