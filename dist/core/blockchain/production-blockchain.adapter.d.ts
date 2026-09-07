import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';
import { Block, BlockchainAdapter, BlockchainTransaction } from './blockchain.interface.js';
export interface FabricConfig {
    peerEndpoint: string;
    channelName: string;
    chaincodeName: string;
    mspId: string;
    tlsCertPath?: string;
}
/**
 * Production adapter for Hyperledger Fabric permissioned networks.
 * Uses identical BlockchainAdapter contract to ensure zero-refactor enterprise production readiness.
 */
export declare class ProductionBlockchainAdapter implements BlockchainAdapter {
    readonly name = "Hyperledger Fabric Multi-Org Network";
    readonly networkType: "HYPERLEDGER_FABRIC";
    private config;
    constructor(config?: Partial<FabricConfig>);
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
    getProof(trustObjectId: string): Promise<BlockchainProof | null>;
    getTransaction(txId: string): Promise<BlockchainTransaction | null>;
    getAuditLedger(): Promise<Block[]>;
    verifyLedgerIntegrity(): Promise<{
        valid: boolean;
        totalBlocks: number;
        verifiedTxs: number;
        reason?: string;
    }>;
}
