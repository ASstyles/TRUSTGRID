import crypto from 'node:crypto';

export interface KeyPair {
  publicKey: string;  // PEM or Hex
  privateKey: string; // PEM or Hex
}

export interface EncryptedKeystore {
  ciphertext: string;
  iv: string;
  tag: string;
  salt?: string;
  algorithm: 'aes-256-gcm';
}

export class CryptoService {
  /**
   * Deterministically orders object keys recursively so that JSON serialization is canonical.
   * This is critical for verifiable hashing across systems.
   */
  public static canonicalStringify(obj: any): string {
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
  public static sha256(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Computes deterministic SHA-256 of any object using canonical JSON representation
   */
  public static hashObject(obj: any): string {
    const canonical = CryptoService.canonicalStringify(obj);
    return CryptoService.sha256(canonical);
  }

  /**
   * Generates an Ed25519 cryptographic keypair
   */
  public static generateEd25519KeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return { publicKey, privateKey };
  }

  /**
   * Deterministically derives an Ed25519 keypair from a seed string.
   * Ensures identical identities produce the exact same keypair across environments.
   */
  public static generateDeterministicEd25519KeyPair(seedInput: string): KeyPair {
    const seed = crypto.createHash('sha256').update(seedInput).digest();
    // Ed25519 PKCS#8 DER header prefix for 32-byte raw seed:
    const pkcs8Der = Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      seed,
    ]);
    const privateKeyObj = crypto.createPrivateKey({
      key: pkcs8Der,
      format: 'der',
      type: 'pkcs8',
    });
    const publicKeyObj = crypto.createPublicKey(privateKeyObj);
    return {
      privateKey: privateKeyObj.export({ type: 'pkcs8', format: 'pem' }) as string,
      publicKey: publicKeyObj.export({ type: 'spki', format: 'pem' }) as string,
    };
  }

  /**
   * Signs arbitrary string or buffer using an Ed25519 private key.
   * Returns base64 signature.
   */
  public static sign(data: string | Buffer, privateKeyPem: string): string {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const signature = crypto.sign(null, buffer, privateKeyPem);
    return signature.toString('base64');
  }

  /**
   * Verifies an Ed25519 signature against data and a public key.
   */
  public static verify(data: string | Buffer, signatureBase64: string, publicKeyPem: string): boolean {
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');
      return crypto.verify(null, buffer, publicKeyPem, signatureBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Encrypts private key using AES-256-GCM, unique random salt, unique random IV, and an authentication tag.
   */
  public static encryptPrivateKey(privateKey: string, secretPassphrase: string, customSalt?: string): EncryptedKeystore {
    const salt = customSalt || crypto.randomBytes(16).toString('hex');
    const key = crypto.scryptSync(secretPassphrase, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
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
  public static decryptPrivateKey(keystore: EncryptedKeystore, secretPassphrase: string): string {
    const salt = keystore.salt || 'trustgrid-salt';
    const key = crypto.scryptSync(secretPassphrase, salt, 32);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(keystore.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(keystore.tag, 'hex'));

    let decrypted = decipher.update(keystore.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Merkle Tree Root calculation for an array of transaction/leaf hashes
   */
  public static computeMerkleRoot(leaves: string[]): string {
    if (leaves.length === 0) {
      return CryptoService.sha256('empty-merkle-tree');
    }
    let currentLevel = leaves.map((leaf) => leaf.toLowerCase());

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const combined = currentLevel[i] + currentLevel[i + 1];
          nextLevel.push(CryptoService.sha256(combined));
        } else {
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
