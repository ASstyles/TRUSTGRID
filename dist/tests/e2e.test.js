"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const db_service_js_1 = require("../database/db.service.js");
const consortium_blockchain_adapter_js_1 = require("../core/blockchain/consortium-blockchain.adapter.js");
const did_service_js_1 = require("../core/identity/did.service.js");
const wallet_service_js_1 = require("../core/identity/wallet.service.js");
const trust_object_service_js_1 = require("../core/trust-object/trust-object.service.js");
const provenance_service_js_1 = require("../core/provenance/provenance.service.js");
const revocation_service_js_1 = require("../core/revocation/revocation.service.js");
const anomaly_service_js_1 = require("../core/risk-engine/anomaly.service.js");
const verification_service_js_1 = require("../core/verification/verification.service.js");
(0, node_test_1.default)('Full End-to-End Trust Object Protocol (TOP) Lifecycle', async () => {
    const db = db_service_js_1.DatabaseService.getTestInstance();
    const didService = new did_service_js_1.DidService(db);
    const blockchain = new consortium_blockchain_adapter_js_1.ConsortiumBlockchainAdapter(db);
    const trustObjectService = new trust_object_service_js_1.TrustObjectService(blockchain, db, didService);
    const provenanceService = new provenance_service_js_1.ProvenanceService(blockchain, db);
    const revocationService = new revocation_service_js_1.RevocationService(blockchain, db);
    const riskEngine = new anomaly_service_js_1.AnomalyRiskEngine(db);
    const verifier = new verification_service_js_1.VerificationService(blockchain, trustObjectService, provenanceService, revocationService, riskEngine, didService, db);
    // 1. Create Issuer & Subject Identities
    const issuer = didService.createIdentity({
        sector: 'edu',
        identifier: 'iit-delhi',
        entityType: 'ORGANIZATION',
    });
    wallet_service_js_1.WalletService.storeKeyPair(issuer.did, issuer.keyPair);
    const student = didService.createIdentity({
        sector: 'usr',
        identifier: 'sneha-rao',
        entityType: 'INDIVIDUAL',
    });
    wallet_service_js_1.WalletService.storeKeyPair(student.did, student.keyPair);
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
    strict_1.default.ok(degree.trustObjectId);
    strict_1.default.ok(degree.contentHash);
    strict_1.default.ok(degree.signature);
    strict_1.default.ok(degree.blockchainTxId.startsWith('0x'));
    // 3. Verify Genuine Object
    const genuineResult = await verifier.verifyTrustObject({
        trustObjectId: degree.trustObjectId,
    });
    strict_1.default.equal(genuineResult.overallStatus, 'AUTHENTIC');
    strict_1.default.equal(genuineResult.hashMatch, true);
    strict_1.default.equal(genuineResult.signatureValid, true);
    strict_1.default.equal(genuineResult.blockchainProofValid, true);
    strict_1.default.equal(genuineResult.revocationStatus.isRevoked, false);
    strict_1.default.ok(genuineResult.trustScore >= 90);
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
    strict_1.default.equal(tamperedResult.overallStatus, 'TAMPERED');
    strict_1.default.equal(tamperedResult.hashMatch, false);
    strict_1.default.ok(tamperedResult.riskAssessment.riskScore >= 50);
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
    strict_1.default.equal(revokedResult.overallStatus, 'TAMPERED'); // Tampered takes precedence over revoked in overallStatus, but revocation is recorded
    strict_1.default.equal(revokedResult.revocationStatus.isRevoked, true);
    strict_1.default.ok(revokedResult.revocationStatus.reason?.includes('GPA tampering attempt'));
});
