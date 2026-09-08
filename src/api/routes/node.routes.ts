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
