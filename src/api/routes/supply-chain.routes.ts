import { Router } from 'express';
import { SupplyChainModule } from '../../sectors/supply-chain.module.js';
import { DatabaseService } from '../../database/db.service.js';

export function createSupplyChainRoutes(scModule: SupplyChainModule, db: DatabaseService): Router {
  const router = Router();

  // GET /api/supply-chain/products
  router.get('/products', (_req, res) => {
    try {
      const rows = db.query<any>(
        `SELECT * FROM trust_objects 
         WHERE object_type = 'PRODUCT' 
         ORDER BY created_at_epoch DESC`
      );

      const products = rows.map((r) => {
        const provenance = db.query<any>(
          'SELECT * FROM provenance_events WHERE trust_object_id = ? ORDER BY timestamp ASC',
          [r.trust_object_id]
        );

        return {
          trustObjectId: r.trust_object_id,
          subjectId: r.subject_id,
          manufacturerDid: r.issuer_id,
          currentOwnerDid: r.owner_id,
          status: r.status,
          blockchainTxId: r.blockchain_tx_id,
          contentHash: r.content_hash,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
          metadata: JSON.parse(r.metadata),
          provenanceHops: provenance.length,
          provenance,
        };
      });

      res.json({ success: true, count: products.length, products });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/supply-chain/register
  router.post('/register', async (req, res) => {
    try {
      const { manufacturerDid, metadata, customId } = req.body;
      const validation = scModule.validateMetadata(metadata);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const trustObject = await scModule.registerProductBatch({
        manufacturerDid,
        metadata,
        customId,
      });

      res.status(201).json({ success: true, trustObject });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/supply-chain/transfer
  router.post('/transfer', async (req, res) => {
    try {
      const { trustObjectId, fromDid, toDid, location, actionDescription } = req.body;
      const event = await scModule.transferProductCustody({
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
