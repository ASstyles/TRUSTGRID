import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { TrustObject, VerificationResult } from '../core/trust-object/trust-object.types.js';
import { ProvenanceService } from '../core/provenance/provenance.service.js';
import { SectorModule } from './sector.interface.js';

export interface ProductBatchMetadata {
  productName: string;
  batchNumber: string;
  serialNumber: string;
  manufacturerName: string;
  manufacturingDate: string;
  expiryDate: string;
  dosageOrSpecification: string;
  complianceCert: string;
}

export class SupplyChainModule implements SectorModule {
  public readonly name = 'Supply Chain & Product Provenance';
  public readonly sectorId = 'SUPPLY_CHAIN' as const;
  public readonly description = 'End-to-end multi-tier custody tracking and anti-counterfeit verification';
  public readonly supportedObjectTypes = ['PRODUCT' as const];

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
    if (!metadata.productName) errors.push('productName is required');
    if (!metadata.batchNumber) errors.push('batchNumber is required');
    if (!metadata.serialNumber) errors.push('serialNumber is required');
    return { valid: errors.length === 0, errors };
  }

  public async registerProductBatch(params: {
    manufacturerDid: string;
    metadata: ProductBatchMetadata;
    customId?: string;
  }): Promise<TrustObject<ProductBatchMetadata>> {
    return this.trustObjectService.createTrustObject<ProductBatchMetadata>({
      objectType: 'PRODUCT',
      subjectId: `did:trustgrid:sc:prod-${params.metadata.serialNumber.toLowerCase()}`,
      issuerId: params.manufacturerDid,
      ownerId: params.manufacturerDid,
      expiresAt: params.metadata.expiryDate,
      metadata: params.metadata,
      customId: params.customId,
    });
  }

  public async transferProductCustody(params: {
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
      headline: isAuthentic ? 'Genuine Product Provenance Confirmed' : 'Supply Chain Alert: Counterfeit Suspected',
      badges: [
        isAuthentic ? 'ORIGINAL_MANUFACTURE' : 'COUNTERFEIT_RISK',
        result.provenanceStatus.isValid ? 'UNBROKEN_CUSTODY' : 'CUSTODY_BREACH',
        result.expirationStatus.isExpired ? 'PRODUCT_EXPIRED' : 'WITHIN_SHELF_LIFE',
      ],
      domainDetails: {
        product: result.trustObjectId,
        custodyHops: result.provenanceStatus.eventCount,
        currentCustodian: result.provenanceStatus.lastCustodian,
      },
    };
  }
}
