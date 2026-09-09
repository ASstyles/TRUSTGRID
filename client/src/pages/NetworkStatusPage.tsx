import React, { useState, useEffect, useRef } from 'react';
import {
  api,
  NetworkStatusResponse,
  NetworkNodeInfo
} from '../services/api';
import {
  Server,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Send,
  Power,
  RotateCcw,
  Layers,
  Cpu,
  Radio,
  ExternalLink
} from 'lucide-react';

export const NetworkStatusPage: React.FC = () => {
  const [data, setData] = useState<NetworkStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdatedSec, setLastUpdatedSec] = useState<number>(0);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.getNetworkStatus();
      if (res?.success) {
        setData(res);
        setLastUpdatedSec(0);
      }
    } catch (err) {
      console.error('Failed to fetch network status:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 4 seconds
    timerRef.current = setInterval(() => {
      fetchStatus(false);
    }, 4000);

    // Update "Last updated X seconds ago" counter every second
    secTimerRef.current = setInterval(() => {
      setLastUpdatedSec((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (secTimerRef.current) clearInterval(secTimerRef.current);
    };
  }, []);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleProposeBlock = async () => {
    setActionLoading('propose');
    setActionMessage(null);
    try {
      const res = await api.proposeDemoBlock();
      if (res?.success) {
        setActionMessage({
          type: 'success',
          text: `Consortium consensus reached! Block #${res.result?.block?.header?.height ?? 1} committed across quorum.`,
        });
        await fetchStatus(true);
      } else {
        setActionMessage({
          type: 'error',
          text: res?.error || 'Proposal failed. Make sure Node 1 (Alpha) on port 4101 is running.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error proposing block';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleNode = async (nodeId: string) => {
    setActionLoading(`toggle-${nodeId}`);
    setActionMessage(null);
    try {
      const res = await api.toggleNetworkNode(nodeId);
      if (res?.success) {
        setActionMessage({
          type: 'success',
          text: `Node ${nodeId.toUpperCase()} state toggled to ${res.result?.status}. Quorum recalculated in real-time.`,
        });
        await fetchStatus(true);
      } else {
        setActionMessage({
          type: 'error',
          text: res?.error || `Failed to toggle node ${nodeId}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncNode = async (nodeId: string) => {
    setActionLoading(`sync-${nodeId}`);
    setActionMessage(null);
    try {
      const res = await api.syncNetworkNode(nodeId);
      if (res?.success) {
        setActionMessage({
          type: 'success',
          text: `Node ${nodeId.toUpperCase()} synchronized missing blocks from honest peers.`,
        });
        await fetchStatus(true);
      } else {
        setActionMessage({
          type: 'error',
          text: res?.error || `Failed to sync node ${nodeId}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const network = data?.network;
  const nodes = data?.nodes || [];

  const alphaNode = nodes.find((n) => n.id === 'alpha' || n.port === 4101);
  const betaNode = nodes.find((n) => n.id === 'beta' || n.port === 4102);
  const gammaNode = nodes.find((n) => n.id === 'gamma' || n.port === 4103);

  const isAlphaOnline = alphaNode?.status === 'ONLINE';
  const isBetaOnline = betaNode?.status === 'ONLINE';
  const isGammaOnline = gammaNode?.status === 'ONLINE';

  const linkAlphaBeta = isAlphaOnline && isBetaOnline;
  const linkAlphaGamma = isAlphaOnline && isGammaOnline;
  const linkBetaGamma = isBetaOnline && isGammaOnline;

  const onlineCount = network?.quorum?.available ?? 0;
  const hasQuorum = network?.quorum?.hasQuorum ?? false;

  return (
    <div className="network-status-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header Section */}
      <div className="tg-card" style={{ background: 'linear-gradient(135deg, rgba(18, 24, 38, 0.95), rgba(13, 18, 28, 0.98))', borderColor: 'var(--border-glow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                background: 'var(--accent-cyan-glow)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Radio size={22} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  TRUSTGRID NETWORK STATUS
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px', margin: 0 }}>
                  3-Node Consortium • 2-of-3 Quorum • Live Node Health
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: hasQuorum ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                boxShadow: hasQuorum ? '0 0 8px var(--accent-emerald)' : '0 0 8px var(--accent-rose)',
                display: 'inline-block',
              }} />
              <span>Auto-refreshing (4s) • Updated {lastUpdatedSec}s ago</span>
            </div>

            <button
              className="demo-btn"
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <RefreshCw size={15} className={refreshing ? 'spin-animation' : ''} />
              <span>{refreshing ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* SIH Evaluation Architecture Banner */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(6, 182, 212, 0.05)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          fontSize: '0.825rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>
              <strong>Consortium Substrate:</strong> 3 Independent Local Node Processes (Ports 4101, 4102, 4103) running isolated SQLite ledgers with 2-of-3 PBFT majority quorum.
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Production Target: <strong>Hyperledger Fabric Multi-Org Channel</strong>
          </div>
        </div>
      </div>

      {/* Action Message Alert Banner */}
      {actionMessage && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          background: actionMessage.type === 'success' ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
          border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
          color: actionMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Key Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {/* Network Health */}
        <div className="tg-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            NETWORK HEALTH
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {network?.status === 'HEALTHY' && <CheckCircle2 size={24} style={{ color: 'var(--accent-emerald)' }} />}
            {network?.status === 'DEGRADED' && <AlertTriangle size={24} style={{ color: 'var(--accent-amber)' }} />}
            {(network?.status === 'QUORUM_LOST' || !network) && <XCircle size={24} style={{ color: 'var(--accent-rose)' }} />}
            <div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: network?.status === 'HEALTHY' ? 'var(--accent-emerald)'
                  : network?.status === 'DEGRADED' ? 'var(--accent-amber)' : 'var(--accent-rose)',
              }}>
                {network?.status === 'HEALTHY' ? 'HEALTHY' : network?.status === 'DEGRADED' ? 'DEGRADED' : 'QUORUM LOST'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {onlineCount} / 3 nodes online
              </div>
            </div>
          </div>
        </div>

        {/* Quorum */}
        <div className="tg-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            QUORUM
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} style={{ color: hasQuorum ? 'var(--accent-cyan)' : 'var(--accent-rose)' }} />
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                2 / 3 required
              </div>
              <div style={{ fontSize: '0.8rem', color: hasQuorum ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                {hasQuorum ? `Quorum Active (${onlineCount}/3 Available)` : 'Quorum Unavailable (< 2 Nodes)'}
              </div>
            </div>
          </div>
        </div>

        {/* Consensus */}
        <div className="tg-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            CONSENSUS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={24} style={{ color: network?.consensus === 'READY' ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
            <div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: network?.consensus === 'READY' ? 'var(--accent-emerald)'
                  : network?.consensus === 'SYNCING' ? 'var(--accent-amber)' : 'var(--accent-rose)',
              }}>
                {network?.consensus === 'READY' ? 'READY / CONFIRMED'
                  : network?.consensus === 'SYNCING' ? 'SYNCING / DIVERGED' : 'NO QUORUM'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {network?.converged ? 'Ledger Hashes Converged' : 'Hash Divergence Detected'}
              </div>
            </div>
          </div>
        </div>

        {/* Block Height & Latest Hash */}
        <div className="tg-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            BLOCK HEIGHT & LATEST BLOCK
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={24} style={{ color: 'var(--accent-cyan)' }} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Height #{network?.latestHeight ?? 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '120px',
                }}>
                  {network?.latestBlockHash ? network.latestBlockHash.slice(0, 14) + '...' : 'Genesis / None'}
                </span>
                {network?.latestBlockHash && (
                  <button
                    onClick={() => handleCopyHash(network.latestBlockHash || '')}
                    title="Copy Block Hash"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedHash ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {copiedHash ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Real 3-Node Consortium Cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Independent Consortium Nodes</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Each node runs an independent daemon with isolated SQLite state
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}>
          {/* NODE 1: ALPHA */}
          <NodeCard
            id="alpha"
            title="ALPHA"
            subtitle="Consortium Proposer / Leader"
            role="PROPOSER"
            port={4101}
            node={alphaNode}
            loading={actionLoading === 'toggle-alpha' || actionLoading === 'sync-alpha'}
            onToggle={() => handleToggleNode('alpha')}
            onSync={() => handleSyncNode('alpha')}
          />

          {/* NODE 2: BETA */}
          <NodeCard
            id="beta"
            title="BETA"
            subtitle="Logistics Validator Peer"
            role="VALIDATOR"
            port={4102}
            node={betaNode}
            loading={actionLoading === 'toggle-beta' || actionLoading === 'sync-beta'}
            onToggle={() => handleToggleNode('beta')}
            onSync={() => handleSyncNode('beta')}
          />

          {/* NODE 3: GAMMA */}
          <NodeCard
            id="gamma"
            title="GAMMA"
            subtitle="Auditor Validator Peer"
            role="VALIDATOR"
            port={4103}
            node={gammaNode}
            loading={actionLoading === 'toggle-gamma' || actionLoading === 'sync-gamma'}
            onToggle={() => handleToggleNode('gamma')}
            onSync={() => handleSyncNode('gamma')}
          />
        </div>
      </div>

      {/* 4. Consortium Mesh Topology Visualization */}
      <div className="tg-card">
        <div className="tg-card-header">
          <div className="tg-card-title">
            <Radio size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>Live Consortium Network Topology</span>
          </div>
          <span className="status-pill status-authentic">
            Gossip Protocol Active
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Visual mesh connectivity reflecting actual node health. Active communication links are highlighted in green; severed connections to offline nodes are indicated with dashed red lines.
        </p>

        {/* SVG Network Topology Map */}
        <div style={{
          position: 'relative',
          background: 'rgba(7, 9, 14, 0.85)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '280px',
          overflow: 'hidden',
        }}>
          <svg viewBox="0 0 600 240" style={{ width: '100%', maxWidth: '600px', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="linkActive" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Mesh Links */}
            {/* Alpha (120, 70) to Beta (480, 70) */}
            <line
              x1="120"
              y1="70"
              x2="480"
              y2="70"
              stroke={linkAlphaBeta ? 'url(#linkActive)' : '#e11d48'}
              strokeWidth={linkAlphaBeta ? '3' : '1.5'}
              strokeDasharray={linkAlphaBeta ? 'none' : '6,6'}
              strokeOpacity={linkAlphaBeta ? 0.9 : 0.4}
              filter={linkAlphaBeta ? 'url(#glow)' : undefined}
            />

            {/* Alpha (120, 70) to Gamma (300, 190) */}
            <line
              x1="120"
              y1="70"
              x2="300"
              y2="190"
              stroke={linkAlphaGamma ? 'url(#linkActive)' : '#e11d48'}
              strokeWidth={linkAlphaGamma ? '3' : '1.5'}
              strokeDasharray={linkAlphaGamma ? 'none' : '6,6'}
              strokeOpacity={linkAlphaGamma ? 0.9 : 0.4}
              filter={linkAlphaGamma ? 'url(#glow)' : undefined}
            />

            {/* Beta (480, 70) to Gamma (300, 190) */}
            <line
              x1="480"
              y1="70"
              x2="300"
              y2="190"
              stroke={linkBetaGamma ? 'url(#linkActive)' : '#e11d48'}
              strokeWidth={linkBetaGamma ? '3' : '1.5'}
              strokeDasharray={linkBetaGamma ? 'none' : '6,6'}
              strokeOpacity={linkBetaGamma ? 0.9 : 0.4}
              filter={linkBetaGamma ? 'url(#glow)' : undefined}
            />

            {/* Central PBFT Hub Circle */}
            <circle cx="300" cy="110" r="32" fill="#0d121c" stroke={hasQuorum ? '#06b6d4' : '#e11d48'} strokeWidth="2" strokeDasharray="3,3" />
            <text x="300" y="106" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" fontWeight="700">PBFT</text>
            <text x="300" y="120" textAnchor="middle" fill={hasQuorum ? '#10b981' : '#f43f5e'} fontSize="9" fontFamily="sans-serif" fontWeight="600">
              {hasQuorum ? 'QUORUM 2/3' : 'NO QUORUM'}
            </text>

            {/* Node Alpha (Top Left) */}
            <g transform="translate(120, 70)">
              <circle r="26" fill="#121826" stroke={isAlphaOnline ? '#10b981' : '#f43f5e'} strokeWidth="3" filter={isAlphaOnline ? 'url(#glow)' : undefined} />
              <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="sans-serif">α</text>
              <text x="0" y="-34" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="sans-serif">ALPHA</text>
              <text x="0" y="-22" textAnchor="middle" fill="#06b6d4" fontSize="9" fontFamily="sans-serif">PROPOSER :4101</text>
              <circle cx="16" cy="-16" r="6" fill={isAlphaOnline ? '#10b981' : '#f43f5e'} />
            </g>

            {/* Node Beta (Top Right) */}
            <g transform="translate(480, 70)">
              <circle r="26" fill="#121826" stroke={isBetaOnline ? '#10b981' : '#f43f5e'} strokeWidth="3" filter={isBetaOnline ? 'url(#glow)' : undefined} />
              <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="sans-serif">β</text>
              <text x="0" y="-34" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="sans-serif">BETA</text>
              <text x="0" y="-22" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontFamily="sans-serif">VALIDATOR :4102</text>
              <circle cx="16" cy="-16" r="6" fill={isBetaOnline ? '#10b981' : '#f43f5e'} />
            </g>

            {/* Node Gamma (Bottom Center) */}
            <g transform="translate(300, 190)">
              <circle r="26" fill="#121826" stroke={isGammaOnline ? '#10b981' : '#f43f5e'} strokeWidth="3" filter={isGammaOnline ? 'url(#glow)' : undefined} />
              <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="sans-serif">γ</text>
              <text x="0" y="42" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="sans-serif">GAMMA</text>
              <text x="0" y="54" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontFamily="sans-serif">VALIDATOR :4103</text>
              <circle cx="16" cy="-16" r="6" fill={isGammaOnline ? '#10b981' : '#f43f5e'} />
            </g>
          </svg>
        </div>

        {/* Status Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
            <span>Online & Endorsing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-rose)', display: 'inline-block' }} />
            <span>Offline / Unreachable</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '18px', height: '3px', background: 'var(--accent-cyan)', display: 'inline-block' }} />
            <span>Active Peer Gossip Link</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '18px', height: '2px', borderTop: '2px dashed #f43f5e', display: 'inline-block' }} />
            <span>Degraded / Severed Link</span>
          </div>
        </div>
      </div>

      {/* 5. Live Demonstration & Fault Tolerance Controls */}
      <div className="tg-card">
        <div className="tg-card-header">
          <div className="tg-card-title">
            <Send size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>Live Consortium Control & Fault Tolerance Testing Console</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            One-Click Proof-of-Consensus
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          Use these controls during the SIH evaluation to demonstrate live multi-node block proposals, quorum fault-tolerance (shutting down 1 node while consensus still succeeds), and automatic catch-up synchronization.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          <button
            className="demo-btn primary"
            onClick={handleProposeBlock}
            disabled={actionLoading === 'propose' || !hasQuorum}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 600 }}
          >
            <Send size={16} />
            <span>{actionLoading === 'propose' ? 'Proposing Block Round...' : 'Propose New Block Round (2/3 Majority)'}</span>
          </button>

          <button
            className="demo-btn"
            onClick={() => handleToggleNode('gamma')}
            disabled={actionLoading === 'toggle-gamma'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
          >
            <Power size={16} style={{ color: isGammaOnline ? 'var(--accent-rose)' : 'var(--accent-emerald)' }} />
            <span>{isGammaOnline ? 'Simulate Crash: Take Gamma OFFLINE' : 'Recover Gamma: Bring ONLINE'}</span>
          </button>

          <button
            className="demo-btn"
            onClick={() => handleSyncNode('gamma')}
            disabled={actionLoading === 'sync-gamma' || !isGammaOnline}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
          >
            <RotateCcw size={16} />
            <span>Trigger Catch-Up Sync (Gamma)</span>
          </button>
        </div>

        {/* CLI Reference Box */}
        <div style={{
          marginTop: '22px',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            TERMINAL CLI COMMANDS FOR INDEPENDENT NODE PROCESSES:
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><code>npm run node:1</code> <span style={{ color: 'var(--text-muted)' }}># Launch Node 1 (Alpha - Proposer on port 4101)</span></div>
            <div><code>npm run node:2</code> <span style={{ color: 'var(--text-muted)' }}># Launch Node 2 (Beta - Validator on port 4102)</span></div>
            <div><code>npm run node:3</code> <span style={{ color: 'var(--text-muted)' }}># Launch Node 3 (Gamma - Validator on port 4103)</span></div>
            <div><code>npm run demo:consortium</code> <span style={{ color: 'var(--text-muted)' }}># Run automated 5-stage consensus & fault tolerance test</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface NodeCardProps {
  id: string;
  title: string;
  subtitle: string;
  role: 'PROPOSER' | 'VALIDATOR';
  port: number;
  node?: NetworkNodeInfo;
  loading: boolean;
  onToggle: () => void;
  onSync: () => void;
}

const NodeCard: React.FC<NodeCardProps> = ({
  id,
  title,
  subtitle,
  role,
  port,
  node,
  loading,
  onToggle,
  onSync,
}) => {
  const isOnline = node?.status === 'ONLINE';

  return (
    <div className="tg-card" style={{
      borderTop: `3px solid ${isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              boxShadow: isOnline ? '0 0 8px var(--accent-emerald)' : '0 0 8px var(--accent-rose)',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.02em' }}>{title}</span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: role === 'PROPOSER' ? 'var(--accent-cyan-glow)' : 'rgba(139, 92, 246, 0.15)',
              color: role === 'PROPOSER' ? 'var(--accent-cyan)' : 'var(--accent-violet)',
              border: `1px solid ${role === 'PROPOSER' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
            }}>
              {role}
            </span>
          </div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
        </div>

        <span className={`status-pill ${isOnline ? 'status-authentic' : 'status-tampered'}`}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* Node Metrics Grid */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontSize: '0.825rem',
        marginBottom: '16px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Port:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{port}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Block Height:</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: isOnline ? 'var(--accent-cyan)' : 'var(--text-muted)',
          }}>
            {isOnline && typeof node?.blockHeight === 'number' ? `Height #${node.blockHeight}` : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Latest Block Hash:</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: isOnline && node?.latestBlockHash ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}>
            {isOnline && node?.latestBlockHash ? `${node.latestBlockHash.slice(0, 16)}...` : 'Unavailable'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Response Latency:</span>
          <span style={{ color: isOnline ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
            {isOnline && typeof node?.responseTimeMs === 'number' ? `${node.responseTimeMs} ms` : 'Unreachable'}
          </span>
        </div>

        {node?.error && !isOnline && (
          <div style={{ color: 'var(--accent-rose)', fontSize: '0.75rem', marginTop: '2px', borderTop: '1px solid rgba(244, 63, 94, 0.2)', paddingTop: '4px' }}>
            ⚠ {node.error}
          </div>
        )}
      </div>

      {/* Node Controls */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="demo-btn"
          onClick={onToggle}
          disabled={loading}
          style={{ flex: 1, padding: '6px 12px', fontSize: '0.775rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Power size={13} style={{ color: isOnline ? 'var(--accent-rose)' : 'var(--accent-emerald)' }} />
          <span>{isOnline ? 'Toggle Offline' : 'Toggle Online'}</span>
        </button>

        <button
          className="demo-btn"
          onClick={onSync}
          disabled={loading || !isOnline}
          style={{ padding: '6px 12px', fontSize: '0.775rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          title="Catch-up Synchronize from Peers"
        >
          <RotateCcw size={13} />
          <span>Sync</span>
        </button>
      </div>
    </div>
  );
};
