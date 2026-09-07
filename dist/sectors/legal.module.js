"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalEvidenceModule = void 0;
class LegalEvidenceModule {
    name = 'Legal & Digital Forensic Chain of Custody';
    sectorId = 'LEGAL';
    description = 'Tamper-evident chain of custody for digital evidence admissible in judicial proceedings';
    supportedObjectTypes = ['EVIDENCE'];
    trustObjectService;
    provenanceService;
    constructor(trustObjectService, provenanceService) {
        this.trustObjectService = trustObjectService;
        this.provenanceService = provenanceService;
    }
    validateMetadata(metadata) {
        const errors = [];
        if (!metadata.caseNumber)
            errors.push('caseNumber is required');
        if (!metadata.evidenceTag)
            errors.push('evidenceTag is required');
        if (!metadata.forensicHash)
            errors.push('forensicHash is required');
        return { valid: errors.length === 0, errors };
    }
    async registerEvidence(params) {
        return this.trustObjectService.createTrustObject({
            objectType: 'EVIDENCE',
            subjectId: `did:trustgrid:legal:ev-${params.metadata.evidenceTag.toLowerCase()}`,
            issuerId: params.investigatorDid,
            ownerId: params.investigatorDid,
            metadata: params.metadata,
            customId: params.customId,
        });
    }
    async transferEvidenceCustody(params) {
        return this.provenanceService.transferCustody(params);
    }
    generateVerificationSummary(result) {
        const isAuthentic = result.overallStatus === 'AUTHENTIC';
        return {
            headline: isAuthentic ? 'Court-Admissible Evidence Integrity Verified' : 'EVIDENCE INTEGRITY FAILURE',
            badges: [
                isAuthentic ? 'EVIDENCE_AUTHENTIC' : 'SPOLIATION_DETECTED',
                result.provenanceStatus.isValid ? 'CUSTODY_UNCOMPROMISED' : 'CHAIN_OF_CUSTODY_BROKEN',
                result.signatureValid ? 'INVESTIGATOR_ATTESTED' : 'UNAUTHORIZED_SUBMISSION',
            ],
            domainDetails: {
                evidenceId: result.trustObjectId,
                custodian: result.provenanceStatus.lastCustodian,
                custodyTransfers: result.provenanceStatus.eventCount,
            },
        };
    }
}
exports.LegalEvidenceModule = LegalEvidenceModule;
