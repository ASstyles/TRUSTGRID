import { DatabaseService } from '../../database/db.service.js';
import { CryptoService, KeyPair } from '../crypto/crypto.service.js';
import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';
import { Block, BlockchainAdapter, BlockchainTransaction } from './blockchain.interface.js';
import { ConsortiumBlockchainAdapter } from './consortium-blockchain.adapter.js';

export interface LocalConsortiumConfig {
  leaderUrl?: string; // default http://localhost:4101
  validatorUrls?: string[]; // default [http://localhost:4102, http://localhost:4103]
}

export class LocalConsortiumBlockchainAdapter implements BlockchainAdapter {
  public readonly name = '3-Node Local Consortium Consensus Adapter';
  public readonly networkType = 'CONSORTIUM_LEDGER' as const;

  private leaderUrl: string;
  private validatorUrls: string[];
  private fallbackAdapter: ConsortiumBlockchainAdapter;
  private clusterAvailable: boolean = false;

  constructor(db?: DatabaseService, config?: LocalConsortiumConfig) {
    this.leaderUrl = config?.leaderUrl || process.env.CONSORTIUM_LEADER_URL || 'http://localhost:4101';
    this.validatorUrls = config?.validatorUrls || [
      'http://localhost:4102',
      'http://localhost:4103',
    ];
    this.fallbackAdapter = new ConsortiumBlockchainAdapter(db || DatabaseService.getInstance());
  }

  /**
   * Check if the independent 3-node HTTP cluster is currently active
   */
  public async checkClusterHealth(): Promise<{
    available: boolean;
    nodes: Array<{ url: string; online: boolean; height?: number; blockHash?: string }>;
  }> {
    const allUrls = [this.leaderUrl, ...this.validatorUrls];
    const nodeStatuses: Array<{ url: string; online: boolean; height?: number; blockHash?: string }> = [];

    let onlineCount = 0;
    for (const url of allUrls) {
      try {
        const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          nodeStatuses.push({
            url,
            online: true,
            height: data.currentHeight,
            blockHash: data.latestBlockHash,
          });
          onlineCount++;
        } else {
          nodeStatuses.push({ url, online: false });
        }
      } catch {
        nodeStatuses.push({ url, online: false });
      }
    }

    // Cluster is considered available if at least 2/3 nodes are responsive
    const quorumRequired = Math.ceil((allUrls.length * 2) / 3);
    this.clusterAvailable = onlineCount >= quorumRequired;

