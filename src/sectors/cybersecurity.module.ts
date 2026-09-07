import crypto from 'node:crypto';
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
  configurationHash: string; // Hash of authorized config/firewall rules
  macAddress: string;
  authorizedAdminDid: string;
  ipAddress: string;
}

export class CybersecurityModule implements SectorModule {
  public readonly name = 'Cybersecurity Asset & Integrity Monitoring';
  public readonly sectorId = 'CYBERSECURITY' as const;
  public readonly description = 'Zero-trust device configuration baselines and unauthorized modification detection';
  public readonly supportedObjectTypes = ['DEVICE' as const];

  private trustObjectService: TrustObjectService;
  private blockchain?: BlockchainAdapter;
  private db: DatabaseService;

  constructor(trustObjectService: TrustObjectService, blockchain?: BlockchainAdapter, db?: DatabaseService) {
    this.trustObjectService = trustObjectService;
    this.blockchain = blockchain;
    this.db = db || DatabaseService.getInstance();
  }

  public validateMetadata(metadata: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!metadata.deviceId) errors.push('deviceId is required');
    if (!metadata.hostname) errors.push('hostname is required');
    if (!metadata.configurationHash) errors.push('configurationHash is required');
    return { valid: errors.length === 0, errors };
  }

  public async registerDeviceBaseline(params: {
    adminDid: string;
    metadata: DeviceBaselineMetadata;
    customId?: string;
  }): Promise<TrustObject<DeviceBaselineMetadata>> {
    return this.trustObjectService.createTrustObject<DeviceBaselineMetadata>({
      objectType: 'DEVICE',
      subjectId: `did:trustgrid:sec:dev-${params.metadata.deviceId.toLowerCase()}`,
      issuerId: params.adminDid,
      ownerId: params.adminDid,
      metadata: params.metadata,
      customId: params.customId,
    });
  }

  /**
   * Performs an integrity check comparing the live observed device state against the immutable baseline
   */
  public async auditDeviceIntegrity(params: {
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
  }> {
    const trustObject = await this.trustObjectService.getTrustObject(params.trustObjectId);
    if (!trustObject) {
      throw new Error(`Device Trust Object not found: ${params.trustObjectId}`);
    }

    const baselineHash = trustObject.metadata.configurationHash;
    const isIntact = baselineHash === params.observedConfigHash;

    if (!isIntact) {
      const eventId = `SEC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const description = `UNAUTHORIZED CONFIGURATION DRIFT: Observed hash ${params.observedConfigHash.substring(0, 12)} does not match registered baseline ${baselineHash.substring(0, 12)}. Potential malicious firmware/rootkit tampering.`;

      let blockchainTxId: string | undefined = undefined;

      // Anchor security event on-chain
      if (this.blockchain) {
        try {
          const onChain = await this.blockchain.recordSecurityEvent({
            eventId,
            trustObjectId: params.trustObjectId,
            deviceId: trustObject.subjectId,
            eventType: 'BASELINE_VIOLATION',
            severity: 'CRITICAL',
            expectedHash: baselineHash,
            observedHash: params.observedConfigHash,
            description,
            reporterDid: params.reporterDid,
          });
          blockchainTxId = onChain.txId;
        } catch {
          // If blockchain offline, continue with database record
        }
      }

      // Record in security_events table
      this.db.run(
        `INSERT INTO security_events 
         (id, device_id, trust_object_id, event_severity, event_type, expected_hash, observed_hash, description, reported_by_did, blockchain_tx_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          trustObject.subjectId,
          params.trustObjectId,
          'CRITICAL',
          'BASELINE_VIOLATION',
          baselineHash,
          params.observedConfigHash,
          description,
          params.reporterDid,
          blockchainTxId || null,
        ]
      );

      // Also mark TrustObject status as TAMPERED
      this.trustObjectService.simulateTamper(params.trustObjectId, {
        ...trustObject.metadata,
        configurationHash: params.observedConfigHash,
        compromiseDetectedAt: new Date().toISOString(),
      });

      return {
        status: 'COMPROMISED',
        baselineHash,
        observedHash: params.observedConfigHash,
        securityEventId: eventId,
        blockchainTxId,
        description,
      };
    }

    return {
      status: 'AUTHENTIC',
      baselineHash,
      observedHash: params.observedConfigHash,
      description: 'Device configuration matches verified cryptographic baseline exactly. Zero unauthorized drift detected.',
    };
  }

  public generateVerificationSummary(result: VerificationResult) {
    const isAuthentic = result.overallStatus === 'AUTHENTIC';
    return {
      headline: isAuthentic ? 'Device Cryptographic Integrity Verified' : '🚨 DEVICE INTEGRITY COMPROMISED',
      badges: [
        isAuthentic ? 'BASELINE_VERIFIED' : 'CONFIGURATION_DRIFT',
        result.hashMatch ? 'INTEGRITY_INTACT' : 'TAMPER_ALERT',
        result.signatureValid ? 'AUTHORITY_SIGNED' : 'UNAUTHORIZED_STATE',
      ],
      domainDetails: {
        device: result.trustObjectId,
        subjectId: result.subjectId,
        status: result.overallStatus,
      },
    };
  }
}
