# TRUSTGRID — Institutional Decentralized Trust Infrastructure
> **Smart India Hackathon 2026 — Problem Statement 26194 (Student Innovation: Blockchain & Cybersecurity)**
> 
> *"Don't trust the database. Verify the proof."*

---

## 1. Executive Summary & Canonical Positioning

> **TRUSTGRID is a sector-agnostic institutional trust infrastructure built around the Trust Object Protocol (TOP). TOP provides a common model for creating, signing, anchoring, verifying, revoking, and auditing digital and physical trust objects.**
>
> **Instead of putting sensitive information on-chain, TRUSTGRID keeps sensitive data off-chain and anchors cryptographic proofs, provenance, status, and audit references to a tamper-evident blockchain ledger.**
>
> **The same verification infrastructure is demonstrated across four sectors: academic credentials, pharmaceutical provenance, digital forensic evidence, and critical device integrity.**
>
> **One trust protocol. Four sectors. One verification engine.**

Today, every major economic sector operates an isolated, fragile island of trust:
* **Universities** maintain opaque academic degree databases susceptible to SQL injection and insider forgery.
* **Pharmaceutical and manufacturing supply chains** struggle with adulterated batches and counterfeit products injected during distributor transit.
* **Law enforcement and judiciaries** face digital evidence spoliation challenges where CCTV files or digital records cannot provably demonstrate an unbroken chain of custody.
* **Cybersecurity teams** struggle to establish tamper-evident cryptographic baselines for critical infrastructure devices and SCADA endpoints.

**TRUSTGRID** solves this structural vulnerability not by creating four unrelated applications, but by inventing a unified, sector-agnostic protocol: the **Trust Object Protocol (TOP)**.

```
                       TRUSTGRID
                           │
                 TRUST OBJECT PROTOCOL (TOP)
                           │
            ┌──────────────┼──────────────┐
            │              │              │
        IDENTITY       CRYPTOGRAPHY    POLICY
            │              │              │
            └──────────────┼──────────────┘
                           │
        BLOCKCHAIN TRUST LEDGER (Consortium / Fabric)
                           │
                  ┌────────┴────────┐
                  │                 │
            VERIFICATION        PROVENANCE
               ENGINE              ENGINE
                  │                 │
                  └────────┬────────┘
                           │
               EXPLAINABLE RISK ENGINE
                           │
                    TRUST GRAPH
                           │
                   TRUST PASSPORT
                           │
            ┌──────────────┼──────────────┐
            │              │              │
        EDUCATION     SUPPLY CHAIN      LEGAL
                                          │
                                    CYBERSECURITY
```

---

## 2. Core Protocol Innovation: The Trust Object Protocol (TOP)

* **TOP is the central innovation.**
* **Blockchain provides the tamper-evident trust substrate.**
* **The four flagship sectors are real-world validations of the exact same protocol.**

Every digital or physical asset registered in TRUSTGRID becomes a tamper-evident, cryptographically verifiable **Trust Object**:

```json
{
  "trustObjectId": "TO-EDU-DEGREE-GENUINE-2024",
  "objectType": "CREDENTIAL",
  "subjectId": "did:trustgrid:usr:rahul-sharma",
  "issuerId": "did:trustgrid:edu:delhi-tech-univ",
  "ownerId": "did:trustgrid:usr:rahul-sharma",
  "createdAt": "2026-09-07T15:55:00.000Z",
  "expiresAt": null,
  "contentHash": "e064c5dac4f5219169ae0d09b1b91f8d9094f6a76035f97cc73422061b696176",
  "signature": "3Kz...[Ed25519 digital signature]",
  "blockchainTxId": "0xaa36adcb54ad8e9b10522e171f689c55b8921b8b795c169797b475ef47aacc79",
  "status": "ACTIVE",
  "metadata": {
    "studentName": "Rahul Sharma",
    "degreeName": "Bachelor of Technology in Computer Science & Engineering",
    "cgpa": "9.42 / 10.00",
    "serialNumber": "DTU-2024-BTECH-0942"
  },
  "provenance": [
    {
      "eventId": "EV-001",
      "eventType": "CREATION",
      "fromDid": "did:trustgrid:edu:delhi-tech-univ",
      "toDid": "did:trustgrid:usr:rahul-sharma",
      "timestamp": "2026-09-07T15:55:00.000Z",
      "signature": "...",
      "blockchainTxId": "0xaa36..."
    }
  ],
  "version": 1
}
```

