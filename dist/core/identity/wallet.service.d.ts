import { EncryptedKeystore, KeyPair } from '../crypto/crypto.service.js';
import { DatabaseService } from '../../database/db.service.js';
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
     * Resets in-memory key cache (used to simulate server process restart in tests)
     */
    static clearMemoryCache(): void;
    /**
     * Encrypts and securely stores a keypair for an entity in the persistent wallet keystore table
     */
    static storeKeyPair(did: string, keyPair: KeyPair, dbInstance?: DatabaseService): EncryptedKeystore;
    /**
     * Retrieves full keypair (public and private key) for an identity.
     * Checks in-memory cache first, then decrypts from persistent keystore table.
     */
    static getKeyPair(did: string, dbInstance?: DatabaseService): KeyPair | null;
    /**
     * Retrieves private key for signing, either from active session or decrypting keystore
     */
    static getPrivateKey(did: string, encryptedKeystore?: EncryptedKeystore): string | null;
    /**
     * Retrieves public key for an identity
     */
    static getPublicKey(did: string): string | null;
    /**
     * Retrieves existing keypair or generates and persists a new one.
     * Guarantees that an already-registered DID never has its keys overwritten.
     */
    static getOrCreateKeyPair(did: string, generatorFn: () => KeyPair, dbInstance?: DatabaseService): KeyPair;
    /**
     * Convenience helper to sign a message using an identity's managed wallet
     */
    static signWithDid(did: string, data: string | Buffer): string;
}
