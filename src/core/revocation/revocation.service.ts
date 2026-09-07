import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
import { WalletService } from '../identity/wallet.service.js';

export interface RevocationRecord {
  trustObjectId: string;
  revokedByDid: string;
  revocationReason: string;
  revocationProof: string;
  blockchainTxId: string;
  revokedAt: string;
}

export class RevocationService {
  private db: DatabaseService;
  private blockchain: BlockchainAdapter;

  constructor(blockchain: BlockchainAdapter, db?: DatabaseService) {
    this.blockchain = blockchain;
    this.db = db || DatabaseService.getInstance();
  }

  /**
   * Cryptographically revokes a Trust Object on the blockchain trust ledger
   */
  public async revokeTrustObject(params: {
    trustObjectId: string;
    revokerDid: string;
    reason: string;
  }): Promise<RevocationRecord> {
    const timestamp = new Date().toISOString();
    const revocationStatement = `REVOKE-${params.trustObjectId}-${params.revokerDid}-${params.reason}-${timestamp}`;
    const signature = WalletService.signWithDid(params.revokerDid, revocationStatement);

    const proof = await this.blockchain.revokeProof({
      trustObjectId: params.trustObjectId,
      reason: params.reason,
      revokerDid: params.revokerDid,
      signature,
    });

    return {
      trustObjectId: params.trustObjectId,
      revokedByDid: params.revokerDid,
      revocationReason: params.reason,
      revocationProof: signature,
      blockchainTxId: proof.txId,
      revokedAt: timestamp,
    };
  }

  /**
   * Checks if an object has been revoked
   */
  public getRevocationStatus(trustObjectId: string): RevocationRecord | null {
    const row = this.db.getOne<any>(
      'SELECT * FROM revocations WHERE trust_object_id = ?',
      [trustObjectId]
    );

    if (!row) {
      return null;
    }

    return {
      trustObjectId: row.trust_object_id,
      revokedByDid: row.revoked_by_did,
      revocationReason: row.revocation_reason,
      revocationProof: row.revocation_proof,
      blockchainTxId: row.blockchain_tx_id,
      revokedAt: row.revoked_at,
    };
  }
}
