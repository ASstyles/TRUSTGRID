export interface KeyPair {
    publicKey: string;
    privateKey: string;
}
export interface EncryptedKeystore {
    ciphertext: string;
    iv: string;
    tag: string;
    salt?: string;
    algorithm: 'aes-256-gcm';
}
export declare class CryptoService {
    /**
     * Deterministically orders object keys recursively so that JSON serialization is canonical.
     * This is critical for verifiable hashing across systems.
     */
    static canonicalStringify(obj: any): string;
    /**
     * Generates a standard SHA-256 hash in lowercase hex
     */
    static sha256(data: string | Buffer): string;
    /**
     * Computes deterministic SHA-256 of any object using canonical JSON representation
     */
    static hashObject(obj: any): string;
    /**
     * Generates an Ed25519 cryptographic keypair
     */
    static generateEd25519KeyPair(): KeyPair;
    /**
     * Deterministically derives an Ed25519 keypair from a seed string.
     * Ensures identical identities produce the exact same keypair across environments.
     */
    static generateDeterministicEd25519KeyPair(seedInput: string): KeyPair;
    /**
     * Signs arbitrary string or buffer using an Ed25519 private key.
     * Returns base64 signature.
     */
    static sign(data: string | Buffer, privateKeyPem: string): string;
    /**
     * Verifies an Ed25519 signature against data and a public key.
     */
    static verify(data: string | Buffer, signatureBase64: string, publicKeyPem: string): boolean;
    /**
     * Encrypts private key using AES-256-GCM, unique random salt, unique random IV, and an authentication tag.
     */
    static encryptPrivateKey(privateKey: string, secretPassphrase: string, customSalt?: string): EncryptedKeystore;
    /**
     * Decrypts private key from an EncryptedKeystore
     */
    static decryptPrivateKey(keystore: EncryptedKeystore, secretPassphrase: string): string;
    /**
     * Merkle Tree Root calculation for an array of transaction/leaf hashes
     */
    static computeMerkleRoot(leaves: string[]): string;
}
