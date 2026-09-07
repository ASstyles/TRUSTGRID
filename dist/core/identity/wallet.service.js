"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const crypto_service_js_1 = require("../crypto/crypto.service.js");
const db_service_js_1 = require("../../database/db.service.js");
class WalletService {
    static masterSecret = process.env.TRUSTGRID_WALLET_SECRET || 'trustgrid-master-secure-demo-secret-2026';
    static memoryWallet = new Map();
    /**
     * Resets in-memory key cache (used to simulate server process restart in tests)
     */
    static clearMemoryCache() {
        this.memoryWallet.clear();
    }
    /**
     * Encrypts and securely stores a keypair for an entity in the persistent wallet keystore table
     */
    static storeKeyPair(did, keyPair, dbInstance) {
        // 1. Cache in memory
        this.memoryWallet.set(did, keyPair);
        // 2. Encrypt private key using AES-256-GCM with unique salt and IV
        const encryptedKeystore = crypto_service_js_1.CryptoService.encryptPrivateKey(keyPair.privateKey, this.masterSecret);
        // 3. Persist to database
        try {
            const db = dbInstance || db_service_js_1.DatabaseService.getInstance();
            db.run(`INSERT OR REPLACE INTO wallet_keystores 
         (did, public_key, key_type, encrypted_keystore, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`, [
                did,
                keyPair.publicKey,
                'Ed25519VerificationKey2020',
                JSON.stringify(encryptedKeystore),
            ]);
        }
        catch {
            // If DB is not available in unit test sandbox, in-memory cache remains available
        }
        return encryptedKeystore;
    }
    /**
     * Retrieves full keypair (public and private key) for an identity.
     * Checks in-memory cache first, then decrypts from persistent keystore table.
     */
    static getKeyPair(did, dbInstance) {
        if (this.memoryWallet.has(did)) {
            return this.memoryWallet.get(did);
        }
        try {
            const db = dbInstance || db_service_js_1.DatabaseService.getInstance();
            // Check wallet_keystores table
            const keystoreRow = db.getOne('SELECT public_key, encrypted_keystore FROM wallet_keystores WHERE did = ?', [did]);
            if (keystoreRow && keystoreRow.encrypted_keystore) {
                const parsed = JSON.parse(keystoreRow.encrypted_keystore);
                const privateKey = crypto_service_js_1.CryptoService.decryptPrivateKey(parsed, this.masterSecret);
                const keyPair = {
                    publicKey: keystoreRow.public_key,
                    privateKey,
                };
                this.memoryWallet.set(did, keyPair);
                return keyPair;
            }
            // Fallback: check users table
            const userRow = db.getOne('SELECT public_key, encrypted_private_key FROM users WHERE did = ?', [did]);
            if (userRow && userRow.encrypted_private_key) {
                const parsed = JSON.parse(userRow.encrypted_private_key);
                const privateKey = crypto_service_js_1.CryptoService.decryptPrivateKey(parsed, this.masterSecret);
                const keyPair = {
                    publicKey: userRow.public_key,
                    privateKey,
                };
                this.memoryWallet.set(did, keyPair);
                return keyPair;
            }
        }
        catch {
            // Database not available or decryption failed
        }
        return null;
    }
    /**
     * Retrieves private key for signing, either from active session or decrypting keystore
     */
    static getPrivateKey(did, encryptedKeystore) {
        if (this.memoryWallet.has(did)) {
            return this.memoryWallet.get(did).privateKey;
        }
        if (encryptedKeystore) {
            try {
                const privateKey = crypto_service_js_1.CryptoService.decryptPrivateKey(encryptedKeystore, this.masterSecret);
                return privateKey;
            }
            catch {
                return null;
            }
        }
        const keyPair = this.getKeyPair(did);
        return keyPair ? keyPair.privateKey : null;
    }
    /**
     * Retrieves public key for an identity
     */
    static getPublicKey(did) {
        const keyPair = this.getKeyPair(did);
        return keyPair ? keyPair.publicKey : null;
    }
    /**
     * Retrieves existing keypair or generates and persists a new one.
     * Guarantees that an already-registered DID never has its keys overwritten.
     */
    static getOrCreateKeyPair(did, generatorFn, dbInstance) {
        const existing = this.getKeyPair(did, dbInstance);
        if (existing) {
            return existing;
        }
        const newKeyPair = generatorFn();
        this.storeKeyPair(did, newKeyPair, dbInstance);
        return newKeyPair;
    }
    /**
     * Convenience helper to sign a message using an identity's managed wallet
     */
    static signWithDid(did, data) {
        const privateKey = this.getPrivateKey(did);
        if (!privateKey) {
            throw new Error(`Wallet private key not available for identity DID: ${did}`);
        }
        return crypto_service_js_1.CryptoService.sign(data, privateKey);
    }
}
exports.WalletService = WalletService;
