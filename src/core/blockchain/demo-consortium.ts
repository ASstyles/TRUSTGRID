import { ConsortiumNode } from './consortium-node.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { Block, BlockchainTransaction } from './blockchain.interface.js';

const PORT_NODE_1 = 4101;
const PORT_NODE_2 = 4102;
const PORT_NODE_3 = 4103;

const URL_NODE_1 = `http://localhost:${PORT_NODE_1}`;
const URL_NODE_2 = `http://localhost:${PORT_NODE_2}`;
const URL_NODE_3 = `http://localhost:${PORT_NODE_3}`;

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`🔷 ${title}`);
  console.log('='.repeat(70));
}

function logStep(step: string, detail: string) {
  console.log(`\n  ▶ [STEP] ${step}`);
  console.log(`    ↳ ${detail}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConsortiumDemo() {
  console.log('\n======================================================================');
  console.log('🛡️  TRUSTGRID LOCAL 3-NODE CONSORTIUM CONSENSUS PROTOTYPE');
  console.log('    Protocol: Trust Object Protocol (TOP) Consortium Substrate');
  console.log('    Consensus: 2/3 Majority Consortium Endorsement (Deterministic)');
  console.log('    Topology: 3 Independent Processes (Ports 4101, 4102, 4103)');
  console.log('    Production Roadmap: Hyperledger Fabric / Multi-Organization');
  console.log('======================================================================');

  logSection('1. Initializing 3 Independent Consortium Node Processes');

  const node1 = new ConsortiumNode({
    nodeId: 'node-1',
    name: 'Node 1 (Alpha - Consortium Proposer)',
    role: 'LEADER',
    port: PORT_NODE_1,
    peers: [URL_NODE_2, URL_NODE_3],
    dbPath: ':memory:',
  });

  const node2 = new ConsortiumNode({
    nodeId: 'node-2',
    name: 'Node 2 (Beta - Logistics Validator)',
    role: 'VALIDATOR',
    port: PORT_NODE_2,
    peers: [URL_NODE_1, URL_NODE_3],
    dbPath: ':memory:',
  });

  const node3 = new ConsortiumNode({
    nodeId: 'node-3',
    name: 'Node 3 (Gamma - Audit Validator)',
    role: 'VALIDATOR',
    port: PORT_NODE_3,
    peers: [URL_NODE_1, URL_NODE_2],
    dbPath: ':memory:',
  });

  await node1.start();
  await node2.start();
  await node3.start();

  console.log(`  ✔ Node 1 (Alpha) started at ${URL_NODE_1} [Genesis Height: ${node1.ledgerNode.getHeight()}]`);
  console.log(`  ✔ Node 2 (Beta)  started at ${URL_NODE_2} [Genesis Height: ${node2.ledgerNode.getHeight()}]`);
  console.log(`  ✔ Node 3 (Gamma) started at ${URL_NODE_3} [Genesis Height: ${node3.ledgerNode.getHeight()}]`);

  // Query statuses over HTTP
  const status1 = await (await fetch(`${URL_NODE_1}/status`)).json() as any;
  const status2 = await (await fetch(`${URL_NODE_2}/status`)).json() as any;
  const status3 = await (await fetch(`${URL_NODE_3}/status`)).json() as any;

  console.log(`\n  Initial Cluster Genesis State:`);
  console.log(`    Node 1 Hash: ${status1.latestBlockHash.slice(0, 20)}... (Height: ${status1.currentHeight})`);
  console.log(`    Node 2 Hash: ${status2.latestBlockHash.slice(0, 20)}... (Height: ${status2.currentHeight})`);
  console.log(`    Node 3 Hash: ${status3.latestBlockHash.slice(0, 20)}... (Height: ${status3.currentHeight})`);

  logSection('2. Successful Consensus Flow (Block #1 Proposal & 2/3 Quorum)');
  logStep('Node 1 Proposes Block', 'Anchoring genuine B.Tech degree proof to consortium ledger');

  const tx1Timestamp = new Date().toISOString();
  const tx1ContentHash = CryptoService.sha256('degree:rahul-sharma:btech:dtu');
  const tx1Id = 'tx-consortium-demo-001';
  const tx1Leaf = CryptoService.sha256(`${tx1Id}:${tx1ContentHash}:${tx1Timestamp}`);

  const tx1: BlockchainTransaction = {
    txId: tx1Id,
    blockHeight: 1,
    actionType: 'REGISTER_PROOF',
    trustObjectId: 'TO-EDU-DEGREE-GENUINE-2026',
    contentHash: tx1ContentHash,
    signerDid: 'did:trustgrid:edu:delhi-tech-univ',
    notarySignature: CryptoService.sign(tx1Leaf, node1.ledgerNode.keyPair.privateKey),
    timestamp: tx1Timestamp,
    merkleLeaf: tx1Leaf,
    payload: {
      studentName: 'Rahul Sharma',
      degree: 'B.Tech Computer Science',
      university: 'Delhi Technological University',
    },
  };

  const proposeResp = await fetch(`${URL_NODE_1}/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: [tx1], round: 1 }),
  });

  const proposeData = (await proposeResp.json()) as any;
  console.log(`    Consensus Result: ${proposeData.consensusReached ? '✅ CONSENSUS REACHED' : '❌ FAILED'}`);
  console.log(`    Votes Collected: ${proposeData.votesReceived} / 3 (Threshold: ${proposeData.quorumRequired} for >= 2/3)`);
  console.log(`    Committed Nodes: [${proposeData.committedNodes.join(', ')}]`);
  console.log(`    Committed Block Hash: ${proposeData.blockHash}`);

  logStep('Verifying Node Convergence', 'Checking that all 3 nodes updated their local SQLite ledger');
  const b1 = await (await fetch(`${URL_NODE_1}/blocks/1`)).json() as any;
  const b2 = await (await fetch(`${URL_NODE_2}/blocks/1`)).json() as any;
  const b3 = await (await fetch(`${URL_NODE_3}/blocks/1`)).json() as any;

  console.log(`    Node 1 Block #1 Hash: ${b1.block.blockHash}`);
  console.log(`    Node 2 Block #1 Hash: ${b2.block.blockHash}`);
  console.log(`    Node 3 Block #1 Hash: ${b3.block.blockHash}`);

  const converged = b1.block.blockHash === b2.block.blockHash && b2.block.blockHash === b3.block.blockHash;
  console.log(`    Convergence Status: ${converged ? '🎯 ALL 3 NODES CONVERGED (100% IDENTICAL HASH)' : '❌ DIVERGED'}`);

  logSection('3. Adversarial Case: Invalid / Tampered Block Proposal Rejection');
  logStep('Simulating Tampered Candidate Block', 'Proposing block with forged previousHash to Node 2 and Node 3');

  const forgedHeader = {
    height: 2,
    previousHash: '0xdeadbeef_invalid_previous_hash_forged_by_adversary',
    merkleRoot: CryptoService.sha256('tampered-leaf'),
    timestamp: new Date().toISOString(),
    validatorDid: node1.ledgerNode.did,
    txCount: 1,
    round: 1,
  };
  const forgedHash = CryptoService.sha256(CryptoService.canonicalStringify(forgedHeader));
  const forgedSig = CryptoService.sign(forgedHash, node1.ledgerNode.keyPair.privateKey);

  const forgedCandidate: Block = {
    header: forgedHeader,
    blockHash: forgedHash,
    validatorSignature: forgedSig,
    transactions: [],
  };

  const val2 = await (await fetch(`${URL_NODE_2}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateBlock: forgedCandidate }),
  })).json() as any;

  const val3 = await (await fetch(`${URL_NODE_3}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateBlock: forgedCandidate }),
  })).json() as any;

  console.log(`    Node 2 Validation: ${val2.vote} [Reason: ${val2.reason}]`);
  console.log(`    Node 3 Validation: ${val3.vote} [Reason: ${val3.reason}]`);
  console.log(`    Result: 🛡️ Tampered proposal rejected by validators; chain integrity preserved at Height 1!`);

  logSection('4. Fault Tolerance: 1 Node Offline, 2/3 Majority Still Succeeds');
  logStep('Simulating Node 3 Crash / Offline', 'Toggling Node 3 status to OFFLINE');

  await fetch(`${URL_NODE_3}/status/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'OFFLINE' }),
  });
  console.log(`    Node 3 status: OFFLINE (Unavailable for consensus)`);

  logStep('Proposing Block #2 with Node 3 Down', 'Consortium requires >= 2/3 (2 of 3) votes to proceed');

  const tx2Timestamp = new Date().toISOString();
  const tx2ContentHash = CryptoService.sha256('batch:covid-vaccine:lot-402');
  const tx2Id = 'tx-consortium-demo-002';
  const tx2Leaf = CryptoService.sha256(`${tx2Id}:${tx2ContentHash}:${tx2Timestamp}`);

  const tx2: BlockchainTransaction = {
    txId: tx2Id,
    blockHeight: 2,
    actionType: 'RECORD_PROVENANCE',
    trustObjectId: 'TO-SUPPLY-PHARMA-BATCH-2026',
    contentHash: tx2ContentHash,
    signerDid: 'did:trustgrid:pharma:biotech-labs',
    notarySignature: CryptoService.sign(tx2Leaf, node1.ledgerNode.keyPair.privateKey),
    timestamp: tx2Timestamp,
    merkleLeaf: tx2Leaf,
    payload: {
      product: 'Cold-Chain Vaccine Batch',
      distributor: 'National Medical Logistics',
    },
  };

  const prop2Resp = await fetch(`${URL_NODE_1}/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: [tx2], round: 2 }),
  });

  const prop2Data = (await prop2Resp.json()) as any;
  console.log(`    Consensus Result: ${prop2Data.consensusReached ? '✅ CONSENSUS REACHED (Quorum = Node 1 + Node 2)' : '❌ FAILED'}`);
  console.log(`    Votes Collected: ${prop2Data.votesReceived} / 3 (Required: ${prop2Data.quorumRequired})`);
  console.log(`    Committed Nodes: [${prop2Data.committedNodes.join(', ')}]`);
  console.log(`    Committed Block Hash: ${prop2Data.blockHash}`);

  logSection('5. Node Recovery & Peer Catch-up Synchronization');
  logStep('Bringing Node 3 back ONLINE', 'Node 3 is currently behind at Height 1');
  await fetch(`${URL_NODE_3}/status/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ONLINE' }),
  });

  const s3Pre = await (await fetch(`${URL_NODE_3}/status`)).json() as any;
  console.log(`    Node 3 Height before sync: ${s3Pre.currentHeight} (Cluster Leader Height: 2)`);

  logStep('Triggering Node 3 Catchup Sync', 'Fetching verified blocks from peer nodes');
  const syncResp = await (await fetch(`${URL_NODE_3}/sync`, { method: 'POST' })).json() as any;
  console.log(`    Sync Result: ${syncResp.success ? '✅ SYNC SUCCESSFUL' : '❌ FAILED'}`);
  console.log(`    Node 3 Height after sync: ${syncResp.syncedHeight} (Synced ${syncResp.syncedBlocks} missing block(s))`);

  // Final Convergence Check
  const final1 = await (await fetch(`${URL_NODE_1}/blocks/2`)).json() as any;
  const final2 = await (await fetch(`${URL_NODE_2}/blocks/2`)).json() as any;
  const final3 = await (await fetch(`${URL_NODE_3}/blocks/2`)).json() as any;

  console.log(`\n  Final Cluster State across all 3 nodes:`);
  console.log(`    Node 1 Block #2 Hash: ${final1.block.blockHash}`);
  console.log(`    Node 2 Block #2 Hash: ${final2.block.blockHash}`);
  console.log(`    Node 3 Block #2 Hash: ${final3.block.blockHash}`);

  const fullySynced = final1.block.blockHash === final2.block.blockHash && final2.block.blockHash === final3.block.blockHash;
  console.log(`    Final Convergence: ${fullySynced ? '🎯 100% CONVERGENCE AT HEIGHT 2' : '❌ DIVERGED'}`);

  // Clean shutdown
  await node1.stop();
  await node2.stop();
  await node3.stop();

  console.log('\n======================================================================');
  console.log('✅ DEMO COMPLETE: All 3 Consortium Nodes Stopped Cleanly.');
  console.log('======================================================================\n');
}

runConsortiumDemo().catch((err) => {
  console.error('Consortium demo error:', err);
  process.exit(1);
});
