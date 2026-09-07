"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvenanceService = void 0;
const db_service_js_1 = require("../../database/db.service.js");
const wallet_service_js_1 = require("../identity/wallet.service.js");
class ProvenanceService {
    db;
    blockchain;
    constructor(blockchain, db) {
        this.blockchain = blockchain;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    /**
     * Records a certified custody handoff or state transition on-chain
     */
    async transferCustody(params) {
        const eventId = `EV-TRANSFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
            'OWN-' + Date.now(),
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
            // Handoff consistency: current 'fromDid' should match previous 'toDid'
            if (curr.fromDid && prev.toDid && curr.fromDid !== prev.toDid) {
                return {
                    isValid: false,
                    brokenIndex: i,
                    reason: `Broken chain at step ${i}: Custody held by ${prev.toDid}, but handed off by unauthorized entity ${curr.fromDid}`,
                };
            }
            // Chronological consistency
            if (new Date(curr.timestamp).getTime() < new Date(prev.timestamp).getTime()) {
                return {
                    isValid: false,
                    brokenIndex: i,
                    reason: `Time-warp anomaly: Event ${i} timestamp is older than previous event`,
                };
            }
        }
        return { isValid: true };
    }
}
exports.ProvenanceService = ProvenanceService;
