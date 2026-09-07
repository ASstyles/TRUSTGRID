-- TRUSTGRID Database Schema (PostgreSQL / ANSI SQL)
-- Normalized architecture for decentralized trust infrastructure
-- Smart India Hackathon 2026 - Problem Statement 26194

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(64) NOT NULL, -- 'UNIVERSITY' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'LAW_ENFORCEMENT' | 'CYBERSECURITY_AGENCY' | 'GOVERNMENT'
    jurisdiction VARCHAR(128) NOT NULL,
    did VARCHAR(128) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    verification_status VARCHAR(32) DEFAULT 'VERIFIED', -- 'PENDING' | 'VERIFIED' | 'SUSPENDED'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_did ON organizations(did);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);

-- 2. Users / Actors
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(64) NOT NULL, -- 'STUDENT' | 'ISSUER' | 'VERIFIER' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'INVESTIGATOR' | 'SECURITY_ADMIN' | 'SYSTEM_ADMIN'
    did VARCHAR(128) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT, -- Encrypted demo wallet keystore
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_did ON users(did);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- 3. Decentralized Identities (DIDs)
CREATE TABLE IF NOT EXISTS identities (
    did VARCHAR(128) PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL, -- 'INDIVIDUAL' | 'ORGANIZATION' | 'DEVICE' | 'SERVICE'
    controller_did VARCHAR(128) NOT NULL,
    public_key TEXT NOT NULL,
    key_type VARCHAR(32) DEFAULT 'Ed25519VerificationKey2020',
    verification_method VARCHAR(128) NOT NULL,
    authentication_methods JSONB,
    service_endpoints JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_identities_controller ON identities(controller_did);

-- 4. Trust Objects (Core Protocol Entity)
CREATE TABLE IF NOT EXISTS trust_objects (
    trust_object_id VARCHAR(128) PRIMARY KEY,
    object_type VARCHAR(32) NOT NULL, -- 'CREDENTIAL' | 'PRODUCT' | 'EVIDENCE' | 'DEVICE' | 'DOCUMENT' | 'IDENTITY' | 'TRANSACTION'
    subject_id VARCHAR(128) NOT NULL,
    issuer_id VARCHAR(128) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hex
    signature TEXT NOT NULL,          -- Ed25519 base64/hex signature
    blockchain_tx_id VARCHAR(66) NOT NULL, -- 0x...
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'TAMPERED'
    version INT DEFAULT 1,
    metadata JSONB NOT NULL,
    off_chain_data JSONB,             -- Encrypted / restricted sensitive attributes kept off-chain
    created_at_epoch BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trust_objects_type ON trust_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_trust_objects_subject ON trust_objects(subject_id);
CREATE INDEX IF NOT EXISTS idx_trust_objects_issuer ON trust_objects(issuer_id);
CREATE INDEX IF NOT EXISTS idx_trust_objects_owner ON trust_objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_trust_objects_hash ON trust_objects(content_hash);
CREATE INDEX IF NOT EXISTS idx_trust_objects_status ON trust_objects(status);
CREATE INDEX IF NOT EXISTS idx_trust_objects_tx ON trust_objects(blockchain_tx_id);

-- 5. Academic Credentials (Sector: Education)
CREATE TABLE IF NOT EXISTS credentials (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128) UNIQUE NOT NULL REFERENCES trust_objects(trust_object_id) ON DELETE CASCADE,
    student_did VARCHAR(128) NOT NULL,
    institution_did VARCHAR(128) NOT NULL,
    credential_type VARCHAR(64) NOT NULL, -- 'DEGREE' | 'TRANSCRIPT' | 'CERTIFICATE'
    degree_name VARCHAR(255) NOT NULL,
    major VARCHAR(255) NOT NULL,
    graduation_year INT NOT NULL,
    grade VARCHAR(32),
    serial_number VARCHAR(128) UNIQUE NOT NULL,
    document_hash VARCHAR(64) NOT NULL,
    issuance_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credentials_student ON credentials(student_did);
CREATE INDEX IF NOT EXISTS idx_credentials_inst ON credentials(institution_did);

-- 6. Documents & Raw Evidence Off-Chain References
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128) REFERENCES trust_objects(trust_object_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    storage_path TEXT,
    encryption_algorithm VARCHAR(32) DEFAULT 'AES-256-GCM',
    uploader_did VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);

-- 7. Provenance & Custody Events (Universal Chain of Custody)
CREATE TABLE IF NOT EXISTS provenance_events (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128) NOT NULL REFERENCES trust_objects(trust_object_id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL, -- 'CREATION' | 'TRANSFER' | 'INSPECTION' | 'LOCATION_UPDATE' | 'CUSTODY_HANDOFF' | 'STATUS_CHANGE'
    from_did VARCHAR(128),
    to_did VARCHAR(128),
    location VARCHAR(255),
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    action_description TEXT NOT NULL,
    signature TEXT NOT NULL,
    blockchain_tx_id VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_provenance_obj ON provenance_events(trust_object_id);
CREATE INDEX IF NOT EXISTS idx_provenance_to ON provenance_events(to_did);
CREATE INDEX IF NOT EXISTS idx_provenance_from ON provenance_events(from_did);

-- 8. Ownership Events (Supply Chain & Physical Asset Registries)
CREATE TABLE IF NOT EXISTS ownership_events (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128) NOT NULL REFERENCES trust_objects(trust_object_id) ON DELETE CASCADE,
    previous_owner_did VARCHAR(128),
    new_owner_did VARCHAR(128) NOT NULL,
    transfer_reason VARCHAR(255),
    signature TEXT NOT NULL,
    blockchain_tx_id VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Revocations
CREATE TABLE IF NOT EXISTS revocations (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128) UNIQUE NOT NULL REFERENCES trust_objects(trust_object_id) ON DELETE CASCADE,
    revoked_by_did VARCHAR(128) NOT NULL,
    revocation_reason TEXT NOT NULL,
    revocation_proof TEXT NOT NULL,
    blockchain_tx_id VARCHAR(66) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revocations_obj ON revocations(trust_object_id);

-- 10. Blockchain Ledger Transactions & Blocks
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    tx_id VARCHAR(66) PRIMARY KEY,
    block_height BIGINT NOT NULL,
    block_hash VARCHAR(64) NOT NULL,
    action_type VARCHAR(64) NOT NULL, -- 'REGISTER_PROOF' | 'RECORD_PROVENANCE' | 'REVOKE_PROOF' | 'UPDATE_STATUS'
    trust_object_id VARCHAR(128) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    signer_did VARCHAR(128) NOT NULL,
    notary_signature TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    merkle_leaf VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_block ON blockchain_transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_tx_obj ON blockchain_transactions(trust_object_id);

-- 11. Audit Logs (Immutable compliance trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor_did VARCHAR(128) NOT NULL,
    action VARCHAR(128) NOT NULL,
    target_resource VARCHAR(128) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_did);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- 12. Security Events (Cybersecurity Sector: Device & File Integrity)
CREATE TABLE IF NOT EXISTS security_events (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(128) NOT NULL,
    trust_object_id VARCHAR(128) REFERENCES trust_objects(trust_object_id),
    event_severity VARCHAR(32) NOT NULL, -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    event_type VARCHAR(64) NOT NULL, -- 'BASELINE_VIOLATION' | 'UNAUTHORIZED_MODIFICATION' | 'TAMPER_DETECTED' | 'UNAUTHORIZED_LOGIN'
    expected_hash VARCHAR(64) NOT NULL,
    observed_hash VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    reported_by_did VARCHAR(128) NOT NULL,
    remediated BOOLEAN DEFAULT FALSE,
    blockchain_tx_id VARCHAR(66),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_device ON security_events(device_id);
CREATE INDEX IF NOT EXISTS idx_security_severity ON security_events(event_severity);

-- 13. Risk Events (Explainable Risk Engine)
CREATE TABLE IF NOT EXISTS risk_events (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128),
    actor_did VARCHAR(128),
    risk_score INT NOT NULL, -- 0 - 100
    risk_level VARCHAR(32) NOT NULL, -- 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
    primary_factors JSONB NOT NULL, -- Array of explainable risk reasons with weights
    verification_attempt_count INT DEFAULT 1,
    anomaly_type VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_obj ON risk_events(trust_object_id);
CREATE INDEX IF NOT EXISTS idx_risk_score ON risk_events(risk_score);

-- 14. Verification Events (Verification audit history)
CREATE TABLE IF NOT EXISTS verification_events (
    id VARCHAR(64) PRIMARY KEY,
    trust_object_id VARCHAR(128) NOT NULL,
    verifier_did VARCHAR(128),
    result_status VARCHAR(32) NOT NULL, -- 'AUTHENTIC' | 'TAMPERED' | 'REVOKED' | 'EXPIRED' | 'INVALID_SIGNATURE'
    presented_hash VARCHAR(64) NOT NULL,
    on_chain_hash VARCHAR(64) NOT NULL,
    signature_valid BOOLEAN NOT NULL,
    blockchain_proof_valid BOOLEAN NOT NULL,
    risk_score INT DEFAULT 0,
    client_ip VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_obj ON verification_events(trust_object_id);
