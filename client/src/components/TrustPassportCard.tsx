import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldCheck, Eye, EyeOff, CheckCircle2, Lock, Award, Building, User } from 'lucide-react';

interface TrustPassportCardProps {
  initialDid?: string;
}

export const TrustPassportCard: React.FC<TrustPassportCardProps> = ({ initialDid = 'did:trustgrid:usr:rahul-sharma' }) => {
  const [did, setDid] = useState<string>(initialDid);
  const [passport, setPassport] = useState<any>(null);
  const [selective, setSelective] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadPassport(did, selective);
  }, [did, selective]);

  const loadPassport = async (targetDid: string, isSelective: boolean) => {
    setLoading(true);
    try {
      const res = await api.getTrustPassport(targetDid, isSelective);
      if (res.success) {
        setPassport(res.passport);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sampleDids = [
    { label: 'Rahul Sharma (Student)', did: 'did:trustgrid:usr:rahul-sharma' },
    { label: 'Bharat Pharma (Manufacturer)', did: 'did:trustgrid:sc:bharat-pharma' },
    { label: 'Delhi Tech Univ (University)', did: 'did:trustgrid:edu:delhi-tech-univ' },
  ];

  return (
    <div className="tg-card">
      <div className="tg-card-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="tg-card-title">
            <ShieldCheck size={22} style={{ color: 'var(--accent-cyan)' }} />
            <span>Verifiable Trust Passport</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Decentralized identity claims with privacy-aware selective disclosure architecture.
          </p>
        </div>

        {/* Identity Selector & Privacy Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            className="tg-input"
            style={{ width: 'auto', fontSize: '0.85rem' }}
            value={did}
            onChange={(e) => setDid(e.target.value)}
          >
            {sampleDids.map((d) => (
              <option key={d.did} value={d.did}>{d.label}</option>
            ))}
          </select>

          <button
            className={`demo-btn ${selective ? 'active' : ''}`}
            onClick={() => setSelective(!selective)}
            title="Toggle between selective disclosure (privacy-preserving) and full disclosure"
          >
            {selective ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{selective ? 'Selective Disclosure (ON)' : 'Full Disclosure (OFF)'}</span>
          </button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading passport...</p>}

      {passport && (
        <div>
          {/* Header Profile Box */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(18, 24, 38, 0.8) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '54px', 
                height: '54px', 
                borderRadius: '50%', 
                background: passport.ownerType === 'ORGANIZATION' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: passport.ownerType === 'ORGANIZATION' ? 'var(--accent-violet)' : 'var(--accent-cyan)',
                border: '2px solid rgba(6, 182, 212, 0.4)'
              }}>
                {passport.ownerType === 'ORGANIZATION' ? <Building size={28} /> : <User size={28} />}
              </div>

              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {passport.ownerName}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  {passport.ownerDid}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Trust Reputation Index
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                {passport.reputationTrustScore} / 100
              </div>
              <div className="status-pill status-authentic" style={{ fontSize: '0.7rem' }}>
                <CheckCircle2 size={12} />
                CRYPTOGRAPHICALLY VERIFIED
              </div>
            </div>
          </div>

          {/* Privacy Banner */}
          <div style={{ 
            background: selective ? 'rgba(6, 182, 212, 0.06)' : 'rgba(245, 158, 11, 0.06)',
            border: `1px solid ${selective ? 'rgba(6, 182, 212, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Lock size={16} style={{ color: selective ? 'var(--accent-cyan)' : 'var(--accent-amber)' }} />
            <span>
              {selective
                ? 'Privacy-Preserving Mode Active: Sensitive personal attributes (GPA, residential coordinates) are masked off-chain. Only cryptographic assertions and status are shared.'
                : 'Full Disclosure Mode Active: Raw off-chain credential attributes are exposed to the viewer.'}
            </span>
          </div>

          {/* Verifiable Claims Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {passport.claims.map((claim: any) => (
              <div key={claim.trustObjectId} className="tg-card" style={{ background: '#0a0e17' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{claim.claimType}</span>
                  </div>
                  <span className={`status-pill status-${claim.status === 'ACTIVE' ? 'authentic' : 'revoked'}`}>
                    {claim.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Issuer: <span style={{ color: 'var(--text-primary)' }}>{claim.issuerName}</span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Disclosed Attributes
                  </div>
                  {Object.entries(claim.disclosedAttributes).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', margin: '3px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{k}:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{String(v)}</strong>
                    </div>
                  ))}

                  {claim.hiddenAttributesCount > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '6px', fontStyle: 'italic' }}>
                      🔒 {claim.hiddenAttributesCount} sensitive attributes cryptographically masked
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  Tx: {claim.blockchainTxId.substring(0, 18)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
