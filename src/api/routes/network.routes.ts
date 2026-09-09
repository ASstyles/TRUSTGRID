/**
 * TRUSTGRID Consortium Network Status Routes
 *
 * Provides real-time inspectable status of the 3-node independent process consortium:
 *  - Node 1 (Alpha):  Proposer  - Port 4101
 *  - Node 2 (Beta):   Validator - Port 4102
 *  - Node 3 (Gamma):  Validator - Port 4103
 *
 * Queries nodes over HTTP with strict timeouts to dynamically reflect live online/offline state.
 * Never exposes private keys, seeds, or sensitive secrets.
 */

import { Router, Request, Response } from 'express';

export interface NetworkNodeInfo {
  id: 'alpha' | 'beta' | 'gamma';
  nodeId: string;
  name: string;
  role: 'PROPOSER' | 'VALIDATOR';
  port: number;
  status: 'ONLINE' | 'OFFLINE';
  blockHeight: number | null;
  latestBlockHash: string | null;
  previousHash: string | null;
  lastSeen: string | null;
  did: string | null;
  publicKey: string | null;
  peersCount: number;
  responseTimeMs: number | null;
  error?: string;
}

export interface NetworkQuorumInfo {
  required: number;
  total: number;
  available: number;
  hasQuorum: boolean;
}

export interface NetworkStatusResponse {
  success: boolean;
  network: {
    status: 'HEALTHY' | 'DEGRADED' | 'QUORUM_LOST';
    quorum: NetworkQuorumInfo;
    consensus: 'READY' | 'SYNCING' | 'NO_QUORUM';
    latestHeight: number | null;
    latestBlockHash: string | null;
    converged: boolean;
    clusterTopology: string;
    timestamp: string;
  };
  nodes: NetworkNodeInfo[];
}

interface NodeConfig {
  id: 'alpha' | 'beta' | 'gamma';
  nodeId: string;
  name: string;
  role: 'PROPOSER' | 'VALIDATOR';
  port: number;
}

export const CONSORTIUM_CONFIG: NodeConfig[] = [
  { id: 'alpha', nodeId: 'node-1', name: 'Alpha', role: 'PROPOSER', port: 4101 },
  { id: 'beta', nodeId: 'node-2', name: 'Beta', role: 'VALIDATOR', port: 4102 },
  { id: 'gamma', nodeId: 'node-3', name: 'Gamma', role: 'VALIDATOR', port: 4103 },
];

/**
 * Perform a live check against a single node process over HTTP
 */
export async function checkNodeStatus(config: NodeConfig, timeoutMs = 1200): Promise<NetworkNodeInfo> {
  const url = `http://localhost:${config.port}/blocks/status`;
  const startTime = Date.now();

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const elapsed = Date.now() - startTime;

    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>;
      const rawStatus = (data.nodeStatus || data.status) as string;
      const isOnline = rawStatus === 'ONLINE';

      return {
        id: config.id,
        nodeId: (data.nodeId as string) || config.nodeId,
        name: config.name,
        role: config.role,
        port: config.port,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        blockHeight: typeof data.blockHeight === 'number' ? data.blockHeight : (typeof data.currentHeight === 'number' ? data.currentHeight : 0),
        latestBlockHash: (data.latestBlockHash as string) || null,
        previousHash: (data.previousHash as string) || null,
        lastSeen: new Date().toISOString(),
        did: (data.did as string) || null,
        publicKey: (data.publicKey as string) || null,
        peersCount: typeof data.peersCount === 'number' ? data.peersCount : 2,
        responseTimeMs: elapsed,
        error: isOnline ? undefined : `Node state is ${rawStatus}`,
      };
    } else {
      return {
        id: config.id,
        nodeId: config.nodeId,
        name: config.name,
        role: config.role,
        port: config.port,
        status: 'OFFLINE',
        blockHeight: null,
        latestBlockHash: null,
        previousHash: null,
        lastSeen: null,
        did: null,
        publicKey: null,
        peersCount: 0,
        responseTimeMs: elapsed,
        error: `HTTP ${resp.status} ${resp.statusText}`,
      };
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return {
      id: config.id,
      nodeId: config.nodeId,
      name: config.name,
      role: config.role,
      port: config.port,
      status: 'OFFLINE',
      blockHeight: null,
      latestBlockHash: null,
      previousHash: null,
      lastSeen: null,
      did: null,
      publicKey: null,
      peersCount: 0,
      responseTimeMs: elapsed,
      error: `Process not reachable on port ${config.port} (${msg})`,
    };
  }
}

/**
 * Build aggregated consortium network status from an array of node checks
 */
