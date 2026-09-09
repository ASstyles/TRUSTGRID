import express, { Express, Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { LedgerNode, NodeStatus, NodeRole } from './node.js';
import {
  Block,
  BlockchainTransaction,
  EndorsementCertificate,
  EndorsementVote,
} from './blockchain.interface.js';
import { CryptoService } from '../crypto/crypto.service.js';

export interface ConsortiumNodeOptions {
  nodeId: string;
  name?: string;
  role?: NodeRole;
  port: number;
  peers: string[];
  dbPath?: string;
  keySeed?: string;
}

export interface LastConsensusDecision {
  action: 'PROPOSE' | 'VALIDATE' | 'COMMIT' | 'REJECT';
  outcome: 'COMMITTED' | 'REJECTED' | 'ABORTED';
  round?: number;
  blockHeight?: number;
  blockHash?: string;
  votesReceived?: number;
  votesRequired?: number;
  reason?: string;
  timestamp: string;
}

export class ConsortiumNode {
  public readonly nodeId: string;
  public readonly name: string;
  public readonly role: NodeRole;
  public readonly port: number;
  public peers: string[];
  public readonly ledgerNode: LedgerNode;

  private app: Express;
  private server: http.Server | null = null;
  private consensusStatus: 'IDLE' | 'VOTING' | 'COMMITTED' | 'REJECTED' = 'IDLE';
  private lastConsensusDecision: LastConsensusDecision | null = null;

  constructor(options: ConsortiumNodeOptions) {
    this.nodeId = options.nodeId;
    this.name = options.name || `Consortium Node (${options.nodeId})`;
    this.role = options.role || (options.nodeId === 'node-1' ? 'LEADER' : 'VALIDATOR');
    this.port = options.port;
    this.peers = options.peers;

    const seed = options.keySeed || `seed:trustgrid:consortium:${options.nodeId}`;
    const did = `did:trustgrid:node:${options.nodeId}`;

    // Resolve db path
    let resolvedDbPath: string | undefined = options.dbPath;
    if (!resolvedDbPath) {
      const dir = path.resolve(process.cwd(), 'data', 'nodes');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      resolvedDbPath = path.resolve(dir, `${options.nodeId}.db`);
    }

    this.ledgerNode = new LedgerNode({
      nodeId: options.nodeId,
      name: this.name,
      role: this.role,
      did,
      keySeed: seed,
      dbPath: resolvedDbPath,
    });

    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.json({ limit: '5mb' }));

    // 1. GET /status - Node identity, status, peers, and consensus status
    this.app.get('/status', (_req: Request, res: Response) => {
      const lastBlock = this.ledgerNode.getLastBlock();
      const status = this.ledgerNode.getStatus();
      return res.json({
        success: true,
        nodeId: this.nodeId,
        name: this.name,
        role: this.role,
        status,
        port: this.port,
        did: this.ledgerNode.did,
        publicKey: this.ledgerNode.keyPair.publicKey,
        currentHeight: this.ledgerNode.getHeight(),
        latestBlockHash: lastBlock ? lastBlock.blockHash : null,
        peerNodes: this.peers,
        peersCount: this.peers.length,
        validatorsCount: this.peers.length + 1,
        quorumRequired: Math.ceil(((this.peers.length + 1) * 2) / 3),
        consensusStatus: this.consensusStatus,
        lastConsensusDecision: this.lastConsensusDecision,
      });
    });

    // 2. GET /blocks - All local blocks
    this.app.get('/blocks', (_req: Request, res: Response) => {
      return res.json({
        success: true,
        nodeId: this.nodeId,
        height: this.ledgerNode.getHeight(),
        blocks: this.ledgerNode.getAllBlocks(),
      });
    });

    // 3. GET /blocks/:height - Specific block
    this.app.get('/blocks/:height', (req: Request, res: Response) => {
      const height = Number(req.params.height);
      const block = this.ledgerNode.getBlockByHeight(height);
      if (!block) {
        return res.status(404).json({ success: false, error: `Block at height ${height} not found` });
      }
      return res.json({ success: true, block });
    });

    // 4. GET /verify - Local cryptographic chain integrity
    this.app.get('/verify', (_req: Request, res: Response) => {
      const integrity = this.ledgerNode.verifyLocalChainIntegrity();
      return res.json({
        success: true,
        nodeId: this.nodeId,
        integrity,
      });
    });

    // 5. POST /propose - Propose candidate block, gossip to peers, achieve 2/3 majority, and commit
    this.app.post('/propose', async (req: Request, res: Response) => {
      if (this.ledgerNode.getStatus() !== 'ONLINE') {
        return res.status(503).json({
          success: false,
          error: `Cannot propose: Node ${this.nodeId} is ${this.ledgerNode.getStatus()}`,
        });
      }

      this.consensusStatus = 'VOTING';
      const round = Number(req.body.round) || 1;
      let transactions: BlockchainTransaction[] = req.body.transactions || [];

      // If empty transactions provided, create a sample demonstrator transaction
      if (transactions.length === 0) {
        const txId = `tx-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const contentHash = CryptoService.sha256(`demo-payload-${Date.now()}`);
        const timestamp = new Date().toISOString();
        const merkleLeaf = CryptoService.sha256(`${txId}:${contentHash}:${timestamp}`);
        const sig = CryptoService.sign(merkleLeaf, this.ledgerNode.keyPair.privateKey);

        transactions = [
          {
            txId,
            blockHeight: this.ledgerNode.getHeight() + 1,
            actionType: 'REGISTER_PROOF',
            trustObjectId: `TO-DEMO-${Date.now()}`,
            contentHash,
            signerDid: this.ledgerNode.did,
            notarySignature: sig,
            timestamp,
            merkleLeaf,
            payload: {
              issuerId: this.ledgerNode.did,
              ownerId: this.ledgerNode.did,
              status: 'ACTIVE',
              notes: req.body.notes || 'Consortium demonstration transaction',
            },
          },
        ];
      }

      // Step A: Create candidate block
      let candidateBlock: Block;
      try {
        candidateBlock = this.ledgerNode.proposeBlock(transactions, round);
      } catch (err: any) {
        this.consensusStatus = 'REJECTED';
        this.lastConsensusDecision = {
          action: 'PROPOSE',
          outcome: 'ABORTED',
          reason: err.message,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json({ success: false, error: err.message });
      }

      // Step B: Collect proposer's own vote
      const votes: EndorsementVote[] = [];
      const leaderVote = this.ledgerNode.signEndorsement(candidateBlock.blockHash, round);
      votes.push(leaderVote);

      // Step C: Gossip candidate block to all online peers for validation
      const clusterSize = this.peers.length + 1;
      const quorumRequired = Math.ceil((clusterSize * 2) / 3); // 2 out of 3
      const validationDetails: Array<{ peer: string; vote: 'APPROVE' | 'REJECT'; reason?: string }> = [];

      for (const peerUrl of this.peers) {
        try {
          const resp = await fetch(`${peerUrl}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidateBlock }),
            signal: AbortSignal.timeout(2500),
          });

          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (data.vote === 'APPROVE' && data.endorsementVote) {
              votes.push(data.endorsementVote);
              validationDetails.push({ peer: peerUrl, vote: 'APPROVE' });
            } else {
              validationDetails.push({ peer: peerUrl, vote: 'REJECT', reason: data.reason });
            }
          } else {
            const errData = (await resp.json().catch(() => ({}))) as any;
            validationDetails.push({ peer: peerUrl, vote: 'REJECT', reason: errData.reason || `HTTP ${resp.status}` });
          }
        } catch (err: any) {
          validationDetails.push({ peer: peerUrl, vote: 'REJECT', reason: `Peer unreachable: ${err.message}` });
        }
      }

      // Step D: Evaluate majority consensus
      if (votes.length < quorumRequired) {
        this.consensusStatus = 'REJECTED';
        this.lastConsensusDecision = {
          action: 'PROPOSE',
          outcome: 'REJECTED',
          round,
          blockHeight: candidateBlock.header.height,
          blockHash: candidateBlock.blockHash,
          votesReceived: votes.length,
          votesRequired: quorumRequired,
          reason: `Insufficient votes (${votes.length}/${quorumRequired})`,
          timestamp: new Date().toISOString(),
        };

        return res.status(400).json({
          success: false,
          consensusReached: false,
          error: `Consensus quorum failed: received ${votes.length} votes, required ${quorumRequired} for 2/3 majority`,
          votesReceived: votes.length,
          quorumRequired,
          validations: validationDetails,
        });
      }

      // Step E: Create Endorsement Certificate and commit
      const certificate: EndorsementCertificate = {
        blockHash: candidateBlock.blockHash,
        round,
        votes,
        quorumReached: true,
      };

      const committedBlock: Block = {
        ...candidateBlock,
        certificate,
      };

      // Proposer commits locally
      this.ledgerNode.commitBlock(committedBlock);
      const committedNodes: string[] = [this.nodeId];

      // Broadcast commit to all reachable peers
      for (const peerUrl of this.peers) {
        try {
          const resp = await fetch(`${peerUrl}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ block: committedBlock }),
            signal: AbortSignal.timeout(2500),
          });
          if (resp.ok) {
            const cData = (await resp.json()) as any;
            if (cData.success) {
              committedNodes.push(cData.nodeId || peerUrl);
            }
          }
        } catch {
          // Peer commit failed or offline
        }
      }

      this.consensusStatus = 'COMMITTED';
      this.lastConsensusDecision = {
        action: 'PROPOSE',
        outcome: 'COMMITTED',
        round,
        blockHeight: committedBlock.header.height,
        blockHash: committedBlock.blockHash,
        votesReceived: votes.length,
        votesRequired: quorumRequired,
        timestamp: new Date().toISOString(),
      };

      return res.json({
        success: true,
        consensusReached: true,
        message: `Block #${committedBlock.header.height} committed across ${committedNodes.length} nodes with ${votes.length}/${clusterSize} consensus majority`,
        block: committedBlock,
        blockHash: committedBlock.blockHash,
        height: committedBlock.header.height,
        votesReceived: votes.length,
        quorumRequired,
        committedNodes,
        validations: validationDetails,
      });
    });

    // 6. POST /validate - Validator peer independently validates candidate block
    this.app.post('/validate', (req: Request, res: Response) => {
      if (this.ledgerNode.getStatus() !== 'ONLINE') {
        return res.status(503).json({
          vote: 'REJECT',
          nodeId: this.nodeId,
          reason: `Node ${this.nodeId} is ${this.ledgerNode.getStatus()}`,
        });
      }

      const candidateBlock: Block = req.body.candidateBlock;
      if (!candidateBlock || !candidateBlock.header) {
        return res.status(400).json({
          vote: 'REJECT',
          nodeId: this.nodeId,
          reason: 'Missing candidateBlock in payload',
        });
      }

      // Independent cryptographic verification
      const verification = this.ledgerNode.verifyCandidateBlock(candidateBlock);
      if (!verification.valid) {
        this.lastConsensusDecision = {
          action: 'VALIDATE',
          outcome: 'REJECTED',
          blockHeight: candidateBlock.header.height,
          blockHash: candidateBlock.blockHash,
          reason: verification.reason,
          timestamp: new Date().toISOString(),
        };

        return res.status(400).json({
          vote: 'REJECT',
          nodeId: this.nodeId,
          reason: verification.reason,
        });
      }

      // Produce signed vote
      try {
        const endorsementVote = this.ledgerNode.signEndorsement(
          candidateBlock.blockHash,
          candidateBlock.header.round || 1
        );

        this.lastConsensusDecision = {
          action: 'VALIDATE',
          outcome: 'COMMITTED',
          blockHeight: candidateBlock.header.height,
          blockHash: candidateBlock.blockHash,
          timestamp: new Date().toISOString(),
        };

        return res.json({
          vote: 'APPROVE',
          nodeId: this.nodeId,
          endorsementVote,
        });
      } catch (err: any) {
        return res.status(500).json({
          vote: 'REJECT',
          nodeId: this.nodeId,
          reason: `Signing error: ${err.message}`,
        });
      }
    });

    // 7. POST /commit - Peer receives committed block with certificate and commits locally
    this.app.post('/commit', (req: Request, res: Response) => {
      if (this.ledgerNode.getStatus() !== 'ONLINE' && this.ledgerNode.getStatus() !== 'SYNCING') {
        return res.status(503).json({
          success: false,
          nodeId: this.nodeId,
          error: `Node ${this.nodeId} is ${this.ledgerNode.getStatus()}`,
        });
      }

      const block: Block = req.body.block;
      if (!block || !block.header) {
        return res.status(400).json({ success: false, error: 'Missing block in commit payload' });
      }

      // Verify certificate has >= 2 votes
      if (!block.certificate || !block.certificate.votes || block.certificate.votes.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Commit rejected: Certificate does not contain required majority endorsements',
        });
      }

      const committed = this.ledgerNode.commitBlock(block);
      if (!committed) {
        return res.status(500).json({
          success: false,
          nodeId: this.nodeId,
          error: 'Failed to write block to local SQLite ledger',
        });
      }

      this.consensusStatus = 'COMMITTED';
      this.lastConsensusDecision = {
        action: 'COMMIT',
        outcome: 'COMMITTED',
        blockHeight: block.header.height,
        blockHash: block.blockHash,
        timestamp: new Date().toISOString(),
      };

      return res.json({
        success: true,
        nodeId: this.nodeId,
        height: this.ledgerNode.getHeight(),
        blockHash: block.blockHash,
      });
    });

    // 8. POST /sync - Reconcile local ledger by fetching missing blocks from peers
    this.app.post('/sync', async (_req: Request, res: Response) => {
      const initialHeight = this.ledgerNode.getHeight();
      let bestPeerBlocks: Block[] = [];

      for (const peerUrl of this.peers) {
        try {
          const resp = await fetch(`${peerUrl}/blocks`, {
            signal: AbortSignal.timeout(2000),
          });
          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (data.blocks && data.blocks.length > bestPeerBlocks.length) {
              bestPeerBlocks = data.blocks;
            }
          }
        } catch {
          // Ignore offline peer
        }
      }

      if (bestPeerBlocks.length <= initialHeight + 1) {
        return res.json({
          success: true,
          nodeId: this.nodeId,
          message: 'Node is already at latest cluster height',
          height: initialHeight,
        });
      }

      const result = this.ledgerNode.reconcileChain(bestPeerBlocks);
      return res.json({
        success: result.success,
        nodeId: this.nodeId,
        initialHeight,
        syncedHeight: this.ledgerNode.getHeight(),
        syncedBlocks: result.syncedBlocks,
        error: result.error,
      });
    });

    // 9. POST /tamper - Deliberately tamper local block for demo testing
    this.app.post('/tamper', (req: Request, res: Response) => {
      const height = Number(req.body.height) || 1;
      try {
        this.ledgerNode.tamperBlock(height, {
          blockHash: req.body.blockHash || '0xdeadbeef_corrupted_hash',
          previousHash: req.body.previousHash,
          merkleRoot: req.body.merkleRoot,
          payloadMutation: req.body.payloadMutation || { tampered: true },
        });

        return res.json({
          success: true,
          nodeId: this.nodeId,
          message: `Block #${height} deliberately tampered on node ${this.nodeId}`,
          status: this.ledgerNode.getStatus(),
        });
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }
    });

    // 10. POST /status/toggle - Toggle node ONLINE/OFFLINE
    this.app.post('/status/toggle', (req: Request, res: Response) => {
      const newStatus: NodeStatus = req.body.status || (this.ledgerNode.getStatus() === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
      this.ledgerNode.setStatus(newStatus);
      return res.json({
        success: true,
        nodeId: this.nodeId,
        status: this.ledgerNode.getStatus(),
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        return resolve();
      }
      this.server = this.app.listen(this.port, () => {
        resolve();
      });
      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        this.ledgerNode.close();
        return resolve();
      }
      this.server.close(() => {
        this.server = null;
        this.ledgerNode.close();
        resolve();
      });
    });
  }

  public getStatus(): NodeStatus {
    return this.ledgerNode.getStatus();
  }

  public setStatus(status: NodeStatus): void {
    this.ledgerNode.setStatus(status);
  }
}