---

## 3. The 7-Step Unified Verification Pipeline

When any Trust Object is presented to TRUSTGRID, the exact same verification engine executes:

1. **Decentralized Identity (DID) Resolution:** Resolves issuer DID document and fetches the active Ed25519 public key.
2. **Canonical Hash Recalculation:** Recursively computes the deterministic SHA-256 hash of the presented payload using alphabetical key sorting.
3. **Cryptographic Signature Verification:** Verifies that the issuer's private key signed the original content hash.
4. **Blockchain Proof Anchor Verification:** Audits the ledger for the object's Merkle leaf, block height, and validator notary signature.
5. **Anti-Tampering Hash Comparison:** Compares the recalculated hash with the on-chain registered hash. Any modification flags `TAMPERED`.
6. **Revocation & Expiration Status:** Checks if a revocation receipt exists on the blockchain ledger or if the validity window has elapsed.
7. **Provenance Continuity Check:** Verifies the cryptographic chain of custody transitions to prevent unauthorized handoffs or counterfeit injection.

---

## 4. Architectural Truth & Blockchain Substrate Realism

* **MVP:** TRUSTGRID currently demonstrates the trust protocol using a cryptographically verifiable consortium-style ledger with chained blocks, Merkle roots, and validator signatures running locally in-process.
* **Production path:** The blockchain layer is abstracted behind `BlockchainAdapter` so the same application/protocol layer can connect to a multi-organization permissioned network such as **Hyperledger Fabric** with zero application code refactoring.

---

## 5. Why Not Store Sensitive Data On-Chain?

Public and consortium blockchains are tamper-evident append-only ledgers. Storing student transcripts, medical specifications, or forensic files directly on-chain violates privacy frameworks (GDPR, India DPDP Act 2023) and creates blockchain bloat:
* **Sensitive metadata remains 100% off-chain** in encrypted relational stores.
* **Only the cryptographic content hash, issuer DID, block timestamp, and status** are anchored on-chain.
* **Privacy-Aware Trust Passport:** Supports selective disclosure architecture where users can cryptographically prove their degree or credential without disclosing GPA, residential coordinates, or financial data.

---

## 6. The Four Flagship Demonstrations

| Sector | Demonstrated Use Case | What Happens Under Attack | Status Detected |
|---|---|---|---|
| **🎓 Education** | Academic Credential Verification | Student name changed from "Rahul" to "Rohan", CGPA falsified from 7.1 to 9.9 | `TAMPERED` (Content Hash Mismatch) |
| **📦 Supply Chain** | Pharmaceutical Product Provenance | Unverified distributor injects counterfeit batch without manufacturer handoff signature | `PROVENANCE_MISMATCH` (Broken Custody) |
| **⚖️ Legal Evidence** | Digital Forensic Evidence Integrity | Video frames edited between 02:14:00 - 02:17:30 | `TAMPERED` (Spoliation Detected) |
| **🛡️ Cybersecurity** | Critical Device Integrity Monitoring | Unauthorized firewall backdoor injected into router firmware | `DEVICE_INTEGRITY_COMPROMISED` (Critical Baseline Breach) |

---

## 7. Explainable Trust Risk Engine (No AI Gimmicks)

Rather than using an opaque LLM chatbot, TRUSTGRID implements an explainable, deterministic 0–100 behavioral anomaly scoring engine that explains the factors contributing to elevated trust risk:
* **Duplicate Credential Claim (+30 risk):** Same content hash claimed across multiple distinct entity DIDs.
* **High Frequency Verification Spike (+20 risk):** >6 verification attempts within 15 minutes.
* **Content Hash Bit-Flip (+55 risk):** Data divergence between off-chain records and on-chain proofs.
* **Broken Provenance Gap (+35 risk):** Custody transfer not signed by legitimate prior owner.

Outputs human-understandable audit rationales:
```
Risk: 92/100 — CRITICAL
Reasons:
• Off-chain data content hash does not match on-chain proof (Tampering detected)
• Provenance transition gap: custody transfer was not signed by legitimate prior owner
```

---

## 8. Technology Stack

* **Backend:** Node.js 24 LTS, TypeScript, Express, native `node:crypto` (Ed25519 & SHA-256)
* **Database:** Dual-mode architecture:
  * Zero-dependency native SQLite (`node:sqlite`) for instant, friction-free local execution
  * Full PostgreSQL DDL migrations (`schema.sql`) and `docker-compose.yml` for enterprise deployment
