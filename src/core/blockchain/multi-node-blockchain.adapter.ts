import { DatabaseService } from '../../database/db.service.js';
import { CryptoService, KeyPair } from '../crypto/crypto.service.js';
import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';
import { Block, BlockchainAdapter, BlockchainTransaction } from './blockchain.interface.js';
import { LedgerNode } from './node.js';
import { PeerNetwork } from './network.js';
import { PbftConsensusEngine } from './consensus.service.js';
import { WalletService } from '../identity/wallet.service.js';

export interface ClusterNodeInfo {
  nodeId: string;
  name: string;
  role: 'LEADER' | 'VALIDATOR';
  did: string;
  publicKey: string;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'CORRUPTED';
  height: number;
  lastBlockHash: string;
  isLeader: boolean;
}

export interface CrossNodeAuditReport {
  consistent: boolean;
  clusterHeight: number;
  quorumReachable: boolean;
  totalNodes: number;
  onlineNodes: number;
  divergedNodes: string[];
  nodeReports: Array<{
    nodeId: string;
    role: string;
    height: number;
    lastBlockHash: string;
    status: string;
    intact: boolean;
    error?: string;
  }>;
}

export class MultiNodeBlockchainAdapter implements BlockchainAdapter {
  public readonly name = 'PBFT Multi-Node Consortium Ledger';
  public readonly networkType = 'CONSORTIUM_LEDGER' as const;

  private db: DatabaseService;
  private network: PeerNetwork;
  private consensusEngine: PbftConsensusEngine;
  private notaryDid = 'did:trustgrid:sys:consortium-notary';
  private notaryKeyPair: KeyPair;

  // 3 Consortium Nodes
  private alphaNode: LedgerNode;
  private betaNode: LedgerNode;
  private gammaNode: LedgerNode;

  constructor(db?: DatabaseService, memoryStorage: boolean = false) {
    this.db = db || DatabaseService.getInstance();
    this.network = new PeerNetwork();

    // Ensure persistent notary key for system compatibility
    const existingKey = WalletService.getKeyPair(this.notaryDid, this.db);
    if (existingKey) {
      this.notaryKeyPair = existingKey;
    } else {
      this.notaryKeyPair = CryptoService.generateDeterministicEd25519KeyPair(`notary-seed:${this.notaryDid}`);
      WalletService.storeKeyPair(this.notaryDid, this.notaryKeyPair, this.db);
    }

    // Initialize 3 independent nodes with isolated storage
    const storageMode = memoryStorage ? ':memory:' : undefined;

    this.alphaNode = new LedgerNode({
      nodeId: 'node-alpha',
      name: 'Alpha (Consortium Leader)',
      role: 'LEADER',
      did: 'did:trustgrid:node:alpha',
      keySeed: 'seed:trustgrid:node:alpha',
      dbPath: storageMode,
    });

    this.betaNode = new LedgerNode({
      nodeId: 'node-beta',
      name: 'Beta (Customs & Logistics Validator)',
      role: 'VALIDATOR',
      did: 'did:trustgrid:node:beta',
      keySeed: 'seed:trustgrid:node:beta',
      dbPath: storageMode,
    });

    this.gammaNode = new LedgerNode({
      nodeId: 'node-gamma',
      name: 'Gamma (Judiciary & Audit Validator)',
      role: 'VALIDATOR',
      did: 'did:trustgrid:node:gamma',
      keySeed: 'seed:trustgrid:node:gamma',
      dbPath: storageMode,
    });

    this.network.registerNode(this.alphaNode);
    this.network.registerNode(this.betaNode);
    this.network.registerNode(this.gammaNode);

    // PBFT Consensus Engine (Quorum = 2 of 3)
    this.consensusEngine = new PbftConsensusEngine(this.network, 'node-alpha', 2);

    // Register node identities in main db for DID lookup
    this.registerNodeIdentities();
  }

