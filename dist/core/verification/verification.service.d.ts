import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
import { DidService } from '../identity/did.service.js';
import { ProvenanceService } from '../provenance/provenance.service.js';
import { RevocationService } from '../revocation/revocation.service.js';
import { AnomalyRiskEngine } from '../risk-engine/anomaly.service.js';
import { TrustObjectService } from '../trust-object/trust-object.service.js';
import { VerificationResult } from '../trust-object/trust-object.types.js';
export declare class VerificationService {
    private db;
    private blockchain;
    private didService;
    private trustObjectService;
    private provenanceService;
    private revocationService;
    private riskEngine;
    constructor(blockchain: BlockchainAdapter, trustObjectService: TrustObjectService, provenanceService: ProvenanceService, revocationService: RevocationService, riskEngine: AnomalyRiskEngine, didService?: DidService, db?: DatabaseService);
    /**
     * Executes the 7-step cryptographic verification pipeline on any Trust Object
     */
    verifyTrustObject(params: {
        trustObjectId: string;
        presentedMetadata?: Record<string, any>;
        verifierDid?: string;
        clientIp?: string;
    }): Promise<VerificationResult>;
}
