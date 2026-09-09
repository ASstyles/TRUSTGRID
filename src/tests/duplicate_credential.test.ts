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

test('Duplicate Credential Claim & Anomaly Risk Suite', async (t) => {
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

  const uniDid = 'did:trustgrid:edu:delhi-tech-univ';
  const studentA = 'did:trustgrid:usr:student-alpha';
  const studentB = 'did:trustgrid:usr:student-bravo';

  // Ensure issuer and student identities exist
  WalletService.registerDeterministicIdentity(uniDid, 'ORGANIZATION', db);
  didService.createIdentity({ sector: 'usr', identifier: 'student-alpha', entityType: 'INDIVIDUAL' });
  didService.createIdentity({ sector: 'usr', identifier: 'student-bravo', entityType: 'INDIVIDUAL' });

  await t.test('Identical credential content claimed across multiple subject DIDs triggers DUPLICATE_CREDENTIAL_CLAIM', async () => {
    // 1. Issue genuine credential to Student A
    const credA = await trustObjectService.createTrustObject({
      objectType: 'CREDENTIAL',
      subjectId: studentA,
      issuerId: uniDid,
      ownerId: studentA,
      metadata: {
        degree: 'Bachelor of Technology in Data Science',
        serialNumber: `DTU-DS-${Date.now()}`,
        sharedCertificateKey: 'CERT-SECURE-HASH-KEY-2026',
      },
    });

    // 2. Clone scenario: Create conflicting object with same contentHash but for Student B
    const cloneCustomId = `TO-CLONE-${Date.now()}`;
    db.run(
      `INSERT INTO trust_objects 
       (trust_object_id, object_type, subject_id, issuer_id, owner_id, created_at, expires_at, content_hash, signature, blockchain_tx_id, status, metadata, off_chain_data, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cloneCustomId,
        'CREDENTIAL',
        studentB, // Conflicting subject DID!
        uniDid,
        studentB,
        new Date().toISOString(),
        null,
        credA.contentHash, // Identical content hash!
        credA.signature,
        credA.blockchainTxId,
        'ACTIVE',
        JSON.stringify(credA.metadata),
        null,
        Date.now(),
      ]
    );

    // 3. Verify clone
    const cloneVerification = await verifier.verifyTrustObject({
      trustObjectId: cloneCustomId,
    });

    // Verify duplicate factor was detected
    const duplicateFactor = cloneVerification.riskAssessment.factors.find(
      (f) => f.factor === 'DUPLICATE_CREDENTIAL_CLAIM'
    );

    assert.ok(duplicateFactor, 'DUPLICATE_CREDENTIAL_CLAIM factor must be triggered');
    assert.equal(duplicateFactor.impact, 30);
    assert.ok(cloneVerification.riskAssessment.riskScore >= 30, 'Risk score must be elevated');
  });
});
