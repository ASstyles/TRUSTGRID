"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_service_js_1 = require("../../database/db.service.js");
const crypto_service_js_1 = require("../crypto/crypto.service.js");
const did_service_js_1 = require("../identity/did.service.js");
class VerificationService {
    db;
    blockchain;
    didService;
    trustObjectService;
    provenanceService;
    revocationService;
    riskEngine;
    constructor(blockchain, trustObjectService, provenanceService, revocationService, riskEngine, didService, db) {
        this.blockchain = blockchain;
        this.trustObjectService = trustObjectService;
        this.provenanceService = provenanceService;
        this.revocationService = revocationService;
        this.riskEngine = riskEngine;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
        this.didService = didService || new did_service_js_1.DidService(this.db);
    }
    /**
     * Executes the 7-step cryptographic verification pipeline on any Trust Object
     */
    async verifyTrustObject(params) {
        const timestamp = new Date().toISOString();
        const checks = [];
        // 1. Fetch current Trust Object record from database
        const trustObject = await this.trustObjectService.getTrustObject(params.trustObjectId);
        if (!trustObject) {
            throw new Error(`Trust Object not found: ${params.trustObjectId}`);
        }
        const metadataToVerify = params.presentedMetadata || trustObject.metadata;
        // STEP 1: Subject Identity & DID Format Verification
        const subjectDidValid = typeof trustObject.subjectId === 'string' && trustObject.subjectId.startsWith('did:trustgrid:');
        checks.push({
            code: 'CHK_SUBJECT_IDENTITY',
            name: 'Subject Decentralized Identity (DID) Verification',
            passed: subjectDidValid,
            details: subjectDidValid
                ? `Subject DID ${trustObject.subjectId} adheres to W3C Decentralized Identifier standards`
                : `Subject DID format invalid: ${trustObject.subjectId}`,
            timestamp,
        });
        // STEP 2: Issuer Identity & Public Key Resolution
        const issuerPubKey = this.didService.getPublicKey(trustObject.issuerId);
        const issuerIdentityValid = !!issuerPubKey;
        checks.push({
            code: 'CHK_ISSUER_IDENTITY',
            name: 'Issuer Decentralized Identity (DID) Resolution',
            passed: issuerIdentityValid,
            details: issuerIdentityValid
                ? `Issuer DID ${trustObject.issuerId} resolved with active Ed25519 verification key`
                : `Failed to resolve active verification key for issuer DID ${trustObject.issuerId}`,
            timestamp,
        });
        // STEP 3: Cryptographic Signature Verification
        let signatureValid = false;
        if (issuerPubKey) {
            signatureValid = crypto_service_js_1.CryptoService.verify(trustObject.contentHash, trustObject.signature, issuerPubKey);
        }
        checks.push({
            code: 'CHK_ED25519_SIGNATURE',
            name: 'Issuer Cryptographic Digital Signature',
            passed: signatureValid,
            details: signatureValid
                ? `Valid Ed25519 digital signature verified against issuer public key`
                : `Cryptographic signature verification failed or issuer key is missing`,
            timestamp,
        });
        // STEP 4: Canonical Content Hash Recalculation & Integrity Comparison (Anti-Tampering)
        const contentToHash = {
            trustObjectId: trustObject.trustObjectId,
            objectType: trustObject.objectType,
            subjectId: trustObject.subjectId,
            issuerId: trustObject.issuerId,
            createdAt: trustObject.createdAt,
            expiresAt: trustObject.expiresAt || null,
            metadata: metadataToVerify,
        };
        const canonicalHash = crypto_service_js_1.CryptoService.hashObject(contentToHash);
        const presentedHash = canonicalHash;
        const blockchainProof = await this.blockchain.getProof(params.trustObjectId);
        let blockchainProofValid = false;
        let onChainHash = '';
        if (blockchainProof) {
            onChainHash = blockchainProof.contentHash;
            const verifyProofResult = await this.blockchain.verifyProof(params.trustObjectId, blockchainProof.contentHash);
            blockchainProofValid = verifyProofResult.valid;
        }
        const hashMatch = canonicalHash === onChainHash && canonicalHash === trustObject.contentHash;
        checks.push({
            code: 'CHK_CONTENT_INTEGRITY',
            name: 'Content Hash & Document Integrity Match',
            passed: hashMatch,
            details: hashMatch
                ? `Recalculated SHA-256 hash matches immutable on-chain proof exactly: ${canonicalHash.substring(0, 16)}...`
                : `TAMPER DETECTED! Recalculated hash [${canonicalHash.substring(0, 12)}...] diverges from on-chain anchor [${onChainHash.substring(0, 12)}...]`,
            timestamp,
        });
        // STEP 5: Blockchain Ledger Proof Anchor Verification
        checks.push({
            code: 'CHK_BLOCKCHAIN_ANCHOR',
            name: 'Blockchain Trust Ledger Proof & Merkle Anchor',
            passed: blockchainProofValid,
            details: blockchainProofValid
                ? `Cryptographic proof verified at Block #${blockchainProof?.blockHeight} (Tx: ${blockchainProof?.txId?.substring(0, 18)}...)`
                : `Blockchain ledger proof verification failed or proof not anchored`,
            timestamp,
        });
        // STEP 6: Revocation & Expiration Status
        const revocationRecord = this.revocationService.getRevocationStatus(params.trustObjectId);
        const isRevoked = !!revocationRecord || blockchainProof?.status === 'REVOKED';
        checks.push({
            code: 'CHK_REVOCATION_STATUS',
            name: 'Revocation Registry Check',
            passed: !isRevoked,
            details: isRevoked
                ? `Object was revoked on ${revocationRecord?.revokedAt || 'blockchain'}. Reason: "${revocationRecord?.revocationReason || 'Revoked on ledger'}"`
                : `Object status is ACTIVE; no revocation proof present on blockchain ledger`,
            timestamp,
        });
        const isExpired = trustObject.expiresAt ? new Date(trustObject.expiresAt).getTime() < Date.now() : false;
        checks.push({
            code: 'CHK_EXPIRATION_WINDOW',
            name: 'Validity Window & Expiration Check',
            passed: !isExpired,
            details: isExpired
                ? `Object expired on ${trustObject.expiresAt}`
                : trustObject.expiresAt ? `Valid through ${trustObject.expiresAt}` : `Perpetual validity (no expiration set)`,
            timestamp,
        });
        // STEP 7: Provenance & Custody Chain Validation
        const chainContinuity = this.provenanceService.verifyChainContinuity(trustObject.provenance);
        checks.push({
            code: 'CHK_PROVENANCE_CHAIN',
            name: 'Custody Chain & Provenance Continuity',
            passed: chainContinuity.isValid,
            details: chainContinuity.isValid
                ? `Complete unbroken chain of custody verified across ${trustObject.provenance.length} certified handoffs`
                : `Provenance anomaly: ${chainContinuity.reason}`,
            timestamp,
        });
        // Explainable Trust Risk Assessment
        const riskAssessment = this.riskEngine.assessTrustObjectRisk({
            trustObject,
            verifierDid: params.verifierDid,
            clientIp: params.clientIp,
            hashMatch,
            signatureValid,
            isRevoked,
            isExpired,
            chainContinuityValid: chainContinuity.isValid,
        });
        // Determine Overall Status
        let overallStatus = 'AUTHENTIC';
        if (!hashMatch) {
            if (trustObject.objectType === 'DEVICE') {
                overallStatus = 'DEVICE_INTEGRITY_COMPROMISED';
            }
            else {
                overallStatus = 'TAMPERED';
            }
        }
        else if (!signatureValid) {
            overallStatus = 'INVALID_SIGNATURE';
        }
        else if (isRevoked) {
            overallStatus = 'REVOKED';
        }
        else if (isExpired) {
            overallStatus = 'EXPIRED';
        }
        else if (!chainContinuity.isValid) {
            overallStatus = 'PROVENANCE_MISMATCH';
        }
        // Trust Score (inverse of risk score)
        const trustScore = Math.max(0, 100 - riskAssessment.riskScore);
        // Record verification event in DB
        this.db.run(`INSERT INTO verification_events 
       (id, trust_object_id, verifier_did, result_status, presented_hash, on_chain_hash, signature_valid, blockchain_proof_valid, risk_score, client_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            `VRF-${Date.now()}-${node_crypto_1.default.randomBytes(4).toString('hex')}`,
            params.trustObjectId,
            params.verifierDid || null,
            overallStatus,
            presentedHash,
            onChainHash,
            signatureValid ? 1 : 0,
            blockchainProofValid ? 1 : 0,
            riskAssessment.riskScore,
            params.clientIp || '127.0.0.1',
        ]);
        return {
            overallStatus,
            trustScore,
            trustObjectId: trustObject.trustObjectId,
            objectType: trustObject.objectType,
            subjectId: trustObject.subjectId,
            issuerId: trustObject.issuerId,
            ownerId: trustObject.ownerId,
            presentedHash,
            canonicalHash,
            onChainHash,
            hashMatch,
            signatureValid,
            blockchainProofValid,
            revocationStatus: {
                isRevoked,
                revokedAt: revocationRecord?.revokedAt || null,
                revokedBy: revocationRecord?.revokedByDid || null,
                reason: revocationRecord?.revocationReason || null,
            },
            expirationStatus: {
                isExpired,
                expiresAt: trustObject.expiresAt || null,
            },
            provenanceStatus: {
                isValid: chainContinuity.isValid,
                eventCount: trustObject.provenance.length,
                lastCustodian: trustObject.ownerId,
            },
            blockchainProof: blockchainProof || undefined,
            checks,
            riskAssessment: {
                riskScore: riskAssessment.riskScore,
                riskLevel: riskAssessment.riskLevel,
                factors: riskAssessment.factors,
            },
            verifiedAt: timestamp,
        };
    }
}
exports.VerificationService = VerificationService;
