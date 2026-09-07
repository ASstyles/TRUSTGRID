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

export class TrustGraphService {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || DatabaseService.getInstance();
  }

  /**
   * Generates global or sector-filtered Trust Graph
   */
  public getTrustGraph(filterSector?: string): TrustGraphData {
    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // 1. Fetch Identities / Entities
    const identities = this.db.query<any>('SELECT * FROM identities');
    for (const id of identities) {
      let sector: GraphNode['sector'] = 'SYSTEM';
      if (id.did.includes(':edu:')) sector = 'EDUCATION';
      else if (id.did.includes(':sc:')) sector = 'SUPPLY_CHAIN';
      else if (id.did.includes(':legal:')) sector = 'LEGAL';
      else if (id.did.includes(':sec:')) sector = 'CYBERSECURITY';

      if (filterSector && sector !== filterSector && sector !== 'SYSTEM') {
        continue;
      }

      nodesMap.set(id.did, {
        id: id.did,
        label: id.did.split(':').pop() || id.did,
        category: 'ENTITY',
        sector,
        status: id.revoked_at ? 'REVOKED' : 'ACTIVE',
        metadata: { entityType: id.entity_type },
      });
    }

    // 2. Fetch Trust Objects
    const trustObjects = this.db.query<any>('SELECT * FROM trust_objects');
    for (const obj of trustObjects) {
      let sector: GraphNode['sector'] = 'SYSTEM';
      if (obj.object_type === 'CREDENTIAL') sector = 'EDUCATION';
      else if (obj.object_type === 'PRODUCT') sector = 'SUPPLY_CHAIN';
      else if (obj.object_type === 'EVIDENCE') sector = 'LEGAL';
      else if (obj.object_type === 'DEVICE') sector = 'CYBERSECURITY';

      if (filterSector && sector !== filterSector) {
        continue;
      }

      nodesMap.set(obj.trust_object_id, {
        id: obj.trust_object_id,
        label: obj.trust_object_id,
        category: 'TRUST_OBJECT',
        sector,
        status: obj.status,
        metadata: {
          objectType: obj.object_type,
          contentHash: obj.content_hash,
          txId: obj.blockchain_tx_id,
        },
      });

      // Edge: Issuer -> Trust Object
      if (nodesMap.has(obj.issuer_id)) {
        edges.push({
          id: `edge-${obj.issuer_id}-${obj.trust_object_id}`,
          source: obj.issuer_id,
          target: obj.trust_object_id,
          label: 'ISSUED',
          txId: obj.blockchain_tx_id,
          timestamp: obj.created_at,
        });
      }

      // Edge: Subject -> Trust Object
      if (nodesMap.has(obj.subject_id) && obj.subject_id !== obj.issuer_id) {
        edges.push({
          id: `edge-${obj.subject_id}-${obj.trust_object_id}`,
          source: obj.subject_id,
          target: obj.trust_object_id,
          label: 'SUBJECT_OF',
          txId: obj.blockchain_tx_id,
          timestamp: obj.created_at,
        });
      }
    }

    // 3. Fetch Provenance Handoffs
    const provenanceEvents = this.db.query<any>(
      'SELECT * FROM provenance_events WHERE from_did IS NOT NULL AND to_did IS NOT NULL'
    );
    for (const ev of provenanceEvents) {
      if (nodesMap.has(ev.from_did) && nodesMap.has(ev.to_did)) {
        edges.push({
          id: `prov-${ev.id}`,
          source: ev.from_did,
          target: ev.to_did,
          label: 'CUSTODY_TRANSFER',
          txId: ev.blockchain_tx_id,
          timestamp: ev.timestamp,
        });
      }
    }

    const nodes = Array.from(nodesMap.values());
    const sectors = Array.from(new Set(nodes.map((n) => n.sector).filter(Boolean))) as string[];

    return {
      nodes,
      edges,
      summary: {
        totalEntities: nodes.filter((n) => n.category === 'ENTITY').length,
        totalTrustObjects: nodes.filter((n) => n.category === 'TRUST_OBJECT').length,
        totalRelationships: edges.length,
        sectorsRepresented: sectors,
      },
    };
  }
}
