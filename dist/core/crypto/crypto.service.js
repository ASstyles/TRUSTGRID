"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class CryptoService {
    /**
     * Deterministically orders object keys recursively so that JSON serialization is canonical.
     * This is critical for verifiable hashing across systems.
     */
    static canonicalStringify(obj) {
        if (obj === null || typeof obj !== 'object') {
            return JSON.stringify(obj);
        }
        if (Array.isArray(obj)) {
            return '[' + obj.map((item) => CryptoService.canonicalStringify(item)).join(',') + ']';
        }
        const sortedKeys = Object.keys(obj).sort();
        const keyValPairs = sortedKeys.map((key) => {
            const val = CryptoService.canonicalStringify(obj[key]);
            return `"${key}":${val}`;
        });
        return '{' + keyValPairs.join(',') + '}';
    }
    /**
     * Generates a standard SHA-256 hash in lowercase hex
     */
    static sha256(data) {
        return node_crypto_1.default.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Computes deterministic SHA-256 of any object using canonical JSON representation
     */
    static hashObject(obj) {
        const canonical = CryptoService.canonicalStringify(obj);
        return CryptoService.sha256(canonical);
    }
    /**
     * Generates an Ed25519 cryptographic keypair
     */
    static generateEd25519KeyPair() {
        const { publicKey, privateKey } = node_crypto_1.default.generateKeyPairSync('ed25519', {
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        return { publicKey, privateKey };
    }
    /**
     * Deterministically derives an Ed25519 keypair from a seed string.
     * Ensures identical identities produce the exact same keypair across environments.
     */
    static generateDeterministicEd25519KeyPair(seedInput) {
        const seed = node_crypto_1.default.createHash('sha256').update(seedInput).digest();
        // Ed25519 PKCS#8 DER header prefix for 32-byte raw seed:
        const pkcs8Der = Buffer.concat([
            Buffer.from('302e020100300506032b657004220420', 'hex'),
            seed,
        ]);
        const privateKeyObj = node_crypto_1.default.createPrivateKey({
            key: pkcs8Der,
            format: 'der',
            type: 'pkcs8',
        });
        const publicKeyObj = node_crypto_1.default.createPublicKey(privateKeyObj);
        return {
            privateKey: privateKeyObj.export({ type: 'pkcs8', format: 'pem' }),
            publicKey: publicKeyObj.export({ type: 'spki', format: 'pem' }),
        };
    }
    /**
     * Signs arbitrary string or buffer using an Ed25519 private key.
     * Returns base64 signature.
     */
    static sign(data, privateKeyPem) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const signature = node_crypto_1.default.sign(null, buffer, privateKeyPem);
        return signature.toString('base64');
    }
    /**
     * Verifies an Ed25519 signature against data and a public key.
     */
    static verify(data, signatureBase64, publicKeyPem) {
        try {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
            const signatureBuffer = Buffer.from(signatureBase64, 'base64');
            return node_crypto_1.default.verify(null, buffer, publicKeyPem, signatureBuffer);
        }
        catch {
            return false;
        }
    }
    /**
     * Encrypts private key using AES-256-GCM, unique random salt, unique random IV, and an authentication tag.
     */
    static encryptPrivateKey(privateKey, secretPassphrase, customSalt) {
        const salt = customSalt || node_crypto_1.default.randomBytes(16).toString('hex');
        const key = node_crypto_1.default.scryptSync(secretPassphrase, salt, 32);
        const iv = node_crypto_1.default.randomBytes(16);
        const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');
        return {
            ciphertext: encrypted,
            iv: iv.toString('hex'),
            tag,
            salt,
            algorithm: 'aes-256-gcm',
        };
    }
    /**
     * Decrypts private key from an EncryptedKeystore
     */
    static decryptPrivateKey(keystore, secretPassphrase) {
        const salt = keystore.salt || 'trustgrid-salt';
        const key = node_crypto_1.default.scryptSync(secretPassphrase, salt, 32);
        const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', key, Buffer.from(keystore.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(keystore.tag, 'hex'));
        let decrypted = decipher.update(keystore.ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Merkle Tree Root calculation for an array of transaction/leaf hashes
     */
    static computeMerkleRoot(leaves) {
        if (leaves.length === 0) {
            return CryptoService.sha256('empty-merkle-tree');
        }
        let currentLevel = leaves.map((leaf) => leaf.toLowerCase());
        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    const combined = currentLevel[i] + currentLevel[i + 1];
                    nextLevel.push(CryptoService.sha256(combined));
                }
                else {
                    // Odd leaf paired with itself
                    const combined = currentLevel[i] + currentLevel[i];
                    nextLevel.push(CryptoService.sha256(combined));
                }
            }
            currentLevel = nextLevel;
        }
        return currentLevel[0];
    }
}
exports.CryptoService = CryptoService;
