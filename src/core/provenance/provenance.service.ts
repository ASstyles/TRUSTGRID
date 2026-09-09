import crypto from 'node:crypto';
import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { DidService } from '../identity/did.service.js';
import { WalletService } from '../identity/wallet.service.js';
import { ProvenanceEvent } from '../trust-object/trust-object.types.js';

export class ProvenanceService {
  private db: DatabaseService;
  private blockchain: BlockchainAdapter;
  private didService: DidService;

  constructor(blockchain: BlockchainAdapter, db?: DatabaseService, didService?: DidService) {
    this.blockchain = blockchain;
    this.db = db || DatabaseService.getInstance();
    this.didService = didService || new DidService(this.db);
  }

  /**
   * Records a certified custody handoff or state transition on-chain
   */
  public async transferCustody(params: {
    trustObjectId: string;
    fromDid: string;
    toDid: string;
    location: string;
    coordinates?: { latitude: number; longitude: number };
    actionDescription: string;
    metadata?: Record<string, any>;
  }): Promise<ProvenanceEvent> {
    const eventId = `EV-TRANSFER-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Sign the custody handoff
    const signPayload = `${params.trustObjectId}-${params.fromDid}->${params.toDid}-${timestamp}`;
    const signature = WalletService.signWithDid(params.fromDid, signPayload);

    const event: ProvenanceEvent = {
      eventId,
      trustObjectId: params.trustObjectId,
      eventType: 'TRANSFER',
      fromDid: params.fromDid,
      toDid: params.toDid,
      location: params.location,
      coordinates: params.coordinates,
      timestamp,
      actionDescription: params.actionDescription,
      signature,
      blockchainTxId: '',
      metadata: params.metadata,
    };

    // Anchor on blockchain ledger
    const { txId } = await this.blockchain.addProvenanceEvent(event);
    event.blockchainTxId = txId;

    // Update current owner in trust_objects
    this.db.run(
      `UPDATE trust_objects SET owner_id = ? WHERE trust_object_id = ?`,
      [params.toDid, params.trustObjectId]
    );

    // Record in ownership_events
    this.db.run(
      `INSERT INTO ownership_events (id, trust_object_id, previous_owner_did, new_owner_did, transfer_reason, signature, blockchain_tx_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `OWN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        params.trustObjectId,
        params.fromDid,
        params.toDid,
        params.actionDescription,
        signature,
        txId,
        timestamp,
      ]
    );

    return event;
  }

  /**
   * Verifies the continuity of a provenance chain
   */
  public verifyChainContinuity(events: ProvenanceEvent[]): {
    isValid: boolean;
    brokenIndex?: number;
    reason?: string;
  } {
    if (events.length === 0) {
      return { isValid: false, reason: 'Empty provenance chain' };
    }

    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];

      // 1. Handoff consistency: current 'fromDid' should match previous 'toDid'
      if (curr.fromDid && prev.toDid && curr.fromDid !== prev.toDid) {
        return {
          isValid: false,
          brokenIndex: i,
          reason: `Broken chain at step ${i}: Custody held by ${prev.toDid}, but handed off by unauthorized entity ${curr.fromDid}`,
        };
      }

      // 2. Chronological consistency
      if (new Date(curr.timestamp).getTime() < new Date(prev.timestamp).getTime()) {
        return {
          isValid: false,
          brokenIndex: i,
          reason: `Time-warp anomaly: Event ${i} timestamp is older than previous event`,
        };
      }

      // 3. Cryptographic Signature Validation on custody transitions
      if (curr.eventType === 'TRANSFER' && curr.signature && curr.fromDid) {
        const fromPubKey = this.didService.getPublicKey(curr.fromDid);
        if (!fromPubKey) {
          return {
            isValid: false,
            brokenIndex: i,
            reason: `Invalid cryptographic signature: Signer public key not found for custody transition ${i} from ${curr.fromDid}`,
          };
        }
        const signPayload = `${curr.trustObjectId}-${curr.fromDid}->${curr.toDid}-${curr.timestamp}`;
        const signatureValid = CryptoService.verify(signPayload, curr.signature, fromPubKey);
        if (!signatureValid) {
          return {
            isValid: false,
            brokenIndex: i,
            reason: `Invalid cryptographic signature on custody transition ${i} from ${curr.fromDid}`,
          };
        }
      }
    }

    return { isValid: true };
  }
}