* **Frontend:** React 19, TypeScript, Vite, Vanilla Cyber-Aesthetic CSS (Zero Tailwind dependency for maximum control), Lucide Icons
* **Testing:** Node.js native test runner (`node:test`, `tsx`)

---

## 9. Quick Start & Setup Instructions

### Prerequisites
* Node.js v20+ (Node v24 recommended)
* npm v10+

### Option A: Instant Local Startup (Recommended)
```bash
# 1. Clone or navigate to the repository
cd TRUSTGRID

# 2. Install dependencies (root & client)
npm install
npm --prefix client install

# 3. Seed database with 4 Flagship Scenarios
npm run seed

# 4. Run automated test suite (39 tests)
npm test

# 5. Launch unified server
npm run build
npm start
```
The application will start on **http://localhost:5000** (serving both the REST API and the React Web UI).

### Option B: Development Mode with Live Reload
```bash
# Runs Express server and Vite client concurrently
npm run dev
```
* Backend API: `http://localhost:5000`
* Frontend Dev Server: `http://localhost:3000`

### Option C: Docker Deployment
```bash
docker compose up --build
```

---

## 10. Automated Test Results

TRUSTGRID features a comprehensive automated test suite verifying:
* Ed25519 signing, verification, and key export
* Canonical JSON deterministic SHA-256 hashing
* AES-256-GCM encrypted keystore management
* Merkle root tree calculations
* Explainable Trust Risk Engine factor scoring
* Full end-to-end lifecycle (Issue → Anchor → Verify Authentic → Tamper → Verify Tampered → Revoke)
* Consortium blockchain ledger integrity audit
* Persistent encrypted keystore across simulated server restarts
* Cryptographic provenance chain continuity and forged signature detection
* Duplicate credential claim and anomaly risk elevation
* SCADA device configuration drift and on-chain security alert anchoring

```bash
npm test
```
Result: **39 passed, 0 failed, 100% pass rate**.

---

## 11. Project Folder Structure

```
TRUSTGRID/
├── package.json                   # Root package script configuration (Node 24+, tsx, vite)
├── tsconfig.json                  # Server TypeScript configuration
├── Dockerfile                     # Multi-stage production container build
├── docker-compose.yml             # Single-instance Docker Compose orchestration
├── docker-compose.multi-node.yml  # 3-Node PBFT containerized cluster orchestration
├── .env.example                   # Complete configuration reference
├── README.md                      # Comprehensive project overview
├── docs/
│   ├── ARCHITECTURE_AUDIT.md      # Phase 0 baseline audit & v2 architectural roadmap
│   ├── DISTRIBUTED_LEDGER.md      # Distributed ledger architecture & node topology
│   ├── CONSENSUS.md               # 3-Phase PBFT consensus protocol & quorum math
│   ├── SECURITY.md                # Threat model & cryptographic defense-in-depth
│   └── DEMO_SCRIPT.md             # SIH 2026 Judge Demonstration Guide
├── src/
│   ├── server.ts                  # Server entrypoint with auto-seeding
│   ├── app.ts                     # Express app assembly, audit logging & multi-node router
│   ├── core/
│   │   ├── crypto/                # Ed25519, SHA-256 canonical hash, AES-GCM, Merkle trees
│   │   ├── identity/              # W3C DIDs & encrypted keystore wallet
│   │   ├── trust-object/          # Trust Object Protocol (TOP v2) types & service
│   │   ├── blockchain/
│   │   │   ├── node.ts            # LedgerNode class with isolated SQLite & Ed25519 DID
│   │   │   ├── network.ts         # PeerNetwork router with latency & partition simulation
│   │   │   ├── consensus.service.ts # 3-Phase PBFT Consensus Engine (Propose/Endorse/Commit)
│   │   │   ├── multi-node-blockchain.adapter.ts # 3-Node cluster manager (Alpha/Beta/Gamma)
│   │   │   ├── consortium-blockchain.adapter.ts # Primary consortium ledger adapter
│   │   │   ├── production-blockchain.adapter.ts # Hyperledger Fabric gateway bridge
│   │   │   └── fabric-chaincode/
│   │   │       ├── trustgrid_cc.go # Production Hyperledger Fabric 2.5 Go Smart Contract
│   │   │       └── go.mod         # Go module definition
│   │   ├── verification/          # 5-Step Cryptographic Verification Pipeline + PBFT Check
│   │   ├── provenance/            # Certified multi-party custody handoffs
│   │   ├── revocation/            # On-chain revocation registry
│   │   ├── risk-engine/           # Explainable Trust Risk Engine (0-100)
│   │   ├── trust-graph/           # Cross-sector entity relationship graph
│   │   └── passport/              # Trust Passport with salted commitments & range proofs
│   ├── sectors/                   # Sector modules validating TOP
│   │   ├── sector.interface.ts
│   │   ├── education.module.ts    # Academic degrees & transcript verification
│   │   ├── supply-chain.module.ts # Pharma batches & cold-chain custody tracking
│   │   ├── legal.module.ts        # Tamper-evident forensic evidence & chain of custody
│   │   └── cybersecurity.module.ts # SCADA firmware baselines & on-chain drift alerts
│   ├── database/
│   │   ├── schema.sql             # Relational DDL & schema migrations
│   │   ├── db.service.ts          # Built-in node:sqlite database service
│   │   └── seed.ts                # Idempotent demonstrator seed data
│   ├── api/routes/                # REST endpoints (/api/nodes, /api/verify, etc.)
│   └── tests/                     # 112 Automated Tests (Consensus, Fault Tolerance, Tamper, Sectors)
└── client/
    ├── package.json
    ├── vite.config.ts             # Vite dev server with proxy to port 5000
    ├── index.html
    └── src/
        ├── App.tsx                # Master UI router and cyber layout
        ├── index.css              # Custom dark-mode cybersecurity design system
        ├── components/
        │   ├── Navbar.tsx         # Sector navigation & role switcher
        │   ├── DemoBanner.tsx     # SIH 1-click flagship scenario buttons
        │   ├── HeroVerification.tsx # Signature UI with 7-point checklist & hash diff
        │   ├── TrustGraphView.tsx # Interactive SVG node-link graph
        │   └── TrustPassportCard.tsx # Privacy-preserving passport viewer
        ├── pages/
        │   ├── BlockchainExplorerPage.tsx # Multi-Node PBFT Visualizer & Node Control Panel
        │   └── ...                # Sector & audit views
        └── services/api.ts        # Frontend REST API client
```

