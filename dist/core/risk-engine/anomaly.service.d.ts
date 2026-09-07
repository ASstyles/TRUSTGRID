import { DatabaseService } from '../../database/db.service.js';
import { TrustObject } from '../trust-object/trust-object.types.js';
export interface RiskFactor {
    factor: string;
    impact: number;
    explanation: string;
}
export interface RiskAssessment {
    riskScore: number;
    riskLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    factors: RiskFactor[];
    summaryReasons: string[];
    assessedAt: string;
}
export declare class AnomalyRiskEngine {
    private db;
    constructor(db?: DatabaseService);
    /**
     * Evaluates explainable risk indicators for any Trust Object during verification or lifecycle events
     */
    assessTrustObjectRisk(params: {
        trustObject: TrustObject;
        verifierDid?: string;
        clientIp?: string;
        currentLocation?: string;
        hashMatch: boolean;
        signatureValid: boolean;
        isRevoked: boolean;
        isExpired: boolean;
        chainContinuityValid: boolean;
    }): RiskAssessment;
}
