"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustObjectService = void 0;
const db_service_js_1 = require("../../database/db.service.js");
const crypto_service_js_1 = require("../crypto/crypto.service.js");
const did_service_js_1 = require("../identity/did.service.js");
const wallet_service_js_1 = require("../identity/wallet.service.js");
class TrustObjectService {
    db;
    blockchain;
    didService;
    constructor(blockchain, db, didService) {
        this.blockchain = blockchain;
        this.db = db || db_service_js_1.DatabaseService.getInstance();
        this.didService = didService || new did_service_js_1.DidService(this.db);
    }
    /**
     * Creates, signs, anchors, and persists a Trust Object under the Trust Object Protocol (TOP)
     */
    async createTrustObject(params) {
        const trustObjectId = params.customId || `TO-${params.objectType.substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const createdAt = new Date().toISOString();
        const ownerId = params.ownerId || params.subjectId;
        // 1. Calculate deterministic canonical hash of metadata and immutable attributes
        const contentToHash = {
            trustObjectId,
            objectType: params.objectType,
            subjectId: params.subjectId,
            issuerId: params.issuerId,
            createdAt,
            expiresAt: params.expiresAt || null,
            metadata: params.metadata,
        };
        const contentHash = crypto_service_js_1.CryptoService.hashObject(contentToHash);
        // 2. Digitally sign the content hash with the issuer's private key
        const signature = wallet_service_js_1.WalletService.signWithDid(params.issuerId, contentHash);
        // 3. Anchor proof to blockchain trust ledger
        const proof = await this.blockchain.registerProof({
            trustObjectId,
            contentHash,
            issuerId: params.issuerId,
            ownerId,
            status: 'ACTIVE',
            signerDid: params.issuerId,
            signature,
            payload: {
                objectType: params.objectType,
                subjectId: params.subjectId,
            },
        });
        // 4. Persist Trust Object in database
        this.db.run(`INSERT OR REPLACE INTO trust_objects 
       (trust_object_id, object_type, subject_id, issuer_id, owner_id, created_at, expires_at, content_hash, signature, blockchain_tx_id, status, version, metadata, off_chain_data, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            trustObjectId,
            params.objectType,
            params.subjectId,
            params.issuerId,
            ownerId,
            createdAt,
            params.expiresAt || null,
            contentHash,
            signature,
            proof.txId,
            'ACTIVE',
            1,
            JSON.stringify(params.metadata),
            params.offChainData ? JSON.stringify(params.offChainData) : null,
            Date.now(),
        ]);
        // 5. Initial provenance event
        const creationEvent = {
            eventId: `EV-${Date.now()}-001`,
            trustObjectId,
            eventType: 'CREATION',
            fromDid: params.issuerId,
            toDid: ownerId,
            location: 'TRUSTGRID Protocol Genesis',
            timestamp: createdAt,
            actionDescription: `Initial Trust Object creation and cryptographic anchor by ${params.issuerId}`,
            signature: wallet_service_js_1.WalletService.signWithDid(params.issuerId, `${trustObjectId}-CREATION-${createdAt}`),
            blockchainTxId: proof.txId,
            metadata: { initialProofHash: contentHash },
        };
        await this.blockchain.addProvenanceEvent(creationEvent);
        const trustObject = {
            trustObjectId,
            objectType: params.objectType,
            subjectId: params.subjectId,
            issuerId: params.issuerId,
            ownerId,
            createdAt,
            expiresAt: params.expiresAt || null,
            contentHash,
            signature,
            blockchainTxId: proof.txId,
            status: 'ACTIVE',
            metadata: params.metadata,
            provenance: [creationEvent],
            version: 1,
        };
        return trustObject;
    }
    /**
     * Retrieves a Trust Object by ID with full provenance history
     */
    async getTrustObject(trustObjectId) {
        const row = this.db.getOne('SELECT * FROM trust_objects WHERE trust_object_id = ?', [trustObjectId]);
        if (!row) {
            return null;
        }
        const provenanceRows = this.db.query('SELECT * FROM provenance_events WHERE trust_object_id = ? ORDER BY timestamp ASC', [trustObjectId]);
        const provenance = provenanceRows.map((r) => ({
            eventId: r.id,
            trustObjectId: r.trust_object_id,
            eventType: r.event_type,
            fromDid: r.from_did,
            toDid: r.to_did,
            location: r.location,
            coordinates: r.latitude && r.longitude ? { latitude: r.latitude, longitude: r.longitude } : undefined,
            timestamp: r.timestamp,
            actionDescription: r.action_description,
            signature: r.signature,
            blockchainTxId: r.blockchain_tx_id,
            metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        }));
        return {
            trustObjectId: row.trust_object_id,
            objectType: row.object_type,
            subjectId: row.subject_id,
            issuerId: row.issuer_id,
            ownerId: row.owner_id,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            contentHash: row.content_hash,
            signature: row.signature,
            blockchainTxId: row.blockchain_tx_id,
            status: row.status,
            metadata: JSON.parse(row.metadata),
            provenance,
            version: row.version,
        };
    }
    /**
     * Tamper simulation utility for testing and live SIH demonstrations
     * Modifies off-chain metadata attributes in the DB without updating blockchain proof
     */
    simulateTamper(trustObjectId, modifiedMetadata) {
        this.db.run(`UPDATE trust_objects 
       SET metadata = ?, status = 'TAMPERED' 
       WHERE trust_object_id = ?`, [JSON.stringify(modifiedMetadata), trustObjectId]);
    }
}
exports.TrustObjectService = TrustObjectService;
