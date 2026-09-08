import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { MultiNodeBlockchainAdapter } from '../core/blockchain/multi-node-blockchain.adapter.js';

describe('Ledger Tamper Detection & Byzantine Audit Tests', () => {
  let adapter: MultiNodeBlockchainAdapter;

  before(async () => {
    adapter = new MultiNodeBlockchainAdapter(undefined, true);

    // Anchor 3 blocks to have a realistic ledger
    for (let i = 1; i <= 3; i++) {
      await adapter.registerProof({
        trustObjectId: `TO-AUDIT-${i}`,
        contentHash: `hash-audit-00${i}`,
        issuerId: 'did:trustgrid:org:univ',
        ownerId: `did:trustgrid:user:student-${i}`,
        status: 'ACTIVE',
        signerDid: 'did:trustgrid:org:univ',
        signature: `sig-audit-${i}`,
      });
    }
  });

  after(() => {
    adapter.close();
  });

  it('1. Baseline verification: All nodes have intact cryptographic chain', () => {
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, true);
    assert.strictEqual(audit.divergedNodes.length, 0);

    for (const report of audit.nodeReports) {
      assert.strictEqual(report.intact, true);
      assert.strictEqual(report.status, 'ONLINE');
    }
  });

  it('2. Tamper block hash on Node Beta: detected locally by verifyLocalChainIntegrity', () => {
    const beta = adapter.getNode('node-beta');
    assert.ok(beta);

    beta.tamperBlock(1, { blockHash: '0xforged_hash_value_12345' });

    const localCheck = beta.verifyLocalChainIntegrity();
    assert.strictEqual(localCheck.valid, false);
    assert.match(localCheck.reason || '', /Tampered block hash/);
    assert.strictEqual(localCheck.brokenHeight, 1);
  });

  it('3. Cross-node audit immediately detects Node Beta as DIVERGED while Alpha & Gamma are intact', () => {
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, false);
    assert.strictEqual(audit.divergedNodes.length, 1);
    assert.strictEqual(audit.divergedNodes[0], 'node-beta');

    const betaReport = audit.nodeReports.find((r) => r.nodeId === 'node-beta');
    assert.strictEqual(betaReport?.intact, false);
    assert.strictEqual(betaReport?.status, 'CORRUPTED');

    const alphaReport = audit.nodeReports.find((r) => r.nodeId === 'node-alpha');
    const gammaReport = audit.nodeReports.find((r) => r.nodeId === 'node-gamma');
    assert.strictEqual(alphaReport?.intact, true);
    assert.strictEqual(gammaReport?.intact, true);
  });

  it('4. Quorum remains intact ($Q = 2 \ge 2$) despite Byzantine tampering on Node Beta', () => {
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.quorumReachable, true);
    assert.strictEqual(audit.onlineNodes, 2); // Alpha + Gamma online
  });

  it('5. New transactions can still be anchored while Node Beta is corrupted', async () => {
    const proof = await adapter.registerProof({
      trustObjectId: 'TO-AUDIT-4',
      contentHash: 'hash-audit-004',
      issuerId: 'did:trustgrid:org:univ',
      ownerId: 'did:trustgrid:user:student-4',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:univ',
      signature: 'sig-audit-4',
    });

    assert.strictEqual(proof.blockHeight, 4);

    const alpha = adapter.getNode('node-alpha');
    const gamma = adapter.getNode('node-gamma');
    assert.strictEqual(alpha?.getHeight(), 4);
    assert.strictEqual(gamma?.getHeight(), 4);
  });

  it('6. Self-healing: syncNode repairs tampered Node Beta from healthy peer', () => {
    const syncRes = adapter.syncNode('node-beta');
    assert.strictEqual(syncRes.success, true);

    const beta = adapter.getNode('node-beta');
    assert.strictEqual(beta?.getStatus(), 'ONLINE');
    assert.strictEqual(beta?.getHeight(), 4);

    const integrity = beta?.verifyLocalChainIntegrity();
    assert.strictEqual(integrity?.valid, true);
  });

  it('7. Cross-node audit returns to consistent state after self-healing', () => {
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, true);
    assert.strictEqual(audit.divergedNodes.length, 0);
  });

  it('8. Tampering previousHash breaks chain continuity at exact height', () => {
    const gamma = adapter.getNode('node-gamma');
    assert.ok(gamma);

    gamma.tamperBlock(2, { previousHash: '0xbroken_previous_hash_link' });

    const localCheck = gamma.verifyLocalChainIntegrity();
    assert.strictEqual(localCheck.valid, false);
    assert.match(localCheck.reason || '', /Broken chain link/);
    assert.strictEqual(localCheck.brokenHeight, 2);
  });

  it('9. Tampering transaction payload in local database triggers Merkle leaf mismatch', () => {
    // Repair gamma first
    adapter.syncNode('node-gamma');

    const gamma = adapter.getNode('node-gamma');
    assert.ok(gamma);

    gamma.tamperBlock(1, {
      payloadMutation: { tamperedAttribute: 'Malicious modification of off-chain metadata' },
    });

    // Merkle root or leaf computation check
    const localCheck = gamma.verifyLocalChainIntegrity();
    // Tamper detected
    assert.strictEqual(localCheck.valid, false);
  });

  it('10. Repair Node Gamma brings whole cluster back to 100% integrity', () => {
    adapter.syncNode('node-gamma');
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, true);
    assert.strictEqual(audit.divergedNodes.length, 0);
  });

  it('11. Direct adapter tamperNode API method updates status and triggers audit diverged flags', () => {
    adapter.tamperNode('node-beta', 3, { blockHash: '0xdeliberate_tamper_demo' });
    const audit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(audit.consistent, false);
    assert.ok(audit.divergedNodes.includes('node-beta'));

    // Reconcile back
    adapter.recoverNode('node-beta');
    const cleanAudit = adapter.verifyCrossNodeLedger();
    assert.strictEqual(cleanAudit.consistent, true);
  });

  it('12. Read-only verification does not mutate ledger data', async () => {
    const audit1 = adapter.verifyCrossNodeLedger();
    const audit2 = adapter.verifyCrossNodeLedger();

    assert.strictEqual(audit1.consistent, audit2.consistent);
    assert.strictEqual(audit1.clusterHeight, audit2.clusterHeight);
  });
});
