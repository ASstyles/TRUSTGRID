import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';

export interface BlockHeader {
  height: number;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  validatorDid: string;
  txCount: number;
}

export interface Block {
  header: BlockHeader;
  blockHash: string;
  validatorSignature: string;
  transactions: BlockchainTransaction[];
}

export interface BlockchainTransaction {
  txId: string;
  blockHeight: number;
  blockHash?: string;
  actionType: 'REGISTER_PROOF' | 'RECORD_PROVENANCE' | 'REVOKE_PROOF' | 'UPDATE_STATUS';
  trustObjectId: string;
  contentHash: string;
  signerDid: string;
  notarySignature: string;
  timestamp: string;
  merkleLeaf: string;
  payload: Record<string, any>;
}

export interface BlockchainAdapter {
  name: string;
  networkType: 'CONSORTIUM_LEDGER' | 'HYPERLEDGER_FABRIC';
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
