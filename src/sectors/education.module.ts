import { DatabaseService } from '../database/db.service.js';
import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { TrustObject, VerificationResult } from '../core/trust-object/trust-object.types.js';
import { SectorModule } from './sector.interface.js';

export interface DegreeMetadata {
  studentName: string;
  studentRollNo: string;
  degreeName: string;
  major: string;
  graduationYear: number;
  cgpa: string;
  honors?: string;
  serialNumber: string;
  institutionName: string;
}

export class EducationModule implements SectorModule {
  public readonly name = 'Education & Academic Credentialing';
  public readonly sectorId = 'EDUCATION' as const;
  public readonly description = 'Zero-trust verification and forgery detection for degrees, diplomas, and transcripts';
  public readonly supportedObjectTypes = ['CREDENTIAL' as const];

  private trustObjectService: TrustObjectService;
  private db: DatabaseService;

  constructor(trustObjectService: TrustObjectService, db?: DatabaseService) {
    this.trustObjectService = trustObjectService;
    this.db = db || DatabaseService.getInstance();
  }

  public validateMetadata(metadata: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!metadata.studentName) errors.push('studentName is required');
    if (!metadata.degreeName) errors.push('degreeName is required');
    if (!metadata.major) errors.push('major is required');
    if (!metadata.serialNumber) errors.push('serialNumber is required');
    return { valid: errors.length === 0, errors };
  }

  public async issueDegree(params: {
    institutionDid: string;
    studentDid: string;
    metadata: DegreeMetadata;
    customId?: string;
  }): Promise<TrustObject<DegreeMetadata>> {
    const trustObject = await this.trustObjectService.createTrustObject<DegreeMetadata>({
      objectType: 'CREDENTIAL',
      subjectId: params.studentDid,
      issuerId: params.institutionDid,
      metadata: params.metadata,
      customId: params.customId,
    });

    // Populate credentials table
    this.db.run(
      `INSERT OR REPLACE INTO credentials 
       (id, trust_object_id, student_did, institution_did, credential_type, degree_name, major, graduation_year, grade, serial_number, document_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

    return trustObject;
  }

  public generateVerificationSummary(result: VerificationResult) {
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
