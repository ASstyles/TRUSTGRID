# TRUSTGRID REST API Reference Manual
> **Base URL:** `http://localhost:5000/api`
> **Protocol:** Trust Object Protocol (TOP) v1.0

---

## 1. System & Demo Endpoints

### `GET /health`
Returns the status and protocol version of the running TRUSTGRID instance.
* **Response:**
  ```json
  {
    "status": "UP",
    "service": "TRUSTGRID Trust Infrastructure",
    "protocol": "TOP (Trust Object Protocol) v1.0",
    "network": "Consortium Notary Ledger (Local MVP) / Production Hyperledger Fabric Ready",
    "timestamp": "2026-09-07T16:00:00.000Z"
  }
  ```

### `GET /api/demo/scenarios`
Returns the 4 Flagship Demonstrations pre-configured for the SIH evaluation.

### `POST /api/demo/run/:scenarioId`
Executes one of the 4 flagship scenarios, comparing target vs authentic baselines.
* **Params:** `scenarioId` (`SCENARIO_1_FAKE_CERTIFICATE`, `SCENARIO_2_COUNTERFEIT_PRODUCT`, `SCENARIO_3_ALTERED_LEGAL_EVIDENCE`, `SCENARIO_4_DEVICE_COMPROMISE`)
* **Response:** Returns `scenario`, `targetResult`, `comparisonResult`, and `verdict`.

---

## 2. Verification Endpoints

### `POST /api/verify`
Executes the 7-step cryptographic verification pipeline.
* **Body:**
  ```json
  {
    "trustObjectId": "TO-EDU-DEGREE-GENUINE-2024",
    "presentedMetadata": { ... } // Optional: override metadata to test tampering
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "result": {
      "overallStatus": "AUTHENTIC | TAMPERED | REVOKED | EXPIRED | PROVENANCE_MISMATCH",
      "trustScore": 95,
      "trustObjectId": "TO-...",
      "hashMatch": true,
      "signatureValid": true,
      "blockchainProofValid": true,
      "checks": [ ... ],
      "riskAssessment": { ... }
    }
  }
  ```

### `GET /api/verify/:trustObjectId`
Instant verification lookup via QR code scan or direct object ID.

---

## 3. Trust Object Protocol (TOP) Endpoints

### `GET /api/trust-objects`
List all Trust Objects with optional filters.
* **Query Params:** `sector=EDUCATION|SUPPLY_CHAIN|LEGAL|CYBERSECURITY`, `status=ACTIVE|REVOKED|TAMPERED`

### `GET /api/trust-objects/:id`
Retrieves a single Trust Object with its full provenance history.

### `POST /api/trust-objects`
Mints a new Trust Object under the Trust Object Protocol.

### `POST /api/trust-objects/:id/tamper`
Simulates off-chain database tampering for live demonstrations.

---

## 4. Sector Modules

### Education
* `GET /api/education/credentials`: Lists academic degrees.
* `POST /api/education/issue`: Issues a new degree credential.

### Supply Chain
* `GET /api/supply-chain/products`: Lists product batches with provenance history.
* `POST /api/supply-chain/register`: Registers a new manufacturing batch.
* `POST /api/supply-chain/transfer`: Records a certified custody handoff between DIDs.

### Legal Evidence
* `GET /api/legal/evidence`: Lists forensic evidence objects.
* `POST /api/legal/evidence`: Registers new digital evidence.
* `POST /api/legal/transfer`: Transfers forensic custody to lab, prosecutor, or court.

### Cybersecurity
* `GET /api/cybersecurity/devices`: Lists critical device baselines.
* `POST /api/cybersecurity/register`: Registers device configuration baseline hash.
* `POST /api/cybersecurity/audit`: Performs live configuration audit against baseline.
* `GET /api/cybersecurity/events`: Lists immutable security incident alerts.

---

## 5. Blockchain & Ledger Explorer

* `GET /api/blockchain/status`: Returns current block height, total blocks, and ledger integrity verification result.
* `GET /api/blockchain/blocks`: Returns reverse chronological list of mined blocks.
* `GET /api/blockchain/transactions/:txId`: Returns full transaction receipt and Merkle leaf.
* `GET /api/blockchain/proof/:trustObjectId`: Returns the on-chain cryptographic proof for any object.

---

## 6. Trust Graph & Trust Passport

* `GET /api/graph?sector=...`: Returns interactive node-link graph data (entities, objects, relation edges).
* `GET /api/passport/:did?selective=true|false`: Returns verifiable claims for user or organization with selective disclosure.
* `GET /api/risk/stats`: Returns overall risk metrics and anomaly distributions.
* `GET /api/risk/events`: Returns recent elevated risk alerts and factor explanations.
