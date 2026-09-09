# TRUSTGRID Security Specifications & Cryptographic Primitives
> **Smart India Hackathon 2026 — Problem Statement 26194**

---

## 1. Cryptographic Primitives & Specifications

TRUSTGRID employs modern, NIST/CISA-recommended cryptographic primitives with non-compromised mathematical foundations:

| Function | Primitive / Algorithm | Key / Output Size | Purpose |
|---|---|---|---|
| **Digital Signatures** | Ed25519 (Edwards-curve Digital Signature Algorithm) | 256-bit curve / 512-bit signatures | Non-repudiation, entity identity attestation, and custody transfer signing |
| **Content Hashing** | SHA-256 (Secure Hash Algorithm 2) | 256 bits (64-char hex string) | Canonical JSON payload hashing, document integrity, and Merkle tree leaves |
| **Merkle Tree Proofs** | Binary SHA-256 Hash Tree | 256 bits root | Transaction batching and cryptographic proof inclusion in blocks |
| **Local Keystore Encryption** | AES-256-GCM (Galois/Counter Mode) | 256-bit symmetric key, 96-bit IV, 128-bit auth tag | Encrypting private keys at rest in user/org demo wallets |
| **Key Derivation** | scrypt (CPU & memory-hard KDF) | 32-byte derived key | Deriving keystore master encryption keys from administrative passphrases |

---

## 2. Private Key & Keystore Management

1. **Zero Plaintext Storage:** Private keys are never stored in plaintext in the database or filesystem.
2. **Encrypted Keystores:** Private keys are encrypted using AES-256-GCM with unique initialization vectors (IV) and authentication tags before being written to persistent storage.
3. **Hardware Security Module (HSM) Preparedness:** The `WalletService` abstraction exposes a standard sign/verify interface, making it trivial to connect PKCS#11 hardware keys or enterprise KMS (AWS KMS / HashiCorp Vault) in production.

---

## 3. Off-Chain Data Protection & Privacy

* **Zero Sensitive Data On-Chain:** No personal identifiable information (PII), medical records, or classified forensic files ever touch the blockchain.
* **Cryptographic Anchoring:** Only the canonical content hash, issuer DID, block height, and timestamp are anchored to the blockchain.
* **Selective Disclosure in Trust Passport:** Users can share proof of degree authenticity without exposing sensitive fields like GPA, roll numbers, or home addresses.

---

## 4. Replay Protection & Deterministic Canonical Hashing

* **Key Ordering Canonicalization:** Standard JSON stringification is non-deterministic due to undefined key order across platforms. TRUSTGRID recursively sorts all object keys alphabetically prior to hashing.
* **Replay Protection:** Every transaction, custody handoff, and revocation includes unique nonces (`eventId`, `txId`, and millisecond ISO timestamps) signed by the sender, rendering copied signature replay attacks mathematically invalid.

---

## 5. Audit Logging & Compliance

* Every write operation (proof registration, custody handoff, revocation, tamper attempt, device baseline check) automatically records an entry in the normalized `audit_logs` table:
  * Actor DID
  * HTTP action & resource URI
  * Client IP address & User Agent
  * Success status & structured payload
* Audit logs are append-only and tamper-evident, exportable for forensic and judicial verification under Section 65B of the Indian Evidence Act.

---

## 6. Identity Key Custody Threat Model & Architecture

### 6.1 Current MVP Implementation (Honest Assessment)

In the current working MVP, identity key custody is structured to demonstrate end-to-end cryptographic flows while keeping local setup friction minimal. It is critical for hackathon evaluators to understand the exact scope of key protection:

