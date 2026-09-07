import { DatabaseService } from '../../database/db.service.js';
import { KeyPair } from '../crypto/crypto.service.js';
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
export declare class DidService {
    private db;
    constructor(db?: DatabaseService);
    /**
     * Generates a deterministic or random DID for a given sector and identifier
     */
    static formatDid(sector: 'edu' | 'sc' | 'legal' | 'sec' | 'usr' | 'sys', identifier: string): string;
    /**
     * Creates and registers a new DID Document with an Ed25519 keypair
     */
    createIdentity(params: {
        sector: 'edu' | 'sc' | 'legal' | 'sec' | 'usr' | 'sys';
        identifier: string;
        entityType: 'INDIVIDUAL' | 'ORGANIZATION' | 'DEVICE' | 'SERVICE';
        keyPair?: KeyPair;
        controllerDid?: string;
    }): {
        did: string;
        didDocument: DidDocument;
        keyPair: KeyPair;
    };
    /**
     * Resolves a DID Document from the identity store
     */
    resolveDid(did: string): DidDocument | null;
    /**
     * Look up public key directly for signature verification
     */
    getPublicKey(did: string): string | null;
}
