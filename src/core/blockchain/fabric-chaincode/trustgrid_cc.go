/*
 * Hyperledger Fabric Smart Contract for TRUSTGRID Trust Object Protocol (TOP v2)
 * Smart India Hackathon 2026 - Problem Statement 26194
 * Team: TruthLens
 * Framework: Fabric Contract API Go (v2.5+)
 */

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// TrustGridContract provides functions for managing Trust Objects on Hyperledger Fabric
type TrustGridContract struct {
	contractapi.Contract
}

// BlockchainProof represents the immutable cryptographic anchor of a Trust Object on-chain
type BlockchainProof struct {
	TrustObjectID     string   `json:"trustObjectId"`
	ContentHash       string   `json:"contentHash"`
	IssuerID          string   `json:"issuerId"`
	OwnerID           string   `json:"ownerId"`
	Status            string   `json:"status"` // ACTIVE, REVOKED, EXPIRED, TAMPERED
	BlockHeight       uint64   `json:"blockHeight"`
	BlockHash         string   `json:"blockHash"`
	TxID              string   `json:"txId"`
	Timestamp         string   `json:"timestamp"`
	MerkleLeaf        string   `json:"merkleLeaf"`
	MerkleRoot        string   `json:"merkleRoot"`
	NotarySignature   string   `json:"notarySignature"`
	PreviousBlockHash string   `json:"previousBlockHash"`
	EndorsementsCount int      `json:"endorsementsCount"`
	ValidatorDids     []string `json:"validatorDids"`
}

// ProvenanceRecord stores a certified custody handoff or state event
type ProvenanceRecord struct {
	EventID           string `json:"eventId"`
	TrustObjectID     string `json:"trustObjectId"`
	EventType         string `json:"eventType"` // CREATION, TRANSFER, INSPECTION, CUSTODY_HANDOFF, STATUS_CHANGE
	FromDID           string `json:"fromDid"`
	ToDID             string `json:"toDid"`
	Location          string `json:"location"`
	Timestamp         string `json:"timestamp"`
	ActionDescription string `json:"actionDescription"`
	Signature         string `json:"signature"`
	BlockchainTxID    string `json:"blockchainTxId"`
}

