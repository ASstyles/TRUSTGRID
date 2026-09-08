import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { DatabaseService } from '../database/db.service.js';
import { ConsortiumBlockchainAdapter } from '../core/blockchain/consortium-blockchain.adapter.js';
import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { ProvenanceService } from '../core/provenance/provenance.service.js';
import { DidService } from '../core/identity/did.service.js';
import { WalletService } from '../core/identity/wallet.service.js';
import { EducationModule } from '../sectors/education.module.js';
import { SupplyChainModule } from '../sectors/supply-chain.module.js';
import { LegalEvidenceModule, ForensicEvidenceMetadata } from '../sectors/legal.module.js';
import { CybersecurityModule, DeviceBaselineMetadata } from '../sectors/cybersecurity.module.js';
import { CryptoService } from '../core/crypto/crypto.service.js';

describe('Deep-Dive Sector Engines Test Suite (4 Sectors)', () => {
  let db: DatabaseService;
  let blockchain: ConsortiumBlockchainAdapter;
  let didService: DidService;
  let trustObjectService: TrustObjectService;
  let provenanceService: ProvenanceService;

  let eduModule: EducationModule;
  let scModule: SupplyChainModule;
  let legalModule: LegalEvidenceModule;
  let secModule: CybersecurityModule;

  const testUnivDid = 'did:trustgrid:org:iit-bombay';
  const testStudentDid = 'did:trustgrid:student:priya-sharma';
  const testPharmaDid = 'did:trustgrid:sc:pfizer-india';
  const testCourtDid = 'did:trustgrid:legal:delhi-high-court';
  const testSocDid = 'did:trustgrid:cyber:cert-in';

  before(() => {
    db = DatabaseService.getTestInstance();
    didService = new DidService(db);
    blockchain = new ConsortiumBlockchainAdapter(db);
    trustObjectService = new TrustObjectService(blockchain, db, didService);
    provenanceService = new ProvenanceService(blockchain, db);

    eduModule = new EducationModule(trustObjectService, db);
    scModule = new SupplyChainModule(trustObjectService, provenanceService);
    legalModule = new LegalEvidenceModule(trustObjectService, provenanceService);
    secModule = new CybersecurityModule(trustObjectService, blockchain, db);

    // Register all required DIDs with keys in wallet
    const dids = [testUnivDid, testStudentDid, testPharmaDid, testCourtDid, testSocDid];
    for (const did of dids) {
      const kp = CryptoService.generateDeterministicEd25519KeyPair(`seed:${did}`);
      WalletService.storeKeyPair(did, kp, db);
      db.run(
        `INSERT OR REPLACE INTO identities 
         (did, entity_type, controller_did, public_key, key_type, verification_method, authentication_methods, service_endpoints, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          did,
          'ORGANIZATION',
          did,
          kp.publicKey,
          'Ed25519VerificationKey2020',
          `${did}#key-1`,
          JSON.stringify([`${did}#key-1`]),
          JSON.stringify({}),
          new Date().toISOString(),
        ]
      );
    }
  });

  // SECTOR 1: EDUCATION
  it('1. Education: validateMetadata returns valid for complete degree payload', () => {
    const validMeta = {
      studentName: 'Priya Sharma',
      studentRollNo: 'CS-2024-001',
      degreeName: 'Master of Science',
      major: 'Artificial Intelligence',
      graduationYear: 2026,
      cgpa: '9.4',
      serialNumber: 'IITB-MS-2026-991',
      institutionName: 'IIT Bombay',
    };
    const res = eduModule.validateMetadata(validMeta);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors?.length, 0);
  });

  it('2. Education: validateMetadata rejects missing mandatory attributes', () => {
    const invalidMeta = {
      studentName: '',
      degreeName: '',
      major: '',
      serialNumber: '',
    };
    const res = eduModule.validateMetadata(invalidMeta);
    assert.strictEqual(res.valid, false);
    assert.ok((res.errors?.length || 0) >= 4);
  });

  it('3. Education: issueDegree anchors credential on blockchain and populates credentials table', async () => {
    const degree = await eduModule.issueDegree({
      institutionDid: testUnivDid,
      studentDid: testStudentDid,
      metadata: {
        studentName: 'Priya Sharma',
        studentRollNo: 'CS-2024-001',
        degreeName: 'Master of Science',
        major: 'Artificial Intelligence',
        graduationYear: 2026,
        cgpa: '9.4',
        serialNumber: 'IITB-MS-2026-991',
        institutionName: 'IIT Bombay',
      },
    });

    assert.ok(degree);
    assert.strictEqual(degree.objectType, 'CREDENTIAL');
    assert.strictEqual(degree.status, 'ACTIVE');

    const credRow = db.getOne<any>('SELECT * FROM credentials WHERE trust_object_id = ?', [degree.trustObjectId]);
    assert.ok(credRow);
    assert.strictEqual(credRow.student_did, testStudentDid);
    assert.strictEqual(credRow.degree_name, 'Master of Science');
  });

  // SECTOR 2: SUPPLY CHAIN
  it('4. Supply Chain: validateMetadata validates pharma batch payload', () => {
    const validBatch = {
      productName: 'Remdesivir 100mg Injection',
      batchNumber: 'BATCH-RDV-2026-09',
      serialNumber: 'SN-RDV-009182',
      manufacturerName: 'Pfizer India Healthcare',
      manufacturingDate: '2026-01-10',
      expiryDate: '2028-01-10',
      dosageOrSpecification: '100mg lyophilized powder',
      complianceCert: 'WHO-GMP-CERT-9901',
    };
    const res = scModule.validateMetadata(validBatch);
    assert.strictEqual(res.valid, true);
  });

  it('5. Supply Chain: validateMetadata rejects batch without batchNumber', () => {
    const res = scModule.validateMetadata({ productName: 'Aspirin', batchNumber: '', serialNumber: '123' });
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors?.includes('batchNumber is required'));
  });

  it('6. Supply Chain: registerProductBatch anchors product batch with expiration date', async () => {
    const batch = await scModule.registerProductBatch({
      manufacturerDid: testPharmaDid,
      metadata: {
        productName: 'Remdesivir 100mg Injection',
        batchNumber: 'BATCH-RDV-2026-09',
        serialNumber: 'SN-RDV-009182',
        manufacturerName: 'Pfizer India Healthcare',
        manufacturingDate: '2026-01-10',
        expiryDate: '2028-01-10',
        dosageOrSpecification: '100mg lyophilized powder',
        complianceCert: 'WHO-GMP-CERT-9901',
      },
    });

    assert.ok(batch);
    assert.strictEqual(batch.objectType, 'PRODUCT');
    assert.strictEqual(batch.expiresAt, '2028-01-10');
  });

  it('7. Supply Chain: transferProductCustody anchors certified custody event', async () => {
    const batch = await scModule.registerProductBatch({
      manufacturerDid: testPharmaDid,
      metadata: {
        productName: 'Insulin Glargine',
        batchNumber: 'BATCH-INS-01',
        serialNumber: 'SN-INS-100',
        manufacturerName: 'Pfizer India',
        manufacturingDate: '2026-02-01',
        expiryDate: '2027-02-01',
        dosageOrSpecification: '100 units/mL',
        complianceCert: 'ISO-13485',
      },
    });

    const event = await scModule.transferProductCustody({
      trustObjectId: batch.trustObjectId,
      fromDid: testPharmaDid,
      toDid: 'did:trustgrid:sc:apollo-pharmacy',
      location: 'Apollo Central Warehouse, Mumbai',
      actionDescription: 'Cold-chain compliant handover verified at 4 deg C',
    });

    assert.ok(event);
    assert.strictEqual(event.eventType, 'TRANSFER');
    assert.strictEqual(event.toDid, 'did:trustgrid:sc:apollo-pharmacy');
  });

  // SECTOR 3: LEGAL EVIDENCE
  it('8. Legal: validateMetadata validates forensic evidence payload', () => {
    const validEvidence: ForensicEvidenceMetadata = {
      caseNumber: 'FIR-2026-DEL-991',
      evidenceTag: 'TAG-CCTV-001',
      evidenceType: 'FORENSIC_IMAGE',
      originalFileName: 'disk_image.raw',
      collectionLocation: 'Cyber Forensic Vault #4',
      collectingOfficer: 'Inspector Rajesh Verma',
      chainOfCustodyAgency: 'Delhi Police Cyber Cell',
      forensicHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };
    const res = legalModule.validateMetadata(validEvidence);
    assert.strictEqual(res.valid, true);
  });

  it('9. Legal: registerEvidence anchors tamper-evident forensic exhibit', async () => {
    const evidence = await legalModule.registerEvidence({
      investigatorDid: testCourtDid,
      metadata: {
        caseNumber: 'FIR-2026-DEL-991',
        evidenceTag: 'TAG-DISK-991',
        evidenceType: 'FORENSIC_IMAGE',
        originalFileName: 'workstation_bitstream.dd',
        collectionLocation: 'Cyber Forensic Vault #4',
        collectingOfficer: 'Inspector Rajesh Verma',
        chainOfCustodyAgency: 'Delhi Police Cyber Cell',
        forensicHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    });

    assert.ok(evidence);
    assert.strictEqual(evidence.objectType, 'EVIDENCE');
    assert.strictEqual(evidence.status, 'ACTIVE');
  });

  it('10. Legal: transferEvidenceCustody records chain of custody with jurisdiction verification', async () => {
    const evidence = await legalModule.registerEvidence({
      investigatorDid: testCourtDid,
      metadata: {
        caseNumber: 'CASE-2026-002',
        evidenceTag: 'TAG-CCTV-002',
        evidenceType: 'CCTV_VIDEO',
        originalFileName: 'airport_terminal_cam3.mp4',
        collectionLocation: 'IGI Airport Security Room',
        collectingOfficer: 'CBI Special Officer',
        chainOfCustodyAgency: 'CBI Cyber Crimes Unit',
        forensicHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      },
    });

    const event = await legalModule.transferEvidenceCustody({
      trustObjectId: evidence.trustObjectId,
      fromDid: testCourtDid,
      toDid: 'did:trustgrid:legal:forensic-lab-cbi',
      location: 'Central Forensic Science Laboratory, CBI',
      actionDescription: 'Forensic integrity seal verified unbroken',
    });

    assert.ok(event);
    assert.strictEqual(event.eventType, 'TRANSFER');
  });

  // SECTOR 4: CYBERSECURITY
  it('11. Cybersecurity: registerDeviceBaseline anchors firmware baseline hash on ledger', async () => {
    const metadata: DeviceBaselineMetadata = {
      deviceId: 'SCADA-RTU-07',
      hostname: 'scada-rtu-substation-07.grid.in',
      deviceType: 'INDUSTRIAL_SCADA',
      firmwareVersion: 'v4.2.1-sec',
      configurationHash: 'hash-clean-config-rtu-07',
      macAddress: '00:1A:2B:3C:4D:5E',
      authorizedAdminDid: testSocDid,
      ipAddress: '10.200.4.15',
    };

    const device = await secModule.registerDeviceBaseline({
      adminDid: testSocDid,
      metadata,
    });

    assert.ok(device);
    assert.strictEqual(device.objectType, 'DEVICE');
    assert.strictEqual(device.status, 'ACTIVE');
  });

  it('12. Cybersecurity: auditDevice detects firmware drift and logs on-chain alert', async () => {
    const metadata: DeviceBaselineMetadata = {
      deviceId: 'FIREWALL-CORE-01',
      hostname: 'fw-core-dc01.grid.in',
      deviceType: 'CRITICAL_ROUTER',
      firmwareVersion: 'v9.8.2',
      configurationHash: 'hash-baseline-cisco-firmware',
      macAddress: '00:2A:3B:4C:5D:6E',
      authorizedAdminDid: testSocDid,
      ipAddress: '192.168.1.1',
    };

    const device = await secModule.registerDeviceBaseline({
      adminDid: testSocDid,
      metadata,
    });

    // Clean audit
    const cleanAudit = await secModule.auditDeviceIntegrity({
      trustObjectId: device.trustObjectId,
      observedConfigHash: 'hash-baseline-cisco-firmware',
      reporterDid: testSocDid,
    });
    assert.strictEqual(cleanAudit.status, 'AUTHENTIC');

    // Compromised audit
    const compromisedAudit = await secModule.auditDeviceIntegrity({
      trustObjectId: device.trustObjectId,
      observedConfigHash: 'hash-corrupted-drift-detected',
      reporterDid: testSocDid,
    });
    assert.strictEqual(compromisedAudit.status, 'COMPROMISED');
    assert.ok(compromisedAudit.securityEventId);
  });
});
