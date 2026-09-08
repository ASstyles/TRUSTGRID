# TRUSTGRID Security Architecture & Threat Model

**Smart India Hackathon 2026** | **Problem Statement 26194**  
**Theme:** Blockchain & Cybersecurity | **Team:** TruthLens  
**Security Classification:** Enterprise Consortium DLT

---

## 1. Threat Model & Security Posture

TRUSTGRID operates in an adversarial environment where databases, network routers, and client devices cannot be unconditionally trusted.

### Core Adversarial Assumptions:
1. **Compromised Storage:** An adversary may obtain read/write access to the database layer (SQL injection, physical disk access, rogue DB admin).
2. **Network Man-in-the-Middle:** Adversaries may observe or delay network packets between ledger peers.
3. **Byzantine Node Corruption:** Up to $F = 1$ of $N = 3$ nodes may be taken over by an adversary who attempts to broadcast conflicting blocks or refuse to sign endorsements.
4. **Forged Credentials:** Dishonest actors may fabricate academic degrees, counterfeit drugs, or altered forensic logs.

---

## 2. Cryptographic Defense In Depth

```
  +-----------------------------------------------------------------------------------+
  |                               DEFENSE-IN-DEPTH MATRIX                             |
  +---------------------------+-------------------------------------------------------+
  | Layer                     | Defense Mechanism                                     |
  +---------------------------+-------------------------------------------------------+
  | 1. Document / Payload     | Canonical JSON Serialization (RFC 8785)               |
  |                           | SHA-256 Digesting & Ed25519 Digital Signatures        |
  +---------------------------+-------------------------------------------------------+
  | 2. Identity (DID)         | W3C Decentralized Identifiers (did:trustgrid:...)     |
  |                           | Deterministic Public Key Fingerprints & PKI Registry  |
  +---------------------------+-------------------------------------------------------+
  | 3. Privacy Preservation   | Salted Attribute Commitments: H(attr || val || salt)  |
  |                           | Cryptographic Predicate Range Proofs (e.g. GPA >= 3.5)|
  +---------------------------+-------------------------------------------------------+
  | 4. Distributed Ledger     | 3-Phase PBFT Consensus (Propose -> Endorse -> Commit) |
  |                           | Binary Merkle Trees & Cryptographic Block Links       |
  +---------------------------+-------------------------------------------------------+
  | 5. Multi-Node Quorum      | Multi-Signature Endorsement Certificates (Q >= 2/3)   |
  |                           | Dynamic Cross-Node Tamper Detection & Auto-Reconcile  |
  +---------------------------+-------------------------------------------------------+
```

### 2.1. Deterministic Canonical Serialization (RFC 8785)
To prevent hash malleability caused by JSON key reordering, whitespace differences, or floating-point formatting, all data payloads pass through `CryptoService.canonicalStringify()`:
- Object keys are recursively sorted alphabetically.
- All non-significant whitespace is stripped.
- Identical JSON objects always yield bit-for-bit identical SHA-256 digests.

### 2.2. Curve25519 (Ed25519) Digital Signatures
- Implemented natively via Node.js `crypto.sign('ed25519', ...)` and `crypto.verify('ed25519', ...)`.
- Resistance to side-channel attacks and collision vulnerabilities compared to RSA and standard ECDSA.
- Private keys can be protected with AES-256-GCM authenticated encryption at rest (`CryptoService.encryptPrivateKey`).

### 2.3. Privacy-Preserving Salted Commitments
In the Trust Passport module, sensitive attributes are protected using cryptographic commitments:
$$C = \text{SHA-256}(\text{attribute} \parallel \text{value} \parallel \text{salt})$$
- When proving a credential, the subject selectively reveals $(\text{value}, \text{salt})$ only for permitted attributes.
- For hidden attributes, only $C$ is published. Without the high-entropy salt, the adversary cannot brute-force small value sets (such as GPAs or birth dates).

---

## 3. Attack Scenarios & Mitigations

### 3.1. Attack: Direct Database Modification (Out-of-Band Tampering)
- **Scenario:** An insider updates the `metadata` column of a degree record in SQLite from `Rahul Sharma` to `Rohan Sharma`.
- **Defense:** During verification, `VerificationService` recalculates the canonical SHA-256 hash of the presented metadata. The recalculated hash diverges from the immutable `content_hash` recorded on the ledger. Verification immediately fails with `overallStatus = 'TAMPERED'` and a Trust Score of 0.

### 3.2. Attack: Previous Hash Link Breaking
- **Scenario:** An attacker alters a historical block in a node's local database.
- **Defense:** `verifyLocalChainIntegrity()` re-traces previous block hashes from height $0$ to height $H$. Any block whose `previousHash` does not match the preceding block's hash is flagged with `brokenHeight` and rejected.

### 3.3. Attack: Byzantine Minority Fork Attempt
- **Scenario:** A compromised validator node produces a conflicting block with fake transactions.
- **Defense:** The consortium requires $Q \ge 2$ validator endorsements from distinct DIDs. A single corrupted node ($F = 1$) cannot forge the signature of Node Alpha or Node Gamma. The invalid candidate is rejected during Phase 2 (Prepare/Endorse).

### 3.4. Attack: Counterfeit Provenance Injection
- **Scenario:** An attacker inserts a fake pharmaceutical transit step with a forged signature.
- **Defense:** `ProvenanceService.verifyChainContinuity()` traverses the custody graph. Each hop requires:
  1. $\text{fromDid}_{i} == \text{toDid}_{i-1}$
  2. The handoff signature must be cryptographically valid against the custodian DID's public key.
  3. Any broken link fails with `overallStatus = 'PROVENANCE_MISMATCH'`.

---

## 4. Cryptographic Test Suite Verification

The security invariants of TRUSTGRID are continuously validated across 112 automated unit and integration tests executing on every commit:
- `crypto.test.ts`: Ed25519, canonical serialization, AES-256-GCM keystore.
- `merkle.test.ts`: Merkle root derivation and binary branch proofs.
- `multi_node_consensus.test.ts`: PBFT proposal, prepare, and commit cycles.
- `node_fault_tolerance.test.ts`: Crash tolerance, network partitions, catchup sync.
- `ledger_tamper_detection.test.ts`: Deliberate mutation of block hashes, previous hashes, and transaction payloads.
- `passport_disclosure.test.ts`: Salted attribute commitments and range predicate proofs.
- `fabric_contract.test.ts`: Hyperledger Fabric 2.5 Go contract methods and state anchors.
- `provenance_tampering.test.ts`: Custody chain continuity and signature forgery detection.
