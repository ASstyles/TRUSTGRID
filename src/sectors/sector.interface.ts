import { TrustObject, TrustObjectType, VerificationResult } from '../core/trust-object/trust-object.types.js';

export interface SectorModule {
  name: string;
  sectorId: 'EDUCATION' | 'SUPPLY_CHAIN' | 'LEGAL' | 'CYBERSECURITY';
  description: string;
  supportedObjectTypes: TrustObjectType[];
  validateMetadata(metadata: any): { valid: boolean; errors?: string[] };
  generateVerificationSummary(result: VerificationResult): {
    headline: string;
    badges: string[];
    domainDetails: Record<string, any>;
  };
}
