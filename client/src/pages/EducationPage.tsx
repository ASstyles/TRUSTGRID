import React, { useState, useEffect } from 'react';
import { api, VerificationResult } from '../services/api';
import { HeroVerification } from '../components/HeroVerification';
import { GraduationCap, Plus, FileWarning, CheckCircle2, QrCode } from 'lucide-react';

export const EducationPage: React.FC = () => {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<VerificationResult | null>(null);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Form state
  const [studentName, setStudentName] = useState('Priya Patel');
  const [studentRollNo, setStudentRollNo] = useState('2022/CS/104');
  const [degreeName, setDegreeName] = useState('B.Tech Artificial Intelligence');
  const [major, setMajor] = useState('Computer Science');
  const [graduationYear, setGraduationYear] = useState('2026');
  const [cgpa, setCgpa] = useState('9.65 / 10.00');

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const res = await api.getCredentials();
      if (res.success) {
        setCredentials(res.credentials);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const verifyCredential = async (trustObjectId: string) => {
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

  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.issueDegree({
        institutionDid: 'did:trustgrid:edu:delhi-tech-univ',
        studentDid: 'did:trustgrid:usr:priya-patel',
        metadata: {
          studentName,
          studentRollNo,
          degreeName,
          major,
          graduationYear: Number(graduationYear),
          cgpa,
          honors: 'First Class with Distinction',
          serialNumber: `DTU-2026-AI-${Math.floor(Math.random() * 9000 + 1000)}`,
          institutionName: 'Delhi Technological University',
        },
      });

      if (res.success) {
        setShowIssueModal(false);
        loadCredentials();
        verifyCredential(res.trustObject.trustObjectId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateTamper = async (trustObjectId: string) => {
    try {
      await api.tamperTrustObject(trustObjectId, {
        studentName: 'Rohan Sharma (Forged Identity)',
        cgpa: '10.00 / 10.00 (Tampered)',
        degreeName: 'Bachelor of Technology (Altered)',
        serialNumber: 'FORGED-SERIAL-9999',
      });
      loadCredentials();
      verifyCredential(trustObjectId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="tg-card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="tg-card-title">
            <GraduationCap size={24} style={{ color: 'var(--accent-cyan)' }} />
            <span>Education Sector — Academic Credential Integrity</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Issuing verifiable degrees anchored on blockchain trust registry with zero private transcripts on-chain.
          </p>
        </div>

        <button className="tg-btn-primary" onClick={() => setShowIssueModal(true)}>
          <Plus size={16} />
          <span>Issue New Verifiable Degree</span>
        </button>
      </div>

      {/* Verification Result Drawer */}
      {selectedVerification && (
        <div style={{ marginBottom: '28px' }}>
          <HeroVerification result={selectedVerification} />
        </div>
      )}

      {/* Credentials Table / Cards */}
      <div className="tg-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Registered Academic Degrees</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {credentials.map((c) => (
            <div key={c.id} className="tg-card" style={{ background: '#0a0e17' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span className={`status-pill status-${c.status === 'ACTIVE' ? 'authentic' : 'tampered'}`}>
                  {c.status}
                </span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {c.serialNumber}
                </span>
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {c.metadata.studentName}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                {c.degreeName}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                <div>Class of {c.graduationYear} • CGPA: {c.cgpa}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll No: {c.metadata.studentRollNo}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  className="tg-btn-primary"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => verifyCredential(c.trustObjectId)}
                >
                  <CheckCircle2 size={14} />
                  <span>Verify Now</span>
                </button>

                <button
                  className="demo-btn"
                  style={{ fontSize: '0.8rem', padding: '6px 10px', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                  onClick={() => handleSimulateTamper(c.trustObjectId)}
                  title="Tamper student name and GPA to demonstrate tamper detection"
                >
                  <FileWarning size={14} />
                  <span>Tamper</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issue Degree Modal */}
      {showIssueModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="tg-card" style={{ maxWidth: '500px', width: '100%', border: '1px solid var(--border-bright)' }}>
            <div className="tg-card-header">
              <div className="tg-card-title">Issue Official Degree Credential</div>
              <button className="demo-btn" onClick={() => setShowIssueModal(false)}>✕</button>
            </div>

            <form onSubmit={handleIssueCredential} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student Name</label>
                <input className="tg-input" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll Number</label>
                  <input className="tg-input" value={studentRollNo} onChange={(e) => setStudentRollNo(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Graduation Year</label>
                  <input className="tg-input" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Degree Program</label>
                <input className="tg-input" value={degreeName} onChange={(e) => setDegreeName(e.target.value)} required />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CGPA</label>
                <input className="tg-input" value={cgpa} onChange={(e) => setCgpa(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="demo-btn" onClick={() => setShowIssueModal(false)}>Cancel</button>
                <button type="submit" className="tg-btn-primary">Anchor Degree on Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