* **What is encrypted:** Only Ed25519 private keys (`keyPair.privateKey`) are encrypted before storage.
* **What is NOT encrypted:** The remainder of the database is stored in standard plaintext relational SQLite tables (`trust_objects`, `credentials`, `provenance_events`, `local_blocks`, `audit_logs`). Data integrity is enforced via cryptographic SHA-256 content hashes, Merkle roots, and Ed25519 signatures rather than whole-database encryption.
* **Encryption Algorithm:** Symmetric AES-256-GCM (Galois/Counter Mode) with 256-bit derived keys (via `scrypt` using a random 16-byte salt), 96-bit initialization vectors (IV), and 128-bit authentication tags.
* **Storage Location:** Encrypted ciphertext, salt, IV, and auth tag are serialized into JSON and stored in the `wallet_keystores` table (`encrypted_keystore` column) and the `users` table (`encrypted_private_key` column).
* **Master Key Supply:** The master encryption secret is supplied via a single environment variable: `TRUSTGRID_WALLET_SECRET`. If not set, it defaults to a built-in development fallback secret (`'trustgrid-master-secure-demo-secret-2026'`).
* **Custody & Authority Model:** The server host process and system administrator currently hold and control the master encryption key. **Consequently, identity custody in the current MVP is centralized under the single host server authority.** It is not a decentralized key management system.

#### Threat Analysis of Current MVP:

| Threat Scenario | Impact on Current MVP | Mitigation in MVP |
|---|---|---|
| **Server / Host Compromise** | If an attacker acquires host filesystem or process environment access, they can extract `TRUSTGRID_WALLET_SECRET` and decrypt all stored private keys (including university issuers, manufacturers, and consortium notary). | Keys are not stored in plaintext; offline database dumps without the secret cannot be read immediately. |
| **Master Key Loss** | If `TRUSTGRID_WALLET_SECRET` is lost or corrupted, all stored private keys become cryptographically unrecoverable. Entities can no longer sign new credentials or authorize revocations. | Identities must be re-registered with newly generated keypairs; past on-chain proofs remain verifiable via public keys. |
| **Issuer Private Key Compromise** | If an adversary obtains an issuer's private key, they can generate fraudulent credentials that pass Ed25519 signature checks. | The DID controller publishes an on-chain `REVOKE_PROOF` transaction and updates the DID document status to invalidate compromised keys. |
| **Malicious Insider Admin** | A rogue system administrator with host access could bypass business logic and invoke `WalletService.signWithDid()` directly. | Audit logs record all signing requests with client IP; however, host-level insider threats remain possible in a single-server architecture. |

---

### 6.2 Conceptual Production Architecture: Threshold / Multi-Signature Key Custody
> **Status:** Production Roadmap / Conceptual Architecture *(Not implemented in current MVP)*

To transition from the current single-administrator custody model to institutional-grade decentralized trust, production deployments of TRUSTGRID will replace local server wallets with a **2-of-3 Threshold Signature Scheme (TSS)**:

```
                  ISSUER ORGANIZATION (e.g. University / Pharma Manufacturer)
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 │                              │                              │
                 ▼                              ▼                              ▼
      [ Key Share A ]                    [ Key Share B ]                [ Key Share C ]
   Institutional Registrar           Academic Dean / VP Quality       Independent Compliance Officer
   (Hardware Security Module)         (FIDO2 WebAuthn / YubiKey)         (Enterprise Cloud KMS)
                 │                              │                              │
                 └──────────────────────┬───────┴──────────────────────────────┘
                                        │
                           Threshold Quorum Approval
                           (≥ 2 of 3 Shares Required)
                                        │
                                        ▼
                        [ Ed25519 Threshold Signature ]
                       (FROST / Multi-Party Computation)
                                        │
                                        ▼
                   Anchored to TOP Consortium Blockchain Ledger
```

#### How Threshold Custody Hardens the Threat Model:

1. **Elimination of Single Server Compromise:**
   The full private key never exists in memory or on disk on any single machine. Key shares are generated using distributed key generation (DKG) and stored across physically isolated cryptographic hardware modules (HSM, YubiKey, and Cloud KMS).
2. **Mitigation of Insider Misuse & Rogue Issuance:**
   No single individual (e.g., a corrupt IT administrator or rogue clerk) can unilaterally issue a degree, approve a pharmaceutical batch, or alter evidence custody. Issuance requires multi-party approval by at least 2 distinct authorized custodians.
3. **Resilience Against Key Share Loss:**
   If any single key share is lost or corrupted (e.g., a hardware token failure), the remaining 2 custodians can still reach quorum, execute emergency re-sharing, and rotate the institutional key without service outage.
4. **Hardware-Enforced Non-Exportability:**
   Key shares are locked inside FIPS 140-2 Level 3 HSMs and non-exportable hardware security tokens (PKCS#11), preventing key exfiltration even under direct server root access.

