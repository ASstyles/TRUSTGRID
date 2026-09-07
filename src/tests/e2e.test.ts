import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../database/db.service.js';
import { ConsortiumBlockchainAdapter } from '../core/blockchain/consortium-blockchain.adapter.js';
import { DidService } from '../core/identity/did.service.js';
import { WalletService } from '../core/identity/wallet.service.js';
import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { ProvenanceService } from '../core/provenance/provenance.service.js';
import { RevocationService } from '../core/revocation/revocation.service.js';
import { AnomalyRiskEngine } from '../core/risk-engine/anomaly.service.js';
import { VerificationService } from '../core/verification/verification.service.js';

test('Full End-to-End Trust Object Protocol (TOP) Lifecycle', async () => {
  const db = DatabaseService.getTestInstance();
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

  // 1. Create Issuer & Subject Identities
  const issuer = didService.createIdentity({
    sector: 'edu',
    identifier: 'iit-delhi',
    entityType: 'ORGANIZATION',
  });
  WalletService.storeKeyPair(issuer.did, issuer.keyPair);

  const student = didService.createIdentity({
    sector: 'usr',
    identifier: 'sneha-rao',
    entityType: 'INDIVIDUAL',
  });
  WalletService.storeKeyPair(student.did, student.keyPair);

  // 2. Issue Degree Trust Object under TOP
  const degree = await trustObjectService.createTrustObject({
    objectType: 'CREDENTIAL',
    subjectId: student.did,
    issuerId: issuer.did,
    customId: 'TO-E2E-DEGREE-001',
    metadata: {
      studentName: 'Sneha Rao',
      degree: 'M.Tech Cyber Security',
      year: 2026,
      cgpa: '9.8',
    },
  });

  assert.ok(degree.trustObjectId);
  assert.ok(degree.contentHash);
  assert.ok(degree.signature);
  assert.ok(degree.blockchainTxId.startsWith('0x'));

  // 3. Verify Genuine Object
  const genuineResult = await verifier.verifyTrustObject({
    trustObjectId: degree.trustObjectId,
  });

  assert.equal(genuineResult.overallStatus, 'AUTHENTIC');
  assert.equal(genuineResult.hashMatch, true);
  assert.equal(genuineResult.signatureValid, true);
  assert.equal(genuineResult.blockchainProofValid, true);
  assert.equal(genuineResult.revocationStatus.isRevoked, false);
  assert.ok(genuineResult.trustScore >= 90);

  // 4. Simulate Unauthorized Tampering (Student grade altered from 9.8 to 10.0)
  trustObjectService.simulateTamper(degree.trustObjectId, {
    studentName: 'Sneha Rao',
    degree: 'M.Tech Cyber Security',
    year: 2026,
    cgpa: '10.0 (Tampered)',
  });

  // 5. Verify Tampered Object -> Expect TAMPERED
  const tamperedResult = await verifier.verifyTrustObject({
    trustObjectId: degree.trustObjectId,
  });

  assert.equal(tamperedResult.overallStatus, 'TAMPERED');
  assert.equal(tamperedResult.hashMatch, false);
  assert.ok(tamperedResult.riskAssessment.riskScore >= 50);

  // 6. Revoke Object on Blockchain
  await revocationService.revokeTrustObject({
    trustObjectId: degree.trustObjectId,
    revokerDid: issuer.did,
    reason: 'Credential revoked due to fraudulent GPA tampering attempt',
  });

  // 7. Verify Revoked Object -> Expect REVOKED
  const revokedResult = await verifier.verifyTrustObject({
    trustObjectId: degree.trustObjectId,
  });

  assert.equal(revokedResult.overallStatus, 'TAMPERED'); // Tampered takes precedence over revoked in overallStatus, but revocation is recorded
  assert.equal(revokedResult.revocationStatus.isRevoked, true);
  assert.ok(revokedResult.revocationStatus.reason?.includes('GPA tampering attempt'));
});
