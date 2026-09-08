import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ProductionBlockchainAdapter } from '../core/blockchain/production-blockchain.adapter.js';

describe('Hyperledger Fabric Chaincode & Production Adapter Tests', () => {
  let adapter: ProductionBlockchainAdapter;

  before(() => {
    adapter = new ProductionBlockchainAdapter({
      peerEndpoint: 'grpc://localhost:7051',
      channelName: 'trustgrid-channel',
      chaincodeName: 'trustgrid_cc',
      mspId: 'TruthLensMSP',
    });
  });

  it('1. Production adapter reports transparent connection status & contract readiness', () => {
    const status = adapter.getConnectionStatus();
    assert.strictEqual(status.connected, true);
    assert.strictEqual(status.gatewayMode, 'EMULATED_GATEWAY');
    assert.strictEqual(status.channel, 'trustgrid-channel');
    assert.strictEqual(status.chaincode, 'trustgrid_cc');
    assert.strictEqual(status.mspId, 'TruthLensMSP');
    assert.strictEqual(status.chaincodeContractReady, true);
  });

  it('2. registerProof writes to Fabric World State with block and Merkle leaf', async () => {
    const proof = await adapter.registerProof({
      trustObjectId: 'TO-FABRIC-001',
      contentHash: 'hash-fabric-001',
      issuerId: 'did:trustgrid:org:customs',
      ownerId: 'did:trustgrid:sc:prod-9988',
      status: 'ACTIVE',
      signerDid: 'did:trustgrid:org:customs',
      signature: 'fabric-sig-001',
    });

    assert.ok(proof);
    assert.strictEqual(proof.blockHeight, 1);
    assert.strictEqual(proof.status, 'ACTIVE');
    assert.strictEqual(proof.trustObjectId, 'TO-FABRIC-001');
    assert.ok(proof.txId.startsWith('tx-fabric-'));
    assert.ok(proof.validatorSignatures?.length);
  });

  it('3. verifyProof returns valid when content hash matches World State', async () => {
    const result = await adapter.verifyProof('TO-FABRIC-001', 'hash-fabric-001');
    assert.strictEqual(result.valid, true);
    assert.ok(result.proof);
    assert.strictEqual(result.proof.trustObjectId, 'TO-FABRIC-001');
  });

  it('4. verifyProof flags mismatch as TAMPERED', async () => {
    const result = await adapter.verifyProof('TO-FABRIC-001', 'adversary-forged-hash');
    assert.strictEqual(result.valid, false);
    assert.match(result.reason || '', /Fabric state mismatch/);
  });

  it('5. verifyProof returns false for non-existent object', async () => {
    const result = await adapter.verifyProof('TO-NONEXISTENT', 'any-hash');
    assert.strictEqual(result.valid, false);
    assert.match(result.reason || '', /not found in Fabric World State/);
  });

  it('6. revokeProof transitions status to REVOKED on Fabric ledger', async () => {
    const revoked = await adapter.revokeProof({
      trustObjectId: 'TO-FABRIC-001',
      reason: 'Batch contaminated during shipment',
      revokerDid: 'did:trustgrid:org:customs',
      signature: 'revoke-sig-001',
    });

    assert.strictEqual(revoked.status, 'REVOKED');
    assert.strictEqual(revoked.blockHeight, 2);

    const check = await adapter.verifyProof('TO-FABRIC-001', 'hash-fabric-001');
    assert.strictEqual(check.valid, false);
    assert.match(check.reason || '', /REVOKED/);
  });

  it('7. addProvenanceEvent anchors certified custody handoff on Fabric', async () => {
    const res = await adapter.addProvenanceEvent({
      eventId: 'EV-FABRIC-001',
      trustObjectId: 'TO-FABRIC-001',
      eventType: 'TRANSFER',
      fromDid: 'did:trustgrid:sc:node-a',
      toDid: 'did:trustgrid:sc:node-b',
      location: 'Port of Mumbai',
      timestamp: new Date().toISOString(),
      actionDescription: 'Customs port clearance certified',
      signature: 'sig-custody-fab',
      blockchainTxId: '',
    });

    assert.ok(res.txId.startsWith('tx-fabric-prov-'));
    assert.strictEqual(res.blockHeight, 3);
  });

  it('8. recordSecurityEvent anchors firmware compromise alert on Fabric', async () => {
    const res = await adapter.recordSecurityEvent({
      eventId: 'SEC-FABRIC-001',
      trustObjectId: 'TO-DEV-001',
      deviceId: 'GATEWAY-X10',
      eventType: 'FIRMWARE_DRIFT',
      severity: 'HIGH',
      expectedHash: 'sha256-clean',
      observedHash: 'sha256-tampered',
      description: 'Unauthorized firmware checksum modification',
      reporterDid: 'did:trustgrid:sys:cert',
    });

    assert.ok(res.txId.startsWith('tx-fabric-sec-'));
    assert.strictEqual(res.blockHeight, 4);
  });

  it('9. Fabric ledger integrity check validates all block headers and previous hashes', async () => {
    const integrity = await adapter.verifyLedgerIntegrity();
    assert.strictEqual(integrity.valid, true);
    assert.ok(integrity.totalBlocks >= 4);
    assert.ok(integrity.verifiedTxs >= 3);
  });

  it('10. Fabric Go Chaincode source file (trustgrid_cc.go) exists and contains all required methods', () => {
    const chaincodePath = path.resolve(process.cwd(), 'src', 'core', 'blockchain', 'fabric-chaincode', 'trustgrid_cc.go');
    assert.ok(fs.existsSync(chaincodePath));

    const content = fs.readFileSync(chaincodePath, 'utf8');
    assert.ok(content.includes('package main'));
    assert.ok(content.includes('type TrustGridContract struct'));
    assert.ok(content.includes('InitLedger'));
    assert.ok(content.includes('RegisterProof'));
    assert.ok(content.includes('VerifyProof'));
    assert.ok(content.includes('RevokeProof'));
    assert.ok(content.includes('AddProvenanceEvent'));
    assert.ok(content.includes('RecordSecurityEvent'));
  });
});