export function buildNetworkAggregate(nodeStatuses: NetworkNodeInfo[]): NetworkStatusResponse {
  const total = nodeStatuses.length;
  const onlineNodes = nodeStatuses.filter((n) => n.status === 'ONLINE');
  const available = onlineNodes.length;
  const required = Math.ceil((total * 2) / 3); // 2 of 3
  const hasQuorum = available >= required;

  let networkStatus: 'HEALTHY' | 'DEGRADED' | 'QUORUM_LOST';
  if (available === total) {
    networkStatus = 'HEALTHY';
  } else if (hasQuorum) {
    networkStatus = 'DEGRADED';
  } else {
    networkStatus = 'QUORUM_LOST';
  }

  // Determine height and convergence
  let latestHeight: number | null = null;
  let latestBlockHash: string | null = null;
  let converged = false;

  if (onlineNodes.length > 0) {
    const validHeights = onlineNodes.map((n) => n.blockHeight).filter((h): h is number => typeof h === 'number');
    latestHeight = validHeights.length > 0 ? Math.max(...validHeights) : 0;

    const leaderNode = onlineNodes.find((n) => n.role === 'PROPOSER') || onlineNodes[0];
    latestBlockHash = leaderNode.latestBlockHash;

    // Check if all online nodes have identical block height and block hash
    if (onlineNodes.length >= 2) {
      const firstHash = onlineNodes[0].latestBlockHash;
      const firstHeight = onlineNodes[0].blockHeight;
      converged = onlineNodes.every((n) => n.blockHeight === firstHeight && n.latestBlockHash === firstHash);
    } else {
      converged = true;
    }
  }

  let consensus: 'READY' | 'SYNCING' | 'NO_QUORUM';
  if (!hasQuorum) {
    consensus = 'NO_QUORUM';
  } else if (converged) {
    consensus = 'READY';
  } else {
    consensus = 'SYNCING';
  }

  return {
    success: true,
    network: {
      status: networkStatus,
      quorum: {
        required,
        total,
        available,
        hasQuorum,
      },
      consensus,
      latestHeight,
      latestBlockHash,
      converged,
      clusterTopology: '3-Node Consortium Mesh (Ports 4101, 4102, 4103)',
      timestamp: new Date().toISOString(),
    },
    nodes: nodeStatuses,
  };
}

export function createNetworkRoutes(): Router {
  const router = Router();

  /**
   * GET /api/network/status
   * Live health check of all 3 consortium nodes
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const checks = await Promise.all(
        CONSORTIUM_CONFIG.map((config) => checkNodeStatus(config))
      );
      const response = buildNetworkAggregate(checks);
      return res.json(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query consortium network';
      return res.status(500).json({
        success: false,
        error: msg,
      });
    }
  });

  /**
   * POST /api/network/propose-demo-block
   * Trigger proposal of a new block round across the consortium
   */
  router.post('/propose-demo-block', async (req: Request, res: Response) => {
    try {
      const leaderUrl = 'http://localhost:4101/blocks/propose';
      const body = req.body && Object.keys(req.body).length > 0
        ? req.body
        : {
            actionType: 'ANCHOR_CREDENTIAL',
            trustObjectId: `TO-DEMO-ROUND-${Date.now()}`,
            contentHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
            signerDid: 'did:trustgrid:sys:consortium-notary',
            payload: {
              event: 'SIH_CONSORTIUM_DEMO_BLOCK',
              initiatedBy: 'NetworkStatusDashboard',
              timestamp: new Date().toISOString(),
            },
          };

      const resp = await fetch(leaderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        return res.json({ success: true, result: data });
      } else {
        const errText = await resp.text();
        return res.status(resp.status).json({
          success: false,
          error: `Leader rejected proposal: ${errText}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not contact Leader (Node 1)';
      return res.status(503).json({
        success: false,
        error: `Consortium Leader on port 4101 is unreachable: ${msg}. Make sure Node 1 is running.`,
      });
    }
  });

  /**
   * POST /api/network/nodes/:nodeId/toggle
   * Toggle a node's ONLINE/OFFLINE status for fault tolerance testing
   */
  router.post('/nodes/:nodeId/toggle', async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const nodeConfig = CONSORTIUM_CONFIG.find(
      (c) => c.id === nodeId || c.nodeId === nodeId
    );

    if (!nodeConfig) {
      return res.status(404).json({
        success: false,
        error: `Node ${nodeId} not found. Valid IDs: alpha, beta, gamma`,
      });
    }

    try {
      const resp = await fetch(`http://localhost:${nodeConfig.port}/status/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {}),
        signal: AbortSignal.timeout(2000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        return res.json({ success: true, result: data });
      } else {
        return res.status(resp.status).json({
          success: false,
          error: `Node ${nodeConfig.name} returned HTTP ${resp.status}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return res.status(503).json({
        success: false,
        error: `Node ${nodeConfig.name} on port ${nodeConfig.port} is offline or unreachable: ${msg}`,
      });
    }
  });

  /**
   * POST /api/network/nodes/:nodeId/sync
   * Trigger peer catch-up synchronization on a node
   */
  router.post('/nodes/:nodeId/sync', async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const nodeConfig = CONSORTIUM_CONFIG.find(
      (c) => c.id === nodeId || c.nodeId === nodeId
    );

    if (!nodeConfig) {
      return res.status(404).json({
        success: false,
        error: `Node ${nodeId} not found. Valid IDs: alpha, beta, gamma`,
      });
    }

    try {
      const resp = await fetch(`http://localhost:${nodeConfig.port}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || { force: true }),
        signal: AbortSignal.timeout(3000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        return res.json({ success: true, result: data });
      } else {
        return res.status(resp.status).json({
          success: false,
          error: `Node ${nodeConfig.name} sync returned HTTP ${resp.status}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return res.status(503).json({
        success: false,
        error: `Node ${nodeConfig.name} on port ${nodeConfig.port} is unreachable: ${msg}`,
      });
    }
  });

  return router;
}
