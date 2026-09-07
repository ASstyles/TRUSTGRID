import { DatabaseService } from '../../database/db.service.js';
import { BlockchainAdapter } from '../blockchain/blockchain.interface.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { DidService } from '../identity/did.service.js';
import { WalletService } from '../identity/wallet.service.js';
import { ProvenanceEvent, TrustObject, TrustObjectType, TrustObjectStatus } from './trust-object.types.js';

export class TrustObjectService {
  private db: DatabaseService;
  private blockchain: BlockchainAdapter;
  private didService: DidService;

  constructor(blockchain: BlockchainAdapter, db?: DatabaseService, didService?: DidService) {
    this.blockchain = blockchain;
    this.db = db || DatabaseService.getInstance();
    this.didService = didService || new DidService(this.db);
  }

  /**
   * Creates, signs, anchors, and persists a Trust Object under the Trust Object Protocol (TOP)
   */
  public async createTrustObject<T = any>(params: {
    objectType: TrustObjectType;
    subjectId: string;
    issuerId: string;
    ownerId?: string;
    metadata: T;
    offChainData?: Record<string, any>;
    expiresAt?: string | null;
    customId?: string;
  }): Promise<TrustObject<T>> {
    const trustObjectId = params.customId || `TO-${params.objectType.substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    const ownerId = params.ownerId || params.subjectId;

    // 1. Calculate deterministic canonical hash of metadata and immutable attributes
    const contentToHash = {
      trustObjectId,
      objectType: params.objectType,
      subjectId: params.subjectId,
      issuerId: params.issuerId,
      createdAt,
      expiresAt: params.expiresAt || null,
      metadata: params.metadata,
    };
    const contentHash = CryptoService.hashObject(contentToHash);

    // 2. Digitally sign the content hash with the issuer's private key
    const signature = WalletService.signWithDid(params.issuerId, contentHash);

    // 3. Anchor proof to blockchain trust ledger
    const proof = await this.blockchain.registerProof({
      trustObjectId,
      contentHash,
      issuerId: params.issuerId,
      ownerId,
      status: 'ACTIVE',
      signerDid: params.issuerId,
      signature,
      payload: {
        objectType: params.objectType,
        subjectId: params.subjectId,
      },
    });

    // 4. Persist Trust Object in database
    this.db.run(
      `INSERT OR REPLACE INTO trust_objects 
       (trust_object_id, object_type, subject_id, issuer_id, owner_id, created_at, expires_at, content_hash, signature, blockchain_tx_id, status, version, metadata, off_chain_data, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trustObjectId,
        params.objectType,
        params.subjectId,
        params.issuerId,
        ownerId,
        createdAt,
        params.expiresAt || null,
        contentHash,
        signature,
        proof.txId,
        'ACTIVE',
        1,
        JSON.stringify(params.metadata),
        params.offChainData ? JSON.stringify(params.offChainData) : null,
        Date.now(),
      ]
    );

    // 5. Initial provenance event
    const creationEvent: ProvenanceEvent = {
      eventId: `EV-${Date.now()}-001`,
      trustObjectId,
      eventType: 'CREATION',
      fromDid: params.issuerId,
      toDid: ownerId,
      location: 'TRUSTGRID Protocol Genesis',
      timestamp: createdAt,
      actionDescription: `Initial Trust Object creation and cryptographic anchor by ${params.issuerId}`,
      signature: WalletService.signWithDid(params.issuerId, `${trustObjectId}-CREATION-${createdAt}`),
      blockchainTxId: proof.txId,
      metadata: { initialProofHash: contentHash },
    };

    await this.blockchain.addProvenanceEvent(creationEvent);

    const trustObject: TrustObject<T> = {
      trustObjectId,
      objectType: params.objectType,
      subjectId: params.subjectId,
      issuerId: params.issuerId,
      ownerId,
      createdAt,
      expiresAt: params.expiresAt || null,
      contentHash,
      signature,
      blockchainTxId: proof.txId,
      status: 'ACTIVE',
      metadata: params.metadata,
      provenance: [creationEvent],
      version: 1,
    };

    return trustObject;
  }

  /**
   * Retrieves a Trust Object by ID with full provenance history
   */
  public async getTrustObject(trustObjectId: string): Promise<TrustObject | null> {
    const row = this.db.getOne<any>(
      'SELECT * FROM trust_objects WHERE trust_object_id = ?',
      [trustObjectId]
    );

    if (!row) {
      return null;
    }

    const provenanceRows = this.db.query<any>(
      'SELECT * FROM provenance_events WHERE trust_object_id = ? ORDER BY timestamp ASC',
      [trustObjectId]
    );

    const provenance: ProvenanceEvent[] = provenanceRows.map((r) => ({
      eventId: r.id,
      trustObjectId: r.trust_object_id,
      eventType: r.event_type,
      fromDid: r.from_did,
      toDid: r.to_did,
      location: r.location,
      coordinates: r.latitude && r.longitude ? { latitude: r.latitude, longitude: r.longitude } : undefined,
      timestamp: r.timestamp,
      actionDescription: r.action_description,
      signature: r.signature,
      blockchainTxId: r.blockchain_tx_id,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }));

    return {
      trustObjectId: row.trust_object_id,
      objectType: row.object_type,
      subjectId: row.subject_id,
      issuerId: row.issuer_id,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      contentHash: row.content_hash,
      signature: row.signature,
      blockchainTxId: row.blockchain_tx_id,
      status: row.status,
      metadata: JSON.parse(row.metadata),
      provenance,
      version: row.version,
    };
  }

  /**
   * Tamper simulation utility for testing and live SIH demonstrations
   * Modifies off-chain metadata attributes in the DB without updating blockchain proof
   */
  public simulateTamper(trustObjectId: string, modifiedMetadata: Record<string, any>): void {
    this.db.run(
      `UPDATE trust_objects 
       SET metadata = ?, status = 'TAMPERED' 
       WHERE trust_object_id = ?`,
      [JSON.stringify(modifiedMetadata), trustObjectId]
    );
  }
}
