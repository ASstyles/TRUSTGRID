import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DemoBanner } from './components/DemoBanner';
import { DemoScenariosPage } from './pages/DemoScenariosPage';
import { VerificationCenterPage } from './pages/VerificationCenterPage';
import { EducationPage } from './pages/EducationPage';
import { SupplyChainPage } from './pages/SupplyChainPage';
import { LegalPage } from './pages/LegalPage';
import { CybersecurityPage } from './pages/CybersecurityPage';
import { BlockchainExplorerPage } from './pages/BlockchainExplorerPage';
import { NetworkStatusPage } from './pages/NetworkStatusPage';
import { RiskDashboardPage } from './pages/RiskDashboardPage';
import { TrustGraphView } from './components/TrustGraphView';
import { TrustPassportCard } from './components/TrustPassportCard';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('demo');
  const [currentRole, setCurrentRole] = useState<string>('Public Verifier');
  const [activeScenarioId, setActiveScenarioId] = useState<string>('SCENARIO_1_FAKE_CERTIFICATE');

  const handleSelectScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setCurrentTab('demo');
  };

  return (
    <div className="app-container">
      {/* Dynamic Cyber Background Elements */}
      <div className="bg-grid-overlay" />
      <div className="glow-orb-cyan" />
      <div className="glow-orb-violet" />

      {/* Top Hackathon Demo Bar (First thing judges see!) */}
      <DemoBanner
        onSelectScenario={handleSelectScenario}
        activeScenarioId={activeScenarioId}
      />

      {/* Main Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentRole={currentRole}
        onSelectRole={setCurrentRole}
      />

      {/* Main View Area */}
      <main className="main-content">
        {currentTab === 'demo' && (
          <DemoScenariosPage
            scenarioToAutoRun={activeScenarioId}
            onNavigateToTab={setCurrentTab}
          />
        )}
        {currentTab === 'verify' && <VerificationCenterPage />}
        {currentTab === 'education' && <EducationPage />}
        {currentTab === 'supply-chain' && <SupplyChainPage />}
        {currentTab === 'legal' && <LegalPage />}
        {currentTab === 'cybersecurity' && <CybersecurityPage />}
        {currentTab === 'graph' && <TrustGraphView />}
        {currentTab === 'passport' && <TrustPassportCard />}
        {currentTab === 'blockchain' && <BlockchainExplorerPage />}
        {currentTab === 'network' && <NetworkStatusPage />}
        {currentTab === 'risk' && <RiskDashboardPage />}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>TRUSTGRID</strong> — Smart India Hackathon 2026 Problem Statement 26194 (Blockchain & Cybersecurity)
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Core Innovation: <strong>Trust Object Protocol (TOP)</strong> • Off-Chain Storage with Verifiable Blockchain Proofs
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
