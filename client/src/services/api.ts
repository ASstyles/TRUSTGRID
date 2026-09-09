const API_BASE = '/api';

export interface VerificationResult {
  overallStatus: 'AUTHENTIC' | 'TAMPERED' | 'REVOKED' | 'EXPIRED' | 'INVALID_SIGNATURE' | 'PROVENANCE_MISMATCH' | 'DEVICE_INTEGRITY_COMPROMISED' | 'CONSENSUS_REJECTED';
  trustScore: number;
  trustObjectId: string;
  objectType: string;
  subjectId: string;
  issuerId: string;
  ownerId: string;
  presentedHash: string;
  canonicalHash: string;
  onChainHash: string;
  hashMatch: boolean;
  signatureValid: boolean;
  blockchainProofValid: boolean;
  revocationStatus: {
    isRevoked: boolean;
    revokedAt?: string | null;
    revokedBy?: string | null;
    reason?: string | null;
  };
  expirationStatus: {
    isExpired: boolean;
    expiresAt?: string | null;
  };
  provenanceStatus: {
    isValid: boolean;
    eventCount: number;
    lastCustodian: string;
  };
  blockchainProof?: any;
  checks: Array<{
    code: string;
    name: string;
    passed: boolean;
    details: string;
    timestamp: string;
  }>;
  riskAssessment: {
    riskScore: number;
    riskLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    factors: Array<{ factor: string; impact: number; explanation: string }>;
  };
  verifiedAt: string;
}

export const api = {
  // Demo Scenarios
  getDemoScenarios: async () => {
    const res = await fetch(`${API_BASE}/demo/scenarios`);
    return res.json();
  },
  runDemoScenario: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/demo/run/${scenarioId}`, { method: 'POST' });
    return res.json();
  },

  // Verification
  verifyObject: async (trustObjectId: string, presentedMetadata?: any): Promise<{ success: boolean; result: VerificationResult }> => {
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustObjectId, presentedMetadata }),
    });
    return res.json();
  },

  // Trust Objects
  getTrustObjects: async (sector?: string, status?: string) => {
    let url = `${API_BASE}/trust-objects`;
    const params = new URLSearchParams();
    if (sector) params.append('sector', sector);
    if (status) params.append('status', status);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await fetch(url);
    return res.json();
  },
  getTrustObject: async (id: string) => {
    const res = await fetch(`${API_BASE}/trust-objects/${id}`);
    return res.json();
  },
  tamperTrustObject: async (id: string, modifiedMetadata: any) => {
    const res = await fetch(`${API_BASE}/trust-objects/${id}/tamper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modifiedMetadata }),
    });
    return res.json();
  },

  // Education
  getCredentials: async () => {
    const res = await fetch(`${API_BASE}/education/credentials`);
    return res.json();
  },
  issueDegree: async (payload: any) => {
    const res = await fetch(`${API_BASE}/education/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Supply Chain
  getProducts: async () => {
    const res = await fetch(`${API_BASE}/supply-chain/products`);
    return res.json();
  },
  registerProduct: async (payload: any) => {
    const res = await fetch(`${API_BASE}/supply-chain/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  transferProduct: async (payload: any) => {
    const res = await fetch(`${API_BASE}/supply-chain/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Legal
  getEvidence: async () => {
    const res = await fetch(`${API_BASE}/legal/evidence`);
    return res.json();
  },
  registerEvidence: async (payload: any) => {
    const res = await fetch(`${API_BASE}/legal/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  transferEvidence: async (payload: any) => {
    const res = await fetch(`${API_BASE}/legal/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Cybersecurity
  getDevices: async () => {
    const res = await fetch(`${API_BASE}/cybersecurity/devices`);
    return res.json();
  },
  registerDevice: async (payload: any) => {
    const res = await fetch(`${API_BASE}/cybersecurity/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  auditDevice: async (trustObjectId: string, observedConfigHash: string) => {
    const res = await fetch(`${API_BASE}/cybersecurity/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustObjectId, observedConfigHash }),
    });
    return res.json();
  },
  getSecurityEvents: async () => {
    const res = await fetch(`${API_BASE}/cybersecurity/events`);
    return res.json();
  },

  // Blockchain
  getBlockchainStatus: async () => {
    const res = await fetch(`${API_BASE}/blockchain/status`);
    return res.json();
  },
  getBlocks: async () => {
    const res = await fetch(`${API_BASE}/blockchain/blocks`);
    return res.json();
  },

  // Multi-Node PBFT Cluster
  getClusterNodes: async () => {
    const res = await fetch(`${API_BASE}/nodes`);
    return res.json();
  },
  getCrossNodeAudit: async () => {
    const res = await fetch(`${API_BASE}/nodes/audit/cross-node`);
    return res.json();
  },
  failNode: async (nodeId: string) => {
    const res = await fetch(`${API_BASE}/nodes/${nodeId}/fail`, { method: 'POST' });
    return res.json();
  },
  recoverNode: async (nodeId: string) => {
    const res = await fetch(`${API_BASE}/nodes/${nodeId}/recover`, { method: 'POST' });
    return res.json();
  },
  syncNode: async (nodeId: string) => {
    const res = await fetch(`${API_BASE}/nodes/${nodeId}/sync`, { method: 'POST' });
    return res.json();
  },
  tamperNode: async (nodeId: string, height: number = 1) => {
    const res = await fetch(`${API_BASE}/nodes/${nodeId}/tamper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ height }),
    });
    return res.json();
  },

  // Trust Graph
  getTrustGraph: async (sector?: string) => {
    const url = sector ? `${API_BASE}/graph?sector=${sector}` : `${API_BASE}/graph`;
    const res = await fetch(url);
    return res.json();
  },

  // Trust Passport
  getTrustPassport: async (did: string, selective: boolean = true) => {
    const res = await fetch(`${API_BASE}/passport/${did}?selective=${selective}`);
    return res.json();
  },

  // Risk
  getRiskStats: async () => {
    const res = await fetch(`${API_BASE}/risk/stats`);
    return res.json();
  },
  getRiskEvents: async () => {
    const res = await fetch(`${API_BASE}/risk/events`);
    return res.json();
  },

  // Identities
  getIdentities: async () => {
    const res = await fetch(`${API_BASE}/identities`);
    return res.json();
  },

  // System Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Real 3-Node Consortium Network Status
  getNetworkStatus: async (): Promise<NetworkStatusResponse> => {
    const res = await fetch(`${API_BASE}/network/status`);
    return res.json();
  },
  proposeDemoBlock: async (payload?: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/network/propose-demo-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return res.json();
  },
  toggleNetworkNode: async (nodeId: string, status?: string) => {
    const res = await fetch(`${API_BASE}/network/nodes/${nodeId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },
  syncNetworkNode: async (nodeId: string) => {
    const res = await fetch(`${API_BASE}/network/nodes/${nodeId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    return res.json();
  },
};

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
  error?: string;
}
