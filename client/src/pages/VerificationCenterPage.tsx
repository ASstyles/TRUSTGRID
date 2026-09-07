import React, { useState, useEffect } from 'react';
import { api, VerificationResult } from '../services/api';
import { HeroVerification } from '../components/HeroVerification';
import { Search, CheckSquare, QrCode, FileCheck, RefreshCw } from 'lucide-react';

export const VerificationCenterPage: React.FC = () => {
  const [objectIdInput, setObjectIdInput] = useState<string>('TO-EDU-DEGREE-GENUINE-2024');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [recentObjects, setRecentObjects] = useState<any[]>([]);

  useEffect(() => {
    loadRecentObjects();
    runVerification('TO-EDU-DEGREE-GENUINE-2024');
  }, []);

  const loadRecentObjects = async () => {
    try {
      const res = await api.getTrustObjects();
      if (res.success) {
        setRecentObjects(res.objects.slice(0, 8));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runVerification = async (idToVerify: string) => {
    setLoading(true);
    try {
      const res = await api.verifyObject(idToVerify);
      if (res.success) {
        setVerificationResult(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectIdInput.trim()) {
      runVerification(objectIdInput.trim());
    }
  };

  return (
    <div>
      {/* Verification Query Card */}
      <div className="tg-card" style={{ marginBottom: '24px' }}>
        <div className="tg-card-header">
          <div className="tg-card-title">
            <CheckSquare size={22} style={{ color: 'var(--accent-cyan)' }} />
            <span>Universal Trust Object Verification Engine</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Protocol Version: TOP v1.0 | Ed25519 + SHA-256
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              className="tg-input"
              style={{ paddingLeft: '38px', fontFamily: 'var(--font-mono)' }}
              placeholder="Enter Trust Object ID (e.g. TO-EDU-DEGREE-GENUINE-2024 or scan QR)..."
              value={objectIdInput}
              onChange={(e) => setObjectIdInput(e.target.value)}
            />
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          </div>

          <button type="submit" className="tg-btn-primary" disabled={loading}>
            {loading ? <RefreshCw size={16} className="spin" /> : <FileCheck size={16} />}
            <span>Verify Proof</span>
          </button>
        </form>

        {/* Quick Sample Selector */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quick Samples:</span>
          {recentObjects.map((obj) => (
            <button
              key={obj.trustObjectId}
              className="demo-btn"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={() => {
                setObjectIdInput(obj.trustObjectId);
                runVerification(obj.trustObjectId);
              }}
            >
              <span>{obj.trustObjectId}</span>
              <span className={`status-pill status-${obj.status === 'ACTIVE' ? 'authentic' : 'tampered'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                {obj.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="tg-card" style={{ textAlign: 'center', padding: '36px', color: 'var(--accent-cyan)' }}>
          Recalculating canonical SHA-256 hash, verifying Ed25519 signature, and validating blockchain ledger proof...
        </div>
      )}

      {/* Hero Verification Screen */}
      {verificationResult && !loading && (
        <HeroVerification result={verificationResult} />
      )}
    </div>
  );
};
