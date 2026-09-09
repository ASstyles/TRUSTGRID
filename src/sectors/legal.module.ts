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

export class LegalEvidenceModule implements SectorModule {
  public readonly name = 'Legal & Digital Forensic Chain of Custody';
  public readonly sectorId = 'LEGAL' as const;
  public readonly description = 'Tamper-evident chain of custody for digital forensic evidence';
  public readonly supportedObjectTypes = ['EVIDENCE' as const];

  private trustObjectService: TrustObjectService;
  private provenanceService: ProvenanceService;

  constructor(trustObjectService: TrustObjectService, provenanceService: ProvenanceService) {
    this.trustObjectService = trustObjectService;
    this.provenanceService = provenanceService;
  }

  public validateMetadata(metadata: any): { valid: boolean; errors?: string[] } {
    if (!metadata || typeof metadata !== 'object') {
      return { valid: false, errors: ['metadata must be a non-null object'] };
    }
    const errors: string[] = [];
    if (!metadata.caseNumber) errors.push('caseNumber is required');
    if (!metadata.evidenceTag) errors.push('evidenceTag is required');
    if (!metadata.forensicHash) errors.push('forensicHash is required');
    return { valid: errors.length === 0, errors };
  }

  public async registerEvidence(params: {
    investigatorDid: string;
    metadata: ForensicEvidenceMetadata;
    customId?: string;
  }): Promise<TrustObject<ForensicEvidenceMetadata>> {
    return this.trustObjectService.createTrustObject<ForensicEvidenceMetadata>({
      objectType: 'EVIDENCE',
      subjectId: `did:trustgrid:legal:ev-${params.metadata.evidenceTag.toLowerCase()}`,
      issuerId: params.investigatorDid,
      ownerId: params.investigatorDid,
      metadata: params.metadata,
      customId: params.customId,
    });
  }

  public async transferEvidenceCustody(params: {
    trustObjectId: string;
    fromDid: string;
    toDid: string;
    location: string;
    actionDescription: string;
  }) {
    return this.provenanceService.transferCustody(params);
  }

  public generateVerificationSummary(result: VerificationResult) {
    const isAuthentic = result.overallStatus === 'AUTHENTIC';
    return {
      headline: isAuthentic ? 'Digital Forensic Evidence Integrity Verified' : 'EVIDENCE INTEGRITY FAILURE',
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
