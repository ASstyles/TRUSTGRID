import React, { useState, useEffect } from 'react';
import { api, VerificationResult } from '../services/api';
import { HeroVerification } from '../components/HeroVerification';
import { Cpu, ShieldAlert, CheckCircle2, RefreshCw, AlertOctagon, Terminal, Activity } from 'lucide-react';

export const CybersecurityPage: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<VerificationResult | null>(null);
  const [auditMessage, setAuditMessage] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadDevices();
    loadEvents();
  }, []);

  const loadDevices = async () => {
    try {
      const res = await api.getDevices();
      if (res.success) {
        setDevices(res.devices);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await api.getSecurityEvents();
      if (res.success) {
        setSecurityEvents(res.events);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const verifyDevice = async (trustObjectId: string) => {
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

  const runAudit = async (trustObjectId: string, shouldSimulateCompromise: boolean) => {
    setLoading(true);
    setAuditMessage(null);
    try {
      const dev = devices.find((d) => d.trustObjectId === trustObjectId);
      const hashToCheck = shouldSimulateCompromise
        ? 'c0ffee0000000000000000000000000000000000000000000000000000c0ffee'
        : dev.metadata.configurationHash;

      const res = await api.auditDevice(trustObjectId, hashToCheck);
      if (res.success) {
        setAuditMessage(res.auditResult);
        loadDevices();
        loadEvents();
        verifyDevice(trustObjectId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="tg-card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="tg-card-title">
            <Cpu size={24} style={{ color: 'var(--accent-violet)' }} />
            <span>Cybersecurity Sector — Asset Baselines & Threat Monitoring</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Zero-trust integrity monitoring for critical infrastructure routers, SCADA nodes, and server configurations.
          </p>
        </div>
      </div>

      {selectedVerification && (
        <div style={{ marginBottom: '28px' }}>
          <HeroVerification result={selectedVerification} />
        </div>
      )}

      {/* Audit Alert Notification */}
      {auditMessage && (
        <div style={{
          background: auditMessage.status === 'COMPROMISED' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          border: `1px solid ${auditMessage.status === 'COMPROMISED' ? 'var(--accent-rose)' : 'var(--accent-emerald)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {auditMessage.status === 'COMPROMISED' ? <AlertOctagon size={24} color="#f43f5e" /> : <CheckCircle2 size={24} color="#10b981" />}
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: auditMessage.status === 'COMPROMISED' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
              {auditMessage.status === 'COMPROMISED' ? '🚨 CRITICAL BASELINE BREACH DETECTED' : '✅ ASSET INTEGRITY VERIFIED'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {auditMessage.description}
            </div>
          </div>
        </div>
      )}

      {/* Devices Grid */}
      <div className="grid-2" style={{ marginBottom: '28px' }}>
        {devices.map((d) => (
          <div key={d.trustObjectId} className="tg-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span className={`status-pill status-${d.status === 'ACTIVE' ? 'authentic' : 'tampered'}`}>
                {d.status === 'ACTIVE' ? 'BASELINE INTACT' : 'COMPROMISED'}
              </span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                IP: {d.metadata.ipAddress}
              </span>
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>
              {d.metadata.hostname}
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Device Type: <strong>{d.metadata.deviceType}</strong> • Firmware: <code>{d.metadata.firmwareVersion}</code>
            </div>

            <div style={{ background: '#0a0e17', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Cryptographic Configuration Hash Baseline
              </div>
              <div className="mono-box" style={{ fontSize: '0.78rem' }}>
                {d.metadata.configurationHash}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="tg-btn-primary"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                onClick={() => verifyDevice(d.trustObjectId)}
              >
                <CheckCircle2 size={14} />
                <span>Verify Proof</span>
              </button>

              <button
                className="demo-btn"
                style={{ fontSize: '0.8rem' }}
                onClick={() => runAudit(d.trustObjectId, false)}
                title="Run live audit against expected configuration"
              >
                <RefreshCw size={14} />
                <span>Pass Audit</span>
              </button>

              <button
                className="demo-btn"
                style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.4)', fontSize: '0.8rem' }}
                onClick={() => runAudit(d.trustObjectId, true)}
                title="Simulate injection of unauthorized firewall rule or rootkit backdoor"
              >
                <ShieldAlert size={14} />
                <span>Inject Drift</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Security Incident Event Log */}
      <div className="tg-card">
        <div className="tg-card-header">
          <div className="tg-card-title">
            <Terminal size={18} style={{ color: 'var(--accent-rose)' }} />
            <span>On-Chain Anchored Security Incident Ledger</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tamper-evident SOC audit stream
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {securityEvents.map((ev) => (
            <div key={ev.id} style={{
              background: '#0a0e17',
              borderLeft: '4px solid var(--accent-rose)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-pill status-tampered" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                    {ev.event_severity}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{ev.event_type}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Device: {ev.device_id}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {ev.description}
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
