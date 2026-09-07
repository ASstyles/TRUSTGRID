import React, { useState, useEffect } from 'react';
import { api, VerificationResult } from '../services/api';
import { HeroVerification } from '../components/HeroVerification';
import { Package, Truck, ArrowRight, ShieldCheck, MapPin, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';

export const SupplyChainPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [activeProductId, setActiveProductId] = useState<string>('');

  // Transfer form
  const [fromDid, setFromDid] = useState('did:trustgrid:sc:bharat-pharma');
  const [toDid, setToDid] = useState('did:trustgrid:sc:apex-logistics');
  const [location, setLocation] = useState('Central Drug Depot, Sector 18, Gurugram');
  const [actionDesc, setActionDesc] = useState('Transfer of cold-chain custody under WHO-GMP compliance');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await api.getProducts();
      if (res.success) {
        setProducts(res.products);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const verifyProduct = async (trustObjectId: string) => {
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

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.transferProduct({
        trustObjectId: activeProductId,
        fromDid,
        toDid,
        location,
        actionDescription: actionDesc,
      });

      if (res.success) {
        setShowTransferModal(false);
        loadProducts();
        verifyProduct(activeProductId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="tg-card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="tg-card-title">
            <Package size={24} style={{ color: 'var(--accent-amber)' }} />
            <span>Supply Chain Sector — Multi-Tier Provenance & Custody Tracking</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Tracking life-saving pharmaceutical batches across manufacturers, cold-chain freight, warehouses, and retail pharmacies.
          </p>
        </div>
      </div>

      {selectedVerification && (
        <div style={{ marginBottom: '28px' }}>
          <HeroVerification result={selectedVerification} />
        </div>
      )}

      {/* Products Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {products.map((p) => (
          <div key={p.trustObjectId} className="tg-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`status-pill status-${p.status === 'ACTIVE' ? 'authentic' : 'tampered'}`}>
                    {p.status}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Batch: {p.metadata.batchNumber}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px' }}>
                  {p.metadata.productName}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Manufacturer: <strong>{p.metadata.manufacturerName}</strong> • Serial: <code>{p.metadata.serialNumber}</code>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="tg-btn-primary"
                  onClick={() => verifyProduct(p.trustObjectId)}
                >
                  <ShieldCheck size={16} />
                  <span>Verify Provenance</span>
                </button>

                <button
                  className="demo-btn"
                  onClick={() => {
                    setActiveProductId(p.trustObjectId);
                    setShowTransferModal(true);
                  }}
                >
                  <Truck size={16} />
                  <span>Transfer Custody</span>
                </button>
              </div>
            </div>

            {/* Provenance Event Timeline */}
            <div style={{ background: '#0a0e17', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Certified Custody Handoff Timeline ({p.provenance.length} Events)
              </h4>

              <div className="timeline">
                {p.provenance.map((ev: any, idx: number) => {
                  const isSmuggled = ev.fromDid?.includes('unauthorized');
                  return (
                    <div key={ev.id} className="timeline-step">
                      <div className={`timeline-dot ${isSmuggled ? 'compromised' : ''}`}>
                        {isSmuggled ? <AlertTriangle size={10} color="#f43f5e" /> : <CheckCircle2 size={10} color="#06b6d4" />}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSmuggled ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                            {ev.eventType}: {ev.actionDescription}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <MapPin size={12} />
                            <span>{ev.location || 'Location Not Disclosed'}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                            From: {ev.fromDid} ➔ To: {ev.toDid}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transfer Custody Modal */}
      {showTransferModal && (
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
          <div className="tg-card" style={{ maxWidth: '520px', width: '100%', border: '1px solid var(--border-bright)' }}>
            <div className="tg-card-header">
              <div className="tg-card-title">Record Certified Custody Transfer</div>
              <button className="demo-btn" onClick={() => setShowTransferModal(false)}>✕</button>
            </div>

            <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From Entity DID (Current Custodian)</label>
                <input className="tg-input" value={fromDid} onChange={(e) => setFromDid(e.target.value)} required />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To Entity DID (Receiving Custodian)</label>
                <input className="tg-input" value={toDid} onChange={(e) => setToDid(e.target.value)} required />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Location / Terminal</label>
                <input className="tg-input" value={location} onChange={(e) => setLocation(e.target.value)} required />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Handoff Action Description</label>
                <input className="tg-input" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="demo-btn" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" className="tg-btn-primary">Anchor Transfer on Blockchain</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
