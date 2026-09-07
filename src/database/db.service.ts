import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: DatabaseSync;

  private constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.DATABASE_FILE || path.resolve(process.cwd(), 'trustgrid.db');
    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
  }

  public static getInstance(dbPath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  public static getTestInstance(): DatabaseService {
    return new DatabaseService(':memory:');
  }

  private initSchema() {
    this.db.exec(`
      -- Organizations
      CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          organization_type TEXT NOT NULL,
          jurisdiction TEXT NOT NULL,
          did TEXT UNIQUE NOT NULL,
          public_key TEXT NOT NULL,
          verification_status TEXT DEFAULT 'VERIFIED',
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_organizations_did ON organizations(did);
      CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);

      -- Users
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          organization_id TEXT REFERENCES organizations(id),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          user_type TEXT NOT NULL,
          did TEXT UNIQUE NOT NULL,
          public_key TEXT NOT NULL,
          encrypted_private_key TEXT,
          status TEXT DEFAULT 'ACTIVE',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_users_did ON users(did);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      -- Identities
      CREATE TABLE IF NOT EXISTS identities (
          did TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          controller_did TEXT NOT NULL,
          public_key TEXT NOT NULL,
          key_type TEXT DEFAULT 'Ed25519VerificationKey2020',
          verification_method TEXT NOT NULL,
          authentication_methods TEXT,
          service_endpoints TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_identities_controller ON identities(controller_did);

      -- Trust Objects (TOP core)
      CREATE TABLE IF NOT EXISTS trust_objects (
          trust_object_id TEXT PRIMARY KEY,
          object_type TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          issuer_id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT,
          content_hash TEXT NOT NULL,
          signature TEXT NOT NULL,
          blockchain_tx_id TEXT NOT NULL,
          status TEXT DEFAULT 'ACTIVE',
          version INTEGER DEFAULT 1,
          metadata TEXT NOT NULL,
          off_chain_data TEXT,
          created_at_epoch INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_trust_objects_type ON trust_objects(object_type);
      CREATE INDEX IF NOT EXISTS idx_trust_objects_subject ON trust_objects(subject_id);
      CREATE INDEX IF NOT EXISTS idx_trust_objects_issuer ON trust_objects(issuer_id);
      CREATE INDEX IF NOT EXISTS idx_trust_objects_owner ON trust_objects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_trust_objects_hash ON trust_objects(content_hash);
      CREATE INDEX IF NOT EXISTS idx_trust_objects_status ON trust_objects(status);

      -- Credentials (Education)
      CREATE TABLE IF NOT EXISTS credentials (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT UNIQUE NOT NULL REFERENCES trust_objects(trust_object_id),
          student_did TEXT NOT NULL,
          institution_did TEXT NOT NULL,
          credential_type TEXT NOT NULL,
          degree_name TEXT NOT NULL,
          major TEXT NOT NULL,
          graduation_year INTEGER NOT NULL,
          grade TEXT,
          serial_number TEXT UNIQUE NOT NULL,
          document_hash TEXT NOT NULL,
          issuance_date TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_credentials_student ON credentials(student_did);

      -- Documents
      CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT REFERENCES trust_objects(trust_object_id),
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          storage_path TEXT,
          encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
          uploader_did TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);

      -- Provenance Events
      CREATE TABLE IF NOT EXISTS provenance_events (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT NOT NULL REFERENCES trust_objects(trust_object_id),
          event_type TEXT NOT NULL,
          from_did TEXT,
          to_did TEXT,
          location TEXT,
          latitude REAL,
          longitude REAL,
          action_description TEXT NOT NULL,
          signature TEXT NOT NULL,
          blockchain_tx_id TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now')),
          metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_provenance_obj ON provenance_events(trust_object_id);

      -- Ownership Events
      CREATE TABLE IF NOT EXISTS ownership_events (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT NOT NULL REFERENCES trust_objects(trust_object_id),
          previous_owner_did TEXT,
          new_owner_did TEXT NOT NULL,
          transfer_reason TEXT,
          signature TEXT NOT NULL,
          blockchain_tx_id TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now'))
      );

      -- Revocations
      CREATE TABLE IF NOT EXISTS revocations (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT UNIQUE NOT NULL REFERENCES trust_objects(trust_object_id),
          revoked_by_did TEXT NOT NULL,
          revocation_reason TEXT NOT NULL,
          revocation_proof TEXT NOT NULL,
          blockchain_tx_id TEXT NOT NULL,
          revoked_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_revocations_obj ON revocations(trust_object_id);

      -- Blockchain Transactions
      CREATE TABLE IF NOT EXISTS blockchain_transactions (
          tx_id TEXT PRIMARY KEY,
          block_height INTEGER NOT NULL,
          block_hash TEXT NOT NULL,
          action_type TEXT NOT NULL,
          trust_object_id TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          signer_did TEXT NOT NULL,
          notary_signature TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now')),
          merkle_leaf TEXT NOT NULL,
          payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tx_block ON blockchain_transactions(block_height);
      CREATE INDEX IF NOT EXISTS idx_tx_obj ON blockchain_transactions(trust_object_id);

      -- Blockchain Blocks
      CREATE TABLE IF NOT EXISTS blockchain_blocks (
          height INTEGER PRIMARY KEY,
          previous_hash TEXT NOT NULL,
          merkle_root TEXT NOT NULL,
          block_hash TEXT NOT NULL,
          validator_did TEXT NOT NULL,
          validator_signature TEXT NOT NULL,
          tx_count INTEGER NOT NULL,
          timestamp TEXT NOT NULL
      );

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_did TEXT NOT NULL,
          action TEXT NOT NULL,
          target_resource TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          details TEXT,
          timestamp TEXT DEFAULT (datetime('now'))
      );

      -- Security Events (Cybersecurity)
      CREATE TABLE IF NOT EXISTS security_events (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          trust_object_id TEXT REFERENCES trust_objects(trust_object_id),
          event_severity TEXT NOT NULL,
          event_type TEXT NOT NULL,
          expected_hash TEXT NOT NULL,
          observed_hash TEXT NOT NULL,
          description TEXT NOT NULL,
          reported_by_did TEXT NOT NULL,
          remediated INTEGER DEFAULT 0,
          blockchain_tx_id TEXT,
          timestamp TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_security_device ON security_events(device_id);

      -- Risk Events
      CREATE TABLE IF NOT EXISTS risk_events (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT,
          actor_did TEXT,
          risk_score INTEGER NOT NULL,
          risk_level TEXT NOT NULL,
          primary_factors TEXT NOT NULL,
          verification_attempt_count INTEGER DEFAULT 1,
          anomaly_type TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_risk_obj ON risk_events(trust_object_id);

      -- Verification Events
      CREATE TABLE IF NOT EXISTS verification_events (
          id TEXT PRIMARY KEY,
          trust_object_id TEXT NOT NULL,
          verifier_did TEXT,
          result_status TEXT NOT NULL,
          presented_hash TEXT NOT NULL,
          on_chain_hash TEXT NOT NULL,
          signature_valid INTEGER NOT NULL,
          blockchain_proof_valid INTEGER NOT NULL,
          risk_score INTEGER DEFAULT 0,
          client_ip TEXT,
          timestamp TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_verification_obj ON verification_events(trust_object_id);
    `);
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public run(sql: string, params: any[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  public getOne<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) || null;
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public close(): void {
    this.db.close();
  }
}
