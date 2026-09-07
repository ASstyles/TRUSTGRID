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
export declare class EducationModule implements SectorModule {
    readonly name = "Education & Academic Credentialing";
    readonly sectorId: "EDUCATION";
    readonly description = "Zero-trust verification and forgery detection for degrees, diplomas, and transcripts";
    readonly supportedObjectTypes: "CREDENTIAL"[];
    private trustObjectService;
    private db;
    constructor(trustObjectService: TrustObjectService, db?: DatabaseService);
    validateMetadata(metadata: any): {
        valid: boolean;
        errors?: string[];
    };
    issueDegree(params: {
        institutionDid: string;
        studentDid: string;
        metadata: DegreeMetadata;
        customId?: string;
    }): Promise<TrustObject<DegreeMetadata>>;
    generateVerificationSummary(result: VerificationResult): {
        headline: string;
        badges: string[];
        domainDetails: {
            degree: string;
            issuer: string;
            subject: string;
        };
    };
}
