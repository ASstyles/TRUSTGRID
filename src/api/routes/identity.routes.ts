import { Router } from 'express';
import { DatabaseService } from '../../database/db.service.js';
import { DidService } from '../../core/identity/did.service.js';
import { WalletService } from '../../core/identity/wallet.service.js';

export function createIdentityRoutes(didService: DidService, db: DatabaseService): Router {
  const router = Router();

  // GET /api/identities
  router.get('/', (_req, res) => {
    try {
      const identities = db.query<any>('SELECT * FROM identities ORDER BY created_at DESC');
      const users = db.query<any>('SELECT id, email, display_name, user_type, did, status FROM users');
      const organizations = db.query<any>('SELECT * FROM organizations');

      res.json({
        success: true,
        count: identities.length,
        identities,
        users,
        organizations,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/identities/:did
  router.get('/:did', (req, res) => {
    try {
      const doc = didService.resolveDid(req.params.did);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'DID document not found' });
      }
      res.json({ success: true, didDocument: doc });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/identities/create
  router.post('/create', (req, res) => {
    try {
      const { sector, identifier, entityType, controllerDid } = req.body;
      if (!sector || !identifier || !entityType) {
        return res.status(400).json({ success: false, error: 'sector, identifier, and entityType are required' });
      }

      const { did, didDocument, keyPair } = didService.createIdentity({
        sector,
        identifier,
        entityType,
        controllerDid,
      });

      const keystore = WalletService.storeKeyPair(did, keyPair);

      res.status(201).json({
        success: true,
        did,
        didDocument,
        publicKey: keyPair.publicKey,
        keystore,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
