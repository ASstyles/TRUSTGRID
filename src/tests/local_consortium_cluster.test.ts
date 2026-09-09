import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ConsortiumNode } from '../core/blockchain/consortium-node.js';
import { CryptoService } from '../core/crypto/crypto.service.js';
import { Block, BlockchainTransaction } from '../core/blockchain/blockchain.interface.js';

const PORT_NODE_1 = 4201;
const PORT_NODE_2 = 4202;
const PORT_NODE_3 = 4203;

const URL_1 = `http://localhost:${PORT_NODE_1}`;
const URL_2 = `http://localhost:${PORT_NODE_2}`;
const URL_3 = `http://localhost:${PORT_NODE_3}`;

describe('3-Node Local Consortium Consensus & Integrity Suite', () => {
  let node1: ConsortiumNode;
  let node2: ConsortiumNode;
  let node3: ConsortiumNode;

  before(async () => {
    node1 = new ConsortiumNode({
      nodeId: 'node-1',
      name: 'Test Node 1 (Proposer)',
      role: 'LEADER',
      port: PORT_NODE_1,
      peers: [URL_2, URL_3],
      dbPath: ':memory:',
    });

    node2 = new ConsortiumNode({
      nodeId: 'node-2',
      name: 'Test Node 2 (Validator)',
      role: 'VALIDATOR',
      port: PORT_NODE_2,
      peers: [URL_1, URL_3],
      dbPath: ':memory:',
    });

    node3 = new ConsortiumNode({
      nodeId: 'node-3',
      name: 'Test Node 3 (Validator)',
      role: 'VALIDATOR',
      port: PORT_NODE_3,
      peers: [URL_1, URL_2],
      dbPath: ':memory:',
    });

    await node1.start();
    await node2.start();
    await node3.start();
  });

  after(async () => {
    await node1.stop();
    await node2.stop();
    await node3.stop();
  });

  it('1. 3 consortium nodes start with independent HTTP listeners and genesis block at height 0', async () => {
    const s1 = (await (await fetch(`${URL_1}/status`)).json()) as any;
    const s2 = (await (await fetch(`${URL_2}/status`)).json()) as any;
    const s3 = (await (await fetch(`${URL_3}/status`)).json()) as any;

    assert.equal(s1.success, true);
    assert.equal(s1.nodeId, 'node-1');
    assert.equal(s1.status, 'ONLINE');
    assert.equal(s1.currentHeight, 0);

    assert.equal(s2.success, true);
    assert.equal(s2.nodeId, 'node-2');
    assert.equal(s2.status, 'ONLINE');
    assert.equal(s2.currentHeight, 0);

    assert.equal(s3.success, true);
    assert.equal(s3.nodeId, 'node-3');
    assert.equal(s3.status, 'ONLINE');
    assert.equal(s3.currentHeight, 0);

    assert.equal(s1.latestBlockHash, s2.latestBlockHash);
    assert.equal(s2.latestBlockHash, s3.latestBlockHash);
  });

  it('2. Node 1 proposes block; peers validate and 2/3 majority consensus commits block across all nodes', async () => {
    const txTimestamp = new Date().toISOString();
    const contentHash = CryptoService.sha256('degree:genuine:rahul-sharma');
    const txId = 'tx-test-c01';
    const merkleLeaf = CryptoService.sha256(`${txId}:${contentHash}:${txTimestamp}`);

    const tx: BlockchainTransaction = {
      txId,
      blockHeight: 1,
      actionType: 'REGISTER_PROOF',
      trustObjectId: 'TO-EDU-001',
      contentHash,
      signerDid: 'did:trustgrid:edu:dtu',
      notarySignature: CryptoService.sign(merkleLeaf, node1.ledgerNode.keyPair.privateKey),
      timestamp: txTimestamp,
      merkleLeaf,
      payload: { student: 'Rahul Sharma', degree: 'B.Tech CSE' },
    };

    const resp = await fetch(`${URL_1}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [tx], round: 1 }),
    });

    const data = (await resp.json()) as any;
    assert.equal(data.success, true);
    assert.equal(data.consensusReached, true);
    assert.equal(data.votesReceived, 3);
    assert.equal(data.quorumRequired, 2);
    assert.equal(data.height, 1);
    assert.ok(data.blockHash);
  });

  it('3. All 3 nodes converge to the exact same block hash at height 1', async () => {
    const b1 = (await (await fetch(`${URL_1}/blocks/1`)).json()) as any;
    const b2 = (await (await fetch(`${URL_2}/blocks/1`)).json()) as any;
    const b3 = (await (await fetch(`${URL_3}/blocks/1`)).json()) as any;

    assert.equal(b1.success, true);
    assert.equal(b2.success, true);
    assert.equal(b3.success, true);

    assert.equal(b1.block.header.height, 1);
    assert.equal(b2.block.header.height, 1);
    assert.equal(b3.block.header.height, 1);

    assert.equal(b1.block.blockHash, b2.block.blockHash);
    assert.equal(b2.block.blockHash, b3.block.blockHash);
  });

  it('4. Candidate block with invalid height is rejected by validator peers', async () => {
    const invalidHeader = {
      height: 99, // Invalid jump
      previousHash: node1.ledgerNode.getLastBlock()!.blockHash,
      merkleRoot: CryptoService.sha256('root'),
      timestamp: new Date().toISOString(),
      validatorDid: node1.ledgerNode.did,
      txCount: 0,
      round: 1,
    };
    const blockHash = CryptoService.sha256(CryptoService.canonicalStringify(invalidHeader));
    const validatorSignature = CryptoService.sign(blockHash, node1.ledgerNode.keyPair.privateKey);

    const invalidCandidate: Block = {
      header: invalidHeader,
      blockHash,
      validatorSignature,
      transactions: [],
    };

    const resp = await fetch(`${URL_2}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateBlock: invalidCandidate }),
    });

    assert.equal(resp.status, 400);
    const data = (await resp.json()) as any;
    assert.equal(data.vote, 'REJECT');
    assert.match(data.reason, /Height mismatch/i);
  });

  it('5. Candidate block with broken previousHash link is rejected by validator peers', async () => {
    const invalidHeader = {
      height: 2,
      previousHash: '0x000000000000000000000000000000000000000000000000000000000000dead',
      merkleRoot: CryptoService.sha256('root'),
      timestamp: new Date().toISOString(),
      validatorDid: node1.ledgerNode.did,
      txCount: 0,
      round: 1,
    };
    const blockHash = CryptoService.sha256(CryptoService.canonicalStringify(invalidHeader));
    const validatorSignature = CryptoService.sign(blockHash, node1.ledgerNode.keyPair.privateKey);

    const invalidCandidate: Block = {
      header: invalidHeader,
      blockHash,
      validatorSignature,
      transactions: [],
    };

    const resp = await fetch(`${URL_3}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateBlock: invalidCandidate }),
    });

    assert.equal(resp.status, 400);
    const data = (await resp.json()) as any;
    assert.equal(data.vote, 'REJECT');
    assert.match(data.reason, /Previous hash mismatch/i);
  });

  it('6. Candidate block with tampered transaction merkle root is rejected by validator peers', async () => {
    const lastBlock = node1.ledgerNode.getLastBlock()!;
    const invalidHeader = {
      height: 2,
      previousHash: lastBlock.blockHash,
      merkleRoot: '0xforged_merkle_root_not_matching_leaves',
      timestamp: new Date().toISOString(),
      validatorDid: node1.ledgerNode.did,
      txCount: 0,
      round: 1,
    };
    const blockHash = CryptoService.sha256(CryptoService.canonicalStringify(invalidHeader));
    const validatorSignature = CryptoService.sign(blockHash, node1.ledgerNode.keyPair.privateKey);

    const invalidCandidate: Block = {
      header: invalidHeader,
      blockHash,
      validatorSignature,
      transactions: [],
    };

    const resp = await fetch(`${URL_2}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateBlock: invalidCandidate }),
    });

    assert.equal(resp.status, 400);
    const data = (await resp.json()) as any;
    assert.equal(data.vote, 'REJECT');
    assert.match(data.reason, /Merkle root mismatch/i);
  });

  it('7. Candidate block with corrupted block hash is rejected by validator peers', async () => {
    const lastBlock = node1.ledgerNode.getLastBlock()!;
    const validHeader = {
      height: 2,
      previousHash: lastBlock.blockHash,
      merkleRoot: CryptoService.computeMerkleRoot([]),
      timestamp: new Date().toISOString(),
      validatorDid: node1.ledgerNode.did,
      txCount: 0,
      round: 1,
    };
    // Deliberately corrupted block hash
    const corruptedHash = '0xcorrupted_hash_does_not_match_canonical_header';
    const validatorSignature = CryptoService.sign(corruptedHash, node1.ledgerNode.keyPair.privateKey);

    const invalidCandidate: Block = {
      header: validHeader,
      blockHash: corruptedHash,
      validatorSignature,
      transactions: [],
    };

    const resp = await fetch(`${URL_3}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateBlock: invalidCandidate }),
    });

    assert.equal(resp.status, 400);
    const data = (await resp.json()) as any;
    assert.equal(data.vote, 'REJECT');
    assert.match(data.reason, /Block hash mismatch/i);
  });

  it('8. Consensus succeeds with 2/3 majority when 1 validator node (Node 3) is offline', async () => {
    // Take Node 3 offline
    await fetch(`${URL_3}/status/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'OFFLINE' }),
    });

    const s3 = (await (await fetch(`${URL_3}/status`)).json()) as any;
    assert.equal(s3.status, 'OFFLINE');

    const txTimestamp = new Date().toISOString();
    const contentHash = CryptoService.sha256('supply:batch:lot-999');
    const txId = 'tx-test-c02';
    const merkleLeaf = CryptoService.sha256(`${txId}:${contentHash}:${txTimestamp}`);

    const tx: BlockchainTransaction = {
      txId,
      blockHeight: 2,
      actionType: 'RECORD_PROVENANCE',
      trustObjectId: 'TO-SUPPLY-002',
      contentHash,
      signerDid: 'did:trustgrid:pharma:mfg',
      notarySignature: CryptoService.sign(merkleLeaf, node1.ledgerNode.keyPair.privateKey),
      timestamp: txTimestamp,
      merkleLeaf,
      payload: { product: 'Insulin Vial', batch: 'LOT-999' },
    };

    // Node 1 proposes block 2 while Node 3 is offline
    const resp = await fetch(`${URL_1}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [tx], round: 2 }),
    });

    const data = (await resp.json()) as any;
    assert.equal(data.success, true);
    assert.equal(data.consensusReached, true);
    assert.equal(data.votesReceived, 2); // Node 1 + Node 2 = 2 votes (Quorum threshold = 2)
    assert.equal(data.height, 2);

    // Node 1 and Node 2 should be at height 2
    const b1 = (await (await fetch(`${URL_1}/blocks/2`)).json()) as any;
    const b2 = (await (await fetch(`${URL_2}/blocks/2`)).json()) as any;
    assert.equal(b1.block.blockHash, b2.block.blockHash);

    // Node 3 should still be at height 1
    const b3 = (await (await fetch(`${URL_3}/blocks/2`)).json()) as any;
    assert.equal(b3.success, false);
  });

  it('9. Offline node recovers and synchronizes missing blocks from peers via catchup protocol', async () => {
    // Bring Node 3 back online
    await fetch(`${URL_3}/status/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ONLINE' }),
    });

    // Trigger catchup sync
    const syncResp = (await (await fetch(`${URL_3}/sync`, { method: 'POST' })).json()) as any;
    assert.equal(syncResp.success, true);
    assert.equal(syncResp.syncedHeight, 2);

    // Verify Node 3 now matches Node 1 and Node 2 at height 2
    const b1 = (await (await fetch(`${URL_1}/blocks/2`)).json()) as any;
    const b3 = (await (await fetch(`${URL_3}/blocks/2`)).json()) as any;
    assert.equal(b1.block.blockHash, b3.block.blockHash);
  });

  it('10. Cluster nodes independently verify 100% valid cryptographic chain integrity after sync', async () => {
    const v1 = (await (await fetch(`${URL_1}/verify`)).json()) as any;
    const v2 = (await (await fetch(`${URL_2}/verify`)).json()) as any;
    const v3 = (await (await fetch(`${URL_3}/verify`)).json()) as any;

    assert.equal(v1.integrity.valid, true);
    assert.equal(v1.integrity.totalBlocks, 3); // genesis(0) + block(1) + block(2)

    assert.equal(v2.integrity.valid, true);
    assert.equal(v2.integrity.totalBlocks, 3);

    assert.equal(v3.integrity.valid, true);
    assert.equal(v3.integrity.totalBlocks, 3);
  });
});
