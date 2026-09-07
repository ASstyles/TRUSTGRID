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

test('TRUSTGRID TOP Verification Pipeline Tests', async (t) => {
  // Ensure database is seeded
  await seedDatabase();

  const db = DatabaseService.getInstance();
  const didService = new DidService(db);
  const blockchain = new ConsortiumBlockchainAdapter(db);
  const trustObjectService = new TrustObjectService(blockchain, db, didService);
  const provenanceService = new ProvenanceService(blockchain, db);
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

  await t.test('Scenario 1A: Genuine Education Certificate returns AUTHENTIC with trust score >= 90', async () => {
    const result = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EDU-DEGREE-GENUINE-2024',
    });

    assert.equal(result.overallStatus, 'AUTHENTIC');
    assert.equal(result.hashMatch, true);
    assert.equal(result.signatureValid, true);
    assert.equal(result.blockchainProofValid, true);
    assert.equal(result.revocationStatus.isRevoked, false);
    assert.ok(result.trustScore >= 90);
  });

  await t.test('Scenario 1B: Tampered Certificate (Rahul -> Rohan) detected as TAMPERED', async () => {
    const result = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EDU-DEGREE-TAMPERED-2024',
    });

    assert.equal(result.overallStatus, 'TAMPERED');
    assert.equal(result.hashMatch, false);
    assert.ok(result.riskAssessment.riskScore >= 50);
  });

  await t.test('Scenario 1C: Revoked Certificate detected as REVOKED with on-chain proof', async () => {
    const result = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EDU-DEGREE-REVOKED-2024',
    });

    assert.equal(result.overallStatus, 'REVOKED');
    assert.equal(result.revocationStatus.isRevoked, true);
    assert.ok(result.revocationStatus.reason?.includes('Academic Senate Resolution'));
  });

  await t.test('Scenario 2: Genuine Product returns AUTHENTIC with 4-hop unbroken provenance', async () => {
    const result = await verifier.verifyTrustObject({
      trustObjectId: 'TO-PRD-REMDESIVIR-BATCH-402',
    });

    assert.equal(result.overallStatus, 'AUTHENTIC');
    assert.equal(result.provenanceStatus.isValid, true);
    assert.equal(result.provenanceStatus.eventCount, 4);
  });

  await t.test('Scenario 3: Tampered Legal Forensic Evidence detected as TAMPERED', async () => {
    const result = await verifier.verifyTrustObject({
      trustObjectId: 'TO-EVI-CCTV-TAMPERED-082',
    });

    assert.equal(result.overallStatus, 'TAMPERED');
    assert.equal(result.hashMatch, false);
  });

  await t.test('Consortium Blockchain Ledger Integrity validates all blocks and Merkle roots', async () => {
    const audit = await blockchain.verifyLedgerIntegrity();
    assert.equal(audit.valid, true);
    assert.ok(audit.totalBlocks > 1);
  });
});
