import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Activity, ShieldAlert, AlertTriangle, CheckCircle2, TrendingUp, Cpu } from 'lucide-react';

export const RiskDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        api.getRiskStats(),
        api.getRiskEvents(),
      ]);
      if (statsRes.success) setStats(statsRes.stats);
      if (eventsRes.success) setRiskEvents(eventsRes.events);
    } catch (e) {
      console.error(e);
    }
  };

  const riskFactorsGuide = [
    { factor: 'CONTENT_INTEGRITY_TAMPER', impact: 55, desc: 'Off-chain data canonical hash diverges from blockchain proof' },
    { factor: 'INVALID_ISSUER_SIGNATURE', impact: 45, desc: 'Ed25519 signature fails verification against issuer public key' },
    { factor: 'BROKEN_PROVENANCE_CHAIN', impact: 35, desc: 'Handoff custody was not signed by the legitimate prior owner' },
    { factor: 'DUPLICATE_CREDENTIAL_CLAIM', impact: 30, desc: 'Same credential hash claimed by multiple distinct entity DIDs' },
    { factor: 'ACTIVE_SECURITY_INCIDENTS', impact: 30, desc: 'Unresolved baseline configuration breaches on device' },
    { factor: 'HIGH_FREQUENCY_VERIFICATION_SPIKE', impact: 20, desc: 'Abnormal velocity: >6 verification requests within 15 minutes' },
  ];

  return (
    <div>
      <div className="tg-card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="tg-card-title">
            <Activity size={24} style={{ color: 'var(--accent-rose)' }} />
            <span>Explainable Trust Risk Engine Center</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Deterministic, explainable behavioral and cryptographic anomaly detection (0-100 scoring with transparent rationale).
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="tg-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Verifications</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: '4px' }}>
              {stats.totalVerifications}
            </div>
          </div>

          <div className="tg-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Authentic Proofs</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-emerald)', marginTop: '4px' }}>
              {stats.authentic}
            </div>
          </div>

          <div className="tg-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tampered Catches</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-rose)', marginTop: '4px' }}>
              {stats.tampered}
            </div>
          </div>

          <div className="tg-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Revoked Objects</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-amber)', marginTop: '4px' }}>
              {stats.revoked}
            </div>
          </div>
        </div>
      )}

      {/* Explainable Factor Weights Matrix */}
      <div className="tg-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
          Explainable Anomaly Factor Scoring Matrix (0 – 100 Scale)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
          {riskFactorsGuide.map((f) => (
            <div key={f.factor} style={{ background: '#0a0e17', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{f.factor}</span>
                <span className="status-pill status-tampered" style={{ fontSize: '0.75rem' }}>
                  +{f.impact} Risk
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logged Risk Events */}
      <div className="tg-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
          Recent Elevated Risk Events ({riskEvents.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riskEvents.map((ev) => (
            <div key={ev.id} style={{
              background: '#0a0e17',
              borderLeft: `4px solid ${ev.riskScore >= 70 ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-pill status-${ev.riskScore >= 70 ? 'tampered' : 'revoked'}`}>
                    {ev.riskLevel} • {ev.riskScore}/100
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{ev.anomalyType}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {ev.trustObjectId}
                  </span>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {ev.primaryFactors.map((f: any, idx: number) => (
                      <li key={idx}>
                        <strong>{f.factor}</strong>: {f.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(ev.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
