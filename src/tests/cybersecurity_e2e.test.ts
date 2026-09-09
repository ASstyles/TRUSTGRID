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
import { CybersecurityModule } from '../sectors/cybersecurity.module.js';

test('Cybersecurity E2E & On-Chain Security Alert Suite', async (t) => {
  const db = DatabaseService.getInstance();
  const didService = new DidService(db);
  const blockchain = new ConsortiumBlockchainAdapter(db);
  const trustObjectService = new TrustObjectService(blockchain, db, didService);
  const provenanceService = new ProvenanceService(blockchain, db, didService);
  const revocationService = new RevocationService(blockchain, db);
  const riskEngine = new AnomalyRiskEngine(db);

  const secModule = new CybersecurityModule(trustObjectService, blockchain, db);
  const verifier = new VerificationService(
    blockchain,
    trustObjectService,
    provenanceService,
    revocationService,
    riskEngine,
    didService,
    db
  );

  const adminDid = 'did:trustgrid:sec:ciso-admin';
  WalletService.registerDeterministicIdentity(adminDid, 'INDIVIDUAL', db);
  const deviceCustomId = `TO-DEV-SCADA-${Date.now()}`;
  const baselineConfigHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  await t.test('1. Register device baseline on TOP and blockchain ledger', async () => {
    const deviceObject = await secModule.registerDeviceBaseline({
      adminDid,
      customId: deviceCustomId,
      metadata: {
        deviceId: `SCADA-UNIT-${Date.now()}`,
        hostname: 'grid-transformer-scada-01.power.gov.in',
        deviceType: 'INDUSTRIAL_SCADA',
        firmwareVersion: 'v2.8.4-HARDENED',
        configurationHash: baselineConfigHash,
        macAddress: '00:14:22:01:23:45',
        authorizedAdminDid: adminDid,
        ipAddress: '192.168.10.50',
      },
    });

    assert.equal(deviceObject.trustObjectId, deviceCustomId);
    assert.equal(deviceObject.objectType, 'DEVICE');
    assert.equal(deviceObject.status, 'ACTIVE');

    // Verify intact device initially
    const initialVerification = await verifier.verifyTrustObject({
      trustObjectId: deviceCustomId,
    });
    assert.equal(initialVerification.overallStatus, 'AUTHENTIC');
    assert.equal(initialVerification.hashMatch, true);
  });

  await t.test('2. Clean device audit with matching baseline returns AUTHENTIC', async () => {
    const auditResult = await secModule.auditDeviceIntegrity({
      trustObjectId: deviceCustomId,
      observedConfigHash: baselineConfigHash,
      reporterDid: 'did:trustgrid:sec:automated-scanner',
    });

    assert.equal(auditResult.status, 'AUTHENTIC');
    assert.equal(auditResult.baselineHash, baselineConfigHash);
    assert.equal(auditResult.observedHash, baselineConfigHash);
  });

  await t.test('3. Unauthorized configuration drift creates on-chain anchored security alert', async () => {
    const maliciousDriftHash = 'deadbeef0000000000000000000000000000000000000000000000000000dead';

    const driftResult = await secModule.auditDeviceIntegrity({
      trustObjectId: deviceCustomId,
      observedConfigHash: maliciousDriftHash,
      reporterDid: 'did:trustgrid:sec:automated-scanner',
    });

    assert.equal(driftResult.status, 'COMPROMISED');
    assert.ok(driftResult.securityEventId?.startsWith('SEC-'), 'Security event ID must be generated');
    assert.ok(driftResult.blockchainTxId?.startsWith('0x'), 'Blockchain txId MUST be generated and anchored');

    // Verify blockchain transaction exists on the ledger
    const tx = await blockchain.getTransaction(driftResult.blockchainTxId!);
    assert.ok(tx, 'Transaction must exist on blockchain ledger');
    assert.equal(tx.actionType, 'SECURITY_ALERT', 'Action type must be SECURITY_ALERT');
    assert.equal(tx.trustObjectId, deviceCustomId);

    // Verify security_events table persists the real transaction reference
    const eventRow = db.getOne<any>(
      'SELECT * FROM security_events WHERE id = ?',
      [driftResult.securityEventId]
    );
    assert.ok(eventRow, 'Security event must be persisted in database');
    assert.equal(eventRow.blockchain_tx_id, driftResult.blockchainTxId, 'Database event must reference on-chain txId');
  });

  await t.test('4. Verification pipeline flags compromised device as DEVICE_INTEGRITY_COMPROMISED with critical risk', async () => {
    const verification = await verifier.verifyTrustObject({
      trustObjectId: deviceCustomId,
    });

    assert.equal(
      verification.overallStatus,
      'DEVICE_INTEGRITY_COMPROMISED',
      'Tampered device must return DEVICE_INTEGRITY_COMPROMISED'
    );
    assert.equal(verification.hashMatch, false);
    assert.ok(verification.riskAssessment.riskScore >= 55, 'Risk score must be elevated');
  });
});
