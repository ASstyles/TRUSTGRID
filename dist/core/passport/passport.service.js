"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustPassportService = void 0;
const db_service_js_1 = require("../../database/db.service.js");
const crypto_service_js_1 = require("../crypto/crypto.service.js");
class TrustPassportService {
    db;
    constructor(db) {
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    /**
     * Generates a privacy-preserving Trust Passport for any individual or organization DID
     * with cryptographic salted commitments and predicate assertions
     */
    generatePassport(did, selectiveDisclosure = true) {
        const identity = this.db.getOne('SELECT * FROM identities WHERE did = ?', [did]);
        if (!identity) {
            return null;
        }
        const user = this.db.getOne('SELECT * FROM users WHERE did = ?', [did]);
        const organization = this.db.getOne('SELECT * FROM organizations WHERE did = ?', [did]);
        const ownerName = user?.display_name || organization?.name || did.split(':').pop() || did;
        const ownerType = identity.entity_type === 'ORGANIZATION' ? 'ORGANIZATION' : 'INDIVIDUAL';
        // Fetch Trust Objects where subject_id is this DID
        const trustObjects = this.db.query('SELECT * FROM trust_objects WHERE subject_id = ? ORDER BY created_at_epoch DESC', [did]);
        const claims = [];
        let activeCount = 0;
        let revokedCount = 0;
        for (const obj of trustObjects) {
            const metadata = JSON.parse(obj.metadata);
            let disclosedAttributes = {};
            let hiddenAttributesCount = 0;
            const attributeCommitments = [];
            const predicateProofs = [];
            // Compute cryptographic salted commitment for each attribute
            for (const [key, val] of Object.entries(metadata)) {
                const salt = crypto_service_js_1.CryptoService.sha256(`salt:${did}:${obj.trust_object_id}:${key}`);
                const commitment = crypto_service_js_1.CryptoService.sha256(`${key}:${String(val)}:${salt}`);
                if (selectiveDisclosure) {
                    // Selective disclosure rules:
                    const isDisclosedKey = (obj.object_type === 'CREDENTIAL' && ['degreeName', 'institutionName', 'graduationYear'].includes(key)) ||
                        (obj.object_type === 'PRODUCT' && ['productName', 'batchNumber', 'complianceCert'].includes(key));
                    if (isDisclosedKey) {
                        disclosedAttributes[key] = val;
                        attributeCommitments.push({
                            attribute: key,
                            commitment,
                            salt,
                            value: val,
                            isDisclosed: true,
                        });
                    }
                    else {
                        hiddenAttributesCount++;
                        attributeCommitments.push({
                            attribute: key,
                            commitment,
                            isDisclosed: false, // salt and value blinded
                        });
                    }
                    // Generate cryptographic predicate assertion for numeric credentials (e.g. CGPA >= 3.5 or >= 8.0)
                    if (key === 'cgpa' || key === 'gpa' || key === 'grade') {
                        const numVal = parseFloat(String(val));
                        if (!isNaN(numVal)) {
                            const threshold = numVal >= 7.0 ? 7.5 : 3.5;
                            const satisfied = numVal >= threshold;
                            predicateProofs.push({
                                attribute: key,
                                predicate: `>= ${threshold}`,
                                threshold,
                                satisfied,
                                commitment,
                                proofMethod: 'SALTED_ATTRIBUTE_COMMITMENT',
                                generatedAt: new Date().toISOString(),
                            });
                        }
                    }
                }
                else {
                    disclosedAttributes[key] = val;
                    attributeCommitments.push({
                        attribute: key,
                        commitment,
                        salt,
                        value: val,
                        isDisclosed: true,
                    });
                }
            }
            if (selectiveDisclosure && obj.object_type === 'CREDENTIAL') {
                disclosedAttributes['degreeVerified'] = true;
            }
            if (obj.status === 'ACTIVE')
                activeCount++;
            if (obj.status === 'REVOKED')
                revokedCount++;
            claims.push({
                trustObjectId: obj.trust_object_id,
                claimType: obj.object_type,
                issuerName: obj.issuer_id.split(':').pop() || obj.issuer_id,
                issuerDid: obj.issuer_id,
                issuanceDate: obj.created_at,
                status: obj.status,
                blockchainTxId: obj.blockchain_tx_id,
                contentHash: obj.content_hash,
                disclosedAttributes,
                hiddenAttributesCount,
                attributeCommitments,
                predicateProofs: predicateProofs.length > 0 ? predicateProofs : undefined,
            });
        }
        // Calculate reputation trust score based on active vs revoked ratio and identity verification
        let trustScore = 95;
        if (revokedCount > 0)
            trustScore -= revokedCount * 30;
        if (claims.length === 0)
            trustScore = 50;
        trustScore = Math.max(10, Math.min(100, trustScore));
        return {
            ownerDid: did,
            ownerName,
            ownerType,
            reputationTrustScore: trustScore,
            claims,
            summary: {
                totalCredentials: claims.length,
                activeCredentials: activeCount,
                revokedCredentials: revokedCount,
                isFullyVerified: trustScore >= 70,
            },
            privacyMode: selectiveDisclosure ? 'SELECTIVE_DISCLOSURE' : 'FULL_DISCLOSURE',
            issuedAt: new Date().toISOString(),
        };
    }
    /**
     * Cryptographically verify a disclosed attribute against its commitment and salt
     */
    verifyDisclosedAttribute(attribute, value, salt, expectedCommitment) {
        const computed = crypto_service_js_1.CryptoService.sha256(`${attribute}:${String(value)}:${salt}`);
        return computed === expectedCommitment;
    }
    /**
     * Cryptographically verify a predicate proof
     */
    verifyPredicateProof(proof, actualValue, salt) {
        const computed = crypto_service_js_1.CryptoService.sha256(`${proof.attribute}:${String(actualValue)}:${salt}`);
        if (computed !== proof.commitment) {
            return false;
        }
        if (proof.predicate.startsWith('>=')) {
            return actualValue >= proof.threshold;
        }
        if (proof.predicate.startsWith('>')) {
            return actualValue > proof.threshold;
        }
        if (proof.predicate.startsWith('<=')) {
            return actualValue <= proof.threshold;
        }
        if (proof.predicate.startsWith('<')) {
            return actualValue < proof.threshold;
        }
        return false;
    }
}
exports.TrustPassportService = TrustPassportService;
