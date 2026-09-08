import { LedgerNode } from './node.js';
import { Block, EndorsementVote } from './blockchain.interface.js';

export interface NetworkMessage<T = any> {
  fromNodeId: string;
  toNodeId: string;
  type: 'PROPOSE' | 'ENDORSE' | 'COMMIT' | 'SYNC_REQ' | 'SYNC_RES';
  payload: T;
  timestamp: string;
}

export class PeerNetwork {
  private nodes: Map<string, LedgerNode> = new Map();
  private isolatedNodes: Set<string> = new Set();
  private partitions: Array<Set<string>> = [];
  private simulatedLatencyMs: number = 0;

  public registerNode(node: LedgerNode): void {
    this.nodes.set(node.nodeId, node);
  }

  public unregisterNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.isolatedNodes.delete(nodeId);
  }

  public getNode(nodeId: string): LedgerNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getAllNodes(): LedgerNode[] {
    return Array.from(this.nodes.values());
  }

  public setLatency(ms: number): void {
    this.simulatedLatencyMs = Math.max(0, ms);
  }

  public isolateNode(nodeId: string): void {
    this.isolatedNodes.add(nodeId);
  }

  public reconnectNode(nodeId: string): void {
    this.isolatedNodes.delete(nodeId);
  }

  public partition(groupA: string[], groupB: string[]): void {
    this.partitions = [new Set(groupA), new Set(groupB)];
  }

  public healPartition(): void {
    this.partitions = [];
  }

  public canCommunicate(fromId: string, toId: string): boolean {
    if (this.isolatedNodes.has(fromId) || this.isolatedNodes.has(toId)) {
      return false;
    }

    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) return false;
    if (fromNode.getStatus() === 'OFFLINE' || toNode.getStatus() === 'OFFLINE') return false;

    if (this.partitions.length > 0) {
      const fromGroup = this.partitions.findIndex((p) => p.has(fromId));
      const toGroup = this.partitions.findIndex((p) => p.has(toId));
      if (fromGroup !== -1 && toGroup !== -1 && fromGroup !== toGroup) {
        return false;
      }
    }

    return true;
  }

  private async applyLatency(): Promise<void> {
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }
  }

  /**
   * Broadcast a candidate block proposal to all peers
   */
  public async broadcastProposal(fromNodeId: string, candidate: Block): Promise<Map<string, boolean>> {
    await this.applyLatency();
    const results = new Map<string, boolean>();

    for (const [peerId, peer] of this.nodes.entries()) {
      if (peerId === fromNodeId) continue;
      if (!this.canCommunicate(fromNodeId, peerId)) {
        results.set(peerId, false);
        continue;
      }

      const verification = peer.verifyCandidateBlock(candidate);
      results.set(peerId, verification.valid);
    }

    return results;
  }

  /**
   * Send endorsement vote to leader
   */
  public async sendVote(fromNodeId: string, toNodeId: string, vote: EndorsementVote): Promise<boolean> {
    await this.applyLatency();
    if (!this.canCommunicate(fromNodeId, toNodeId)) {
      return false;
    }
    return true;
  }

  /**
   * Broadcast committed block with certificate to all online nodes
   */
  public async broadcastCommit(fromNodeId: string, block: Block): Promise<Map<string, boolean>> {
    await this.applyLatency();
    const results = new Map<string, boolean>();

    for (const [peerId, peer] of this.nodes.entries()) {
      if (peerId === fromNodeId) {
        results.set(peerId, true);
        continue;
      }

      if (!this.canCommunicate(fromNodeId, peerId)) {
        results.set(peerId, false);
        continue;
      }

      const committed = peer.commitBlock(block);
      results.set(peerId, committed);
    }

    return results;
  }

  /**
   * Request blocks for synchronization from a peer
   */
  public requestBlocks(targetNodeId: string, startHeight: number): Block[] {
    const peer = this.nodes.get(targetNodeId);
    if (!peer || peer.getStatus() === 'OFFLINE' || peer.getStatus() === 'CORRUPTED') {
      return [];
    }

    const allBlocks = peer.getAllBlocks();
    return allBlocks.filter((b) => b.header.height >= startHeight);
  }
}
