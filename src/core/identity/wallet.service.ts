import { CryptoService, EncryptedKeystore, KeyPair } from '../crypto/crypto.service.js';

export interface WalletIdentity {
  did: string;
  name: string;
  role: string;
  publicKeyPem: string;
  encryptedPrivateKey: EncryptedKeystore;
}

export class WalletService {
  private static masterSecret: string = process.env.TRUSTGRID_WALLET_SECRET || 'trustgrid-master-secure-demo-secret-2026';
  private static memoryWallet: Map<string, KeyPair> = new Map();

  /**
   * Encrypts and securely stores a keypair for an entity in demo wallet
   */
  public static storeKeyPair(did: string, keyPair: KeyPair): EncryptedKeystore {
    // Keep in memory for fast execution in demo mode
    this.memoryWallet.set(did, keyPair);
    return CryptoService.encryptPrivateKey(keyPair.privateKey, this.masterSecret);
  }

  /**
   * Retrieves private key for signing, either from active session or decrypting keystore
   */
  public static getPrivateKey(did: string, encryptedKeystore?: EncryptedKeystore): string | null {
    if (this.memoryWallet.has(did)) {
      return this.memoryWallet.get(did)!.privateKey;
    }
    if (encryptedKeystore) {
      try {
        return CryptoService.decryptPrivateKey(encryptedKeystore, this.masterSecret);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Convenience helper to sign a message using an identity's managed wallet
   */
  public static signWithDid(did: string, data: string | Buffer): string {
    const privateKey = this.getPrivateKey(did);
    if (!privateKey) {
      throw new Error(`Wallet private key not available for identity DID: ${did}`);
    }
    return CryptoService.sign(data, privateKey);
  }
}
