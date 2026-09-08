# TRUSTGRID Live Demonstration Script (Smart India Hackathon 2026)

**Problem Statement 26194:** Student Innovation in Distributed Ledger Technology  
**Team:** TruthLens | **Theme:** Blockchain & Cybersecurity  
**System URL:** `http://localhost:3000`  
**API Documentation:** `http://localhost:3000/api/health`

---

## 1. Demonstration Setup & Health Verification

### Step 1.1: Start System
```bash
# In project root:
npm run dev
# Or run automated tests verifying all 112 test cases:
npm test
```

### Step 1.2: Verify Multi-Node Cluster Health
1. Open browser to `http://localhost:3000/blockchain`.
2. Observe the **PBFT Multi-Node Consensus Cluster (3 Nodes)** card:
   - **Node Alpha (Leader):** `ONLINE`, Height: Current, DID: `did:trustgrid:node:alpha`
   - **Node Beta (Validator):** `ONLINE`, Height: Current, DID: `did:trustgrid:node:beta`
   - **Node Gamma (Validator):** `ONLINE`, Height: Current, DID: `did:trustgrid:node:gamma`
3. Click **"Cross-Node Ledger Audit"**:
   - Verify green banner: `CLUSTER CONSENSUS IN SYNC (Quorum: 2/3, Diverged: None)`.

---

## 2. Flagship Scenario 1: Education (Degree Forgery Detection)

### Narrative:
"Degree fraud affects over 30% of resume submissions in corporate hiring. Traditional online portals rely on centralized university databases that can be hacked, bribed, or taken offline. TRUSTGRID eliminates database trust by anchoring cryptographic degrees with Ed25519 digital signatures."

### Action:
1. Navigate to **Education Sector** (`/education` or via Dashboard).
2. Select the genuine degree for **Rohan Sharma** (`TO-EDU-DEGREE-GENUINE-2024`).
3. Click **"Verify Certificate"**:
   - Result: **AUTHENTIC (Trust Score: 98/100, LOW RISK)**.
   - Expand Verification Checks:
     - Subject DID Format Verified
     - Issuer Identity Resolved
     - Ed25519 Signature Valid
     - SHA-256 Canonical Hash Match
     - On-Chain Merkle Anchor Verified
     - Multi-Node PBFT Quorum Endorsed (3 Node Signatures)
     - Revocation Check: ACTIVE
4. Next, select the tampered degree where the student name was modified in the off-chain database from **Rahul Sharma** to **Rohan Sharma**:
5. Click **"Verify Certificate"**:
   - Result: **TAMPERED (Trust Score: 0/100, CRITICAL RISK)**.
   - Observe explanation: *Content hash diverges from immutable blockchain anchor. Document has been altered after issuance.*

---

## 3. Flagship Scenario 2: Supply Chain (Pharma Counterfeit & Cold-Chain Drift)

### Narrative:
"Counterfeit pharmaceuticals cost over 1 million lives globally each year. TRUSTGRID tracks certified multi-hop custody transitions from manufacturer to hospital pharmacy with unbroken cryptographic handoffs."

### Action:
1. Navigate to **Supply Chain Sector** (`/supply-chain`).
2. Select genuine pharmaceutical batch **Remdesivir 100mg** (`TO-SC-BATCH-GENUINE-2024`).
3. Observe the **4-hop unbroken provenance chain**:
   - Manufacturer (Pfizer) -> Primary Distributor -> Cold-Chain Transporter -> Hospital Pharmacy.
4. Click **"Verify Custody Chain"**:
   - Result: **AUTHENTIC (Unbroken custody chain, 4 certified handoffs)**.
