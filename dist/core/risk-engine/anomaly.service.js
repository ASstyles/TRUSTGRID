"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyRiskEngine = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_service_js_1 = require("../../database/db.service.js");
class AnomalyRiskEngine {
    db;
    constructor(db) {
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    /**
     * Evaluates explainable risk indicators for any Trust Object during verification or lifecycle events
     */
    assessTrustObjectRisk(params) {
        const factors = [];
        let accumulatedScore = 0;
        // 1. Critical Cryptographic Integrity
        if (!params.hashMatch) {
            const impact = 55;
            accumulatedScore += impact;
            factors.push({
                factor: 'CONTENT_INTEGRITY_TAMPER',
                impact,
                explanation: 'Off-chain data content hash does not match immutable on-chain proof (Tampering detected)',
            });
        }
        if (!params.signatureValid) {
            const impact = 45;
            accumulatedScore += impact;
            factors.push({
                factor: 'INVALID_ISSUER_SIGNATURE',
                impact,
                explanation: 'Ed25519 digital signature could not be verified against the registered issuer DID public key',
            });
        }
        if (params.isRevoked) {
            const impact = 40;
            accumulatedScore += impact;
            factors.push({
                factor: 'OBJECT_REVOKED',
                impact,
                explanation: 'Trust Object has been officially revoked by issuing authority on the blockchain ledger',
            });
        }
        if (params.isExpired) {
            const impact = 25;
            accumulatedScore += impact;
            factors.push({
                factor: 'OBJECT_EXPIRED',
                impact,
                explanation: 'Trust Object validity window has expired',
            });
        }
        // 2. Chain of Custody & Provenance
        if (!params.chainContinuityValid) {
            const impact = 35;
            accumulatedScore += impact;
            factors.push({
                factor: 'BROKEN_PROVENANCE_CHAIN',
                impact,
                explanation: 'Provenance transition gap: custody transfer was not signed by the legitimate prior owner',
            });
        }
        // 3. Duplicate Identity Reuse Check
        // Check if the same credential/serial or hash is being presented under multiple subject DIDs
        const duplicateSubjectRow = this.db.getOne(`SELECT COUNT(DISTINCT subject_id) as count 
       FROM trust_objects 
       WHERE content_hash = ? AND trust_object_id != ?`, [params.trustObject.contentHash, params.trustObject.trustObjectId]);
        if (duplicateSubjectRow && duplicateSubjectRow.count > 0) {
            const impact = 30;
            accumulatedScore += impact;
            factors.push({
                factor: 'DUPLICATE_CREDENTIAL_CLAIM',
                impact,
                explanation: `Identical content hash claimed across ${duplicateSubjectRow.count + 1} distinct entity DIDs (credential sharing/cloning)`,
            });
        }
        // 4. Verification Velocity & Replay Check
        // Count verification attempts on this object in the last 15 minutes
        const recentVerifications = this.db.getOne(`SELECT COUNT(*) as count 
       FROM verification_events 
       WHERE trust_object_id = ? 
       AND timestamp >= datetime('now', '-15 minutes')`, [params.trustObject.trustObjectId]);
        if (recentVerifications && recentVerifications.count > 6) {
            const impact = 20;
            accumulatedScore += impact;
            factors.push({
                factor: 'HIGH_FREQUENCY_VERIFICATION_SPIKE',
                impact,
                explanation: `Abnormal verification frequency: ${recentVerifications.count} verification requests logged in the last 15 minutes`,
            });
        }
        // 5. Cybersecurity Baseline Drift (Device specifics)
        if (params.trustObject.objectType === 'DEVICE') {
            const securityEventRow = this.db.getOne(`SELECT COUNT(*) as count 
         FROM security_events 
         WHERE device_id = ? AND remediated = 0`, [params.trustObject.subjectId]);
            if (securityEventRow && securityEventRow.count > 0) {
                const impact = 30;
                accumulatedScore += impact;
                factors.push({
                    factor: 'ACTIVE_SECURITY_INCIDENTS',
                    impact,
                    explanation: `${securityEventRow.count} unresolved security baseline breach events logged against device`,
                });
            }
        }
        // Clamp score to 0 - 100
        const finalScore = Math.min(100, Math.max(0, accumulatedScore));
        let riskLevel = 'LOW';
        if (finalScore >= 80)
            riskLevel = 'CRITICAL';
        else if (finalScore >= 55)
            riskLevel = 'HIGH';
        else if (finalScore >= 25)
            riskLevel = 'ELEVATED';
        const summaryReasons = factors.length > 0
            ? factors.map((f) => `• ${f.explanation}`)
            : ['• All cryptographic, blockchain, and behavioral checks passed successfully'];
        // Record risk event if elevated or higher
        if (finalScore >= 25) {
            this.db.run(`INSERT INTO risk_events (id, trust_object_id, actor_did, risk_score, risk_level, primary_factors, anomaly_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                `RISK-${Date.now()}-${node_crypto_1.default.randomBytes(4).toString('hex')}`,
                params.trustObject.trustObjectId,
                params.verifierDid || 'did:trustgrid:anon:verifier',
                finalScore,
                riskLevel,
                JSON.stringify(factors),
                factors[0]?.factor || 'GENERAL_RISK',
            ]);
        }
        return {
            riskScore: finalScore,
            riskLevel,
            factors,
            summaryReasons,
            assessedAt: new Date().toISOString(),
        };
    }
}
exports.AnomalyRiskEngine = AnomalyRiskEngine;
