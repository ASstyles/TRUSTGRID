# TRUSTGRID Consensus Protocol: Practical Byzantine Fault Tolerance (PBFT)

**Smart India Hackathon 2026** | **Problem Statement 26194**  
**Theme:** Blockchain & Cybersecurity | **Team:** TruthLens  
**Module:** `PbftConsensusEngine` (`src/core/blockchain/consensus.service.ts`)

---

## 1. Consensus Model & Quorum Mathematics

TRUSTGRID implements a permissioned consortium consensus protocol inspired by **Practical Byzantine Fault Tolerance (PBFT)** (Castro & Liskov, 1999) optimized for low-latency, deterministic multi-institutional networks.

### Byzantine Fault Tolerance Thresholds:
- Total Consortium Nodes: $N = 3$
- Maximum Tolerable Byzantine Faults:
  $$F = \left\lfloor \frac{N - 1}{3} \right\rfloor = \left\lfloor \frac{3 - 1}{3} \right\rfloor = 1$$
- Minimum Quorum Threshold ($Q$):
  $$Q \ge \left\lceil \frac{2N + 1}{3} \right\rceil = 2$$

The cluster is resilient against any single node failure ($F = 1$), whether due to a crash, network partition, or deliberate malicious database tampering.

---

## 2. The 3-Phase Consensus Cycle

Each block creation cycle transitions through three cryptographic phases:

```
    LEADER (Alpha)               VALIDATOR (Beta)             VALIDATOR (Gamma)
          |                              |                            |
          |======== PHASE 1: PROPOSE ===>|                            |
          |==============================+===========================>|
          |  (Candidate Block, Leaves,   |                            |
          |   Merkle Root, Proposer Sig) |                            |
          |                              |                            |
          |                              |--- [Verify PreviousHash]---|
          |                              |--- [Verify Merkle Root]----|
          |                              |--- [Verify Signatures]-----|
          |                              |                            |
          |<======= PHASE 2: ENDORSE ====|                            |
          |<=============================+============================|
          |  (Signed Endorsement Votes)  |                            |
          |                              |                            |
    [Count Votes >= 2]                   |                            |
    [Form Quorum Certificate]            |                            |
          |                              |                            |
          |======== PHASE 3: COMMIT ====>|                            |
          |==============================+===========================>|
          |  (Block + Endorsement Cert)  |                            |
          |                              |                            |
    [Alpha Commits]                [Beta Commits]               [Gamma Commits]
```

### Phase 1: Propose
1. The designated leader node (**Node Alpha**) collects pending transactions from the mempool.
2. The leader computes the binary Merkle root and canonical serialized header digest:
   $$\text{blockHash} = \text{SHA-256}(\text{CanonicalJSON}(\text{header}))$$
3. The leader digitally signs the candidate block hash with its private key.
4. The leader broadcasts the candidate block to all connected peers over the network.

### Phase 2: Endorse (Prepare)
1. Each validator (**Beta**, **Gamma**) receives the candidate block and verifies:
   - Continuity check: $\text{candidate.header.height} == \text{localHeight} + 1$
   - Hash chain link: $\text{candidate.header.previousHash} == \text{localLastBlock.blockHash}$
   - Merkle root integrity: Recomputed leaf root matches $\text{candidate.header.merkleRoot}$
   - Header hash integrity: Recomputed SHA-256 digest matches $\text{candidate.blockHash}$
   - Proposer authority: Proposer DID is an authorized consortium member.
2. If all checks pass, the validator generates a signed `EndorsementVote`:
   ```typescript
   export interface EndorsementVote {
     voterDid: string;
     voterNodeId: string;
     blockHash: string;
     round: number;
     signature: string;
     timestamp: string;
   }
   ```
3. The validator transmits the vote back to the leader.

### Phase 3: Commit
1. The leader collects votes from all validators.
2. When the leader gathers $\ge Q$ (at least 2 valid signatures from distinct known validator DIDs), it constructs an `EndorsementCertificate`:
   ```typescript
   export interface EndorsementCertificate {
     blockHash: string;
     round: number;
     votes: EndorsementVote[];
     quorumReached: boolean;
   }
   ```
3. The leader attaches the certificate to the block and commits it to its local SQLite ledger.
4. The leader broadcasts the committed certified block to all reachable peers.
5. Each online peer verifies the certificate and commits the block to its local database.

---

## 3. Fault Tolerance & Liveness Guarantees

| Scenario | Active Nodes | Votes Received | Quorum (>=2) | Result |
| :--- | :---: | :---: | :---: | :--- |
| **All Nodes Healthy** | Alpha, Beta, Gamma | 3 | **Yes** | Block committed across all 3 nodes |
| **Validator Beta Crashed** | Alpha, Gamma | 2 | **Yes** | Block committed to Alpha & Gamma; Beta syncs on recovery |
| **Validator Gamma Crashed** | Alpha, Beta | 2 | **Yes** | Block committed to Alpha & Beta; Gamma syncs on recovery |
| **Network Partition (2 vs 1)** | {Alpha, Beta} vs {Gamma} | 2 | **Yes** | Majority partition continues mining; Gamma isolated |
| **Leader Alpha Crashed** | Beta, Gamma | 0 | **No** | Consensus paused until leader restored or view change |
| **Two Nodes Crashed** | Alpha only | 1 | **No** | Consensus rejected: `Cannot reach quorum (received 1 votes, required 2)` |

---

## 4. Byzantine Tamper Detection & Cross-Node Audit

TRUSTGRID includes a continuous cross-node ledger audit API (`GET /api/nodes/audit/cross-node`).

If an attacker gains unauthorized root access to a single node's operating system and mutates its database:
1. `verifyLocalChainIntegrity()` flags the corrupted block hash or broken Merkle root on the tampered node.
2. `verifyCrossNodeLedger()` compares block hashes across all nodes. The corrupted node's hash diverges from the 2/3 Byzantine majority.
3. The cluster flags the node as `CORRUPTED` and diverged, while the 2 healthy nodes continue operating normally.
4. Triggering `recoverNode` or `syncNode` pulls certified blocks from the healthy majority, overwriting corrupted records and restoring 100% cryptographic integrity.