// SecurityAlertRecord records on-chain firmware drift or unauthorized device modifications
type SecurityAlertRecord struct {
	EventID       string `json:"eventId"`
	TrustObjectID string `json:"trustObjectId"`
	DeviceID      string `json:"deviceId"`
	EventType     string `json:"eventType"`
	Severity      string `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
	ExpectedHash  string `json:"expectedHash"`
	ObservedHash  string `json:"observedHash"`
	Description   string `json:"description"`
	ReporterDID   string `json:"reporterDid"`
	TxID          string `json:"txId"`
	Timestamp     string `json:"timestamp"`
}

// VerificationResult stores the result of an on-chain proof query
type VerificationResult struct {
	Valid          bool             `json:"valid"`
	Proof          *BlockchainProof `json:"proof,omitempty"`
	Reason         string           `json:"reason,omitempty"`
	OnChainHash    string           `json:"onChainHash"`
	Status         string           `json:"status"`
	ChaincodeEpoch int64            `json:"chaincodeEpoch"`
}

// InitLedger initializes the contract with genesis configuration
func (c *TrustGridContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	genesisProof := BlockchainProof{
		TrustObjectID:     "TO-GENESIS-000",
		ContentHash:       "0000000000000000000000000000000000000000000000000000000000000000",
		IssuerID:          "did:trustgrid:sys:genesis",
		OwnerID:           "did:trustgrid:sys:genesis",
		Status:            "ACTIVE",
		BlockHeight:       0,
		BlockHash:         "0000000000000000000000000000000000000000000000000000000000000000",
		TxID:              "genesis-tx",
		Timestamp:         time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339),
		MerkleLeaf:        "genesis-merkle-leaf",
		MerkleRoot:        "genesis-merkle-root",
		NotarySignature:   "genesis-signature",
		PreviousBlockHash: "0000000000000000000000000000000000000000000000000000000000000000",
		EndorsementsCount: 3,
		ValidatorDids:     []string{"did:trustgrid:node:alpha", "did:trustgrid:node:beta", "did:trustgrid:node:gamma"},
	}

	proofBytes, err := json.Marshal(genesisProof)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("TO-GENESIS-000", proofBytes)
}

// RegisterProof anchors a newly minted Trust Object onto the Fabric ledger
func (c *TrustGridContract) RegisterProof(
	ctx contractapi.TransactionContextInterface,
	trustObjectId string,
	contentHash string,
	issuerId string,
	ownerId string,
	signerDid string,
	signature string,
	payloadJson string,
) (*BlockchainProof, error) {
	if len(trustObjectId) == 0 || len(contentHash) == 0 {
		return nil, fmt.Errorf("trustObjectId and contentHash are required")
	}

	// Check if already registered
	existingBytes, err := ctx.GetStub().GetState(trustObjectId)
	if err != nil {
		return nil, fmt.Errorf("failed to read world state: %v", err)
	}
	if existingBytes != nil {
		return nil, fmt.Errorf("trust object %s is already anchored on-chain", trustObjectId)
	}

	txID := ctx.GetStub().GetTxID()
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	timestampStr := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		timestampStr = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

	// Compute Merkle leaf hash
	leafRaw := fmt.Sprintf("%s:%s:%s", txID, contentHash, timestampStr)
	h := sha256.Sum256([]byte(leafRaw))
	merkleLeaf := hex.EncodeToString(h[:])

	// Construct anchor proof
	proof := BlockchainProof{
		TrustObjectID:     trustObjectId,
		ContentHash:       contentHash,
		IssuerID:          issuerId,
		OwnerID:           ownerId,
		Status:            "ACTIVE",
		BlockHeight:       1,
		BlockHash:         merkleLeaf,
		TxID:              txID,
		Timestamp:         timestampStr,
		MerkleLeaf:        merkleLeaf,
		MerkleRoot:        merkleLeaf,
		NotarySignature:   signature,
		PreviousBlockHash: "fabric-channel-anchor",
		EndorsementsCount: 2,
		ValidatorDids:     []string{"did:trustgrid:node:alpha", "did:trustgrid:node:beta"},
	}

	proofBytes, err := json.Marshal(proof)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize proof: %v", err)
	}

	err = ctx.GetStub().PutState(trustObjectId, proofBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to write proof to ledger: %v", err)
	}

	return &proof, nil
}

// VerifyProof checks whether an object exists on ledger and matches expected content hash
func (c *TrustGridContract) VerifyProof(
	ctx contractapi.TransactionContextInterface,
	trustObjectId string,
	expectedHash string,
) (*VerificationResult, error) {
	proofBytes, err := ctx.GetStub().GetState(trustObjectId)
	if err != nil {
		return nil, fmt.Errorf("failed to read from ledger: %v", err)
	}
	if proofBytes == nil {
		return &VerificationResult{
			Valid:          false,
			Reason:         fmt.Sprintf("Trust Object %s is not registered on Fabric ledger", trustObjectId),
			ChaincodeEpoch: time.Now().Unix(),
		}, nil
	}

	var proof BlockchainProof
	err = json.Unmarshal(proofBytes, &proof)
	if err != nil {
		return nil, fmt.Errorf("failed to parse on-chain proof: %v", err)
	}

	if proof.ContentHash != expectedHash {
		return &VerificationResult{
			Valid:          false,
			Proof:          &proof,
			OnChainHash:    proof.ContentHash,
			Status:         "TAMPERED",
			Reason:         fmt.Sprintf("Content hash mismatch: registered %s != presented %s", proof.ContentHash, expectedHash),
			ChaincodeEpoch: time.Now().Unix(),
		}, nil
	}

	if proof.Status == "REVOKED" {
		return &VerificationResult{
			Valid:          false,
			Proof:          &proof,
			OnChainHash:    proof.ContentHash,
			Status:         "REVOKED",
			Reason:         "Trust Object is permanently REVOKED on ledger",
			ChaincodeEpoch: time.Now().Unix(),
		}, nil
	}

	return &VerificationResult{
		Valid:          true,
		Proof:          &proof,
		OnChainHash:    proof.ContentHash,
		Status:         proof.Status,
		ChaincodeEpoch: time.Now().Unix(),
	}, nil
}

// RevokeProof marks an active proof as REVOKED on the Fabric ledger
func (c *TrustGridContract) RevokeProof(
	ctx contractapi.TransactionContextInterface,
	trustObjectId string,
	reason string,
	revokerDid string,
	signature string,
) (*BlockchainProof, error) {
	proofBytes, err := ctx.GetStub().GetState(trustObjectId)
	if err != nil {
		return nil, fmt.Errorf("failed to read ledger: %v", err)
	}
	if proofBytes == nil {
		return nil, fmt.Errorf("cannot revoke: trust object %s not found on ledger", trustObjectId)
	}

	var proof BlockchainProof
	err = json.Unmarshal(proofBytes, &proof)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal proof: %v", err)
	}

	proof.Status = "REVOKED"
	txID := ctx.GetStub().GetTxID()
	proof.TxID = txID

	updatedBytes, err := json.Marshal(proof)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal revoked proof: %v", err)
	}

	err = ctx.GetStub().PutState(trustObjectId, updatedBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to commit revocation: %v", err)
	}

	return &proof, nil
}

// AddProvenanceEvent records a custody handoff in world state
func (c *TrustGridContract) AddProvenanceEvent(
	ctx contractapi.TransactionContextInterface,
	eventJson string,
) (*ProvenanceRecord, error) {
	var record ProvenanceRecord
	err := json.Unmarshal([]byte(eventJson), &record)
	if err != nil {
		return nil, fmt.Errorf("invalid provenance event JSON: %v", err)
	}

	record.BlockchainTxID = ctx.GetStub().GetTxID()
	stateKey := fmt.Sprintf("PROV~%s~%s", record.TrustObjectID, record.EventID)

	eventBytes, err := json.Marshal(record)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(stateKey, eventBytes)
	if err != nil {
		return nil, err
	}

	return &record, nil
}

// RecordSecurityEvent records an immutable cybersecurity tampering or firmware alert
func (c *TrustGridContract) RecordSecurityEvent(
	ctx contractapi.TransactionContextInterface,
	alertJson string,
) (*SecurityAlertRecord, error) {
	var alert SecurityAlertRecord
	err := json.Unmarshal([]byte(alertJson), &alert)
	if err != nil {
		return nil, fmt.Errorf("invalid security alert JSON: %v", err)
	}

	alert.TxID = ctx.GetStub().GetTxID()
	stateKey := fmt.Sprintf("SEC~%s~%s", alert.TrustObjectID, alert.EventID)

	alertBytes, err := json.Marshal(alert)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(stateKey, alertBytes)
	if err != nil {
		return nil, err
	}

	return &alert, nil
}

// GetProof queries the current state of a proof
func (c *TrustGridContract) GetProof(
	ctx contractapi.TransactionContextInterface,
	trustObjectId string,
) (*BlockchainProof, error) {
	proofBytes, err := ctx.GetStub().GetState(trustObjectId)
	if err != nil {
		return nil, err
	}
	if proofBytes == nil {
		return nil, fmt.Errorf("proof %s not found", trustObjectId)
	}

	var proof BlockchainProof
	err = json.Unmarshal(proofBytes, &proof)
	if err != nil {
		return nil, err
	}

	return &proof, nil
}

func main() {
	cc, err := contractapi.NewChaincode(&TrustGridContract{})
	if err != nil {
		fmt.Printf("Error creating TRUSTGRID chaincode: %v\n", err)
		return
	}

	if err := cc.Start(); err != nil {
		fmt.Printf("Error starting TRUSTGRID chaincode: %v\n", err)
	}
}
