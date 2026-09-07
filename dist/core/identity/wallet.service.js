"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const crypto_service_js_1 = require("../crypto/crypto.service.js");
class WalletService {
    static masterSecret = process.env.TRUSTGRID_WALLET_SECRET || 'trustgrid-master-secure-demo-secret-2026';
    static memoryWallet = new Map();
    /**
     * Encrypts and securely stores a keypair for an entity in demo wallet
     */
    static storeKeyPair(did, keyPair) {
        // Keep in memory for fast execution in demo mode
        this.memoryWallet.set(did, keyPair);
        return crypto_service_js_1.CryptoService.encryptPrivateKey(keyPair.privateKey, this.masterSecret);
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
                return crypto_service_js_1.CryptoService.decryptPrivateKey(encryptedKeystore, this.masterSecret);
            }
            catch {
                return null;
            }
        }
        return null;
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
