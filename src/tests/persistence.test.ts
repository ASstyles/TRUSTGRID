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

test('Persistent Encrypted Keystore & Server Restart Integrity Suite', async (t) => {
  const db = DatabaseService.getInstance();
  const didService = new DidService(db);

  await t.test('1. Key Persistence: Consortium Notary retains identical keypair across simulated restarts', async () => {
    const notaryDid = 'did:trustgrid:sys:consortium-notary';

    // Instance A (First boot)
    const adapterA = new ConsortiumBlockchainAdapter(db);
    const keyA = WalletService.getKeyPair(notaryDid, db);
    assert.ok(keyA, 'Notary keypair must exist');

    // Simulate process exit / cold boot: wipe all in-memory caches
    WalletService.clearMemoryCache();

    // Instance B (Post-restart boot)
    const adapterB = new ConsortiumBlockchainAdapter(db);
    const keyB = WalletService.getKeyPair(notaryDid, db);
    assert.ok(keyB, 'Notary keypair must be retrieved after restart');

    assert.equal(keyA.publicKey, keyB.publicKey, 'Public key MUST survive restart without changing');
    assert.equal(keyA.privateKey, keyB.privateKey, 'Private key MUST be decrypted identically after restart');
  });

  await t.test('2. Ledger Persistence: Blockchain integrity remains 100% VALID after restart', async () => {
    // Adapter before restart
    const adapterBefore = new ConsortiumBlockchainAdapter(db);
    const integrityBefore = await adapterBefore.verifyLedgerIntegrity();
    assert.equal(integrityBefore.valid, true, `Ledger before restart: ${integrityBefore.reason}`);

    // Simulate server process restart
    WalletService.clearMemoryCache();

    // Adapter after restart
    const adapterAfter = new ConsortiumBlockchainAdapter(db);
    const integrityAfter = await adapterAfter.verifyLedgerIntegrity();
    assert.equal(integrityAfter.valid, true, 'Ledger MUST remain valid after restart');
    assert.equal(integrityBefore.totalBlocks, integrityAfter.totalBlocks, 'Block count must match exactly');
    assert.equal(integrityBefore.verifiedTxs, integrityAfter.verifiedTxs, 'Transaction count must match exactly');
  });

  await t.test('3. Object Persistence: Trust Object created before restart verifies as AUTHENTIC after restart', async () => {
    // Boot session 1
    const blockchain1 = new ConsortiumBlockchainAdapter(db);
    const trustObjService1 = new TrustObjectService(blockchain1, db, didService);
    const issuerDid = 'did:trustgrid:edu:delhi-tech-univ';
    const studentDid = 'did:trustgrid:usr:rahul-sharma';

    const testObjectId = `TO-PERSIST-TEST-${Date.now()}`;
    const createdObject = await trustObjService1.createTrustObject({
      objectType: 'CREDENTIAL',
      subjectId: studentDid,
      issuerId: issuerDid,
      ownerId: studentDid,
      customId: testObjectId,
      metadata: {
        degree: 'Bachelor of Technology in Cybersecurity',
        grade: 'A+',
        year: 2026,
        studentName: 'Rahul Sharma',
      },
    });

    assert.equal(createdObject.trustObjectId, testObjectId);

    // Simulate server crash & restart
    WalletService.clearMemoryCache();

    // Boot session 2 (New service instances)
    const blockchain2 = new ConsortiumBlockchainAdapter(db);
    const trustObjService2 = new TrustObjectService(blockchain2, db, didService);
    const provService2 = new ProvenanceService(blockchain2, db, didService);
    const revService2 = new RevocationService(blockchain2, db);
    const riskEngine2 = new AnomalyRiskEngine(db);

    const verifier2 = new VerificationService(
      blockchain2,
      trustObjService2,
      provService2,
      revService2,
      riskEngine2,
      didService,
      db
    );

    const verificationResult = await verifier2.verifyTrustObject({
      trustObjectId: testObjectId,
    });

    assert.equal(verificationResult.overallStatus, 'AUTHENTIC', 'Persisted object must verify as AUTHENTIC');
    assert.equal(verificationResult.hashMatch, true, 'Content hash must match on-chain proof');
    assert.equal(verificationResult.signatureValid, true, 'Ed25519 signature must verify against issuer public key');
    assert.equal(verificationResult.blockchainProofValid, true, 'Blockchain anchor proof must be valid');
  });

  await t.test('4. Revocation Persistence: Revoked object remains REVOKED after restart', async () => {
    // Boot session 1
    const blockchain1 = new ConsortiumBlockchainAdapter(db);
    const trustObjService1 = new TrustObjectService(blockchain1, db, didService);
    const revService1 = new RevocationService(blockchain1, db);
    const issuerDid = 'did:trustgrid:edu:delhi-tech-univ';
    const studentDid = 'did:trustgrid:usr:rahul-sharma';

    const revokeObjectId = `TO-REVOKE-PERSIST-${Date.now()}`;
    await trustObjService1.createTrustObject({
      objectType: 'CREDENTIAL',
      subjectId: studentDid,
      issuerId: issuerDid,
      ownerId: studentDid,
      customId: revokeObjectId,
      metadata: {
        degree: 'Certificate in Cloud Security',
        year: 2025,
      },
    });

    // Revoke object in session 1
    await revService1.revokeTrustObject({
      trustObjectId: revokeObjectId,
      revokerDid: issuerDid,
      reason: 'Course curriculum revoked by accreditation board',
    });

    // Simulate server restart
    WalletService.clearMemoryCache();

    // Boot session 2
    const blockchain2 = new ConsortiumBlockchainAdapter(db);
    const trustObjService2 = new TrustObjectService(blockchain2, db, didService);
    const provService2 = new ProvenanceService(blockchain2, db, didService);
    const revService2 = new RevocationService(blockchain2, db);
    const riskEngine2 = new AnomalyRiskEngine(db);

    const verifier2 = new VerificationService(
      blockchain2,
      trustObjService2,
      provService2,
      revService2,
      riskEngine2,
      didService,
      db
    );

    const verificationResult = await verifier2.verifyTrustObject({
      trustObjectId: revokeObjectId,
    });

    assert.equal(verificationResult.overallStatus, 'REVOKED', 'Revocation status MUST persist across restart');
    assert.equal(verificationResult.revocationStatus.isRevoked, true);
    assert.ok(verificationResult.revocationStatus.reason?.includes('accreditation board'));
  });
});
