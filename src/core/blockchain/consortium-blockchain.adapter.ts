import { DatabaseService } from '../../database/db.service.js';
import { CryptoService, KeyPair } from '../crypto/crypto.service.js';
import { BlockchainProof, ProvenanceEvent, TrustObjectStatus } from '../trust-object/trust-object.types.js';
import { Block, BlockchainAdapter, BlockchainTransaction } from './blockchain.interface.js';
import { WalletService } from '../identity/wallet.service.js';

export class ConsortiumBlockchainAdapter implements BlockchainAdapter {
  public readonly name = 'Consortium Notary Ledger';
  public readonly networkType = 'CONSORTIUM_LEDGER' as const;
  private db: DatabaseService;
  private notaryDid: string = 'did:trustgrid:sys:consortium-notary';
  private notaryKeyPair: KeyPair;
  private blocks: Block[] = [];
  private pendingTransactions: BlockchainTransaction[] = [];
  private currentHeight: number = 0;

  constructor(db?: DatabaseService) {
    this.db = db || DatabaseService.getInstance();
    
    // Check if notary identity exists in DB, or create one
    const existingNotary = this.db.getOne<any>('SELECT * FROM identities WHERE did = ?', [this.notaryDid]);
    if (existingNotary && WalletService.getPrivateKey(this.notaryDid)) {
      this.notaryKeyPair = {
        publicKey: existingNotary.public_key,
        privateKey: WalletService.getPrivateKey(this.notaryDid)!,
      };
    } else {
      this.notaryKeyPair = CryptoService.generateEd25519KeyPair();
      WalletService.storeKeyPair(this.notaryDid, this.notaryKeyPair);
      this.db.run(
        `INSERT OR REPLACE INTO identities 
         (did, entity_type, controller_did, public_key, key_type, verification_method, authentication_methods, service_endpoints, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.notaryDid,
          'SERVICE',
          this.notaryDid,
          this.notaryKeyPair.publicKey,
          'Ed25519VerificationKey2020',
          `${this.notaryDid}#key-1`,
          JSON.stringify([`${this.notaryDid}#key-1`]),
          JSON.stringify({}),
          new Date().toISOString(),
        ]
      );
    }

