import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../database/db.service.js';
import { ConsortiumBlockchainAdapter } from '../core/blockchain/consortium-blockchain.adapter.js';
import { DidService } from '../core/identity/did.service.js';
import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { ProvenanceService } from '../core/provenance/provenance.service.js';
import { RevocationService } from '../core/revocation/revocation.service.js';
import { AnomalyRiskEngine } from '../core/risk-engine/anomaly.service.js';
import { VerificationService } from '../core/verification/verification.service.js';
import { seedDatabase } from '../database/seed.js';

test('System Health & All 4 Flagship Demo Scenarios Suite', async (t) => {
  // Ensure freshly seeded clean demo state
  await seedDatabase(true);

  const db = DatabaseService.getInstance();
  const didService = new DidService(db);
  const blockchain = new ConsortiumBlockchainAdapter(db);
  const trustObjectService = new TrustObjectService(blockchain, db, didService);
  const provenanceService = new ProvenanceService(blockchain, db, didService);
  const revocationService = new RevocationService(blockchain, db);
  const riskEngine = new AnomalyRiskEngine(db);

  const verifier = new VerificationService(
    blockchain,
    trustObjectService,
    provenanceService,
    revocationService,
    riskEngine,
    didService,
    db
  );

  await t.test('1. System Diagnostics: Ledger integrity is valid and all tables are ready', async () => {
    const audit = await blockchain.verifyLedgerIntegrity();
    assert.equal(audit.valid, true, 'Audit ledger must be valid');
    assert.ok(audit.totalBlocks >= 4, 'Blocks must be mined for seeded items');
    assert.ok(audit.verifiedTxs >= 4, 'Transactions must be verified');

    // Check demo data presence
    const eduObj = await trustObjectService.getTrustObject('TO-EDU-DEGREE-GENUINE-2024');
    assert.ok(eduObj, 'Education genuine demo object must exist');

    const prodObj = await trustObjectService.getTrustObject('TO-PRD-REMDESIVIR-BATCH-402');
    assert.ok(prodObj, 'Supply chain genuine demo object must exist');

    const eviObj = await trustObjectService.getTrustObject('TO-EVI-CCTV-FORENSIC-081');
    assert.ok(eviObj, 'Legal genuine demo object must exist');

    const devObj = await trustObjectService.getTrustObject('TO-DEV-CORE-ROUTER-09');
    assert.ok(devObj, 'Cybersecurity genuine demo object must exist');
  });

  await t.test('2. Scenario 1 (Education): Genuine vs Tampered Certificate', async () => {
    // Genuine
    const genuine = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EDU-DEGREE-GENUINE-2024',
    });
    assert.equal(genuine.overallStatus, 'AUTHENTIC');
    assert.equal(genuine.hashMatch, true);
    assert.equal(genuine.signatureValid, true);

    // Tampered
    const tampered = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EDU-DEGREE-TAMPERED-2024',
    });
    assert.equal(tampered.overallStatus, 'TAMPERED');
    assert.equal(tampered.hashMatch, false);

    // Revoked
    const revoked = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EDU-DEGREE-REVOKED-2024',
    });
    assert.equal(revoked.overallStatus, 'REVOKED');
  });

  await t.test('3. Scenario 2 (Supply Chain): Genuine vs Counterfeit Batch', async () => {
    // Genuine
    const genuine = await verifier.verifyTrustObject({
      trustObjectId: 'TO-PRD-REMDESIVIR-BATCH-402',
    });
    assert.equal(genuine.overallStatus, 'AUTHENTIC');
    assert.equal(genuine.provenanceStatus.isValid, true);
    assert.equal(genuine.provenanceStatus.eventCount, 4);

    // Counterfeit
    const counterfeit = await verifier.verifyTrustObject({
      trustObjectId: 'TO-PRD-COUNTERFEIT-BATCH-999',
    });
    assert.equal(counterfeit.overallStatus, 'PROVENANCE_MISMATCH');
    assert.equal(counterfeit.provenanceStatus.isValid, false);
  });

  await t.test('4. Scenario 3 (Legal Evidence): Genuine vs Tampered Forensics', async () => {
    // Genuine
    const genuine = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EVI-CCTV-FORENSIC-081',
    });
    assert.equal(genuine.overallStatus, 'AUTHENTIC');
    assert.equal(genuine.hashMatch, true);

    // Tampered
    const tampered = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EVI-CCTV-TAMPERED-082',
    });
    assert.equal(tampered.overallStatus, 'TAMPERED');
    assert.equal(tampered.hashMatch, false);
  });

  await t.test('5. Scenario 4 (Cybersecurity): Clean Gateway vs Compromised SCADA Device', async () => {
    // Clean
    const clean = await verifier.verifyTrustObject({
      trustObjectId: 'TO-DEV-CORE-ROUTER-09',
    });
    assert.equal(clean.overallStatus, 'AUTHENTIC');
    assert.equal(clean.hashMatch, true);

    // Compromised
    const compromised = await verifier.verifyTrustObject({
      trustObjectId: 'TO-DEV-EDGE-GATEWAY-01',
    });
    assert.equal(compromised.overallStatus, 'DEVICE_INTEGRITY_COMPROMISED');
    assert.equal(compromised.hashMatch, false);
    assert.ok(compromised.riskAssessment.riskScore >= 50);
  });
});
