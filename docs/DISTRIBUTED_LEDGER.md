# TRUSTGRID Distributed Ledger Architecture

**Smart India Hackathon 2026** | **Problem Statement 26194**  
**Theme:** Blockchain & Cybersecurity | **Team:** TruthLens  
**Protocol:** Trust Object Protocol (TOP v2.0.0)

---

## 1. Overview & Architectural Philosophy

TRUSTGRID is a permissioned distributed ledger technology (DLT) designed specifically for multi-sector trust infrastructure. Unlike anonymous public proof-of-work blockchains that suffer from extreme energy waste, high latency, and unpredictable transaction fees, TRUSTGRID implements an enterprise-grade **local permissioned consortium ledger** with Byzantine Fault Tolerant (PBFT) consensus.

### Core Principle
> *"Don't trust the database. Verify the proof."*

In TRUSTGRID, databases are treated as untrusted, potentially vulnerable storage caches. Verification is never performed by trusting database query results; it is performed by mathematically evaluating digital signatures, Merkle inclusion proofs, and multi-node consensus endorsement certificates.

---

## 2. Cluster Topology & Node Specifications

The core ledger runs as an interconnected cluster of three independent nodes, representing key institutional stakeholders in a national consortium:

```
                          +-------------------------------------------------------+
                          |                   CONSORTIUM NETWORK                  |
                          |  - Peer-to-Peer RPC Router                            |
                          |  - Network Latency & Partition Simulation             |
                          +---------------------------+---------------------------+
                                                      |
                  +-----------------------------------+-----------------------------------+
                  |                                   |                                   |
                  v                                   v                                   v
    +---------------------------+       +---------------------------+       +---------------------------+
    |        NODE ALPHA         |       |         NODE BETA         |       |        NODE GAMMA         |
    +---------------------------+       +---------------------------+       +---------------------------+
    | Role: Leader / Proposer   |       | Role: Validator / Endorser|       | Role: Validator / Endorser|
    | DID: did:tg:node:alpha    |       | DID: did:tg:node:beta     |       | DID: did:tg:node:gamma    |
    | DB: node_alpha.db         |       | DB: node_beta.db          |       | DB: node_gamma.db         |
    | Port: 4001                |       | Port: 4002                |       | Port: 4003                |
    | Stakeholder: University / |       | Stakeholder: Customs &    |       | Stakeholder: High Court / |
    | Academic Consortium       |       | Logistics Authority       |       | State Audit Directorate   |
    +---------------------------+       +---------------------------+       +---------------------------+
```

### 2.1. Isolated Storage Substrate
Every node maintains its **own independent database instance** using Node.js built-in `node:sqlite`:
- **Node Alpha:** `data/nodes/node-alpha.db`
- **Node Beta:** `data/nodes/node-beta.db`
- **Node Gamma:** `data/nodes/node-gamma.db`

Each node database contains isolated schema tables:
1. `local_blocks`: Stores immutable block headers, block hashes, validator signatures, round numbers, and multi-signature certificates.
2. `local_transactions`: Stores transaction payloads, content hashes, signer DIDs, notary signatures, and Merkle leaf hashes.

### 2.2. Decentralized Identities (DIDs) & Keypairs
Every node is identified by a W3C-compliant Decentralized Identifier (DID) and possesses a dedicated Ed25519 keypair:
- Cryptographic signatures are generated using Curve25519 (`ed25519`) via Node.js native `crypto.sign()`.
- Public keys are registered in the consortium DID registry (`identities` table).

---

## 3. Block Structure & Cryptographic Chaining

Every block on TRUSTGRID contains an immutable header, Merkle tree root, transactions, and a consensus endorsement certificate.

```typescript
export interface BlockHeader {
  height: number;           // Sequential block index (0 = Genesis)
  previousHash: string;     // SHA-256 hash of previous block header
  merkleRoot: string;       // Cryptographic root of binary Merkle tree
  timestamp: string;        // ISO-8601 UTC timestamp
  validatorDid: string;     // Proposer node DID
  txCount: number;          // Number of transactions in block
  round: number;            // Consensus round counter
}

export interface EndorsementCertificate {
  blockHash: string;        // Cryptographic block hash
  round: number;            // Consensus round
  votes: EndorsementVote[]; // Quorum of validator signatures (>= 2)
  quorumReached: boolean;   // True if votes >= 2
}

export interface Block {
  header: BlockHeader;
  blockHash: string;
  validatorSignature: string;
  transactions: BlockchainTransaction[];
  certificate?: EndorsementCertificate;
}
```

### 3.1. Binary Merkle Tree Verification
Each transaction in a block is converted into a leaf digest:
$$\text{leaf}_i = \text{SHA-256}(\text{txId}_i \parallel \text{contentHash}_i \parallel \text{timestamp}_i)$$

The leaves are combined pairwise into a binary Merkle tree. If an adversary tampers with even a single byte of transaction metadata in a node's local database, the recomputed Merkle root immediately diverges from the immutable `merkleRoot` stored in the block header, exposing the breach.

---

## 4. Ledger Synchronization Protocol (`syncNode`)

When a node recovers from an offline state or is repaired following Byzantine corruption:
1. **Peer Discovery:** The syncing node queries the network router to identify online healthy peers with higher block heights.
2. **Block Fetching:** The syncing node downloads missing blocks sequential from `targetNode.getHeight() + 1` to `peer.getHeight()`.
3. **Cryptographic Validation:** For each downloaded block, the syncing node validates:
   - $H_i = H_{i-1} + 1$ (height continuity)
   - $\text{previousHash}_i == \text{blockHash}_{i-1}$
   - $\text{computedMerkleRoot} == \text{block.header.merkleRoot}$
   - $\text{computedHash} == \text{block.blockHash}$
   - Endorsement certificate has $\ge 2$ valid validator signatures.
4. **Ledger Commit:** The validated block and transactions are atomically written to the local database, bringing the node back into cluster consensus.
