import { Router } from 'express';
import { VerificationService } from '../../core/verification/verification.service.js';

export function createVerifyRoutes(verificationService: VerificationService): Router {
  const router = Router();

  // POST /api/verify
  router.post('/', async (req, res) => {
    try {
      const { trustObjectId, presentedMetadata, verifierDid } = req.body;
      if (!trustObjectId) {
        return res.status(400).json({ success: false, error: 'trustObjectId is required' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const result = await verificationService.verifyTrustObject({
        trustObjectId,
        presentedMetadata,
        verifierDid,
        clientIp,
      });

      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/verify/:trustObjectId (Instant verification via QR code or direct link)
  router.get('/:trustObjectId', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const result = await verificationService.verifyTrustObject({
        trustObjectId: req.params.trustObjectId,
        clientIp,
      });

      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
