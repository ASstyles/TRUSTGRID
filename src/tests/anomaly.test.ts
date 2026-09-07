import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../database/db.service.js';
import { AnomalyRiskEngine } from '../core/risk-engine/anomaly.service.js';
import { TrustObject } from '../core/trust-object/trust-object.types.js';

test('Explainable Trust Risk Engine Tests', async (t) => {
  const db = DatabaseService.getTestInstance();
  const engine = new AnomalyRiskEngine(db);

  const mockTrustObject: TrustObject = {
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

    assert.equal(assessment.riskScore, 0);
    assert.equal(assessment.riskLevel, 'LOW');
    assert.equal(assessment.factors.length, 0);
    assert.ok(assessment.summaryReasons[0].includes('All cryptographic, blockchain, and behavioral checks passed'));
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

    assert.ok(assessment.riskScore >= 80);
    assert.equal(assessment.riskLevel, 'CRITICAL');
    assert.ok(assessment.factors.some((f) => f.factor === 'CONTENT_INTEGRITY_TAMPER'));
    assert.ok(assessment.factors.some((f) => f.factor === 'INVALID_ISSUER_SIGNATURE'));
    assert.ok(assessment.summaryReasons.some((r) => r.includes('Tampering detected')));
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

    assert.ok(assessment.riskScore >= 35);
    assert.ok(assessment.factors.some((f) => f.factor === 'BROKEN_PROVENANCE_CHAIN'));
    assert.ok(assessment.summaryReasons.some((r) => r.includes('Provenance transition gap')));
  });
});
