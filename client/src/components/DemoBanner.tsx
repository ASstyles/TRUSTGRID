import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, PackageSearch, FileWarning, Cpu, Sparkles } from 'lucide-react';

interface DemoBannerProps {
  onSelectScenario: (scenarioId: string) => void;
  activeScenarioId?: string;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onSelectScenario, activeScenarioId }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const scenarios = [
    {
      id: 'SCENARIO_1_FAKE_CERTIFICATE',
      label: '1. Fake Certificate',
      sub: 'Tampered GPA & Name',
      icon: <FileWarning size={14} />,
      color: '#f43f5e',
    },
    {
      id: 'SCENARIO_2_COUNTERFEIT_PRODUCT',
      label: '2. Trace Product',
      sub: 'Counterfeit Batch',
      icon: <PackageSearch size={14} />,
      color: '#f59e0b',
    },
    {
      id: 'SCENARIO_3_ALTERED_LEGAL_EVIDENCE',
      label: '3. Verify Evidence',
      sub: 'Altered Video Frames',
      icon: <AlertTriangle size={14} />,
      color: '#f43f5e',
    },
    {
      id: 'SCENARIO_4_DEVICE_COMPROMISE',
      label: '4. Device Compromise',
      sub: 'Config Baseline Drift',
      icon: <Cpu size={14} />,
      color: '#06b6d4',
    },
  ];

  const handleTrigger = (id: string) => {
    setLoadingId(id);
    onSelectScenario(id);
    setTimeout(() => setLoadingId(null), 600);
  };

  return (
    <div className="sih-demo-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="sih-badge">
          <Sparkles size={12} />
          SIH 2026 DEMO MODE
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          One Trust Object Protocol. Four Sectors. Click any scenario:
        </span>
      </div>

      <div className="demo-buttons-group">
        {scenarios.map((s) => {
          const isActive = activeScenarioId === s.id;
          return (
            <button
              key={s.id}
              className={`demo-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTrigger(s.id)}
              disabled={loadingId === s.id}
              title={s.sub}
            >
              <span style={{ color: s.color }}>{s.icon}</span>
              <span>{s.label}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({s.sub})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