  private registerNodeIdentities(): void {
    const nodes = [this.alphaNode, this.betaNode, this.gammaNode];
    for (const node of nodes) {
      const existing = this.db.getOne<any>('SELECT * FROM identities WHERE did = ?', [node.did]);
      if (!existing) {
        this.db.run(
          `INSERT INTO identities 
           (did, entity_type, controller_did, public_key, key_type, verification_method, authentication_methods, service_endpoints, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            node.did,
            'SERVICE',
            node.did,
            node.keyPair.publicKey,
            'Ed25519VerificationKey2020',
            `${node.did}#key-1`,
            JSON.stringify([`${node.did}#key-1`]),
            JSON.stringify({}),
            new Date().toISOString(),
          ]
        );
      }
    }
  }

  public getNetwork(): PeerNetwork {
    return this.network;
  }

  public getConsensusEngine(): PbftConsensusEngine {
    return this.consensusEngine;
  }

  public getNodes(): ClusterNodeInfo[] {
    return [this.alphaNode, this.betaNode, this.gammaNode].map((node) => {
      const lastBlock = node.getLastBlock();
      return {
        nodeId: node.nodeId,
        name: node.name,
        role: node.role,
        did: node.did,
        publicKey: node.keyPair.publicKey,
        status: node.getStatus(),
        height: node.getHeight(),
        lastBlockHash: lastBlock ? lastBlock.blockHash : '',
        isLeader: node.nodeId === this.alphaNode.nodeId,
      };
    });
  }

  public getNode(nodeId: string): LedgerNode | undefined {
    return this.network.getNode(nodeId);
  }

  public failNode(nodeId: string): { success: boolean; nodeId: string; status: string } {
    const node = this.network.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    node.setStatus('OFFLINE');
    return { success: true, nodeId, status: 'OFFLINE' };
  }

  public recoverNode(nodeId: string): { success: boolean; nodeId: string; status: string; syncedBlocks: number } {
    const node = this.network.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    node.setStatus('ONLINE');
    const syncResult = this.syncNode(nodeId);
    return { success: true, nodeId, status: 'ONLINE', syncedBlocks: syncResult.syncedBlocks };
  }

  public syncNode(nodeId: string): { success: boolean; nodeId: string; syncedBlocks: number; error?: string } {
    const targetNode = this.network.getNode(nodeId);
    if (!targetNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Find healthy peer with highest block height
    const healthyPeers = [this.alphaNode, this.betaNode, this.gammaNode]
      .filter((n) => n.nodeId !== nodeId && n.getStatus() === 'ONLINE')
      .sort((a, b) => b.getHeight() - a.getHeight());

    if (healthyPeers.length === 0) {
      return { success: false, nodeId, syncedBlocks: 0, error: 'No online healthy peers to sync from' };
    }

    const peer = healthyPeers[0];
    const peerBlocks = peer.getAllBlocks();
    const result = targetNode.reconcileChain(peerBlocks);

    return {
      success: result.success,
      nodeId,
      syncedBlocks: result.syncedBlocks,
      error: result.error,
    };
  }

  public tamperNode(
    nodeId: string,
    height: number,
    mutations: {
      blockHash?: string;
      previousHash?: string;
      merkleRoot?: string;
      validatorSignature?: string;
      payloadMutation?: any;
    }
  ): { success: boolean; nodeId: string; height: number } {
    const node = this.network.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.tamperBlock(height, mutations);
    return { success: true, nodeId, height };
  }

  public verifyCrossNodeLedger(): CrossNodeAuditReport {
    const nodes = [this.alphaNode, this.betaNode, this.gammaNode];
    const nodeReports = nodes.map((node) => {
      const integrity = node.verifyLocalChainIntegrity();
      const lastBlock = node.getLastBlock();
      return {
        nodeId: node.nodeId,
        role: node.role,
        height: node.getHeight(),
        lastBlockHash: lastBlock ? lastBlock.blockHash : '',
        status: node.getStatus(),
        intact: integrity.valid,
        error: integrity.reason,
      };
    });

    const onlineNodes = nodes.filter((n) => n.getStatus() === 'ONLINE');
    const quorumReachable = onlineNodes.length >= 2;

    // Compare block hashes against leader / majority
    const leaderReport = nodeReports.find((r) => r.nodeId === this.alphaNode.nodeId);
    const expectedHash = leaderReport?.lastBlockHash || '';
    const divergedNodes: string[] = [];

    for (const report of nodeReports) {
      if (!report.intact || report.status === 'CORRUPTED') {
        divergedNodes.push(report.nodeId);
      } else if (report.lastBlockHash !== expectedHash || report.status === 'OFFLINE') {
        divergedNodes.push(report.nodeId);
      }
    }

    const consistent = divergedNodes.length === 0 && quorumReachable && onlineNodes.length === nodes.length;

    return {
      consistent,
      clusterHeight: this.alphaNode.getHeight(),
      quorumReachable,
      totalNodes: nodes.length,
      onlineNodes: onlineNodes.length,
      divergedNodes,
      nodeReports,
    };
  }

  // --- BlockchainAdapter Implementation ---

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
    const timestamp = new Date().toISOString();
    const txId = `tx-${CryptoService.sha256(`${params.trustObjectId}:${timestamp}:${Math.random()}`).substring(0, 16)}`;
    const merkleLeaf = CryptoService.sha256(`${txId}:${params.contentHash}:${timestamp}`);

    const tx: BlockchainTransaction = {
      txId,
      blockHeight: 0,
      actionType: 'REGISTER_PROOF',
      trustObjectId: params.trustObjectId,
      contentHash: params.contentHash,
      signerDid: params.signerDid,
      notarySignature: CryptoService.sign(`${txId}:${params.contentHash}`, this.notaryKeyPair.privateKey),
      timestamp,
      merkleLeaf,
      payload: {
        trustObjectId: params.trustObjectId,
        contentHash: params.contentHash,
        issuerId: params.issuerId,
        ownerId: params.ownerId,
        status: params.status,
        signerDid: params.signerDid,
        signature: params.signature,
        ...(params.payload || {}),
      },
    };

    // Execute PBFT consensus across Alpha, Beta, Gamma
    const consensusResult = await this.consensusEngine.executeConsensus([tx]);
    if (!consensusResult.success || !consensusResult.block) {
      throw new Error(`Consensus failed for registerProof: ${consensusResult.reason}`);
    }

    const block = consensusResult.block;

    // Mirror block to main database for backward compatibility with existing tests
    this.mirrorBlockToMainDb(block);

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
      notarySignature: tx.notarySignature,
      previousBlockHash: block.header.previousHash,
      endorsementsCount: block.certificate?.votes.length || 1,
      validatorSignatures: block.certificate?.votes.map((v) => v.signature) || [block.validatorSignature],
    };
  }

  public async verifyProof(
    trustObjectId: string,
    expectedHash: string
  ): Promise<{ valid: boolean; proof: BlockchainProof | null; reason?: string }> {
    const proof = await this.getProof(trustObjectId);
    if (!proof) {
      return { valid: false, proof: null, reason: 'Proof not registered on ledger' };
    }

    if (proof.contentHash !== expectedHash) {
      return {
        valid: false,
        proof,
        reason: `Cryptographic content hash mismatch: registered ${proof.contentHash} != presented ${expectedHash}`,
      };
    }

    if (proof.status === 'REVOKED') {
      return { valid: false, proof, reason: 'Proof is explicitly marked REVOKED on ledger' };
    }

    return { valid: true, proof };
  }

  public async revokeProof(params: {
    trustObjectId: string;
    reason: string;
    revokerDid: string;
    signature: string;
  }): Promise<BlockchainProof> {
    const existingProof = await this.getProof(params.trustObjectId);
    if (!existingProof) {
      throw new Error(`Cannot revoke: proof for ${params.trustObjectId} not found`);
    }

    const timestamp = new Date().toISOString();
    const txId = `tx-revoke-${CryptoService.sha256(`${params.trustObjectId}:${timestamp}`).substring(0, 16)}`;
    const merkleLeaf = CryptoService.sha256(`${txId}:REVOKED:${timestamp}`);

    const tx: BlockchainTransaction = {
      txId,
      blockHeight: 0,
      actionType: 'REVOKE_PROOF',
      trustObjectId: params.trustObjectId,
      contentHash: existingProof.contentHash,
      signerDid: params.revokerDid,
      notarySignature: CryptoService.sign(`${txId}:REVOKED`, this.notaryKeyPair.privateKey),
      timestamp,
      merkleLeaf,
      payload: {
        trustObjectId: params.trustObjectId,
        status: 'REVOKED' as TrustObjectStatus,
        reason: params.reason,
        revokerDid: params.revokerDid,
        signature: params.signature,
      },
    };

    const consensusResult = await this.consensusEngine.executeConsensus([tx]);
    if (!consensusResult.success || !consensusResult.block) {
      throw new Error(`Consensus failed for revokeProof: ${consensusResult.reason}`);
    }

    const block = consensusResult.block;
    this.mirrorBlockToMainDb(block);

    return {
      ...existingProof,
      status: 'REVOKED',
      blockHeight: block.header.height,
      blockHash: block.blockHash,
      txId,
      timestamp,
      merkleLeaf,
      merkleRoot: block.header.merkleRoot,
      previousBlockHash: block.header.previousHash,
      endorsementsCount: block.certificate?.votes.length || 1,
      validatorSignatures: block.certificate?.votes.map((v) => v.signature) || [block.validatorSignature],
    };
  }

  public async addProvenanceEvent(event: ProvenanceEvent): Promise<{ txId: string; blockHeight: number; blockHash: string }> {
    const timestamp = new Date().toISOString();
    const txId = `tx-prov-${CryptoService.sha256(`${event.eventId}:${timestamp}`).substring(0, 16)}`;
    const contentHash = CryptoService.sha256(CryptoService.canonicalStringify(event));
    const merkleLeaf = CryptoService.sha256(`${txId}:${contentHash}:${timestamp}`);

    const tx: BlockchainTransaction = {
      txId,
      blockHeight: 0,
      actionType: 'RECORD_PROVENANCE',
      trustObjectId: event.trustObjectId,
      contentHash,
      signerDid: event.fromDid || this.notaryDid,
      notarySignature: CryptoService.sign(`${txId}:${contentHash}`, this.notaryKeyPair.privateKey),
      timestamp,
      merkleLeaf,
      payload: event,
    };

    const consensusResult = await this.consensusEngine.executeConsensus([tx]);
    if (!consensusResult.success || !consensusResult.block) {
      throw new Error(`Consensus failed for addProvenanceEvent: ${consensusResult.reason}`);
    }

    const block = consensusResult.block;
    this.mirrorBlockToMainDb(block);

    return {
      txId,
      blockHeight: block.header.height,
      blockHash: block.blockHash,
    };
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
  }): Promise<{ txId: string; blockHeight: number; blockHash: string }> {
    const timestamp = new Date().toISOString();
    const txId = `tx-sec-${CryptoService.sha256(`${params.eventId}:${timestamp}`).substring(0, 16)}`;
    const contentHash = CryptoService.sha256(CryptoService.canonicalStringify(params));
    const merkleLeaf = CryptoService.sha256(`${txId}:${contentHash}:${timestamp}`);

    const tx: BlockchainTransaction = {
      txId,
      blockHeight: 0,
      actionType: 'SECURITY_ALERT',
      trustObjectId: params.trustObjectId,
      contentHash,
      signerDid: params.reporterDid,
      notarySignature: CryptoService.sign(`${txId}:${contentHash}`, this.notaryKeyPair.privateKey),
      timestamp,
      merkleLeaf,
      payload: params,
    };

    const consensusResult = await this.consensusEngine.executeConsensus([tx]);
    if (!consensusResult.success || !consensusResult.block) {
      throw new Error(`Consensus failed for recordSecurityEvent: ${consensusResult.reason}`);
    }

    const block = consensusResult.block;
    this.mirrorBlockToMainDb(block);

    return {
      txId,
      blockHeight: block.header.height,
      blockHash: block.blockHash,
    };
  }

  public async getProof(trustObjectId: string): Promise<BlockchainProof | null> {
    // Primary query from Alpha leader node
    return this.alphaNode.getProof(trustObjectId);
  }

  public async getTransaction(txId: string): Promise<BlockchainTransaction | null> {
    return this.alphaNode.getTransaction(txId);
  }

  public async getAuditLedger(): Promise<Block[]> {
    return this.alphaNode.getAllBlocks();
  }

  public async verifyLedgerIntegrity(): Promise<{
    valid: boolean;
    totalBlocks: number;
    verifiedTxs: number;
    reason?: string;
  }> {
    return this.alphaNode.verifyLocalChainIntegrity();
  }

  private mirrorBlockToMainDb(_block: Block): void {
    // Isolated multi-node cluster stores blocks in local node tables (local_blocks / local_transactions)
  }

  public close(): void {
    this.alphaNode.close();
    this.betaNode.close();
    this.gammaNode.close();
  }
}
