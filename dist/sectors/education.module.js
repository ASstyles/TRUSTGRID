"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EducationModule = void 0;
const db_service_js_1 = require("../database/db.service.js");
class EducationModule {
    name = 'Education & Academic Credentialing';
    sectorId = 'EDUCATION';
    description = 'Zero-trust verification and forgery detection for degrees, diplomas, and transcripts';
    supportedObjectTypes = ['CREDENTIAL'];
    trustObjectService;
    db;
    constructor(trustObjectService, db) {
        this.trustObjectService = trustObjectService;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    validateMetadata(metadata) {
        const errors = [];
        if (!metadata.studentName)
            errors.push('studentName is required');
        if (!metadata.degreeName)
            errors.push('degreeName is required');
        if (!metadata.major)
            errors.push('major is required');
        if (!metadata.serialNumber)
            errors.push('serialNumber is required');
        return { valid: errors.length === 0, errors };
    }
    async issueDegree(params) {
        const trustObject = await this.trustObjectService.createTrustObject({
            objectType: 'CREDENTIAL',
            subjectId: params.studentDid,
            issuerId: params.institutionDid,
            metadata: params.metadata,
            customId: params.customId,
        });
        // Populate credentials table
        this.db.run(`INSERT OR REPLACE INTO credentials 
       (id, trust_object_id, student_did, institution_did, credential_type, degree_name, major, graduation_year, grade, serial_number, document_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            'CRED-' + Date.now(),
            trustObject.trustObjectId,
            params.studentDid,
            params.institutionDid,
            'DEGREE',
            params.metadata.degreeName,
            params.metadata.major,
            params.metadata.graduationYear,
            params.metadata.cgpa,
            params.metadata.serialNumber,
            trustObject.contentHash,
        ]);
        return trustObject;
    }
    generateVerificationSummary(result) {
        const isAuthentic = result.overallStatus === 'AUTHENTIC';
        return {
            headline: isAuthentic ? 'Official Degree Credential Verified' : 'Credential Verification Alert',
            badges: [
                isAuthentic ? 'ACADEMICALLY_VALID' : 'UNVERIFIED',
                result.hashMatch ? 'DOCUMENT_INTEGRITY_PASSED' : 'FORGERY_DETECTED',
                result.signatureValid ? 'UNIVERSITY_SIGNATURE_CONFIRMED' : 'INVALID_SIGNER',
            ],
            domainDetails: {
                degree: result.trustObjectId,
                issuer: result.issuerId,
                subject: result.subjectId,
            },
        };
    }
}
exports.EducationModule = EducationModule;