    return {
      available: this.clusterAvailable,
      nodes: nodeStatuses,
    };
  }

  public async registerProof(params: {
    trustObjectId: string;
    contentHash: string;
    issuerId: string;
    ownerId: string;
    status: TrustObjectStatus;
    signerDid: string;
    signature: string;
    payload?: Record<string, any>;
  }): Promise<BlockchainProof> {
    // If cluster is running, propose to node-1 (leader)
    const health = await this.checkClusterHealth();
    if (health.available) {
      try {
        const txId = `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const timestamp = new Date().toISOString();
        const merkleLeaf = CryptoService.sha256(`${txId}:${params.contentHash}:${timestamp}`);

        const tx: BlockchainTransaction = {
          txId,
          blockHeight: 0, // Assigned by proposer
          actionType: 'REGISTER_PROOF',
          trustObjectId: params.trustObjectId,
          contentHash: params.contentHash,
          signerDid: params.signerDid,
          notarySignature: params.signature,
          timestamp,
          merkleLeaf,
          payload: {
            issuerId: params.issuerId,
            ownerId: params.ownerId,
            status: params.status,
            ...(params.payload || {}),
          },
        };

        const res = await fetch(`${this.leaderUrl}/propose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: [tx], round: 1 }),
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const block = data.block;
          return {
            trustObjectId: params.trustObjectId,
            contentHash: params.contentHash,
            issuerId: params.issuerId,
            ownerId: params.ownerId,
            status: params.status,
            blockHeight: block.header.height,
            blockHash: block.blockHash,
            txId,
            timestamp,
            merkleLeaf,
            merkleRoot: block.header.merkleRoot,
            notarySignature: block.validatorSignature,
            previousBlockHash: block.header.previousHash,
            endorsementsCount: block.certificate?.votes?.length || data.votesReceived || 2,
            validatorSignatures: block.certificate?.votes?.map((v: any) => v.signature) || [block.validatorSignature],
          };
        }
      } catch {
        // Fallback to local embedded consortium adapter
      }
    }

    return this.fallbackAdapter.registerProof(params);
  }

  public async verifyProof(trustObjectId: string, expectedHash: string): Promise<{
    valid: boolean;
    proof: BlockchainProof | null;
    reason?: string;
  }> {
    const health = await this.checkClusterHealth();
    if (health.available) {
      try {
        // Query leader blocks for the proof
        const res = await fetch(`${this.leaderUrl}/blocks`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          const blocks: Block[] = data.blocks || [];

          for (let i = blocks.length - 1; i >= 0; i--) {
            const block = blocks[i];
            const tx = block.transactions.find((t) => t.trustObjectId === trustObjectId);
            if (tx) {
              const hashMatches = tx.contentHash === expectedHash;
              const proof: BlockchainProof = {
                trustObjectId: tx.trustObjectId,
                contentHash: tx.contentHash,
                issuerId: tx.payload.issuerId || tx.signerDid,
                ownerId: tx.payload.ownerId || tx.signerDid,
                status: tx.payload.status || 'ACTIVE',
                blockHeight: block.header.height,
                blockHash: block.blockHash,
                txId: tx.txId,
                timestamp: tx.timestamp,
                merkleLeaf: tx.merkleLeaf,
                merkleRoot: block.header.merkleRoot,
                notarySignature: tx.notarySignature,
                previousBlockHash: block.header.previousHash,
                endorsementsCount: block.certificate?.votes?.length || 1,
                validatorSignatures: block.certificate?.votes?.map((v) => v.signature) || [block.validatorSignature],
              };

              return {
                valid: hashMatches,
                proof,
                reason: hashMatches ? undefined : 'Proof content hash mismatch on consortium ledger',
              };
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    return this.fallbackAdapter.verifyProof(trustObjectId, expectedHash);
  }

  public async revokeProof(params: {
    trustObjectId: string;
    reason: string;
    revokerDid: string;
    signature: string;
  }): Promise<BlockchainProof> {
    return this.fallbackAdapter.revokeProof(params);
  }

  public async addProvenanceEvent(event: ProvenanceEvent): Promise<{
    txId: string;
    blockHeight: number;
    blockHash: string;
  }> {
    return this.fallbackAdapter.addProvenanceEvent(event);
  }

  public async recordSecurityEvent(params: {
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
  }> {
    return this.fallbackAdapter.recordSecurityEvent(params);
  }

  public async getProof(trustObjectId: string): Promise<BlockchainProof | null> {
    return this.fallbackAdapter.getProof(trustObjectId);
  }

  public async getTransaction(txId: string): Promise<BlockchainTransaction | null> {
    return this.fallbackAdapter.getTransaction(txId);
  }

  public async getAuditLedger(): Promise<Block[]> {
    const health = await this.checkClusterHealth();
    if (health.available) {
      try {
        const res = await fetch(`${this.leaderUrl}/blocks`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          return data.blocks || [];
        }
      } catch {
        // Fallback
      }
    }
    return this.fallbackAdapter.getAuditLedger();
  }

  public async verifyLedgerIntegrity(): Promise<{
    valid: boolean;
    totalBlocks: number;
    verifiedTxs: number;
    reason?: string;
  }> {
    const health = await this.checkClusterHealth();
    if (health.available) {
      try {
        const res = await fetch(`${this.leaderUrl}/verify`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          return data.integrity;
        }
      } catch {
        // Fallback
      }
    }
    return this.fallbackAdapter.verifyLedgerIntegrity();
  }
}
