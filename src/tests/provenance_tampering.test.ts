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
import { ProvenanceEvent } from '../core/trust-object/trust-object.types.js';

test('Provenance Chain Cryptographic Integrity & Tamper Detection Suite', async (t) => {
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

  const mfgDid = 'did:trustgrid:sc:bharat-pharma';
  const distDid = 'did:trustgrid:sc:apex-logistics';
  const warehouseDid = 'did:trustgrid:sc:delhi-central-hub';
  const retailDid = 'did:trustgrid:sc:medlife-retail';

  await t.test('1. Unbroken 4-hop certified custody chain verifies as AUTHENTIC', async () => {
    const product = await trustObjectService.createTrustObject({
      objectType: 'PRODUCT',
      subjectId: `did:trustgrid:sc:item-${Date.now()}`,
      issuerId: mfgDid,
      ownerId: mfgDid,
      metadata: {
        productName: 'Remdesivir 100mg Injection',
        batchNumber: `BAT-${Date.now()}`,
      },
    });

    // Hop 1: Manufacturer -> Distributor
    await provenanceService.transferCustody({
      trustObjectId: product.trustObjectId,
      fromDid: mfgDid,
      toDid: distDid,
      location: 'Pharmaceutical Plant, Baddi, HP',
      actionDescription: 'Cold-chain dispatch initiated',
    });

    // Hop 2: Distributor -> Warehouse
    await provenanceService.transferCustody({
      trustObjectId: product.trustObjectId,
      fromDid: distDid,
      toDid: warehouseDid,
      location: 'Apex Cargo Terminal, IGI Airport, New Delhi',
      actionDescription: 'Air freight received under 2-8 deg C storage',
    });

    // Hop 3: Warehouse -> Retailer
    await provenanceService.transferCustody({
      trustObjectId: product.trustObjectId,
      fromDid: warehouseDid,
      toDid: retailDid,
      location: 'MedLife Central Distribution Warehouse, Okhla Phase III',
      actionDescription: 'Delivery to licensed hospital pharmacy network',
    });

    const verification = await verifier.verifyTrustObject({
      trustObjectId: product.trustObjectId,
    });

    assert.equal(verification.overallStatus, 'AUTHENTIC');
    assert.equal(verification.provenanceStatus.isValid, true);
    assert.equal(verification.provenanceStatus.eventCount, 4);
    assert.equal(verification.ownerId, retailDid);
  });

  await t.test('2. Broken chain of custody (unauthorized hop) detected as PROVENANCE_MISMATCH', async () => {
    const timestamp = '2026-09-02T10:00:00.000Z';
    const ev2Payload = `TO-TEST-BREAK-${mfgDid}->${distDid}-${timestamp}`;
    const ev2Sig = WalletService.signWithDid(mfgDid, ev2Payload);

    const events: ProvenanceEvent[] = [
      {
        eventId: 'EV-01',
        trustObjectId: 'TO-TEST-BREAK',
        eventType: 'CREATION',
        fromDid: mfgDid,
        toDid: mfgDid,
        location: 'Factory',
        timestamp: '2026-09-01T10:00:00.000Z',
        actionDescription: 'Manufactured',
        signature: 'valid-sig',
        blockchainTxId: '0x01',
      },
      {
        eventId: 'EV-02',
        trustObjectId: 'TO-TEST-BREAK',
        eventType: 'TRANSFER',
        fromDid: mfgDid,
        toDid: distDid,
        location: 'Distributor Hub',
        timestamp,
        actionDescription: 'Handoff to distributor',
        signature: ev2Sig,
        blockchainTxId: '0x02',
      },
      {
        eventId: 'EV-03',
        trustObjectId: 'TO-TEST-BREAK',
        eventType: 'TRANSFER',
        fromDid: 'did:trustgrid:sc:unauthorized-third-party', // BROKEN HOP! Prior was distDid!
        toDid: retailDid,
        location: 'Unknown location',
        timestamp: '2026-09-03T10:00:00.000Z',
        actionDescription: 'Suspicious delivery',
        signature: 'valid-sig',
        blockchainTxId: '0x03',
      },
    ];

    const continuity = provenanceService.verifyChainContinuity(events);
    assert.equal(continuity.isValid, false);
    assert.equal(continuity.brokenIndex, 2);
    assert.ok(continuity.reason?.includes('unauthorized entity'));
  });

  await t.test('3. Forged custody signature detected as PROVENANCE_MISMATCH', async () => {
    const timestamp = '2026-09-02T10:00:00.000Z';
    const fakeSignature = Buffer.from('corrupted-ed25519-signature-bytes-not-authentic').toString('base64');

    const events: ProvenanceEvent[] = [
      {
        eventId: 'EV-01',
        trustObjectId: 'TO-TEST-FORGE',
        eventType: 'CREATION',
        fromDid: mfgDid,
        toDid: mfgDid,
        location: 'Factory',
        timestamp: '2026-09-01T10:00:00.000Z',
        actionDescription: 'Manufactured',
        signature: 'valid-creation',
        blockchainTxId: '0x01',
      },
      {
        eventId: 'EV-02',
        trustObjectId: 'TO-TEST-FORGE',
        eventType: 'TRANSFER',
        fromDid: mfgDid,
        toDid: distDid,
        location: 'In transit',
        timestamp,
        actionDescription: 'Certified transfer',
        signature: fakeSignature, // Tampered signature!
        blockchainTxId: '0x02',
      },
    ];

    const continuity = provenanceService.verifyChainContinuity(events);
    assert.equal(continuity.isValid, false);
    assert.equal(continuity.brokenIndex, 1);
    assert.ok(continuity.reason?.includes('Invalid cryptographic signature'));
  });
});
