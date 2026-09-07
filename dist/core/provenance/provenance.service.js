"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvenanceService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_service_js_1 = require("../../database/db.service.js");
const crypto_service_js_1 = require("../crypto/crypto.service.js");
const did_service_js_1 = require("../identity/did.service.js");
const wallet_service_js_1 = require("../identity/wallet.service.js");
class ProvenanceService {
    db;
    blockchain;
    didService;
    constructor(blockchain, db, didService) {
        this.blockchain = blockchain;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
        this.didService = didService || new did_service_js_1.DidService(this.db);
    }
    /**
     * Records a certified custody handoff or state transition on-chain
     */
    async transferCustody(params) {
        const eventId = `EV-TRANSFER-${Date.now()}-${node_crypto_1.default.randomBytes(4).toString('hex')}`;
        const timestamp = new Date().toISOString();
        // Sign the custody handoff
        const signPayload = `${params.trustObjectId}-${params.fromDid}->${params.toDid}-${timestamp}`;
        const signature = wallet_service_js_1.WalletService.signWithDid(params.fromDid, signPayload);
        const event = {
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
        this.db.run(`UPDATE trust_objects SET owner_id = ? WHERE trust_object_id = ?`, [params.toDid, params.trustObjectId]);
        // Record in ownership_events
        this.db.run(`INSERT INTO ownership_events (id, trust_object_id, previous_owner_did, new_owner_did, transfer_reason, signature, blockchain_tx_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            `OWN-${Date.now()}-${node_crypto_1.default.randomBytes(4).toString('hex')}`,
            params.trustObjectId,
            params.fromDid,
            params.toDid,
            params.actionDescription,
            signature,
            txId,
            timestamp,
        ]);
        return event;
    }
    /**
     * Verifies the continuity of a provenance chain
     */
    verifyChainContinuity(events) {
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
                if (fromPubKey) {
                    const signPayload = `${curr.trustObjectId}-${curr.fromDid}->${curr.toDid}-${curr.timestamp}`;
                    const signatureValid = crypto_service_js_1.CryptoService.verify(signPayload, curr.signature, fromPubKey);
                    if (!signatureValid) {
                        return {
                            isValid: false,
                            brokenIndex: i,
                            reason: `Invalid cryptographic signature on custody transition ${i} from ${curr.fromDid}`,
                        };
                    }
                }
            }
        }
        return { isValid: true };
    }
}
exports.ProvenanceService = ProvenanceService;
