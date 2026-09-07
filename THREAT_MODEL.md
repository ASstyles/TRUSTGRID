# TRUSTGRID Threat Model & Attack Mitigation Matrix
> **Framework:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
> **Smart India Hackathon 2026 — Problem Statement 26194**

---

## 1. Threat Mitigation Matrix (Attack ➔ Prevention ➔ Detection ➔ Recovery)

### Threat 1: Credential Forgery (Creating fraudulent degree or certificate)
* **Attack Vector:** Malicious student creates an unofficial degree document or adds fake records into a local database table.
* **Prevention:** Verifiers do not rely on local databases. All credentials require an Ed25519 digital signature from the certified university issuer DID.
* **Detection:** The 7-step verification engine queries the decentralized identity registry; an unrecognized or self-signed key fails `CHK_ED25519_SIGNATURE`.
* **Recovery:** Forged document is rejected with `INVALID_SIGNATURE`. An immutable audit log records the verifier attempt and IP address.

### Threat 2: Document & Metadata Tampering (Off-chain bit-flip)
* **Attack Vector:** An insider updates a legitimate student's name from "Rahul" to "Rohan" or alters a CGPA from 7.1 to 9.9 in the off-chain SQL database.
* **Prevention:** The canonical SHA-256 hash of all immutable attributes was computed at creation time and anchored to the blockchain ledger.
* **Detection:** When the document is verified, the engine recalculates the canonical hash. The recalculated hash diverges from the immutable on-chain proof, immediately flagging `TAMPERED`.
* **Recovery:** Verification center renders red `INTEGRITY FAILURE` banner, displays side-by-side hash mismatch, and flags risk score to 92/100 (CRITICAL).

### Threat 3: Replay Attacks (Re-submitting old proofs)
* **Attack Vector:** An attacker intercepts a valid signed custody transfer or proof receipt and attempts to re-apply it to another object or timestamp.
* **Prevention:** Every transaction includes the specific `trustObjectId`, unique `eventId`, and cryptographic timestamp in the signed payload.
* **Detection:** The blockchain ledger enforces transaction ID uniqueness and monotonic block height progression; duplicate leaves are rejected.
* **Recovery:** Duplicate transactions fail on-chain insertion.

### Threat 4: Stolen Identity / Key Compromise
* **Attack Vector:** An attacker compromises an organization's private key.
* **Prevention:** Private keys are never stored in plaintext. They are encrypted at rest with AES-256-GCM.
* **Detection:** The Explainable Trust Risk Engine monitors verification velocity spikes, impossible geographic hops, and abnormal issuance frequencies.
* **Recovery:** The organization DID controller publishes an immediate on-chain revocation transaction, annulling the compromised key and transitioning the DID status to `REVOKED`.

### Threat 5: Unauthorized Custody Transfer (Supply Chain & Legal Evidence)
* **Attack Vector:** A third party attempts to claim custody of a pharmaceutical batch or seized CCTV hard drive without a certified handoff from the legitimate custodian.
* **Prevention:** Every provenance transition requires the Ed25519 signature of the current `ownerId` / `fromDid`.
* **Detection:** The provenance engine validates chain continuity (`prev.toDid === curr.fromDid`). Any gap flags `PROVENANCE_MISMATCH`.
* **Recovery:** Product or evidence is quarantined with `CUSTODY_BREACH` alert on the supply chain dashboard.

### Threat 6: Fake Product / Counterfeit Insertion
* **Attack Vector:** A counterfeit manufacturer clones an authentic batch number (e.g. `LOT-2026-REM-402`) onto counterfeit vials.
* **Prevention:** Each serialized unit has a unique Trust Object ID and certified digital signature linked to the manufacturer's verified DID.
* **Detection:** The counterfeit product lacks a continuous cryptographic provenance trail signed by authorized distributors and warehouses.
* **Recovery:** Verifier receives `COUNTERFEIT_RISK` verdict and alerts regulatory authorities.

### Threat 7: Malicious Insider Database Manipulation
* **Attack Vector:** A rogue database administrator alters or deletes records directly in the SQL database.
* **Prevention:** TRUSTGRID's core tenet is *"Don't trust the database. Verify the proof."* The database is treated as an untrusted cache.
* **Detection:** Any direct database modification causes recalculation failure against the blockchain trust anchor.
* **Recovery:** The database state can be restored from on-chain audit logs and verified proofs.

### Threat 8: Blockchain Ledger Tampering Attempts
* **Attack Vector:** An attacker attempts to modify past blocks in the ledger to rewrite history.
* **Prevention:** Blocks are chained sequentially using SHA-256 (`previousHash`). Each block contains a Merkle tree root and is signed by the consortium validator notary.
* **Detection:** `verifyLedgerIntegrity()` audits all block links and Merkle roots. Modifying any past transaction invalidates all subsequent block hashes.
* **Recovery:** The ledger integrity check immediately reports the exact corrupted block index and halts untrusted operations.

### Threat 9: Privacy Leakage
* **Attack Vector:** Eavesdroppers or verifiers attempt to extract private student transcripts, medical formulas, or proprietary trade secrets from the public ledger.
* **Prevention:** Zero sensitive records are placed on-chain. Trust Passports provide selective disclosure, cryptographically masking personal fields (GPA, address) while proving validity.
* **Detection:** Continuous automated schema validation guarantees off-chain isolation.
* **Recovery:** Privacy is guaranteed by protocol design.

### Threat 10: Denial of Service & API Abuse
* **Attack Vector:** High-volume automated bot attempts to flood verification endpoints.
* **Prevention:** Rate-limiting middleware and express request payload size limits (10MB).
* **Detection:** The Explainable Trust Risk Engine monitors verification velocity and flags objects receiving >6 requests within 15 minutes as suspicious.
* **Recovery:** IP throttled; suspicious verifications flagged with elevated risk scores.