---

## 12. Verification & Automated Test Suite

TRUSTGRID features a comprehensive automated test suite consisting of **112 passing tests** executing in ~6 seconds:
```bash
npm test
```

### Test Suite Breakdown:
- `crypto.test.ts` (4 tests) — Ed25519 signing/verification, RFC 8785 canonical serialization, AES-256-GCM keystores.
- `merkle.test.ts` (1 test) — Binary Merkle tree root and inclusion proof verification.
- `multi_node_consensus.test.ts` (15 tests) — 3-Phase PBFT consensus, quorum endorsement certificates ($Q \ge 2$), height continuity.
- `node_fault_tolerance.test.ts` (12 tests) — Dynamic node crash/failure, network partitions, catchup sync protocol.
- `ledger_tamper_detection.test.ts` (12 tests) — Deliberate block hash, previous hash, and transaction mutations with cross-node divergence detection and self-healing.
- `passport_disclosure.test.ts` (12 tests) — Salted attribute commitments, blinding, and numeric predicate range proofs.
- `fabric_contract.test.ts` (10 tests) — Hyperledger Fabric 2.5 Go contract methods, world state anchoring, revocation.
- `sector_deep_dive.test.ts` (12 tests) — Education, Supply Chain, Legal Evidence, and Cybersecurity sector deep-dive validation.
- `e2e.test.ts`, `verification.test.ts`, `provenance_tampering.test.ts`, `persistence.test.ts`, `cybersecurity_e2e.test.ts`, `duplicate_credential.test.ts`, `system_health.test.ts` (34 tests) — Baseline end-to-end integration workflows.

---

## 13. Future Scope & Roadmap

1. **Zero-Knowledge Range Proofs (zk-SNARKs):** Integrating Groth16 / Circom circuits to prove age, credentials, or batch expiry without revealing any numerical attributes.
2. **Cross-Chain State Anchoring:** Relaying consortium Merkle state roots onto public networks (Polygon / Ethereum) for public notary anchoring.
3. **Decentralized Storage Connectors:** Optional IPFS / Filecoin pinning for large non-sensitive public assets.
4. **Hardware Security Module (HSM) Support:** Integrating PKCS#11 / AWS KMS / Azure Key Vault for institutional private key signing.

---

## 14. License
Apache License 2.0. Built for Smart India Hackathon 2026.
