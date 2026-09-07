import React, { useState, useEffect } from 'react';
import { api, VerificationResult } from '../services/api';
import { HeroVerification } from '../components/HeroVerification';
import { Scale, ShieldAlert, CheckCircle2, FileWarning, Video, ArrowRight, UserCheck } from 'lucide-react';

export const LegalPage: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadEvidence();
  }, []);

  const loadEvidence = async () => {
    try {
      const res = await api.getEvidence();
      if (res.success) {
        setEvidenceList(res.evidence);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const verifyEvidence = async (trustObjectId: string) => {
    setLoading(true);
    try {
      const res = await api.verifyObject(trustObjectId);
      if (res.success) {
        setSelectedVerification(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const simulateSpoliation = async (trustObjectId: string) => {
    try {
      await api.tamperTrustObject(trustObjectId, {
        caseNumber: 'FIR-2026-ND-4182',
        evidenceTag: 'EVI-CCTV-081',
        evidenceType: 'CCTV_VIDEO',
        originalFileName: 'cctv_vault_corridor_cam04_20260210.mp4',
        forensicHash: 'deadbeef000000000000000000000000000000000000000000000000deadbeef',
        spoliationReason: 'Unauthorized trimming of key evidence timestamps by suspect insider',
      });
      loadEvidence();
      verifyEvidence(trustObjectId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="tg-card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="tg-card-title">
            <Scale size={24} style={{ color: 'var(--accent-emerald)' }} />
            <span>Legal Sector — Digital Forensic Evidence & Chain of Custody</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Preserving cryptographically verifiable digital evidence under Section 65B of the Indian Evidence Act with tamper-evident cryptographic handoffs.
          </p>
        </div>
      </div>

      {selectedVerification && (
        <div style={{ marginBottom: '28px' }}>
          <HeroVerification result={selectedVerification} />
        </div>
      )}

      {/* Evidence Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {evidenceList.map((ev) => (
          <div key={ev.trustObjectId} className="tg-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-pill status-${ev.status === 'ACTIVE' ? 'authentic' : 'tampered'}`}>
                    {ev.status === 'ACTIVE' ? 'AUTHENTIC / VERIFIED' : 'INTEGRITY COMPROMISED'}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Case: {ev.metadata.caseNumber} • Tag: {ev.metadata.evidenceTag}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Video size={18} style={{ color: 'var(--accent-cyan)' }} />
                  {ev.metadata.originalFileName}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Acquired By: <strong>{ev.metadata.collectingOfficer}</strong> ({ev.metadata.chainOfCustodyAgency})
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="tg-btn-primary"
                  onClick={() => verifyEvidence(ev.trustObjectId)}
                >
                  <CheckCircle2 size={16} />
                  <span>Verify Chain of Custody</span>
                </button>

                <button
                  className="demo-btn"
                  style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                  onClick={() => simulateSpoliation(ev.trustObjectId)}
                  title="Simulate altering video frames and modifying forensic file hash"
                >
                  <FileWarning size={16} />
                  <span>Tamper Video</span>
                </button>
              </div>
            </div>

            {/* Forensic Hash Box */}
            <div style={{ background: '#0a0e17', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Forensic SHA-256 Acquisition Hash (Write-Blocker Sealed)
              </div>
              <div className="mono-box" style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>
                {ev.metadata.forensicHash}
              </div>
            </div>

            {/* Custody Chain Steps */}
            <div>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Judicial Chain of Custody Audit Trail ({ev.custodyChain.length} Sign-offs)
              </h4>
              <div className="timeline">
                {ev.custodyChain.map((step: any, i: number) => (
                  <div key={step.id} className="timeline-step">
                    <div className="timeline-dot">
                      <UserCheck size={10} color="#10b981" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {step.actionDescription}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Location: {step.location}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        Signer: {step.fromDid}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
