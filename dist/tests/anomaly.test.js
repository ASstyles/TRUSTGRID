"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const db_service_js_1 = require("../database/db.service.js");
const anomaly_service_js_1 = require("../core/risk-engine/anomaly.service.js");
(0, node_test_1.default)('Explainable Trust Risk Engine Tests', async (t) => {
    const db = db_service_js_1.DatabaseService.getTestInstance();
    const engine = new anomaly_service_js_1.AnomalyRiskEngine(db);
    const mockTrustObject = {
        trustObjectId: 'TO-TEST-001',
        objectType: 'CREDENTIAL',
        subjectId: 'did:trustgrid:usr:test-student',
        issuerId: 'did:trustgrid:edu:test-univ',
        ownerId: 'did:trustgrid:usr:test-student',
        createdAt: new Date().toISOString(),
        contentHash: 'a'.repeat(64),
        signature: 'mock-sig',
        blockchainTxId: '0xmock',
        status: 'ACTIVE',
        metadata: {},
        provenance: [],
        version: 1,
    };
    await t.test('Clean authentic verification outputs Risk Score 0 and LOW risk level', () => {
        const assessment = engine.assessTrustObjectRisk({
            trustObject: mockTrustObject,
            hashMatch: true,
            signatureValid: true,
            isRevoked: false,
            isExpired: false,
            chainContinuityValid: true,
        });
        strict_1.default.equal(assessment.riskScore, 0);
        strict_1.default.equal(assessment.riskLevel, 'LOW');
        strict_1.default.equal(assessment.factors.length, 0);
        strict_1.default.ok(assessment.summaryReasons[0].includes('All cryptographic, blockchain, and behavioral checks passed'));
    });
    await t.test('Content tampering and invalid signature trigger CRITICAL risk with transparent explanations', () => {
        const assessment = engine.assessTrustObjectRisk({
            trustObject: mockTrustObject,
            hashMatch: false,
            signatureValid: false,
            isRevoked: false,
            isExpired: false,
            chainContinuityValid: true,
        });
        strict_1.default.ok(assessment.riskScore >= 80);
        strict_1.default.equal(assessment.riskLevel, 'CRITICAL');
        strict_1.default.ok(assessment.factors.some((f) => f.factor === 'CONTENT_INTEGRITY_TAMPER'));
        strict_1.default.ok(assessment.factors.some((f) => f.factor === 'INVALID_ISSUER_SIGNATURE'));
        strict_1.default.ok(assessment.summaryReasons.some((r) => r.includes('Tampering detected')));
    });
    await t.test('Broken provenance chain triggers elevated risk with chain explanation', () => {
        const assessment = engine.assessTrustObjectRisk({
            trustObject: mockTrustObject,
            hashMatch: true,
            signatureValid: true,
            isRevoked: false,
            isExpired: false,
            chainContinuityValid: false,
        });
        strict_1.default.ok(assessment.riskScore >= 35);
        strict_1.default.ok(assessment.factors.some((f) => f.factor === 'BROKEN_PROVENANCE_CHAIN'));
        strict_1.default.ok(assessment.summaryReasons.some((r) => r.includes('Provenance transition gap')));
    });
});
