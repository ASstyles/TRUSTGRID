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
const trust_object_service_js_1 = require("../core/trust-object/trust-object.service.js");
const provenance_service_js_1 = require("../core/provenance/provenance.service.js");
const revocation_service_js_1 = require("../core/revocation/revocation.service.js");
const anomaly_service_js_1 = require("../core/risk-engine/anomaly.service.js");
const verification_service_js_1 = require("../core/verification/verification.service.js");
const seed_js_1 = require("../database/seed.js");
(0, node_test_1.default)('TRUSTGRID TOP Verification Pipeline Tests', async (t) => {
    // Ensure database is seeded
    await (0, seed_js_1.seedDatabase)();
    const db = db_service_js_1.DatabaseService.getInstance();
    const didService = new did_service_js_1.DidService(db);
    const blockchain = new consortium_blockchain_adapter_js_1.ConsortiumBlockchainAdapter(db);
    const trustObjectService = new trust_object_service_js_1.TrustObjectService(blockchain, db, didService);
    const provenanceService = new provenance_service_js_1.ProvenanceService(blockchain, db);
    const revocationService = new revocation_service_js_1.RevocationService(blockchain, db);
    const riskEngine = new anomaly_service_js_1.AnomalyRiskEngine(db);
    const verifier = new verification_service_js_1.VerificationService(blockchain, trustObjectService, provenanceService, revocationService, riskEngine, didService, db);
    await t.test('Scenario 1A: Genuine Education Certificate returns AUTHENTIC with trust score >= 90', async () => {
        const result = await verifier.verifyTrustObject({
            trustObjectId: 'TO-EDU-DEGREE-GENUINE-2024',
        });
        strict_1.default.equal(result.overallStatus, 'AUTHENTIC');
        strict_1.default.equal(result.hashMatch, true);
        strict_1.default.equal(result.signatureValid, true);
        strict_1.default.equal(result.blockchainProofValid, true);
        strict_1.default.equal(result.revocationStatus.isRevoked, false);
        strict_1.default.ok(result.trustScore >= 90);
    });
    await t.test('Scenario 1B: Tampered Certificate (Rahul -> Rohan) detected as TAMPERED', async () => {
        const result = await verifier.verifyTrustObject({
            trustObjectId: 'TO-EDU-DEGREE-TAMPERED-2024',
        });
        strict_1.default.equal(result.overallStatus, 'TAMPERED');
        strict_1.default.equal(result.hashMatch, false);
        strict_1.default.ok(result.riskAssessment.riskScore >= 50);
    });
    await t.test('Scenario 1C: Revoked Certificate detected as REVOKED with on-chain proof', async () => {
        const result = await verifier.verifyTrustObject({
            trustObjectId: 'TO-EDU-DEGREE-REVOKED-2024',
        });
        strict_1.default.equal(result.overallStatus, 'REVOKED');
        strict_1.default.equal(result.revocationStatus.isRevoked, true);
        strict_1.default.ok(result.revocationStatus.reason?.includes('Academic Senate Resolution'));
    });
    await t.test('Scenario 2: Genuine Product returns AUTHENTIC with 4-hop unbroken provenance', async () => {
        const result = await verifier.verifyTrustObject({
            trustObjectId: 'TO-PRD-REMDESIVIR-BATCH-402',
        });
        strict_1.default.equal(result.overallStatus, 'AUTHENTIC');
        strict_1.default.equal(result.provenanceStatus.isValid, true);
        strict_1.default.equal(result.provenanceStatus.eventCount, 4);
    });
    await t.test('Scenario 3: Tampered Legal Forensic Evidence detected as TAMPERED', async () => {
        const result = await verifier.verifyTrustObject({
            trustObjectId: 'TO-EVI-CCTV-TAMPERED-082',
        });
        strict_1.default.equal(result.overallStatus, 'TAMPERED');
        strict_1.default.equal(result.hashMatch, false);
    });
    await t.test('Consortium Blockchain Ledger Integrity validates all blocks and Merkle roots', async () => {
        const audit = await blockchain.verifyLedgerIntegrity();
        strict_1.default.equal(audit.valid, true);
        strict_1.default.ok(audit.totalBlocks > 1);
    });
});
