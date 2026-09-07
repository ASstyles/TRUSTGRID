"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevocationService = void 0;
const db_service_js_1 = require("../../database/db.service.js");
const wallet_service_js_1 = require("../identity/wallet.service.js");
class RevocationService {
    db;
    blockchain;
    constructor(blockchain, db) {
        this.blockchain = blockchain;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    /**
     * Cryptographically revokes a Trust Object on the blockchain trust ledger
     */
    async revokeTrustObject(params) {
        const timestamp = new Date().toISOString();
        const revocationStatement = `REVOKE-${params.trustObjectId}-${params.revokerDid}-${params.reason}-${timestamp}`;
        const signature = wallet_service_js_1.WalletService.signWithDid(params.revokerDid, revocationStatement);
        const proof = await this.blockchain.revokeProof({
            trustObjectId: params.trustObjectId,
            reason: params.reason,
            revokerDid: params.revokerDid,
            signature,
        });
        return {
            trustObjectId: params.trustObjectId,
            revokedByDid: params.revokerDid,
            revocationReason: params.reason,
            revocationProof: signature,
            blockchainTxId: proof.txId,
            revokedAt: timestamp,
        };
    }
    /**
     * Checks if an object has been revoked
     */
    getRevocationStatus(trustObjectId) {
        const row = this.db.getOne('SELECT * FROM revocations WHERE trust_object_id = ?', [trustObjectId]);
        if (!row) {
            return null;
        }
        return {
            trustObjectId: row.trust_object_id,
            revokedByDid: row.revoked_by_did,
            revocationReason: row.revocation_reason,
            revocationProof: row.revocation_proof,
            blockchainTxId: row.blockchain_tx_id,
            revokedAt: row.revoked_at,
        };
    }
}
exports.RevocationService = RevocationService;
