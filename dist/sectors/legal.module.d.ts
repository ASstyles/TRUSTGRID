import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { TrustObject, VerificationResult } from '../core/trust-object/trust-object.types.js';
import { ProvenanceService } from '../core/provenance/provenance.service.js';
import { SectorModule } from './sector.interface.js';
export interface ForensicEvidenceMetadata {
    caseNumber: string;
    evidenceTag: string;
    evidenceType: 'CCTV_VIDEO' | 'FORENSIC_IMAGE' | 'DIGITAL_DOCUMENT' | 'AUDIO_RECORDING';
    originalFileName: string;
    collectionLocation: string;
    collectingOfficer: string;
    chainOfCustodyAgency: string;
    forensicHash: string;
}
export declare class LegalEvidenceModule implements SectorModule {
    readonly name = "Legal & Digital Forensic Chain of Custody";
    readonly sectorId: "LEGAL";
    readonly description = "Tamper-evident chain of custody for digital evidence admissible in judicial proceedings";
    readonly supportedObjectTypes: "EVIDENCE"[];
    private trustObjectService;
    private provenanceService;
    constructor(trustObjectService: TrustObjectService, provenanceService: ProvenanceService);
    validateMetadata(metadata: any): {
        valid: boolean;
        errors?: string[];
    };
    registerEvidence(params: {
        investigatorDid: string;
        metadata: ForensicEvidenceMetadata;
        customId?: string;
    }): Promise<TrustObject<ForensicEvidenceMetadata>>;
    transferEvidenceCustody(params: {
        trustObjectId: string;
        fromDid: string;
        toDid: string;
        location: string;
        actionDescription: string;
    }): Promise<import("../core/trust-object/trust-object.types.js").ProvenanceEvent>;
    generateVerificationSummary(result: VerificationResult): {
        headline: string;
        badges: string[];
        domainDetails: {
            evidenceId: string;
            custodian: string;
            custodyTransfers: number;
        };
    };
}