    this.loadOrInitLedger();
  }

  private loadOrInitLedger(): void {
    const blockRows = this.db.query<any>('SELECT * FROM blockchain_blocks ORDER BY height ASC');
    if (blockRows.length > 0) {
      this.blocks = blockRows.map((r) => {
        const txRows = this.db.query<any>('SELECT * FROM blockchain_transactions WHERE block_height = ?', [r.height]);
        const transactions: BlockchainTransaction[] = txRows.map((tx) => ({
          txId: tx.tx_id,
          blockHeight: tx.block_height,
          blockHash: tx.block_hash,
          actionType: tx.action_type,
          trustObjectId: tx.trust_object_id,
          contentHash: tx.content_hash,
          signerDid: tx.signer_did,
          notarySignature: tx.notary_signature,
          timestamp: tx.timestamp,
          merkleLeaf: tx.merkle_leaf,
          payload: JSON.parse(tx.payload),
        }));

        return {
          header: {
            height: r.height,
            previousHash: r.previous_hash,
            merkleRoot: r.merkle_root,
            timestamp: r.timestamp,
            validatorDid: r.validator_did,
            txCount: r.tx_count,
          },
          blockHash: r.block_hash,
          validatorSignature: r.validator_signature,
          transactions,
        };
      });
      this.currentHeight = this.blocks[this.blocks.length - 1].header.height;
    } else {
      this.initGenesisBlock();
    }
  }

  private initGenesisBlock(): void {
    const genesisHeader = {
      height: 0,
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      merkleRoot: CryptoService.sha256('genesis-merkle-root'),
      timestamp: '2026-01-01T00:00:00.000Z',
      validatorDid: this.notaryDid,
      txCount: 0,
    };
    const blockHash = CryptoService.sha256(CryptoService.canonicalStringify(genesisHeader));
    const validatorSignature = CryptoService.sign(blockHash, this.notaryKeyPair.privateKey);

    const genesisBlock: Block = {
      header: genesisHeader,
      blockHash,
      validatorSignature,
      transactions: [],
    };

    this.blocks.push(genesisBlock);
    this.currentHeight = 0;

    this.db.run(
      `INSERT OR REPLACE INTO blockchain_blocks 
       (height, previous_hash, merkle_root, block_hash, validator_did, validator_signature, tx_count, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [0, genesisHeader.previousHash, genesisHeader.merkleRoot, blockHash, this.notaryDid, validatorSignature, 0, genesisHeader.timestamp]
    );
  }

  private mineBlock(transactions: BlockchainTransaction[]): Block {
    const previousBlock = this.blocks[this.blocks.length - 1];
    this.currentHeight += 1;

    const merkleLeaves = transactions.map((t) => t.merkleLeaf);
    const merkleRoot = CryptoService.computeMerkleRoot(merkleLeaves);
    const timestamp = new Date().toISOString();

    const header = {
      height: this.currentHeight,
      previousHash: previousBlock.blockHash,
      merkleRoot,
      timestamp,
      validatorDid: this.notaryDid,
      txCount: transactions.length,
    };

    const blockHash = CryptoService.sha256(CryptoService.canonicalStringify(header));
    const validatorSignature = CryptoService.sign(blockHash, this.notaryKeyPair.privateKey);

    const block: Block = {
      header,
      blockHash,
      validatorSignature,
      transactions,
    };

    this.blocks.push(block);

    // Save block to blockchain_blocks table
    this.db.run(
      `INSERT OR REPLACE INTO blockchain_blocks 
       (height, previous_hash, merkle_root, block_hash, validator_did, validator_signature, tx_count, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.currentHeight, header.previousHash, merkleRoot, blockHash, this.notaryDid, validatorSignature, transactions.length, timestamp]
    );

    // Save transactions in the database
    for (const tx of transactions) {
      tx.blockHeight = this.currentHeight;
      this.db.run(
        `INSERT OR REPLACE INTO blockchain_transactions 
         (tx_id, block_height, block_hash, action_type, trust_object_id, content_hash, signer_did, notary_signature, timestamp, merkle_leaf, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.txId,
          this.currentHeight,
          blockHash,
          tx.actionType,
          tx.trustObjectId,
          tx.contentHash,
          tx.signerDid,
          tx.notarySignature,
          tx.timestamp,
          tx.merkleLeaf,
          JSON.stringify(tx.payload),
        ]
      );
    }

    return block;
  }

  public async registerProof(params: {
    trustObjectId: string;
    contentHash: string;
    issuerId: string;
    ownerId: string;
    status: TrustObjectStatus;
    signerDid: string;
    signature: string;
    payload?: Record<string, any>;
  }): Promise<BlockchainProof> {
    const txId = '0x' + CryptoService.sha256(params.trustObjectId + params.contentHash + Date.now().toString());
    const merkleLeaf = CryptoService.sha256(txId + params.contentHash + params.status);
    const timestamp = new Date().toISOString();
    const notarySignature = CryptoService.sign(merkleLeaf, this.notaryKeyPair.privateKey);

    const transaction: BlockchainTransaction = {
      txId,
      blockHeight: this.currentHeight + 1,
      actionType: 'REGISTER_PROOF',
      trustObjectId: params.trustObjectId,
      contentHash: params.contentHash,
      signerDid: params.signerDid,
      notarySignature,
      timestamp,
      merkleLeaf,
      payload: params.payload || {
        issuerId: params.issuerId,
        ownerId: params.ownerId,
        status: params.status,
      },
    };

    const block = this.mineBlock([transaction]);

    return {
      trustObjectId: params.trustObjectId,
      contentHash: params.contentHash,
      issuerId: params.issuerId,
      ownerId: params.ownerId,
      status: params.status,
      blockHeight: block.header.height,
      blockHash: block.blockHash,
      txId,
      timestamp,
      merkleLeaf,
      merkleRoot: block.header.merkleRoot,
      notarySignature,
      previousBlockHash: block.header.previousHash,
    };
  }

  public async verifyProof(trustObjectId: string, expectedHash: string): Promise<{
    valid: boolean;
    proof: BlockchainProof | null;
    reason?: string;
  }> {
    const proof = await this.getProof(trustObjectId);
    if (!proof) {
      return {
        valid: false,
        proof: null,
        reason: 'Proof not found in blockchain ledger',
      };
    }

    if (proof.contentHash !== expectedHash) {
      return {
        valid: false,
        proof,
        reason: `Hash mismatch: Ledger registered hash is ${proof.contentHash}, but presented content hash is ${expectedHash}`,
      };
    }

    if (proof.status === 'REVOKED') {
      return {
        valid: false,
        proof,
        reason: 'Object has been revoked on the blockchain ledger',
      };
    }

    // Verify notary signature
    const isNotarySigValid = CryptoService.verify(
      proof.merkleLeaf,
      proof.notarySignature,
      this.notaryKeyPair.publicKey
    );

    if (!isNotarySigValid) {
      return {
        valid: false,
        proof,
        reason: 'Invalid ledger notary signature',
      };
    }

    return {
      valid: true,
      proof,
    };
  }

  public async revokeProof(params: {
    trustObjectId: string;
    reason: string;
    revokerDid: string;
    signature: string;
  }): Promise<BlockchainProof> {
    const existingProof = await this.getProof(params.trustObjectId);
    if (!existingProof) {
      throw new Error(`Cannot revoke proof: object ${params.trustObjectId} not found on ledger`);
    }

    const txId = '0x' + CryptoService.sha256(params.trustObjectId + 'REVOKED' + Date.now().toString());
    const merkleLeaf = CryptoService.sha256(txId + existingProof.contentHash + 'REVOKED');
    const timestamp = new Date().toISOString();
    const notarySignature = CryptoService.sign(merkleLeaf, this.notaryKeyPair.privateKey);

    const transaction: BlockchainTransaction = {
      txId,
      blockHeight: this.currentHeight + 1,
      actionType: 'REVOKE_PROOF',
      trustObjectId: params.trustObjectId,
      contentHash: existingProof.contentHash,
      signerDid: params.revokerDid,
      notarySignature,
      timestamp,
      merkleLeaf,
      payload: {
        reason: params.reason,
        revokedBy: params.revokerDid,
        revokerSignature: params.signature,
      },
    };

    const block = this.mineBlock([transaction]);

    // Record revocation in DB
    this.db.run(
      `INSERT OR REPLACE INTO revocations (id, trust_object_id, revoked_by_did, revocation_reason, revocation_proof, blockchain_tx_id, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'REV-' + Date.now(),
        params.trustObjectId,
        params.revokerDid,
        params.reason,
        params.signature,
        txId,
        timestamp,
      ]
    );

    // Update trust_object status in DB
    this.db.run(`UPDATE trust_objects SET status = 'REVOKED' WHERE trust_object_id = ?`, [params.trustObjectId]);

    return {
      ...existingProof,
      status: 'REVOKED',
      blockHeight: block.header.height,
      blockHash: block.blockHash,
      txId,
      timestamp,
      merkleLeaf,
      merkleRoot: block.header.merkleRoot,
      notarySignature,
      previousBlockHash: block.header.previousHash,
    };
  }

  public async addProvenanceEvent(event: ProvenanceEvent): Promise<{
    txId: string;
    blockHeight: number;
    blockHash: string;
  }> {
    const txId = '0x' + CryptoService.sha256(event.eventId + event.trustObjectId + Date.now().toString());
    const merkleLeaf = CryptoService.sha256(txId + event.actionDescription + event.timestamp);
    const timestamp = new Date().toISOString();
    const notarySignature = CryptoService.sign(merkleLeaf, this.notaryKeyPair.privateKey);

    const transaction: BlockchainTransaction = {
      txId,
      blockHeight: this.currentHeight + 1,
      actionType: 'RECORD_PROVENANCE',
      trustObjectId: event.trustObjectId,
      contentHash: merkleLeaf,
      signerDid: event.fromDid || this.notaryDid,
      notarySignature,
      timestamp,
      merkleLeaf,
      payload: {
        ...event,
        anchoredTxId: txId,
      },
    };

    const block = this.mineBlock([transaction]);

    // Store in DB
    this.db.run(
      `INSERT OR REPLACE INTO provenance_events 
       (id, trust_object_id, event_type, from_did, to_did, location, latitude, longitude, action_description, signature, blockchain_tx_id, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.trustObjectId,
        event.eventType,
        event.fromDid || null,
        event.toDid || null,
        event.location || null,
        event.coordinates?.latitude || null,
        event.coordinates?.longitude || null,
        event.actionDescription,
        event.signature,
        txId,
        event.timestamp,
        JSON.stringify(event.metadata || {}),
      ]
    );

    return {
      txId,
      blockHeight: block.header.height,
      blockHash: block.blockHash,
    };
  }

  public async getProof(trustObjectId: string): Promise<BlockchainProof | null> {
    // Check latest transaction in memory or DB
    const row = this.db.getOne<{
      tx_id: string;
      block_height: number;
      block_hash: string;
      content_hash: string;
      signer_did: string;
      notary_signature: string;
      timestamp: string;
      merkle_leaf: string;
      payload: string;
    }>(
      `SELECT * FROM blockchain_transactions 
       WHERE trust_object_id = ? 
       AND action_type IN ('REGISTER_PROOF', 'REVOKE_PROOF', 'UPDATE_STATUS')
       ORDER BY block_height DESC LIMIT 1`,
      [trustObjectId]
    );

    if (!row) {
      return null;
    }

    const payload = JSON.parse(row.payload);
    const block = this.blocks.find((b) => b.header.height === row.block_height);

    return {
      trustObjectId,
      contentHash: row.content_hash,
      issuerId: payload.issuerId || row.signer_did,
      ownerId: payload.ownerId || row.signer_did,
      status: payload.status || (payload.reason ? 'REVOKED' : 'ACTIVE'),
      blockHeight: row.block_height,
      blockHash: row.block_hash,
      txId: row.tx_id,
      timestamp: row.timestamp,
      merkleLeaf: row.merkle_leaf,
      merkleRoot: block ? block.header.merkleRoot : CryptoService.sha256('merkle-root'),
      notarySignature: row.notary_signature,
      previousBlockHash: block ? block.header.previousHash : '00000000000000000000000000000000',
    };
  }

  public async getTransaction(txId: string): Promise<BlockchainTransaction | null> {
    const row = this.db.getOne<any>(
      'SELECT * FROM blockchain_transactions WHERE tx_id = ?',
      [txId]
    );
    if (!row) return null;

    return {
      txId: row.tx_id,
      blockHeight: row.block_height,
      blockHash: row.block_hash,
      actionType: row.action_type,
      trustObjectId: row.trust_object_id,
      contentHash: row.content_hash,
      signerDid: row.signer_did,
      notarySignature: row.notary_signature,
      timestamp: row.timestamp,
      merkleLeaf: row.merkle_leaf,
      payload: JSON.parse(row.payload),
    };
  }

  public async getAuditLedger(): Promise<Block[]> {
    return this.blocks;
  }

  public async verifyLedgerIntegrity(): Promise<{
    valid: boolean;
    totalBlocks: number;
    verifiedTxs: number;
    reason?: string;
  }> {
    let verifiedTxs = 0;

    for (let i = 1; i < this.blocks.length; i++) {
      const prevBlock = this.blocks[i - 1];
      const currBlock = this.blocks[i];

      // 1. Check previous hash continuity
      if (currBlock.header.previousHash !== prevBlock.blockHash) {
        return {
          valid: false,
          totalBlocks: this.blocks.length,
          verifiedTxs,
          reason: `Block ${i} previousHash does not match Block ${i - 1} blockHash`,
        };
      }

      // 2. Check header hash
      const expectedBlockHash = CryptoService.sha256(CryptoService.canonicalStringify(currBlock.header));
      if (expectedBlockHash !== currBlock.blockHash) {
        return {
          valid: false,
          totalBlocks: this.blocks.length,
          verifiedTxs,
          reason: `Block ${i} header hash validation failed`,
        };
      }

      // 3. Verify notary signature
      const validSig = CryptoService.verify(
        currBlock.blockHash,
        currBlock.validatorSignature,
        this.notaryKeyPair.publicKey
      );
      if (!validSig) {
        return {
          valid: false,
          totalBlocks: this.blocks.length,
          verifiedTxs,
          reason: `Block ${i} validator signature is invalid`,
        };
      }

      verifiedTxs += currBlock.transactions.length;
    }

    return {
      valid: true,
      totalBlocks: this.blocks.length,
      verifiedTxs,
    };
  }
}
