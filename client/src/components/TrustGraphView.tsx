import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Network, Filter, Info, Shield, ArrowUpRight } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  category: string;
  sector?: string;
  status?: string;
  metadata?: any;
  x?: number;
  y?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  txId?: string;
}

export const TrustGraphView: React.FC = () => {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; summary?: any } | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadGraph(selectedSector);
  }, [selectedSector]);

  const loadGraph = async (sector?: string) => {
    setLoading(true);
    try {
      const res = await api.getTrustGraph(sector);
      if (res.success && res.graph) {
        // Layout calculation for clean circular / force-like placement
        const nodes = res.graph.nodes.map((node: GraphNode, i: number) => {
          const total = res.graph.nodes.length;
          const angle = (i / total) * 2 * Math.PI;
          const radius = node.category === 'ENTITY' ? 180 : 310;
          return {
            ...node,
            x: 450 + radius * Math.cos(angle),
            y: 350 + radius * Math.sin(angle),
          };
        });
        setGraphData({ ...res.graph, nodes });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSectorColor = (sector?: string, category?: string) => {
    if (category === 'ENTITY') return '#38bdf8'; // Cyan
    if (sector === 'EDUCATION') return '#06b6d4'; // Cyan/Teal
    if (sector === 'SUPPLY_CHAIN') return '#f59e0b'; // Amber
    if (sector === 'LEGAL') return '#10b981'; // Emerald
    if (sector === 'CYBERSECURITY') return '#8b5cf6'; // Violet
    return '#64748b';
  };

  return (
    <div className="tg-card">
      <div className="tg-card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="tg-card-title">
            <Network size={22} style={{ color: 'var(--accent-cyan)' }} />
            <span>Interactive Multi-Sector Trust Graph</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Visualizes verifiable cryptographic relationships linking Decentralized Identities (DIDs) to Trust Objects.
          </p>
        </div>

        {/* Sector Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['', 'EDUCATION', 'SUPPLY_CHAIN', 'LEGAL', 'CYBERSECURITY'].map((s) => (
            <button
              key={s}
              className={`demo-btn ${selectedSector === s ? 'active' : ''}`}
              onClick={() => setSelectedSector(s)}
              style={{ fontSize: '0.75rem' }}
            >
              <Filter size={12} />
              {s === '' ? 'All Sectors' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Graph Area */}
      <div style={{ position: 'relative', width: '100%', height: '700px', background: '#05070c', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--accent-cyan)' }}>
            Loading cryptographic Trust Graph...
          </div>
        )}

        {graphData && (
          <svg width="100%" height="100%" viewBox="0 0 900 700" style={{ cursor: 'grab' }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.4)" />
              </marker>
            </defs>

            {/* Render Edges */}
            {graphData.edges.map((edge) => {
              const sourceNode = graphData.nodes.find((n) => n.id === edge.source);
              const targetNode = graphData.nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              return (
                <g key={edge.id}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="rgba(148, 163, 184, 0.25)"
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x={((sourceNode.x || 0) + (targetNode.x || 0)) / 2}
                    y={((sourceNode.y || 0) + (targetNode.y || 0)) / 2 - 4}
                    fill="var(--text-muted)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Render Nodes */}
            {graphData.nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const color = getSectorColor(node.sector, node.category);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={node.category === 'ENTITY' ? 18 : 14}
                    fill="#0d131f"
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 1.5}
                    filter={isSelected ? 'drop-shadow(0 0 8px ' + color + ')' : undefined}
                  />
                  <circle
                    r={node.category === 'ENTITY' ? 6 : 4}
                    fill={color}
                  />
                  <text
                    y={node.category === 'ENTITY' ? 28 : 24}
                    fill="var(--text-primary)"
                    fontSize="10"
                    fontWeight={isSelected ? 700 : 500}
                    fontFamily="var(--font-sans)"
                    textAnchor="middle"
                  >
                    {node.label.length > 18 ? node.label.substring(0, 16) + '...' : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            right: '16px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-bright)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-md)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="status-pill" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
                  {selectedNode.category}
                </span>
                {selectedNode.sector && (
                  <span className="status-pill" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-violet)' }}>
                    {selectedNode.sector}
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {selectedNode.id}
                </span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {selectedNode.label}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="demo-btn"
                onClick={() => setSelectedNode(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      {graphData?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div className="tg-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {graphData.summary.totalEntities}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Verified DIDs
            </div>
          </div>

          <div className="tg-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>
              {graphData.summary.totalTrustObjects}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Trust Objects (TOP)
            </div>
          </div>

          <div className="tg-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {graphData.summary.totalRelationships}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Anchored Relationships
            </div>
          </div>

          <div className="tg-card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
              4
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Sectors Integrated
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
