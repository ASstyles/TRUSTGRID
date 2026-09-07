import { Router } from 'express';
import { TrustPassportService } from '../../core/passport/passport.service.js';

export function createPassportRoutes(passportService: TrustPassportService): Router {
  const router = Router();

  // GET /api/passport/:did (supports ?selective=true|false)
  router.get('/:did', (req, res) => {
    try {
      const selective = req.query.selective !== 'false';
      const passport = passportService.generatePassport(req.params.did, selective);
      if (!passport) {
        return res.status(404).json({ success: false, error: 'Identity not found for DID' });
      }

      res.json({ success: true, passport });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
