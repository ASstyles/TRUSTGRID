"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CybersecurityModule = void 0;
const db_service_js_1 = require("../database/db.service.js");
class CybersecurityModule {
    name = 'Cybersecurity Asset & Integrity Monitoring';
    sectorId = 'CYBERSECURITY';
    description = 'Zero-trust device configuration baselines and unauthorized modification detection';
    supportedObjectTypes = ['DEVICE'];
    trustObjectService;
    db;
    constructor(trustObjectService, db) {
        this.trustObjectService = trustObjectService;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    validateMetadata(metadata) {
        const errors = [];
        if (!metadata.deviceId)
            errors.push('deviceId is required');
        if (!metadata.hostname)
            errors.push('hostname is required');
        if (!metadata.configurationHash)
            errors.push('configurationHash is required');
        return { valid: errors.length === 0, errors };
    }
    async registerDeviceBaseline(params) {
        return this.trustObjectService.createTrustObject({
            objectType: 'DEVICE',
            subjectId: `did:trustgrid:sec:dev-${params.metadata.deviceId.toLowerCase()}`,
            issuerId: params.adminDid,
            ownerId: params.adminDid,
            metadata: params.metadata,
            customId: params.customId,
        });
    }
    /**
     * Performs an integrity check comparing the live observed device state against the immutable baseline
     */
    async auditDeviceIntegrity(params) {
        const trustObject = await this.trustObjectService.getTrustObject(params.trustObjectId);
        if (!trustObject) {
            throw new Error(`Device Trust Object not found: ${params.trustObjectId}`);
        }
        const baselineHash = trustObject.metadata.configurationHash;
        const isIntact = baselineHash === params.observedConfigHash;
        if (!isIntact) {
            const eventId = 'SEC-' + Date.now();
            const description = `UNAUTHORIZED CONFIGURATION DRIFT: Observed hash ${params.observedConfigHash.substring(0, 12)} does not match registered baseline ${baselineHash.substring(0, 12)}. Potential malicious firmware/rootkit tampering.`;
            // Record in security_events table
            this.db.run(`INSERT INTO security_events 
         (id, device_id, trust_object_id, event_severity, event_type, expected_hash, observed_hash, description, reported_by_did)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                eventId,
                trustObject.subjectId,
                params.trustObjectId,
                'CRITICAL',
                'BASELINE_VIOLATION',
                baselineHash,
                params.observedConfigHash,
                description,
                params.reporterDid,
            ]);
            // Also mark TrustObject status as TAMPERED
            this.trustObjectService.simulateTamper(params.trustObjectId, {
                ...trustObject.metadata,
                configurationHash: params.observedConfigHash,
                compromiseDetectedAt: new Date().toISOString(),
            });
            return {
                status: 'COMPROMISED',
                baselineHash,
                observedHash: params.observedConfigHash,
                securityEventId: eventId,
                description,
            };
        }
        return {
            status: 'AUTHENTIC',
            baselineHash,
            observedHash: params.observedConfigHash,
            description: 'Device configuration matches verified cryptographic baseline exactly. Zero unauthorized drift detected.',
        };
    }
    generateVerificationSummary(result) {
        const isAuthentic = result.overallStatus === 'AUTHENTIC';
        return {
            headline: isAuthentic ? 'Device Cryptographic Integrity Verified' : '🚨 DEVICE INTEGRITY COMPROMISED',
            badges: [
                isAuthentic ? 'BASELINE_VERIFIED' : 'CONFIGURATION_DRIFT',
                result.hashMatch ? 'INTEGRITY_INTACT' : 'TAMPER_ALERT',
                result.signatureValid ? 'AUTHORITY_SIGNED' : 'UNAUTHORIZED_STATE',
            ],
            domainDetails: {
                device: result.trustObjectId,
                subjectId: result.subjectId,
                status: result.overallStatus,
            },
        };
    }
}
exports.CybersecurityModule = CybersecurityModule;
