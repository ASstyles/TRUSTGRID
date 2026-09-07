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
export declare class SupplyChainModule implements SectorModule {
    readonly name = "Supply Chain & Product Provenance";
    readonly sectorId: "SUPPLY_CHAIN";
    readonly description = "End-to-end multi-tier custody tracking and anti-counterfeit verification";
    readonly supportedObjectTypes: "PRODUCT"[];
    private trustObjectService;
    private provenanceService;
    constructor(trustObjectService: TrustObjectService, provenanceService: ProvenanceService);
    validateMetadata(metadata: any): {
        valid: boolean;
        errors?: string[];
    };
    registerProductBatch(params: {
        manufacturerDid: string;
        metadata: ProductBatchMetadata;
        customId?: string;
    }): Promise<TrustObject<ProductBatchMetadata>>;
    transferProductCustody(params: {
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
            product: string;
            custodyHops: number;
            currentCustodian: string;
        };
    };
}
