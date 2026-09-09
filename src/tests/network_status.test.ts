/**
 * TRUSTGRID Consortium Network Status API & Quorum Test Suite
 *
 * Verifies the 8 core requirements of the Network Status functionality:
 *  1. All 3 nodes online -> Network HEALTHY, Quorum 3/3, Consensus READY
 *  2. One node offline -> Network DEGRADED, Quorum AVAILABLE (2/3)
 *  3. Quorum still available with 2/3 nodes
 *  4. Quorum lost with fewer than 2 nodes (< 2/3) -> Network QUORUM_LOST, Consensus NO_QUORUM
 *  5. Correct block height reporting across nodes
 *  6. Correct node roles (Alpha: PROPOSER, Beta/Gamma: VALIDATOR)
 *  7. Invalid / unreachable node response handled safely without throwing
 *  8. Zero private key material, key seeds, or internal secrets exposed in API responses
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNetworkAggregate,
  checkNodeStatus,
  NetworkNodeInfo,
  CONSORTIUM_CONFIG,
} from '../api/routes/network.routes.js';
import { ConsortiumNode } from '../core/blockchain/consortium-node.js';
import { createApp } from '../app.js';
import type { Server } from 'node:http';

describe('Consortium Network Status & Live Quorum Verification Suite', () => {
  // Mock data sets for unit aggregate testing
  const mockNodeAlpha: NetworkNodeInfo = {
    id: 'alpha',
    nodeId: 'node-1',
    name: 'Alpha',
    role: 'PROPOSER',
    port: 4101,
    status: 'ONLINE',
    blockHeight: 3,
    latestBlockHash: '0xabc123',
    previousHash: '0xprev000',
    lastSeen: new Date().toISOString(),
    did: 'did:trustgrid:sys:node-1',
    publicKey: 'a1b2c3d4e5f6',
    peersCount: 2,
    responseTimeMs: 5,
  };

  const mockNodeBeta: NetworkNodeInfo = {
    id: 'beta',
    nodeId: 'node-2',
    name: 'Beta',
    role: 'VALIDATOR',
    port: 4102,
    status: 'ONLINE',
    blockHeight: 3,
    latestBlockHash: '0xabc123',
    previousHash: '0xprev000',
    lastSeen: new Date().toISOString(),
    did: 'did:trustgrid:sys:node-2',
    publicKey: 'b2c3d4e5f6a1',
    peersCount: 2,
    responseTimeMs: 4,
  };

  const mockNodeGamma: NetworkNodeInfo = {
    id: 'gamma',
    nodeId: 'node-3',
    name: 'Gamma',
    role: 'VALIDATOR',
    port: 4103,
    status: 'ONLINE',
    blockHeight: 3,
    latestBlockHash: '0xabc123',
    previousHash: '0xprev000',
    lastSeen: new Date().toISOString(),
    did: 'did:trustgrid:sys:node-3',
    publicKey: 'c3d4e5f6a1b2',
    peersCount: 2,
    responseTimeMs: 6,
  };

  it('1. All 3 nodes online: Network reports HEALTHY with 3/3 quorum and READY consensus', () => {
    const result = buildNetworkAggregate([mockNodeAlpha, mockNodeBeta, mockNodeGamma]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.network.status, 'HEALTHY');
    assert.strictEqual(result.network.quorum.total, 3);
    assert.strictEqual(result.network.quorum.available, 3);
    assert.strictEqual(result.network.quorum.required, 2);
    assert.strictEqual(result.network.quorum.hasQuorum, true);
    assert.strictEqual(result.network.consensus, 'READY');
    assert.strictEqual(result.network.converged, true);
    assert.strictEqual(result.network.latestHeight, 3);
    assert.strictEqual(result.network.latestBlockHash, '0xabc123');
  });

  it('2. One node offline: Network reports DEGRADED with 2/3 nodes online', () => {
    const offlineGamma: NetworkNodeInfo = {
      ...mockNodeGamma,
      status: 'OFFLINE',
      blockHeight: null,
      latestBlockHash: null,
      error: 'Process not responding on port 4103',
    };

    const result = buildNetworkAggregate([mockNodeAlpha, mockNodeBeta, offlineGamma]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.network.status, 'DEGRADED');
    assert.strictEqual(result.network.quorum.available, 2);
    assert.strictEqual(result.network.quorum.total, 3);
    assert.strictEqual(result.nodes.find((n) => n.id === 'gamma')?.status, 'OFFLINE');
  });

  it('3. Quorum still available with 2 of 3 nodes online (2/3 majority preserved)', () => {
    const offlineGamma: NetworkNodeInfo = {
      ...mockNodeGamma,
      status: 'OFFLINE',
      blockHeight: null,
      latestBlockHash: null,
    };

    const result = buildNetworkAggregate([mockNodeAlpha, mockNodeBeta, offlineGamma]);

    assert.strictEqual(result.network.quorum.hasQuorum, true);
    assert.strictEqual(result.network.quorum.available >= result.network.quorum.required, true);
    assert.strictEqual(result.network.consensus, 'READY');
  });

  it('4. Quorum lost when fewer than 2 nodes are online (e.g. 1/3 available)', () => {
    const offlineBeta: NetworkNodeInfo = { ...mockNodeBeta, status: 'OFFLINE' };
    const offlineGamma: NetworkNodeInfo = { ...mockNodeGamma, status: 'OFFLINE' };

    const result = buildNetworkAggregate([mockNodeAlpha, offlineBeta, offlineGamma]);

    assert.strictEqual(result.network.status, 'QUORUM_LOST');
    assert.strictEqual(result.network.quorum.available, 1);
    assert.strictEqual(result.network.quorum.hasQuorum, false);
    assert.strictEqual(result.network.consensus, 'NO_QUORUM');
  });

  it('5. Correct block height reporting across nodes', () => {
    const nodeAtHeight5: NetworkNodeInfo = { ...mockNodeAlpha, blockHeight: 5 };
    const nodeAtHeight4: NetworkNodeInfo = { ...mockNodeBeta, blockHeight: 4 };
    const nodeAtHeight3: NetworkNodeInfo = { ...mockNodeGamma, blockHeight: 3 };

    const result = buildNetworkAggregate([nodeAtHeight5, nodeAtHeight4, nodeAtHeight3]);

    assert.strictEqual(result.network.latestHeight, 5);
    assert.strictEqual(result.network.converged, false); // Different heights -> not converged
    assert.strictEqual(result.network.consensus, 'SYNCING');
  });

  it('6. Correct node roles assigned: Alpha is PROPOSER, Beta and Gamma are VALIDATORS', () => {
    assert.strictEqual(CONSORTIUM_CONFIG[0].id, 'alpha');
    assert.strictEqual(CONSORTIUM_CONFIG[0].role, 'PROPOSER');
    assert.strictEqual(CONSORTIUM_CONFIG[0].port, 4101);

    assert.strictEqual(CONSORTIUM_CONFIG[1].id, 'beta');
    assert.strictEqual(CONSORTIUM_CONFIG[1].role, 'VALIDATOR');
    assert.strictEqual(CONSORTIUM_CONFIG[1].port, 4102);

    assert.strictEqual(CONSORTIUM_CONFIG[2].id, 'gamma');
    assert.strictEqual(CONSORTIUM_CONFIG[2].role, 'VALIDATOR');
    assert.strictEqual(CONSORTIUM_CONFIG[2].port, 4103);
  });

  it('7. Unreachable/unresponsive node port is handled safely without throwing', async () => {
    // Port 4199 is not listening
    const deadConfig = {
      id: 'alpha' as const,
      nodeId: 'node-dead',
      name: 'Dead Node',
      role: 'PROPOSER' as const,
      port: 4199,
    };

    const status = await checkNodeStatus(deadConfig, 300);

    assert.strictEqual(status.status, 'OFFLINE');
    assert.strictEqual(status.blockHeight, null);
    assert.strictEqual(status.latestBlockHash, null);
    assert.ok(status.error?.includes('not reachable') || status.error?.includes('Connection failed'));
  });

  it('8. Security: Network Status API does not expose private keys, seeds, or internal secrets', () => {
    const result = buildNetworkAggregate([mockNodeAlpha, mockNodeBeta, mockNodeGamma]);

    const serialized = JSON.stringify(result);
    assert.strictEqual(serialized.includes('privateKey'), false);
    assert.strictEqual(serialized.includes('private_key'), false);
    assert.strictEqual(serialized.includes('seed'), false);
    assert.strictEqual(serialized.includes('secret'), false);
    assert.strictEqual(serialized.includes('passphrase'), false);

    for (const node of result.nodes) {
      const record = node as unknown as Record<string, unknown>;
      assert.strictEqual(record.privateKey, undefined);
      assert.strictEqual(record.secret, undefined);
    }
  });

  describe('Live HTTP Endpoints Integration Test', () => {
    let testNode: ConsortiumNode;
    let testServer: Server;
    const TEST_NODE_PORT = 4102; // Matches Beta port for real check
    const APP_PORT = 5098;

    before(async () => {
      // Start a real ConsortiumNode on port 4102 (Beta)
      testNode = new ConsortiumNode({
        nodeId: 'node-2',
        name: 'Node Beta (Validator)',
        role: 'VALIDATOR',
        port: TEST_NODE_PORT,
        peers: ['http://localhost:4101', 'http://localhost:4103'],
        dbPath: ':memory:',
      });
      await testNode.start();

      // Start the Express app
      const app = createApp();
      await new Promise<void>((resolve) => {
        testServer = app.listen(APP_PORT, () => resolve());
      });
    });

    after(async () => {
      await testNode.stop();
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });
    });

    it('9. Real HTTP query to /api/network/status detects running node on port 4102 as ONLINE and unstarted nodes as OFFLINE', async () => {
      const resp = await fetch(`http://localhost:${APP_PORT}/api/network/status`);
      assert.strictEqual(resp.status, 200);

      const json = (await resp.json()) as {
        success: boolean;
        network: { status: string; quorum: { available: number; total: number } };
        nodes: NetworkNodeInfo[];
      };

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.nodes.length, 3);

      const beta = json.nodes.find((n) => n.port === 4102);
      assert.ok(beta);
      assert.strictEqual(beta.status, 'ONLINE');
      assert.strictEqual(beta.role, 'VALIDATOR');
      assert.strictEqual(typeof beta.blockHeight, 'number');

      // Alpha and Gamma are not started in this isolated test, so they must be accurately reported as OFFLINE
      const alpha = json.nodes.find((n) => n.port === 4101);
      const gamma = json.nodes.find((n) => n.port === 4103);
      assert.strictEqual(alpha?.status, 'OFFLINE');
      assert.strictEqual(gamma?.status, 'OFFLINE');

      // With only 1 node running, network status should reflect QUORUM_LOST (1/3 available)
      assert.strictEqual(json.network.quorum.available, 1);
      assert.strictEqual(json.network.status, 'QUORUM_LOST');
    });

    it('10. Toggling node status via POST /api/network/nodes/beta/toggle sets node OFFLINE dynamically', async () => {
      // Toggle Beta to OFFLINE
      const toggleResp = await fetch(`http://localhost:${APP_PORT}/api/network/nodes/beta/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OFFLINE' }),
      });
      assert.strictEqual(toggleResp.ok, true);

      // Now re-check /api/network/status
      const statusResp = await fetch(`http://localhost:${APP_PORT}/api/network/status`);
      const statusJson = (await statusResp.json()) as { nodes: NetworkNodeInfo[] };

      const beta = statusJson.nodes.find((n) => n.port === 4102);
      assert.strictEqual(beta?.status, 'OFFLINE');

      // Toggle back to ONLINE
      await fetch(`http://localhost:${APP_PORT}/api/network/nodes/beta/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ONLINE' }),
      });
    });
  });
});
