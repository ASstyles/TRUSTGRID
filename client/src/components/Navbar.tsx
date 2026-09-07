import React from 'react';
import { 
  Shield, 
  CheckSquare, 
  GraduationCap, 
  Package, 
  Scale, 
  Terminal, 
  Network, 
  CreditCard, 
  Cpu, 
  Activity, 
  Layers,
  UserCircle2
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentRole: string;
  onSelectRole: (role: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, currentRole, onSelectRole }) => {
  const navItems = [
    { id: 'demo', label: 'SIH Demo', icon: <Terminal size={16} /> },
    { id: 'verify', label: 'Verification Center', icon: <CheckSquare size={16} /> },
    { id: 'education', label: 'Education', icon: <GraduationCap size={16} /> },
    { id: 'supply-chain', label: 'Supply Chain', icon: <Package size={16} /> },
    { id: 'legal', label: 'Legal Evidence', icon: <Scale size={16} /> },
    { id: 'cybersecurity', label: 'Cybersecurity', icon: <Cpu size={16} /> },
    { id: 'graph', label: 'Trust Graph', icon: <Network size={16} /> },
    { id: 'passport', label: 'Trust Passport', icon: <CreditCard size={16} /> },
    { id: 'blockchain', label: 'Ledger Explorer', icon: <Layers size={16} /> },
    { id: 'risk', label: 'Risk Engine', icon: <Activity size={16} /> },
  ];

  const roles = [
    'Public Verifier',
    'University Admin',
    'Student (Rahul)',
    'Pharma Manufacturer',
    'Police Investigator',
    'Chief InfoSec Officer',
  ];

  return (
    <nav className="navbar">
      <div className="nav-brand" onClick={() => onSelectTab('demo')} style={{ cursor: 'pointer' }}>
        <div className="brand-logo">
          <Shield size={22} color="#ffffff" />
        </div>
        <div>
          <div className="brand-title">TRUSTGRID</div>
          <div className="brand-subtitle">Trust Object Protocol (TOP)</div>
        </div>
      </div>

      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-link-btn ${currentTab === item.id ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Role Switcher Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UserCircle2 size={18} style={{ color: 'var(--accent-cyan)' }} />
        <select
          className="tg-input"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', background: '#0a0e17' }}
          value={currentRole}
          onChange={(e) => onSelectRole(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
    </nav>
  );
};