5. Select counterfeit batch (`TO-SC-BATCH-COUNTERFEIT-2024`) with an unauthorized custody transfer:
6. Click **"Verify Custody Chain"**:
   - Result: **PROVENANCE_MISMATCH (Custody chain broken at hop #2: Unrecognized custodian DID)**.

---

## 4. Flagship Scenario 3: Legal Evidence (Digital Forensic Chain of Custody)

### Narrative:
"Under Section 65B of the Indian Evidence Act, electronic evidence must maintain provable integrity from seizure to courtroom presentation. An adversary who alters a forensic disk image ruins the prosecution's case."

### Action:
1. Navigate to **Legal Evidence Sector** (`/legal`).
2. Select evidence exhibit **Workstation Bitstream Image** (`TO-LEG-EVIDENCE-GENUINE-2024`).
3. Click **"Verify Forensic Integrity"**:
   - Result: **AUTHENTIC (SHA-256 bitstream matches original court seizure seal)**.
4. Select tampered forensic exhibit (`TO-LEG-EVIDENCE-TAMPERED-2024`):
5. Click **"Verify Forensic Integrity"**:
   - Result: **TAMPERED (Spoliation detected: bitstream hash differs from seized master hash)**.

---

## 5. Flagship Scenario 4: Cybersecurity (SCADA Firmware Drift Alert)

### Narrative:
"Critical infrastructure like electrical power grids and nuclear plants face advanced persistent threats (APTs) where rootkits modify controller firmware. TRUSTGRID anchors golden configuration baselines on-chain."

### Action:
1. Navigate to **Cybersecurity Sector** (`/cybersecurity`).
2. Verify **Clean Substation Gateway RTU-07**:
   - Result: **AUTHENTIC (Firmware hash matches certified golden image)**.
3. Observe **Compromised Substation Gateway RTU-12**:
   - Firmware drift triggered an immutable on-chain security alert (`BASELINE_VIOLATION`, Severity: `CRITICAL`).
   - Verification status: **DEVICE_INTEGRITY_COMPROMISED**.

---

## 6. Flagship Demonstration 5: Live PBFT Node Crash & Self-Healing

### Narrative:
"Watch what happens when a node in our distributed ledger is knocked offline or deliberately tampered with."

### Action:
1. Navigate to **Blockchain Explorer** (`/blockchain`).
2. Under **Node Beta**, click **"Crash / Fail"**:
   - Node Beta status immediately transitions to **OFFLINE** (red badge).
3. Anchor a new document or verify that the cluster remains operational:
   - Notice that Node Alpha (Leader) and Node Gamma (Validator) reach quorum ($2/3 \ge 2$) and continue committing blocks!
4. Click **"Cross-Node Ledger Audit"**:
   - Observe that the cluster flags: `Node Beta is behind/offline; Quorum Reached: YES (2/3)`.
5. Under Node Beta, click **"Recover & Sync"**:
   - Node Beta transitions to `ONLINE`.
   - Node Beta automatically contacts Node Alpha, replays all missed blocks, verifies Merkle roots and signatures, and catches up to cluster height!
   - Cross-node audit returns to: `CLUSTER CONSENSUS IN SYNC`.

---

## 7. Flagship Demonstration 6: Byzantine Database Tampering Detection

### Action:
1. Under **Node Beta**, click **"Tamper DB"**:
   - Simulates an attacker directly modifying the underlying SQLite database file out-of-band.
   - Node Beta's status transitions to **CORRUPTED** (amber badge).
2. Click **"Cross-Node Ledger Audit"**:
   - Observe red banner: **CROSS-NODE DIVERGENCE DETECTED**.
   - Diverged nodes: `node-beta` (tampered hash differs from 2/3 Byzantine majority).
3. Under Node Beta, click **"Reconcile / Self-Heal"**:
   - Node Beta reconciles its state against the Byzantine majority (Node Alpha and Node Gamma).
   - Tampered records are overwritten with cryptographically certified blocks.
   - Node Beta returns to **ONLINE** and passes local cryptographic chain integrity!

---

## 8. Summary of Technical Honesties & Enterprise Parity

| Feature | Demonstration Reality |
| :--- | :--- |
| **Cryptography** | Real native Ed25519 digital signatures and SHA-256 Merkle trees. |
| **Consensus** | Real 3-phase PBFT consensus ($N=3, F=1, Q \ge 2$) with multi-signature certificates. |
| **Multi-Node Ledger** | 3 isolated SQLite database instances (`node-alpha.db`, `node-beta.db`, `node-gamma.db`) communicating over simulated peer-to-peer network. |
| **Selective Disclosure** | Cryptographic salted commitments with predicate range assertions. |
| **Hyperledger Fabric** | Production-ready Go chaincode contract (`trustgrid_cc.go`) with complete contract methods and gateway bridge adapter. |
| **Automated Verification** | 112 automated unit and integration tests passing in ~6 seconds. |
