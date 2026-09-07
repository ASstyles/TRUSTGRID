import { EncryptedKeystore, KeyPair } from '../crypto/crypto.service.js';
export interface WalletIdentity {
    did: string;
    name: string;
    role: string;
    publicKeyPem: string;
    encryptedPrivateKey: EncryptedKeystore;
}
export declare class WalletService {
    private static masterSecret;
    private static memoryWallet;
    /**
     * Encrypts and securely stores a keypair for an entity in demo wallet
     */
    static storeKeyPair(did: string, keyPair: KeyPair): EncryptedKeystore;
    /**
     * Retrieves private key for signing, either from active session or decrypting keystore
     */
    static getPrivateKey(did: string, encryptedKeystore?: EncryptedKeystore): string | null;
    /**
     * Convenience helper to sign a message using an identity's managed wallet
     */
    static signWithDid(did: string, data: string | Buffer): string;
}
