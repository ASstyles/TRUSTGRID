import { LedgerNode } from './node.js';
import { PeerNetwork } from './network.js';
import {
  Block,
  BlockchainTransaction,
  EndorsementCertificate,
  EndorsementVote,
} from './blockchain.interface.js';
import { CryptoService } from '../crypto/crypto.service.js';

export interface ConsensusResult {
  success: boolean;
  block?: Block;
  certificate?: EndorsementCertificate;
  committedNodes: string[];
  votesReceived: number;
  quorumRequired: number;
  reason?: string;
}

export class PbftConsensusEngine {
  private network: PeerNetwork;
  private leaderNodeId: string;
  private quorumThreshold: number;

  constructor(network: PeerNetwork, leaderNodeId: string = 'node-alpha', quorumThreshold: number = 2) {
    this.network = network;
    this.leaderNodeId = leaderNodeId;
    this.quorumThreshold = quorumThreshold;
  }

  public getLeader(): LedgerNode | undefined {
    return this.network.getNode(this.leaderNodeId);
  }

  public setLeader(leaderNodeId: string): void {
    const node = this.network.getNode(leaderNodeId);
    if (!node) {
      throw new Error(`Node ${leaderNodeId} does not exist in network`);
    }
    this.leaderNodeId = leaderNodeId;
  }

  public getQuorumThreshold(): number {
    return this.quorumThreshold;
  }

  /**
   * Execute 3-Phase PBFT Consensus: Propose -> Endorse -> Commit
   */
  public async executeConsensus(
    transactions: BlockchainTransaction[],
    round: number = 1
  ): Promise<ConsensusResult> {
    const leader = this.getLeader();
    if (!leader || leader.getStatus() !== 'ONLINE') {
      return {
        success: false,
        committedNodes: [],
        votesReceived: 0,
        quorumRequired: this.quorumThreshold,
        reason: `Leader node [${this.leaderNodeId}] is OFFLINE or unavailable`,
      };
    }

    if (transactions.length === 0) {
      return {
        success: false,
        committedNodes: [],
        votesReceived: 0,
        quorumRequired: this.quorumThreshold,
        reason: 'Cannot execute consensus on empty transaction list',
      };
    }

    // PHASE 1: PROPOSE
    let candidateBlock: Block;
    try {
      candidateBlock = leader.proposeBlock(transactions, round);
    } catch (err: any) {
      return {
        success: false,
        committedNodes: [],
        votesReceived: 0,
        quorumRequired: this.quorumThreshold,
        reason: `Leader proposal error: ${err.message}`,
      };
    }

    // Collect leader's own vote
    const votes: EndorsementVote[] = [];
    try {
      const leaderVote = leader.signEndorsement(candidateBlock.blockHash, round);
      votes.push(leaderVote);
    } catch (err: any) {
      return {
        success: false,
        committedNodes: [],
        votesReceived: 0,
        quorumRequired: this.quorumThreshold,
        reason: `Leader signing error: ${err.message}`,
      };
    }

    // PHASE 2: PREPARE / ENDORSE
    const allNodes = this.network.getAllNodes();
    for (const peer of allNodes) {
      if (peer.nodeId === leader.nodeId) continue;
      if (peer.getStatus() !== 'ONLINE') continue;
      if (!this.network.canCommunicate(leader.nodeId, peer.nodeId)) continue;

      // Validator verifies candidate block
      const verification = peer.verifyCandidateBlock(candidateBlock);
      if (!verification.valid) {
        continue;
      }

      // Validator produces signed vote
      try {
        const vote = peer.signEndorsement(candidateBlock.blockHash, round);
        // Verify vote signature cryptographically
        const isSigValid = CryptoService.verify(vote.blockHash, vote.signature, peer.keyPair.publicKey);
        if (isSigValid) {
          votes.push(vote);
        }
      } catch {
        // Validator failed to vote
      }
    }

    // CHECK QUORUM
    if (votes.length < this.quorumThreshold) {
      return {
        success: false,
        committedNodes: [],
        votesReceived: votes.length,
        quorumRequired: this.quorumThreshold,
        reason: `Consensus quorum failed: received ${votes.length} votes, required ${this.quorumThreshold}`,
      };
    }

    // Form Endorsement Certificate
    const certificate: EndorsementCertificate = {
      blockHash: candidateBlock.blockHash,
      round,
      votes,
      quorumReached: true,
    };

    const finalBlock: Block = {
      ...candidateBlock,
      certificate,
    };

    // PHASE 3: COMMIT
    const committedNodes: string[] = [];

    // Leader commits first
    const leaderCommitted = leader.commitBlock(finalBlock);
    if (leaderCommitted) {
      committedNodes.push(leader.nodeId);
    }

    // Broadcast commit to all reachable peers
    const commitResults = await this.network.broadcastCommit(leader.nodeId, finalBlock);
    for (const [nodeId, committed] of commitResults.entries()) {
      if (committed && !committedNodes.includes(nodeId)) {
        committedNodes.push(nodeId);
      }
    }

    return {
      success: true,
      block: finalBlock,
      certificate,
      committedNodes,
      votesReceived: votes.length,
      quorumRequired: this.quorumThreshold,
    };
  }
}
