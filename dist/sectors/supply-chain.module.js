"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplyChainModule = void 0;
class SupplyChainModule {
    name = 'Supply Chain & Product Provenance';
    sectorId = 'SUPPLY_CHAIN';
    description = 'End-to-end multi-tier custody tracking and anti-counterfeit verification';
    supportedObjectTypes = ['PRODUCT'];
    trustObjectService;
    provenanceService;
    constructor(trustObjectService, provenanceService) {
        this.trustObjectService = trustObjectService;
        this.provenanceService = provenanceService;
    }
    validateMetadata(metadata) {
        const errors = [];
        if (!metadata.productName)
            errors.push('productName is required');
        if (!metadata.batchNumber)
            errors.push('batchNumber is required');
        if (!metadata.serialNumber)
            errors.push('serialNumber is required');
        return { valid: errors.length === 0, errors };
    }
    async registerProductBatch(params) {
        return this.trustObjectService.createTrustObject({
            objectType: 'PRODUCT',
            subjectId: `did:trustgrid:sc:prod-${params.metadata.serialNumber.toLowerCase()}`,
            issuerId: params.manufacturerDid,
            ownerId: params.manufacturerDid,
            expiresAt: params.metadata.expiryDate,
            metadata: params.metadata,
            customId: params.customId,
        });
    }
    async transferProductCustody(params) {
        return this.provenanceService.transferCustody(params);
    }
    generateVerificationSummary(result) {
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
exports.SupplyChainModule = SupplyChainModule;
