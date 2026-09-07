# TRUSTGRID — 3-Minute SIH Presentation & Demo Sequence
> **Smart India Hackathon 2026 — Problem Statement 26194**

This guide provides the exact step-by-step 3-minute demonstration sequence for hackathon judges and evaluators.

---

## ⏱️ The 3-Minute Presentation Script

### Minute 0:00 - 0:45: The Problem & The Core Innovation
1. **Open the browser at:** `http://localhost:5000`
2. **Point to the headline:**
   > *"Don't trust the database. Verify the proof."*
3. **State the core problem:**
   > *"Today, universities, pharma supply chains, courts, and cybersecurity SOCs each build isolated, fragmented systems of trust. If an insider or hacker alters a SQL database, the forgery is undetectable."*
4. **State the innovation:**
   > *"TRUSTGRID solves this not by building four separate apps, but by inventing a universal Trust Object Protocol (TOP). Blockchain is simply our immutable trust substrate. Sensitive data stays 100% off-chain. Let's see it in action across four sectors right now."*

---

### Minute 0:45 - 1:30: Scenario 1 (Education) — Tamper Detection
1. **Click the button in the top banner:** `1. Fake Certificate`
2. **Observe the Hero Verification UI:**
   * Headline switches to **`INTEGRITY FAILURE`** (Status: **`TAMPERED`**)
   * **Side-by-side hash comparison:**
     * *Original Blockchain Proof Hash:* `e064c5dac4...` (Registered for Rahul Sharma)
     * *Observed Off-Chain Hash:* `3763738d1d...` (Modified to Rohan Sharma, GPA 9.95)
   * **Audit Check:** `CHK_CONTENT_INTEGRITY` flags `TAMPER DETECTED! Recalculated hash diverges from on-chain anchor.`
   * **Explainable Risk Engine:** Displays **`92/100 — CRITICAL RISK`** with exact explanation:
     * *Content integrity tamper: Off-chain data content hash does not match immutable on-chain proof.*
3. **Key takeaway for judges:**
   > *"Even though the university's database was altered, the blockchain proof immediately caught the bit-flip forgery without needing human inspection."*

---

### Minute 1:30 - 2:00: Scenario 2 (Supply Chain) — Counterfeit Detection
1. **Click the button in the top banner:** `2. Trace Product`
2. **Observe the Provenance Timeline:**
   * Genuine Life-Saving Remdesivir batch tracked across Manufacturer ➔ Distributor ➔ Warehouse ➔ Retailer.
   * Counterfeit clone batch detected:
     * Flags **`PROVENANCE MISMATCH`**
     * Broken custody step highlighted in red: an unauthorized actor injected the product at the Delhi border without the manufacturer's cryptographic handoff signature.
3. **Key takeaway for judges:**
   > *"Every handoff is a certified cryptographic state transition signed by the prior custodian. Counterfeits cannot enter the chain."*

---

### Minute 2:00 - 2:30: Scenarios 3 & 4 (Legal Evidence & Cybersecurity)
1. **Click button 3:** `3. Verify Evidence`
   * Demonstrates 4K CCTV digital evidence chain of custody from Crime Scene to High Court.
   * Modifying video frames instantly fails Section 65B hash validation.
2. **Click button 4:** `4. Device Compromise`
   * Demonstrates a SCADA power grid router baseline.
   * Live integrity audit flags unauthorized backdoor injected into firewall rules, triggering an immutable security incident on the ledger.
3. **Key takeaway for judges:**
   > *"Notice that all four use cases used the exact same verification engine."*

---

### Minute 2:30 - 3:00: The Trust Graph & The Reveal
1. **Click the `Trust Graph` tab in the navbar:**
   * Shows the interactive visual network connecting universities, pharma distributors, investigators, devices, and students.
   * Filter by sector or click any node to see underlying on-chain transactions.
2. **Click the `Trust Passport` tab:**
   * Toggle **`Selective Disclosure`** to show privacy-preserving credentials where personal GPA or residential coordinates are masked while cryptographic validity is proven.
3. **Click the `Ledger Explorer` tab:**
   * Show real blocks, Merkle roots, and explain the architecture:
     > *"For this MVP, we built a local consortium notary ledger with real Merkle trees and cryptographic block chaining. Because our architecture uses a clean BlockchainAdapter interface, deploying to a multi-organization Hyperledger Fabric network requires zero code changes."*
4. **Final Closing Line:**
   > *"One trust protocol. Multiple sectors. Cryptographically verifiable. Tamper-evident. Privacy-aware. Thank you."*

---

## ⚡ 1-Minute Elevator Pitch Cheat Sheet
If you have only 60 seconds with an evaluator:
1. Click **1. Fake Certificate** ➔ Point to the red hash mismatch and explainable risk score.
2. Click **2. Trace Product** ➔ Point to the broken custody chain.
3. Click **Trust Graph** ➔ Point to the cross-sector node network.
4. Conclude: *"This is not four applications. This is one trust infrastructure demonstrated through four applications."*
