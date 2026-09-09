import { Router, Request, Response } from 'express';
import { MultiNodeBlockchainAdapter } from '../../core/blockchain/multi-node-blockchain.adapter.js';

export function createNodeRoutes(adapter: MultiNodeBlockchainAdapter): Router {
  const router = Router();

  /**
   * GET /api/nodes
   * List all cluster nodes with operational status, roles, DIDs, and heights
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const nodes = adapter.getNodes();
      const audit = adapter.verifyCrossNodeLedger();
      return res.json({
        success: true,
        cluster: {
          totalNodes: nodes.length,
          quorumRequired: 2,
          quorumReachable: audit.quorumReachable,
          consistent: audit.consistent,
          leaderHeight: audit.clusterHeight,
        },
        nodes,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/nodes/consortium/status
   * Live status of the 3-node independent process consortium (Ports 4101, 4102, 4103)
   */
  router.get('/consortium/status', async (_req: Request, res: Response) => {
    const nodePorts = [4101, 4102, 4103];
    const nodeResults: any[] = [];
    let onlineNodes = 0;

    for (let i = 0; i < nodePorts.length; i++) {
      const port = nodePorts[i];
      const url = `http://localhost:${port}`;
      try {
        const resp = await fetch(`${url}/status`, { signal: AbortSignal.timeout(1000) });
        if (resp.ok) {
          const data = (await resp.json()) as any;
          nodeResults.push(data);
          onlineNodes++;
        } else {
          nodeResults.push({
            nodeId: `node-${i + 1}`,
            status: 'OFFLINE',
            port,
            error: `HTTP ${resp.status}`,
          });
        }
      } catch {
        nodeResults.push({
          nodeId: `node-${i + 1}`,
          status: 'OFFLINE',
          port,
          error: 'Process not responding on port ' + port,
        });
      }
    }

    const clusterRunning = onlineNodes >= 2;
    return res.json({
      success: true,
      prototype: '3-node local consortium consensus prototype',
      productionRoadmap: 'Hyperledger Fabric / multi-organization deployment',
      clusterRunning,
      onlineNodes,
      totalConfiguredNodes: nodePorts.length,
      quorumThreshold: '>= 2/3 (2 nodes)',
      quorumReachable: clusterRunning,
      nodes: nodeResults,
      instructions: !clusterRunning
        ? 'Run "npm run demo:consortium" to launch the 3 independent node processes.'
        : 'All 3 independent processes active and communicating over HTTP gossip.',
    });
  });

  /**
   * POST /api/nodes/consortium/demo-round
   * Trigger a proposal and majority consensus round across independent processes
   */
  router.post('/consortium/demo-round', async (req: Request, res: Response) => {
    try {
      const leaderUrl = 'http://localhost:4101';
      const roundResp = await fetch(`${leaderUrl}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {}),
        signal: AbortSignal.timeout(5000),
      });

      if (roundResp.ok) {
        const data = (await roundResp.json()) as any;
        return res.json({ success: true, result: data });
      } else {
        const errData = (await roundResp.json().catch(() => ({}))) as any;
        return res.status(roundResp.status).json({
          success: false,
          error: errData.error || 'Proposal failed',
          details: errData,
        });
      }
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        error: `Could not connect to Consortium Leader on port 4101: ${err.message}`,
        hint: 'Start the 3-node consortium via "npm run demo:consortium"',
      });
    }
  });

  /**
   * GET /api/nodes/audit/cross-node
   * Cross-node cryptographic consistency audit
   */
  router.get('/audit/cross-node', (_req: Request, res: Response) => {
    try {
      const report = adapter.verifyCrossNodeLedger();
      return res.json({
        success: true,
        auditReport: report,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/nodes/:nodeId
   * Retrieve single node details and local block history
   */
  router.get('/:nodeId', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const node = adapter.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ success: false, error: `Node ${nodeId} not found` });
      }

      return res.json({
        success: true,
        node: {
          nodeId: node.nodeId,
          name: node.name,
          role: node.role,
          did: node.did,
          status: node.getStatus(),
          height: node.getHeight(),
          blocks: node.getAllBlocks(),
          integrity: node.verifyLocalChainIntegrity(),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/nodes/:nodeId/fail
   * Simulate node crash / network disconnect
   */
  router.post('/:nodeId/fail', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const result = adapter.failNode(nodeId);
      return res.json({ success: true, message: `Node ${nodeId} marked OFFLINE`, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/nodes/:nodeId/recover
   * Reconnect node and automatically trigger catch-up synchronization
   */
  router.post('/:nodeId/recover', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const result = adapter.recoverNode(nodeId);
      return res.json({ success: true, message: `Node ${nodeId} recovered and synchronized`, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/nodes/:nodeId/sync
   * Manually trigger peer synchronization protocol
   */
  router.post('/:nodeId/sync', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const result = adapter.syncNode(nodeId);
      return res.json({ success: true, message: `Node ${nodeId} sync complete`, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/nodes/:nodeId/tamper
   * Deliberately tamper with local database record for Byzantine detection demo
   */
  router.post('/:nodeId/tamper', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const { height = 1, mutatedBlockHash, payloadMutation } = req.body || {};
      const result = adapter.tamperNode(nodeId, Number(height), {
        blockHash: mutatedBlockHash || '0xdeadbeef_corrupted_hash',
        payloadMutation: payloadMutation || { tamperedBy: 'adversary' },
      });
      return res.json({ success: true, message: `Node ${nodeId} tampered at block #${height}`, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}
