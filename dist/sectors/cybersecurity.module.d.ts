import { DatabaseService } from '../database/db.service.js';
import { BlockchainAdapter } from '../core/blockchain/blockchain.interface.js';
import { TrustObjectService } from '../core/trust-object/trust-object.service.js';
import { TrustObject, VerificationResult } from '../core/trust-object/trust-object.types.js';
import { SectorModule } from './sector.interface.js';
export interface DeviceBaselineMetadata {
    deviceId: string;
    hostname: string;
    deviceType: 'CRITICAL_ROUTER' | 'ENTERPRISE_SERVER' | 'INDUSTRIAL_SCADA' | 'SOC_ENDPOINT';
    firmwareVersion: string;
    configurationHash: string;
    macAddress: string;
    authorizedAdminDid: string;
    ipAddress: string;
}
export declare class CybersecurityModule implements SectorModule {
    readonly name = "Cybersecurity Asset & Integrity Monitoring";
    readonly sectorId: "CYBERSECURITY";
    readonly description = "Zero-trust device configuration baselines and unauthorized modification detection";
    readonly supportedObjectTypes: "DEVICE"[];
    private trustObjectService;
    private blockchain?;
    private db;
    constructor(trustObjectService: TrustObjectService, blockchain?: BlockchainAdapter, db?: DatabaseService);
    validateMetadata(metadata: any): {
        valid: boolean;
        errors?: string[];
    };
    registerDeviceBaseline(params: {
        adminDid: string;
        metadata: DeviceBaselineMetadata;
        customId?: string;
    }): Promise<TrustObject<DeviceBaselineMetadata>>;
    /**
     * Performs an integrity check comparing the live observed device state against the immutable baseline
     */
    auditDeviceIntegrity(params: {
        trustObjectId: string;
        observedConfigHash: string;
        reporterDid: string;
    }): Promise<{
        status: 'AUTHENTIC' | 'COMPROMISED';
        baselineHash: string;
        observedHash: string;
        securityEventId?: string;
        blockchainTxId?: string;
        description: string;
    }>;
    generateVerificationSummary(result: VerificationResult): {
        headline: string;
        badges: string[];
        domainDetails: {
            device: string;
            subjectId: string;
            status: "REVOKED" | "EXPIRED" | "TAMPERED" | "AUTHENTIC" | "INVALID_SIGNATURE" | "PROVENANCE_MISMATCH" | "DEVICE_INTEGRITY_COMPROMISED";
        };
    };
}
