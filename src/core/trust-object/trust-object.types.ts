export type TrustObjectType =
  | 'CREDENTIAL'
  | 'PRODUCT'
  | 'EVIDENCE'
  | 'DEVICE'
  | 'DOCUMENT'
  | 'IDENTITY'
  | 'TRANSACTION';

export type TrustObjectStatus =
  | 'ACTIVE'
  | 'REVOKED'
  | 'EXPIRED'
  | 'TAMPERED';

export interface ProvenanceEvent {
  eventId: string;
  trustObjectId: string;
  eventType: 'CREATION' | 'TRANSFER' | 'INSPECTION' | 'LOCATION_UPDATE' | 'CUSTODY_HANDOFF' | 'STATUS_CHANGE';
  fromDid?: string;
  toDid?: string;
  location?: string;
  coordinates?: { latitude: number; longitude: number };
  timestamp: string;
  actionDescription: string;
  signature: string;
  blockchainTxId: string;
  metadata?: Record<string, any>;
}

export interface TrustObject<T = Record<string, any>> {
  trustObjectId: string;
  objectType: TrustObjectType;
  subjectId: string;
  issuerId: string;
  ownerId: string;
  createdAt: string;
  expiresAt?: string | null;
  contentHash: string;
  signature: string;
  blockchainTxId: string;
  status: TrustObjectStatus;
  metadata: T;
  provenance: ProvenanceEvent[];
  version: number;
}

export interface BlockchainProof {
  trustObjectId: string;
  contentHash: string;
  issuerId: string;
  ownerId: string;
  status: TrustObjectStatus;
  blockHeight: number;
  blockHash: string;
  txId: string;
  timestamp: string;
  merkleLeaf: string;
  merkleRoot: string;
  notarySignature: string;
  previousBlockHash: string;
  endorsementsCount?: number;
  validatorSignatures?: string[];
}

export interface VerificationCheck {
  code: string;
  name: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

export interface VerificationResult {
  overallStatus: 'AUTHENTIC' | 'TAMPERED' | 'REVOKED' | 'EXPIRED' | 'INVALID_SIGNATURE' | 'PROVENANCE_MISMATCH' | 'DEVICE_INTEGRITY_COMPROMISED' | 'CONSENSUS_REJECTED';
  trustScore: number; // 0 - 100
  trustObjectId: string;
  objectType: TrustObjectType;
  subjectId: string;
  issuerId: string;
  ownerId: string;
  presentedHash: string;
  canonicalHash: string;
  onChainHash: string;
  hashMatch: boolean;
  signatureValid: boolean;
  blockchainProofValid: boolean;
  revocationStatus: {
    isRevoked: boolean;
    revokedAt?: string | null;
    revokedBy?: string | null;
    reason?: string | null;
  };
  expirationStatus: {
    isExpired: boolean;
    expiresAt?: string | null;
  };
  provenanceStatus: {
    isValid: boolean;
    eventCount: number;
    lastCustodian: string;
  };
  blockchainProof?: BlockchainProof;
  checks: VerificationCheck[];
  riskAssessment: {
    riskScore: number;
    riskLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    factors: Array<{ factor: string; impact: number; explanation: string }>;
  };
  verifiedAt: string;
}
