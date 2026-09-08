import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';
import { Block, BlockchainAdapter, BlockchainTransaction } from './blockchain.interface.js';
export interface FabricConfig {
    peerEndpoint: string;
    channelName: string;
    chaincodeName: string;
    mspId: string;
    tlsCertPath?: string;
    clientCertPath?: string;
    clientKeyPath?: string;
}
export interface FabricConnectionStatus {
    connected: boolean;
    gatewayMode: 'EMULATED_GATEWAY' | 'LIVE_GRPC';
    endpoint: string;
    channel: string;
    chaincode: string;
    mspId: string;
    chaincodeContractReady: boolean;
}
/**
 * Enterprise Production Adapter for Hyperledger Fabric (v2.5+).
 *
 * Supports both:
 * 1. Live Fabric Gateway connectivity (via standard gRPC channel and MSP credentials).
 * 2. Emulated Fabric World State engine for deterministic development, SIH evaluation,
 *    and offline demonstrations with 100% cryptographic parity to trustgrid_cc.go.
 */
export declare class ProductionBlockchainAdapter implements BlockchainAdapter {
    readonly name = "Hyperledger Fabric Multi-Org Consortium";
    readonly networkType: "HYPERLEDGER_FABRIC";
    private config;
    private isLiveConnected;
    private worldState;
    private transactions;
    private blocks;
    private currentHeight;
    constructor(config?: Partial<FabricConfig>);
    private initGenesisBlock;
    getConnectionStatus(): FabricConnectionStatus;
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
    verifyLedgerIntegrity(): Promise<{
        valid: boolean;
        totalBlocks: number;
        verifiedTxs: number;
        reason?: string;
    }>;
}
