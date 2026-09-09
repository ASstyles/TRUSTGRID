import { Router } from 'express';
import { LegalEvidenceModule } from '../../sectors/legal.module.js';
import { DatabaseService } from '../../database/db.service.js';

export function createLegalRoutes(legalModule: LegalEvidenceModule, db: DatabaseService): Router {
  const router = Router();

  // GET /api/legal/evidence
  router.get('/evidence', (_req, res) => {
    try {
      const rows = db.query<any>(
        `SELECT * FROM trust_objects 
         WHERE object_type = 'EVIDENCE' 
         ORDER BY created_at_epoch DESC`
      );

      const evidenceList = rows.map((r) => {
        const custodyChain = db.query<any>(
          'SELECT * FROM provenance_events WHERE trust_object_id = ? ORDER BY timestamp ASC',
          [r.trust_object_id]
        );

        return {
          trustObjectId: r.trust_object_id,
          subjectId: r.subject_id,
          collectorDid: r.issuer_id,
          currentCustodianDid: r.owner_id,
          status: r.status,
          blockchainTxId: r.blockchain_tx_id,
          contentHash: r.content_hash,
          createdAt: r.created_at,
          metadata: JSON.parse(r.metadata),
          custodyChain,
        };
      });

      res.json({ success: true, count: evidenceList.length, evidence: evidenceList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/legal/evidence
  router.post('/evidence', async (req, res) => {
    try {
      const { investigatorDid, metadata, customId } = req.body || {};
      if (!investigatorDid || !metadata) {
        return res.status(400).json({ success: false, error: 'investigatorDid and metadata are required' });
      }

      const validation = legalModule.validateMetadata(metadata);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const trustObject = await legalModule.registerEvidence({
        investigatorDid,
        metadata,
        customId,
      });

      res.status(201).json({ success: true, trustObject });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/legal/transfer
  router.post('/transfer', async (req, res) => {
    try {
      const { trustObjectId, fromDid, toDid, location, actionDescription } = req.body || {};
      if (!trustObjectId || !fromDid || !toDid) {
        return res.status(400).json({ success: false, error: 'trustObjectId, fromDid, and toDid are required' });
      }

      const event = await legalModule.transferEvidenceCustody({
        trustObjectId,
        fromDid,
        toDid,
        location,
        actionDescription,
      });

      res.json({ success: true, event });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
