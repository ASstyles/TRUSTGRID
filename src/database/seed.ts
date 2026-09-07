import { DatabaseService } from './db.service.js';
import { ConsortiumBlockchainAdapter } from '../core/blockchain/consortium-blockchain.adapter.js';
import { CryptoService } from '../core/crypto/crypto.service.js';
import { DidService } from '../core/identity/did.service.js';
import { WalletService } from '../core/identity/wallet.service.js';
import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { ProvenanceService } from '../core/provenance/provenance.service.js';
import { RevocationService } from '../core/revocation/revocation.service.js';
import { AnomalyRiskEngine } from '../core/risk-engine/anomaly.service.js';
import { EducationModule } from '../sectors/education.module.js';
import { SupplyChainModule } from '../sectors/supply-chain.module.js';
import { LegalEvidenceModule } from '../sectors/legal.module.js';
import { CybersecurityModule } from '../sectors/cybersecurity.module.js';

export async function seedDatabase(clean: boolean = true) {
  console.log('🌱 [TRUSTGRID] Initializing database and seeding demonstrator data...');
  const db = DatabaseService.getInstance();
  if (clean) {
    db.exec(`
      DELETE FROM verification_events;
      DELETE FROM security_events;
      DELETE FROM risk_events;
      DELETE FROM revocations;
      DELETE FROM ownership_events;
      DELETE FROM provenance_events;
      DELETE FROM documents;
      DELETE FROM credentials;
      DELETE FROM trust_objects;
      DELETE FROM blockchain_transactions;
      DELETE FROM blockchain_blocks;
      DELETE FROM identities;
      DELETE FROM users;
      DELETE FROM organizations;
    `);
  }
  const didService = new DidService(db);
  const blockchain = new ConsortiumBlockchainAdapter(db);
  const trustObjectService = new TrustObjectService(blockchain, db, didService);
  const provenanceService = new ProvenanceService(blockchain, db);
  const revocationService = new RevocationService(blockchain, db);
  const riskEngine = new AnomalyRiskEngine(db);

  const eduModule = new EducationModule(trustObjectService, db);
  const scModule = new SupplyChainModule(trustObjectService, provenanceService);
  const legalModule = new LegalEvidenceModule(trustObjectService, provenanceService);
  const secModule = new CybersecurityModule(trustObjectService, db);

  // 1. SEED IDENTITIES & ORGANIZATIONS
  console.log('🔑 [1/5] Registering Decentralized Identities (DIDs) & Wallets...');

  const orgs = [
    { sector: 'edu' as const, id: 'delhi-tech-univ', name: 'Delhi Technological University', type: 'UNIVERSITY' },
    { sector: 'sc' as const, id: 'bharat-pharma', name: 'Bharat Pharma Laboratories Ltd', type: 'MANUFACTURER' },
    { sector: 'sc' as const, id: 'apex-logistics', name: 'Apex Cold-Chain Logistics', type: 'DISTRIBUTOR' },
    { sector: 'sc' as const, id: 'delhi-central-hub', name: 'Delhi Central Distribution Warehouse', type: 'DISTRIBUTOR' },
    { sector: 'sc' as const, id: 'medlife-retail', name: 'MedLife Pharmacy Network', type: 'DISTRIBUTOR' },
    { sector: 'legal' as const, id: 'delhi-forensics', name: 'Central Forensic Science Laboratory (CFSL)', type: 'LAW_ENFORCEMENT' },
    { sector: 'legal' as const, id: 'delhi-high-court', name: 'High Court Judicial Registry', type: 'GOVERNMENT' },
    { sector: 'sec' as const, id: 'national-cert', name: 'National Critical Infrastructure Security SOC', type: 'CYBERSECURITY_AGENCY' },
  ];

  for (const org of orgs) {
    const keyPair = CryptoService.generateEd25519KeyPair();
    const { did } = didService.createIdentity({
      sector: org.sector,
      identifier: org.id,
      entityType: 'ORGANIZATION',
      keyPair,
    });
    const keystore = WalletService.storeKeyPair(did, keyPair);

    db.run(
      `INSERT OR REPLACE INTO organizations (id, name, organization_type, jurisdiction, did, public_key, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, 'VERIFIED')`,
      ['ORG-' + org.id, org.name, org.type, 'IN-DL', did, keyPair.publicKey]
    );

    // Register organization user
    db.run(
      `INSERT OR REPLACE INTO users (id, organization_id, email, password_hash, display_name, user_type, did, public_key, encrypted_private_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'USR-' + org.id,
        'ORG-' + org.id,
        `${org.id}@trustgrid.gov.in`,
        CryptoService.sha256('TrustGrid2026!'),
        org.name,
        'ISSUER',
        did,
        keyPair.publicKey,
        JSON.stringify(keystore),
      ]
    );
  }

  // Seed Individual Users
  const individuals = [
    { sector: 'usr' as const, id: 'rahul-sharma', name: 'Rahul Sharma', email: 'rahul.sharma@student.dtu.ac.in', role: 'STUDENT' },
    { sector: 'usr' as const, id: 'priya-patel', name: 'Priya Patel', email: 'priya.patel@student.dtu.ac.in', role: 'STUDENT' },
    { sector: 'usr' as const, id: 'arun-kumar', name: 'Arun Kumar', email: 'arun.kumar@student.dtu.ac.in', role: 'STUDENT' },
    { sector: 'legal' as const, id: 'inspector-singh', name: 'Inspector Rajesh Singh', email: 'r.singh@police.gov.in', role: 'INVESTIGATOR' },
    { sector: 'sec' as const, id: 'ciso-admin', name: 'Vikram Mehta (Chief InfoSec Officer)', email: 'ciso@cert.gov.in', role: 'SECURITY_ADMIN' },
    { sector: 'sys' as const, id: 'global-verifier', name: 'Public TrustGrid Verifier', email: 'verifier@trustgrid.network', role: 'VERIFIER' },
  ];

  for (const person of individuals) {
    const keyPair = CryptoService.generateEd25519KeyPair();
    const { did } = didService.createIdentity({
      sector: person.sector,
      identifier: person.id,
      entityType: 'INDIVIDUAL',
      keyPair,
    });
    const keystore = WalletService.storeKeyPair(did, keyPair);

    db.run(
      `INSERT OR REPLACE INTO users (id, email, password_hash, display_name, user_type, did, public_key, encrypted_private_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'USR-' + person.id,
        person.email,
        CryptoService.sha256('TrustGrid2026!'),
        person.name,
        person.role,
        did,
        keyPair.publicKey,
        JSON.stringify(keystore),
      ]
    );
  }

  // 2. FLAGSHIP DEMO SCENARIO 1: EDUCATION
  console.log('🎓 [2/5] Seeding Education Flagship: Genuine, Tampered, and Revoked Degrees...');
  const uniDid = 'did:trustgrid:edu:delhi-tech-univ';
  const rahulDid = 'did:trustgrid:usr:rahul-sharma';
  const arunDid = 'did:trustgrid:usr:arun-kumar';

  // Genuine Degree (Rahul Sharma)
  await eduModule.issueDegree({
    institutionDid: uniDid,
    studentDid: rahulDid,
    customId: 'TO-EDU-DEGREE-GENUINE-2024',
    metadata: {
      studentName: 'Rahul Sharma',
      studentRollNo: '2020/CS/094',
      degreeName: 'Bachelor of Technology in Computer Science & Engineering',
      major: 'Computer Science & Engineering',
      graduationYear: 2024,
      cgpa: '9.42 / 10.00',
      honors: 'First Class with Distinction',
      serialNumber: 'DTU-2024-BTECH-0942',
      institutionName: 'Delhi Technological University',
    },
  });

  // Tampered Degree Scenario (Rahul -> modified to Rohan with fake 9.9 CGPA)
  const tamperedObj = await eduModule.issueDegree({
    institutionDid: uniDid,
    studentDid: rahulDid,
    customId: 'TO-EDU-DEGREE-TAMPERED-2024',
    metadata: {
      studentName: 'Rahul Sharma',
      studentRollNo: '2020/CS/071',
      degreeName: 'Bachelor of Technology in Information Technology',
      major: 'Information Technology',
      graduationYear: 2024,
      cgpa: '7.10 / 10.00',
      honors: 'Second Class',
      serialNumber: 'DTU-2024-BTECH-0710',
      institutionName: 'Delhi Technological University',
    },
  });

  // Simulate off-chain database modification (tamper student name & grade)
  trustObjectService.simulateTamper(tamperedObj.trustObjectId, {
    studentName: 'Rohan Sharma', // Tampered name!
    studentRollNo: '2020/CS/071',
    degreeName: 'Bachelor of Technology in Information Technology',
    major: 'Information Technology',
    graduationYear: 2024,
    cgpa: '9.95 / 10.00', // Tampered CGPA!
    honors: 'First Class with Distinction (Forged)',
    serialNumber: 'DTU-2024-BTECH-0710',
    institutionName: 'Delhi Technological University',
  });

  // Revoked Degree Scenario (Arun Kumar)
  const revokedObj = await eduModule.issueDegree({
    institutionDid: uniDid,
    studentDid: arunDid,
    customId: 'TO-EDU-DEGREE-REVOKED-2024',
    metadata: {
      studentName: 'Arun Kumar',
      studentRollNo: '2020/CS/012',
      degreeName: 'Bachelor of Technology in Software Engineering',
      major: 'Software Engineering',
      graduationYear: 2024,
      cgpa: '8.10 / 10.00',
      serialNumber: 'DTU-2024-BTECH-0810',
      institutionName: 'Delhi Technological University',
    },
  });

  await revocationService.revokeTrustObject({
    trustObjectId: revokedObj.trustObjectId,
    revokerDid: uniDid,
    reason: 'Academic Senate Resolution #2024-88: Degree annulled due to plagiarism and research misconduct.',
  });

  // 3. FLAGSHIP DEMO SCENARIO 2: SUPPLY CHAIN
  console.log('📦 [3/5] Seeding Supply Chain Flagship: Multi-Tier Provenance & Counterfeit Detection...');
  const mfgDid = 'did:trustgrid:sc:bharat-pharma';
  const distDid = 'did:trustgrid:sc:apex-logistics';
  const warehouseDid = 'did:trustgrid:sc:delhi-central-hub';
  const retailDid = 'did:trustgrid:sc:medlife-retail';

  // Genuine Product Batch with complete 4-stage custody
  const genuineMed = await scModule.registerProductBatch({
    manufacturerDid: mfgDid,
    customId: 'TO-PRD-REMDESIVIR-BATCH-402',
    metadata: {
      productName: 'Remdesivir Lyophilized 100mg Vial (Critical Antiviral)',
      batchNumber: 'LOT-2026-REM-402',
      serialNumber: 'REM-DL-9842-100MG',
      manufacturerName: 'Bharat Pharma Laboratories Ltd',
      manufacturingDate: '2026-01-15',
      expiryDate: '2028-01-14',
      dosageOrSpecification: '100mg / Sterile Powder for Injection',
      complianceCert: 'WHO-GMP-CERT-IN-984201',
    },
  });

  // Hop 1: Manufacturer -> Apex Logistics
  await scModule.transferProductCustody({
    trustObjectId: genuineMed.trustObjectId,
    fromDid: mfgDid,
    toDid: distDid,
    location: 'Baddi Industrial Area, Himachal Pradesh (Manufacturing Plant)',
    actionDescription: 'Certified cold-chain dispatch at 2-8°C with temperature logging',
  });

  // Hop 2: Apex Logistics -> Central Distribution Warehouse
  await scModule.transferProductCustody({
    trustObjectId: genuineMed.trustObjectId,
    fromDid: distDid,
    toDid: warehouseDid,
    location: 'National Highway 44, Kundli Logistics Hub',
    actionDescription: 'Hub transfer and barcode integrity inspection passed',
  });

  // Hop 3: Central Warehouse -> MedLife Pharmacy Retailer
  await scModule.transferProductCustody({
    trustObjectId: genuineMed.trustObjectId,
    fromDid: warehouseDid,
    toDid: retailDid,
    location: 'MedLife Flagship Pharmacy, Connaught Place, New Delhi',
    actionDescription: 'Retail stock receipt, tamper-evident seals verified intact',
  });

  // Counterfeit Product Batch Scenario (Broken Custody Chain)
  const counterfeitMed = await scModule.registerProductBatch({
    manufacturerDid: mfgDid,
    customId: 'TO-PRD-COUNTERFEIT-BATCH-999',
    metadata: {
      productName: 'Remdesivir Lyophilized 100mg Vial (Counterfeit Clone Attempt)',
      batchNumber: 'LOT-2026-REM-402-CLONE',
      serialNumber: 'REM-FAKE-9999-CLONE',
      manufacturerName: 'Bharat Pharma Laboratories Ltd',
      manufacturingDate: '2026-02-01',
      expiryDate: '2028-01-14',
      dosageOrSpecification: 'Adulterated Saline Solution',
      complianceCert: 'UNAUTHORIZED_FORGERY',
    },
  });

  // Injected unauthorized transfer by unknown actor (broken chain)
  db.run(
    `INSERT OR REPLACE INTO provenance_events 
     (id, trust_object_id, event_type, from_did, to_did, location, action_description, signature, blockchain_tx_id, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'))`,
    [
      'EV-PROV-BROKEN-999',
      counterfeitMed.trustObjectId,
      'TRANSFER',
      'did:trustgrid:sc:unauthorized-smuggler', // Unconnected entity!
      retailDid,
      'Black Market Freight Terminal, Delhi Border',
      'Illicit uninspected drop-off without cold-chain verification',
      'INVALID_MOCK_SIGNATURE',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ]
  );

  // 4. FLAGSHIP DEMO SCENARIO 3: LEGAL FORENSIC EVIDENCE
  console.log('⚖️ [4/5] Seeding Legal Flagship: Digital Evidence Chain of Custody & Spoliation Detection...');
  const officerDid = 'did:trustgrid:legal:inspector-singh';
  const forensicLabDid = 'did:trustgrid:legal:delhi-forensics';
  const courtDid = 'did:trustgrid:legal:delhi-high-court';

  // Authentic Evidence (CCTV Video)
  const authenticEvidence = await legalModule.registerEvidence({
    investigatorDid: officerDid,
    customId: 'TO-EVI-CCTV-FORENSIC-081',
    metadata: {
      caseNumber: 'FIR-2026-ND-4182',
      evidenceTag: 'EVI-CCTV-081',
      evidenceType: 'CCTV_VIDEO',
      originalFileName: 'cctv_vault_corridor_cam04_20260210.mp4',
      collectionLocation: 'Financial Banking Center, Parliament Street, New Delhi',
      collectingOfficer: 'Inspector Rajesh Singh (Cyber Crime Unit)',
      chainOfCustodyAgency: 'Delhi Police Cyber Cell',
      forensicHash: '8f4e2a1b9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
    },
  });

  // Custody Handoff 1: Officer -> Forensic Lab
  await legalModule.transferEvidenceCustody({
    trustObjectId: authenticEvidence.trustObjectId,
    fromDid: officerDid,
    toDid: forensicLabDid,
    location: 'CFSL Digital Forensics Examination Laboratory, New Delhi',
    actionDescription: 'Sealed forensic hard drive handoff; write-blocker image acquired',
  });

  // Custody Handoff 2: Forensic Lab -> Court
  await legalModule.transferEvidenceCustody({
    trustObjectId: authenticEvidence.trustObjectId,
    fromDid: forensicLabDid,
    toDid: courtDid,
    location: 'Courtroom #4, Delhi High Court Evidence Vault',
    actionDescription: 'Formal submission under Section 65B Indian Evidence Act for judicial trial',
  });

  // Tampered Evidence Scenario (Modified Video Frames)
  const tamperedEvidence = await legalModule.registerEvidence({
    investigatorDid: officerDid,
    customId: 'TO-EVI-CCTV-TAMPERED-082',
    metadata: {
      caseNumber: 'FIR-2026-ND-4182',
      evidenceTag: 'EVI-CCTV-082',
      evidenceType: 'CCTV_VIDEO',
      originalFileName: 'cctv_entrance_gate_cam01_20260210.mp4',
      collectionLocation: 'Main Gate Security Post, Parliament Street',
      collectingOfficer: 'Inspector Rajesh Singh',
      chainOfCustodyAgency: 'Delhi Police Cyber Cell',
      forensicHash: '3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    },
  });

  // Simulate forensic tampering (tampered video file / altered hash)
  trustObjectService.simulateTamper(tamperedEvidence.trustObjectId, {
    caseNumber: 'FIR-2026-ND-4182',
    evidenceTag: 'EVI-CCTV-082',
    evidenceType: 'CCTV_VIDEO',
    originalFileName: 'cctv_entrance_gate_cam01_20260210.mp4',
    collectionLocation: 'Main Gate Security Post, Parliament Street',
    collectingOfficer: 'Inspector Rajesh Singh',
    chainOfCustodyAgency: 'Delhi Police Cyber Cell',
    forensicHash: 'ff00000000000000000000000000000000000000000000000000000000000001', // Tampered hash!
    spoliationReason: 'Video frames between 02:14:00 - 02:17:30 removed or altered',
  });

  // 5. FLAGSHIP DEMO SCENARIO 4: CYBERSECURITY
  console.log('🛡️ [5/5] Seeding Cybersecurity Flagship: Critical Infrastructure Baseline & Compromise Alert...');
  const secAdminDid = 'did:trustgrid:sec:ciso-admin';

  // Intact Core Router Baseline
  await secModule.registerDeviceBaseline({
    adminDid: secAdminDid,
    customId: 'TO-DEV-CORE-ROUTER-09',
    metadata: {
      deviceId: 'ROUTER-GRID-09',
      hostname: 'core-substation-gw-09.delhi-grid.in',
      deviceType: 'CRITICAL_ROUTER',
      firmwareVersion: 'v4.19.8-LTS-HARDENED',
      configurationHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      macAddress: '00:1B:44:11:3A:B7',
      authorizedAdminDid: secAdminDid,
      ipAddress: '10.240.12.1',
    },
  });

  // Compromised Device Scenario (Injected Backdoor in Edge Gateway)
  const compromisedDevice = await secModule.registerDeviceBaseline({
    adminDid: secAdminDid,
    customId: 'TO-DEV-EDGE-GATEWAY-01',
    metadata: {
      deviceId: 'GATEWAY-EDGE-01',
      hostname: 'edge-scada-node-01.delhi-grid.in',
      deviceType: 'INDUSTRIAL_SCADA',
      firmwareVersion: 'v3.12.0-FIRMWARE',
      configurationHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      macAddress: '00:2A:88:99:FF:31',
      authorizedAdminDid: secAdminDid,
      ipAddress: '10.240.18.99',
    },
  });

  // Trigger live compromise audit detection
  await secModule.auditDeviceIntegrity({
    trustObjectId: compromisedDevice.trustObjectId,
    observedConfigHash: 'deadbeef884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15deadbeef',
    reporterDid: 'did:trustgrid:sec:soc-automated-probe',
  });

  console.log('✅ [TRUSTGRID] Database successfully seeded with 4 Flagship Scenarios & Full Cryptographic Ledgers!');
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}
