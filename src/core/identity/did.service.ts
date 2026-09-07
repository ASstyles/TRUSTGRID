import { DatabaseService } from '../../database/db.service.js';
import { CryptoService, KeyPair } from '../crypto/crypto.service.js';

export interface DidDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyPem: string;
  }>;
  authentication: string[];
  assertionMethod: string[];
  created: string;
}

export class DidService {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || DatabaseService.getInstance();
  }

  /**
   * Generates a deterministic or random DID for a given sector and identifier
   */
  public static formatDid(sector: 'edu' | 'sc' | 'legal' | 'sec' | 'usr' | 'sys', identifier: string): string {
    const sanitized = identifier.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    return `did:trustgrid:${sector}:${sanitized}`;
  }

  /**
   * Creates and registers a new DID Document with an Ed25519 keypair
   */
  public createIdentity(params: {
    sector: 'edu' | 'sc' | 'legal' | 'sec' | 'usr' | 'sys';
    identifier: string;
    entityType: 'INDIVIDUAL' | 'ORGANIZATION' | 'DEVICE' | 'SERVICE';
    keyPair?: KeyPair;
    controllerDid?: string;
  }): { did: string; didDocument: DidDocument; keyPair: KeyPair } {
    const did = DidService.formatDid(params.sector, params.identifier);
    const keyPair = params.keyPair || CryptoService.generateEd25519KeyPair();
    const controller = params.controllerDid || did;
    const keyId = `${did}#key-1`;

    const didDocument: DidDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: did,
      controller,
      verificationMethod: [
        {
          id: keyId,
          type: 'Ed25519VerificationKey2020',
          controller,
          publicKeyPem: keyPair.publicKey,
        },
      ],
      authentication: [keyId],
      assertionMethod: [keyId],
      created: new Date().toISOString(),
    };

    // Store in DB
    this.db.run(
      `INSERT OR REPLACE INTO identities 
       (did, entity_type, controller_did, public_key, key_type, verification_method, authentication_methods, service_endpoints, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        did,
        params.entityType,
        controller,
        keyPair.publicKey,
        'Ed25519VerificationKey2020',
        keyId,
        JSON.stringify([keyId]),
        JSON.stringify({}),
        didDocument.created,
      ]
    );

    return { did, didDocument, keyPair };
  }

  /**
   * Resolves a DID Document from the identity store
   */
  public resolveDid(did: string): DidDocument | null {
    const row = this.db.getOne<{
      did: string;
      controller_did: string;
      public_key: string;
      key_type: string;
      verification_method: string;
      created_at: string;
      revoked_at: string | null;
    }>('SELECT * FROM identities WHERE did = ?', [did]);

    if (!row || row.revoked_at) {
      return null;
    }

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: row.did,
      controller: row.controller_did,
      verificationMethod: [
        {
          id: row.verification_method,
          type: row.key_type,
          controller: row.controller_did,
          publicKeyPem: row.public_key,
        },
      ],
      authentication: [row.verification_method],
      assertionMethod: [row.verification_method],
      created: row.created_at,
    };
  }

  /**
   * Look up public key directly for signature verification
   */
  public getPublicKey(did: string): string | null {
    const doc = this.resolveDid(did);
    if (!doc || doc.verificationMethod.length === 0) {
      return null;
    }
    return doc.verificationMethod[0].publicKeyPem;
  }
}
