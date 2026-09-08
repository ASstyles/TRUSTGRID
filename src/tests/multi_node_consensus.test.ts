import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { LedgerNode } from '../core/blockchain/node.js';
import { PeerNetwork } from '../core/blockchain/network.js';
import { PbftConsensusEngine } from '../core/blockchain/consensus.service.js';
import { BlockchainTransaction } from '../core/blockchain/blockchain.interface.js';
import { CryptoService } from '../core/crypto/crypto.service.js';

describe('PBFT Multi-Node Consensus Engine Tests', () => {
  let network: PeerNetwork;
  let leader: LedgerNode;
  let validator1: LedgerNode;
  let validator2: LedgerNode;
  let consensusEngine: PbftConsensusEngine;

  before(() => {
    network = new PeerNetwork();

    leader = new LedgerNode({
      nodeId: 'test-node-alpha',
      name: 'Alpha Leader',
      role: 'LEADER',
      did: 'did:trustgrid:test:node-alpha',
      keySeed: 'test-seed-alpha',
      dbPath: ':memory:',
    });

    validator1 = new LedgerNode({
      nodeId: 'test-node-beta',
      name: 'Beta Validator',
      role: 'VALIDATOR',
      did: 'did:trustgrid:test:node-beta',
      keySeed: 'test-seed-beta',
      dbPath: ':memory:',
    });

    validator2 = new LedgerNode({
      nodeId: 'test-node-gamma',
      name: 'Gamma Validator',
      role: 'VALIDATOR',
      did: 'did:trustgrid:test:node-gamma',
      keySeed: 'test-seed-gamma',
      dbPath: ':memory:',
    });

    network.registerNode(leader);
    network.registerNode(validator1);
    network.registerNode(validator2);

    consensusEngine = new PbftConsensusEngine(network, 'test-node-alpha', 2);
  });

  after(() => {
    leader.close();
    validator1.close();
    validator2.close();
  });

  const createDummyTx = (id: string, content: string): BlockchainTransaction => {
    const timestamp = new Date().toISOString();
    const contentHash = CryptoService.sha256(content);
    return {
      txId: `tx-${id}`,
      blockHeight: 0,
      actionType: 'REGISTER_PROOF',
      trustObjectId: `TO-${id}`,
      contentHash,
      signerDid: 'did:trustgrid:client:alice',
      notarySignature: CryptoService.sign(contentHash, leader.keyPair.privateKey),
      timestamp,
      merkleLeaf: CryptoService.sha256(`tx-${id}:${contentHash}:${timestamp}`),
      payload: { content },
    };
  };

  it('1. Initial cluster state: All 3 nodes have Genesis Block at height 0', () => {
    assert.strictEqual(leader.getHeight(), 0);
    assert.strictEqual(validator1.getHeight(), 0);
    assert.strictEqual(validator2.getHeight(), 0);

    const leaderGenesis = leader.getLastBlock();
    assert.ok(leaderGenesis);
    assert.strictEqual(leaderGenesis.header.height, 0);
    assert.strictEqual(leaderGenesis.header.previousHash, '0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('2. Leader creates valid candidate block proposal with Merkle root', () => {
    const tx = createDummyTx('001', 'Document payload 1');
    const candidate = leader.proposeBlock([tx]);

    assert.strictEqual(candidate.header.height, 1);
    assert.strictEqual(candidate.header.previousHash, leader.getLastBlock()?.blockHash);
    assert.strictEqual(candidate.header.txCount, 1);
    assert.strictEqual(candidate.transactions.length, 1);

    const expectedRoot = CryptoService.computeMerkleRoot([tx.merkleLeaf]);
    assert.strictEqual(candidate.header.merkleRoot, expectedRoot);
  });

  it('3. Validators verify candidate block successfully', () => {
    const tx = createDummyTx('002', 'Document payload 2');
    const candidate = leader.proposeBlock([tx]);

    const v1Check = validator1.verifyCandidateBlock(candidate);
    const v2Check = validator2.verifyCandidateBlock(candidate);

    assert.strictEqual(v1Check.valid, true);
    assert.strictEqual(v2Check.valid, true);
  });

  it('4. Validator rejects candidate with invalid height', () => {
    const tx = createDummyTx('003', 'Document payload 3');
    const candidate = leader.proposeBlock([tx]);
    candidate.header.height = 99; // corrupt height

    const check = validator1.verifyCandidateBlock(candidate);
    assert.strictEqual(check.valid, false);
    assert.match(check.reason || '', /Height mismatch/);
  });

  it('5. Validator rejects candidate with invalid previousHash link', () => {
    const tx = createDummyTx('004', 'Document payload 4');
    const candidate = leader.proposeBlock([tx]);
    candidate.header.previousHash = '0xbad_previous_hash_link';

    const check = validator1.verifyCandidateBlock(candidate);
    assert.strictEqual(check.valid, false);
    assert.match(check.reason || '', /Previous hash mismatch/);
  });

  it('6. Full PBFT Consensus succeeds with 3/3 votes and commits to all nodes', async () => {
    const tx = createDummyTx('005', 'Consensus test document');
    const result = await consensusEngine.executeConsensus([tx]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.votesReceived, 3);
    assert.ok(result.certificate);
    assert.strictEqual(result.certificate.quorumReached, true);
    assert.strictEqual(result.committedNodes.length, 3);

    // Height on all 3 nodes must be 1
    assert.strictEqual(leader.getHeight(), 1);
    assert.strictEqual(validator1.getHeight(), 1);
    assert.strictEqual(validator2.getHeight(), 1);

    // Block hash on all 3 nodes must match
    assert.strictEqual(leader.getLastBlock()?.blockHash, validator1.getLastBlock()?.blockHash);
    assert.strictEqual(leader.getLastBlock()?.blockHash, validator2.getLastBlock()?.blockHash);
  });

  it('7. Quorum Certificate contains at least 2 valid Ed25519 signatures', () => {
    const lastBlock = leader.getLastBlock();
    assert.ok(lastBlock?.certificate);
    const cert = lastBlock.certificate;

    assert.ok(cert.votes.length >= 2);
    for (const vote of cert.votes) {
      assert.strictEqual(vote.blockHash, lastBlock.blockHash);
      assert.ok(vote.signature.length > 0);
      const voterNode = network.getNode(vote.voterNodeId);
      assert.ok(voterNode);
      const isSigValid = CryptoService.verify(vote.blockHash, vote.signature, voterNode.keyPair.publicKey);
      assert.strictEqual(isSigValid, true);
    }
  });

  it('8. Sequential block production maintains continuous cryptographic chain', async () => {
    const initialHeight = leader.getHeight();

    for (let i = 1; i <= 3; i++) {
      const tx = createDummyTx(`seq-${i}`, `Sequential block payload ${i}`);
      const res = await consensusEngine.executeConsensus([tx]);
      assert.strictEqual(res.success, true);
    }

    assert.strictEqual(leader.getHeight(), initialHeight + 3);
    assert.strictEqual(validator1.getHeight(), initialHeight + 3);
    assert.strictEqual(validator2.getHeight(), initialHeight + 3);

    // Verify chain integrity on all nodes
    assert.strictEqual(leader.verifyLocalChainIntegrity().valid, true);
    assert.strictEqual(validator1.verifyLocalChainIntegrity().valid, true);
    assert.strictEqual(validator2.verifyLocalChainIntegrity().valid, true);
  });

  it('9. Consensus succeeds with 2/3 quorum when 1 validator (Beta) is OFFLINE', async () => {
    validator1.setStatus('OFFLINE');

    const tx = createDummyTx('partial-1', 'Resilience payload 1');
    const result = await consensusEngine.executeConsensus([tx]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.votesReceived, 2); // Leader + Validator2
    assert.strictEqual(result.quorumRequired, 2);

    // Leader and Validator2 committed
    assert.ok(result.committedNodes.includes('test-node-alpha'));
    assert.ok(result.committedNodes.includes('test-node-gamma'));
    assert.ok(!result.committedNodes.includes('test-node-beta'));

    // Restore Beta and sync
    validator1.setStatus('ONLINE');
    validator1.reconcileChain(leader.getAllBlocks());
  });

  it('10. Consensus succeeds with 2/3 quorum when 1 validator (Gamma) is OFFLINE', async () => {
    validator2.setStatus('OFFLINE');

    const tx = createDummyTx('partial-2', 'Resilience payload 2');
    const result = await consensusEngine.executeConsensus([tx]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.votesReceived, 2); // Leader + Validator1
    assert.strictEqual(result.quorumRequired, 2);

    // Restore Gamma and sync
    validator2.setStatus('ONLINE');
    validator2.reconcileChain(leader.getAllBlocks());
  });

  it('11. Consensus FAILS when 2 nodes are OFFLINE (Quorum lost: 1 < 2)', async () => {
    validator1.setStatus('OFFLINE');
    validator2.setStatus('OFFLINE');

    const tx = createDummyTx('fail-quorum', 'Quorum failure payload');
    const result = await consensusEngine.executeConsensus([tx]);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.votesReceived, 1);
    assert.match(result.reason || '', /Consensus quorum failed/);

    // Restore validators
    validator1.setStatus('ONLINE');
    validator2.setStatus('ONLINE');
  });

  it('12. Consensus FAILS when Leader is OFFLINE', async () => {
    leader.setStatus('OFFLINE');

    const tx = createDummyTx('fail-leader', 'Leader failure payload');
    const result = await consensusEngine.executeConsensus([tx]);

    assert.strictEqual(result.success, false);
    assert.match(result.reason || '', /Leader node.*is OFFLINE/);

    // Restore leader
    leader.setStatus('ONLINE');
  });

  it('13. Empty transaction list is rejected by consensus engine', async () => {
    const result = await consensusEngine.executeConsensus([]);
    assert.strictEqual(result.success, false);
    assert.match(result.reason || '', /empty transaction list/);
  });

  it('14. Multi-transaction block computes combined binary Merkle tree', async () => {
    const tx1 = createDummyTx('multi-1', 'Payload 1');
    const tx2 = createDummyTx('multi-2', 'Payload 2');
    const tx3 = createDummyTx('multi-3', 'Payload 3');

    const result = await consensusEngine.executeConsensus([tx1, tx2, tx3]);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.block?.transactions.length, 3);

    const computedRoot = CryptoService.computeMerkleRoot([tx1.merkleLeaf, tx2.merkleLeaf, tx3.merkleLeaf]);
    assert.strictEqual(result.block?.header.merkleRoot, computedRoot);
  });

  it('15. Transaction retrieval by ID from committed blocks', () => {
    const tx = leader.getTransaction('tx-multi-1');
    assert.ok(tx);
    assert.strictEqual(tx.actionType, 'REGISTER_PROOF');
    assert.strictEqual(tx.trustObjectId, 'TO-multi-1');
  });
});
