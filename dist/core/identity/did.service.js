"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DidService = void 0;
const db_service_js_1 = require("../../database/db.service.js");
const crypto_service_js_1 = require("../crypto/crypto.service.js");
class DidService {
    db;
    constructor(db) {
        this.db = db || db_service_js_1.DatabaseService.getInstance();
    }
    /**
     * Generates a deterministic or random DID for a given sector and identifier
     */
    static formatDid(sector, identifier) {
        const sanitized = identifier.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        return `did:trustgrid:${sector}:${sanitized}`;
    }
    /**
     * Creates and registers a new DID Document with an Ed25519 keypair
     */
    createIdentity(params) {
        const did = DidService.formatDid(params.sector, params.identifier);
        const keyPair = params.keyPair || crypto_service_js_1.CryptoService.generateEd25519KeyPair();
        const controller = params.controllerDid || did;
        const keyId = `${did}#key-1`;
        const didDocument = {
            '@context': [
                'https://www.w3.org/ns/did/v1',
                'https://w3id.org/security/suites/ed25519-2020/v1',
            ],
            id: did,
            controller,
            verificationMethod: [
                {
                    id: keyId,
                    type: 'Ed25519VerificationKey2020',
                    controller,
                    publicKeyPem: keyPair.publicKey,
                },
            ],
            authentication: [keyId],
            assertionMethod: [keyId],
            created: new Date().toISOString(),
        };
        // Store in DB
        this.db.run(`INSERT OR REPLACE INTO identities 
       (did, entity_type, controller_did, public_key, key_type, verification_method, authentication_methods, service_endpoints, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            did,
            params.entityType,
            controller,
            keyPair.publicKey,
            'Ed25519VerificationKey2020',
            keyId,
            JSON.stringify([keyId]),
            JSON.stringify({}),
            didDocument.created,
        ]);
        return { did, didDocument, keyPair };
    }
    /**
     * Resolves a DID Document from the identity store
     */
    resolveDid(did) {
        const row = this.db.getOne('SELECT * FROM identities WHERE did = ?', [did]);
        if (!row || row.revoked_at) {
            return null;
        }
        return {
            '@context': [
                'https://www.w3.org/ns/did/v1',
                'https://w3id.org/security/suites/ed25519-2020/v1',
            ],
            id: row.did,
            controller: row.controller_did,
            verificationMethod: [
                {
                    id: row.verification_method,
                    type: row.key_type,
                    controller: row.controller_did,
                    publicKeyPem: row.public_key,
                },
            ],
            authentication: [row.verification_method],
            assertionMethod: [row.verification_method],
            created: row.created_at,
        };
    }
    /**
     * Look up public key directly for signature verification
     */
    getPublicKey(did) {
        const doc = this.resolveDid(did);
        if (!doc || doc.verificationMethod.length === 0) {
            return null;
        }
        return doc.verificationMethod[0].publicKeyPem;
    }
}
exports.DidService = DidService;
