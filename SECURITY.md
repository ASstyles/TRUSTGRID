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
* Audit logs are immutable and can be exported for forensic and judicial compliance under Section 65B of the Indian Evidence Act.
