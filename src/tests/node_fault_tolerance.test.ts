import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { MultiNodeBlockchainAdapter } from '../core/blockchain/multi-node-blockchain.adapter.js';

describe('Node Fault Tolerance & Synchronization Tests', () => {
  let adapter: MultiNodeBlockchainAdapter;

  before(() => {
    // In-memory isolated storage for testing
    adapter = new MultiNodeBlockchainAdapter(undefined, true);
  });

  after(() => {
    adapter.close();
  });

  it('1. Cluster initializes with 3 ONLINE nodes at height 0', () => {
    const nodes = adapter.getNodes();
    assert.strictEqual(nodes.length, 3);
    for (const node of nodes) {
      assert.strictEqual(node.status, 'ONLINE');
      assert.strictEqual(node.height, 0);
    }
  });

  it('2. registerProof executes PBFT consensus and anchors proof across cluster', async () => {
    const proof = await adapter.registerProof({
      trustObjectId: 'TO-TEST-001',
      contentHash: 'hash-content-001',
      issuerId: 'did:trustgrid:org:univ',
      ownerId: 'did:trustgrid:user:alice',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:univ',
      signature: 'sig-001',
    });

    assert.ok(proof);
    assert.strictEqual(proof.blockHeight, 1);
    assert.strictEqual(proof.trustObjectId, 'TO-TEST-001');

    const nodes = adapter.getNodes();
    assert.strictEqual(nodes[0].height, 1);
    assert.strictEqual(nodes[1].height, 1);
    assert.strictEqual(nodes[2].height, 1);
  });

  it('3. failNode marks target node as OFFLINE', () => {
    const res = adapter.failNode('node-beta');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'OFFLINE');

    const beta = adapter.getNode('node-beta');
    assert.strictEqual(beta?.getStatus(), 'OFFLINE');
  });

  it('4. Ledger proceeds when Node Beta is OFFLINE (Quorum = Alpha + Gamma)', async () => {
    const proof = await adapter.registerProof({
      trustObjectId: 'TO-TEST-002',
      contentHash: 'hash-content-002',
      issuerId: 'did:trustgrid:org:univ',
      ownerId: 'did:trustgrid:user:bob',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:univ',
      signature: 'sig-002',
    });

    assert.strictEqual(proof.blockHeight, 2);

    const alpha = adapter.getNode('node-alpha');
    const beta = adapter.getNode('node-beta');
    const gamma = adapter.getNode('node-gamma');

    assert.strictEqual(alpha?.getHeight(), 2);
    assert.strictEqual(gamma?.getHeight(), 2);
    // Beta was offline so remains at height 1
    assert.strictEqual(beta?.getHeight(), 1);
  });

  it('5. Second block anchored while Beta is still down', async () => {
    const proof = await adapter.registerProof({
      trustObjectId: 'TO-TEST-003',
      contentHash: 'hash-content-003',
      issuerId: 'did:trustgrid:org:univ',
      ownerId: 'did:trustgrid:user:charlie',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:univ',
      signature: 'sig-003',
    });

    assert.strictEqual(proof.blockHeight, 3);
    assert.strictEqual(adapter.getNode('node-alpha')?.getHeight(), 3);
    assert.strictEqual(adapter.getNode('node-beta')?.getHeight(), 1);
  });

  it('6. Cross-node audit detects that Node Beta is behind / diverged', () => {
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, false);
    assert.ok(audit.divergedNodes.includes('node-beta'));
    assert.strictEqual(audit.onlineNodes, 2);
    assert.strictEqual(audit.quorumReachable, true);
  });

  it('7. recoverNode brings Beta back ONLINE and auto-syncs missing blocks', () => {
    const res = adapter.recoverNode('node-beta');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'ONLINE');
    assert.ok(res.syncedBlocks >= 2);

    const beta = adapter.getNode('node-beta');
    assert.strictEqual(beta?.getStatus(), 'ONLINE');
    assert.strictEqual(beta?.getHeight(), 3);
  });

  it('8. Cross-node audit passes after Node Beta recovery', () => {
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, true);
    assert.strictEqual(audit.divergedNodes.length, 0);
    assert.strictEqual(audit.onlineNodes, 3);
  });

  it('9. Network partition prevents isolated node from voting', async () => {
    const network = adapter.getNetwork();
    // Partition Gamma into separate network group
    network.partition(['node-alpha', 'node-beta'], ['node-gamma']);

    assert.strictEqual(network.canCommunicate('node-alpha', 'node-gamma'), false);
    assert.strictEqual(network.canCommunicate('node-alpha', 'node-beta'), true);

    // Alpha + Beta can still commit (2 nodes >= quorum 2)
    const proof = await adapter.registerProof({
      trustObjectId: 'TO-TEST-004',
      contentHash: 'hash-content-004',
      issuerId: 'did:trustgrid:org:univ',
      ownerId: 'did:trustgrid:user:dave',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:univ',
      signature: 'sig-004',
    });

    assert.strictEqual(proof.blockHeight, 4);
    assert.strictEqual(adapter.getNode('node-alpha')?.getHeight(), 4);
    assert.strictEqual(adapter.getNode('node-gamma')?.getHeight(), 3);

    // Heal partition
    network.healPartition();
    assert.strictEqual(network.canCommunicate('node-alpha', 'node-gamma'), true);
  });

  it('10. syncNode brings partitioned Node Gamma up to cluster height', () => {
    const syncRes = adapter.syncNode('node-gamma');
    assert.strictEqual(syncRes.success, true);
    assert.ok(syncRes.syncedBlocks >= 1);

    const gamma = adapter.getNode('node-gamma');
    assert.strictEqual(gamma?.getHeight(), 4);
    assert.strictEqual(gamma?.verifyLocalChainIntegrity().valid, true);
  });

  it('11. Network latency simulation executes successfully without drop', async () => {
    const network = adapter.getNetwork();
    network.setLatency(5); // 5ms simulated network latency

    const proof = await adapter.registerProof({
      trustObjectId: 'TO-TEST-005',
      contentHash: 'hash-content-005',
      issuerId: 'did:trustgrid:org:univ',
      ownerId: 'did:trustgrid:user:eve',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:univ',
      signature: 'sig-005',
    });

    assert.strictEqual(proof.blockHeight, 5);
    network.setLatency(0); // Reset
  });

  it('12. Revocation anchored via multi-node consensus across all nodes', async () => {
    const revoked = await adapter.revokeProof({
      trustObjectId: 'TO-TEST-001',
      reason: 'Credential revoked due to disciplinary action',
      revokerDid: 'did:trustgrid:org:univ',
      signature: 'sig-revoke-001',
    });

    assert.strictEqual(revoked.status, 'REVOKED');
    assert.strictEqual(revoked.blockHeight, 6);

    const check = await adapter.verifyProof('TO-TEST-001', 'hash-content-001');
    assert.strictEqual(check.valid, false);
    assert.match(check.reason || '', /REVOKED/);
  });
});
