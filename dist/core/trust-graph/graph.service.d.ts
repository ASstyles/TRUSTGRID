import { DatabaseService } from '../../database/db.service.js';
export interface GraphNode {
    id: string;
    label: string;
    category: 'ENTITY' | 'TRUST_OBJECT' | 'BLOCK' | 'INCIDENT';
    sector?: 'EDUCATION' | 'SUPPLY_CHAIN' | 'LEGAL' | 'CYBERSECURITY' | 'SYSTEM';
    status?: string;
    metadata?: Record<string, any>;
}
export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label: 'ISSUED' | 'SUBJECT_OF' | 'CUSTODY_TRANSFER' | 'MONITORS' | 'REVOKED' | 'ANCHORED_IN';
    txId?: string;
    timestamp?: string;
}
export interface TrustGraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    summary: {
        totalEntities: number;
        totalTrustObjects: number;
        totalRelationships: number;
        sectorsRepresented: string[];
    };
}
export declare class TrustGraphService {
    private db;
    constructor(db?: DatabaseService);
    /**
     * Generates global or sector-filtered Trust Graph
     */
    getTrustGraph(filterSector?: string): TrustGraphData;
}
