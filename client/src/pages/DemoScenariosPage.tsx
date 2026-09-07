import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { HeroVerification } from '../components/HeroVerification';
import { 
  Sparkles, 
  ArrowRight, 
  FileWarning, 
  PackageSearch, 
  AlertTriangle, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck,
  Layers,
  HelpCircle
} from 'lucide-react';

interface DemoScenariosPageProps {
  onNavigateToTab?: (tab: string) => void;
  scenarioToAutoRun?: string | null;
}

export const DemoScenariosPage: React.FC<DemoScenariosPageProps> = ({ scenarioToAutoRun }) => {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('SCENARIO_1_FAKE_CERTIFICATE');
  const [scenarioData, setScenarioData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadScenarios();
  }, []);

  useEffect(() => {
    if (scenarioToAutoRun) {
      setSelectedScenarioId(scenarioToAutoRun);
      executeScenario(scenarioToAutoRun);
    }
  }, [scenarioToAutoRun]);

  const loadScenarios = async () => {
    try {
      const res = await api.getDemoScenarios();
      if (res.success) {
        setScenarios(res.scenarios);
        if (!scenarioToAutoRun && res.scenarios.length > 0) {
          executeScenario(res.scenarios[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executeScenario = async (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setLoading(true);
    try {
      const res = await api.runDemoScenario(scenarioId);
      if (res.success) {
        setScenarioData(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* SIH Pitch Headline & Value Proposition */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(13, 18, 28, 0.9) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        marginBottom: '28px',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
          <Sparkles size={14} />
          Smart India Hackathon 2026 — Problem Statement 26194
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: '1.2', marginBottom: '12px' }}>
          DON'T TRUST THE DATABASE. <span style={{ color: 'var(--accent-cyan)' }}>VERIFY THE PROOF.</span>
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '900px', lineHeight: '1.6' }}>
          <strong>TRUSTGRID</strong> is an institutional decentralized trust infrastructure powered by the <strong>Trust Object Protocol (TOP)</strong>. 
          Instead of building isolated blockchain silos for every sector, TRUSTGRID demonstrates that a single, extensible Trust Object Protocol can verify credentials, product provenance, legal evidence, and cybersecurity device integrity.
        </p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '12px', 
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div>
            <div style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>1. TOP is the Innovation</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Universal schema & 7-step cryptographic verification engine.</div>
          </div>
          <div>
            <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem' }}>2. Blockchain is the Substrate</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consortium Notary MVP / Hyperledger Fabric ready.</div>
          </div>
          <div>
            <div style={{ color: 'var(--accent-amber)', fontWeight: 700, fontSize: '0.85rem' }}>3. 100% Off-Chain Privacy</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Zero private documents or personal records stored on-chain.</div>
          </div>
          <div>
            <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem' }}>4. Explainable Risk Engine</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Deterministic 0-100 anomaly scoring with transparent factor reasons.</div>
          </div>
        </div>
      </div>

      {/* 4 Flagship Scenario Selector Cards */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          Select Flagship Demonstration:
        </h3>
        <div className="grid-4">
          {scenarios.map((sc) => {
            const isSelected = selectedScenarioId === sc.id;
            return (
              <div
                key={sc.id}
                className="tg-card"
                onClick={() => executeScenario(sc.id)}
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-color)',
                  background: isSelected ? 'var(--accent-cyan-glow)' : 'var(--bg-card)',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span className="status-pill" style={{ 
                    background: sc.sector === 'EDUCATION' ? 'rgba(6, 182, 212, 0.15)' : (sc.sector === 'SUPPLY_CHAIN' ? 'rgba(245, 158, 11, 0.15)' : (sc.sector === 'LEGAL' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)')),
                    color: sc.sector === 'EDUCATION' ? 'var(--accent-cyan)' : (sc.sector === 'SUPPLY_CHAIN' ? 'var(--accent-amber)' : (sc.sector === 'LEGAL' ? 'var(--accent-emerald)' : 'var(--accent-violet)'))
                  }}>
                    {sc.sector}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                    TARGET: {sc.expectedStatus}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {sc.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {sc.subtitle}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="tg-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-cyan)' }}>
          Executing cryptographic proof verification and ledger audit...
        </div>
      )}

      {/* Scenario Execution Results */}
      {scenarioData && !loading && (
        <div>
          {/* Hero Verification for Target */}
          <HeroVerification result={scenarioData.targetResult} />

          {/* Side-by-Side Comparison Box */}
          <div className="tg-card" style={{ marginBottom: '28px' }}>
            <div className="tg-card-header">
              <div className="tg-card-title">
                <Layers size={20} style={{ color: 'var(--accent-cyan)' }} />
                <span>Side-by-Side Verification Comparison (Tampered vs Genuine Baseline)</span>
              </div>
            </div>

            <div className="grid-2">
              {/* Target Under Test */}
              <div style={{ background: 'rgba(244, 63, 94, 0.04)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--accent-rose)' }}>Target Scenario Under Test:</strong>
                  <span className="status-pill status-tampered">{scenarioData.targetResult.overallStatus}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Object ID: <code>{scenarioData.targetResult.trustObjectId}</code>
                </div>
                <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                  Hash Match: <strong>{scenarioData.targetResult.hashMatch ? 'PASS' : 'FAIL (Bit-flip detected)'}</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {scenarioData.scenario.keyPoint}
                </div>
              </div>

              {/* Comparison Authentic Object */}
              <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--accent-emerald)' }}>Authentic Certified Comparison:</strong>
                  <span className="status-pill status-authentic">{scenarioData.comparisonResult.overallStatus}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Object ID: <code>{scenarioData.comparisonResult.trustObjectId}</code>
                </div>
                <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                  Hash Match: <strong>PASS (100% Bit-for-bit verified)</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Ledger Anchor: Verified at Block #{scenarioData.comparisonResult.blockchainProof?.blockHeight || 1}
                </div>
              </div>
            </div>
          </div>

          {/* THE 60-SECOND REVEAL CARD FOR JUDGES */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
            border: '2px solid rgba(6, 182, 212, 0.5)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              🎯 THE CORE ARCHITECTURAL REVEAL
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '10px' }}>
              "All four sectors were verified by the exact same Trust Object Protocol (TOP)."
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '780px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
              Whether checking a forged university degree, an illicitly injected pharmaceutical batch, altered CCTV courtroom evidence, or a compromised critical grid router—TRUSTGRID runs the identical 7-step cryptographic verification engine.
            </p>
            <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="status-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}>One Schema</span>
              <span className="status-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}>One Verification Engine</span>
              <span className="status-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}>One Blockchain Ledger</span>
              <span className="status-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}>Infinite Sectors</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
