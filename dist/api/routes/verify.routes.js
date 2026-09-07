"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVerifyRoutes = createVerifyRoutes;
const express_1 = require("express");
function createVerifyRoutes(verificationService) {
    const router = (0, express_1.Router)();
    // POST /api/verify
    router.post('/', async (req, res) => {
        try {
            const { trustObjectId, presentedMetadata, verifierDid } = req.body;
            if (!trustObjectId) {
                return res.status(400).json({ success: false, error: 'trustObjectId is required' });
            }
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
            const result = await verificationService.verifyTrustObject({
                trustObjectId,
                presentedMetadata,
                verifierDid,
                clientIp,
            });
            res.json({ success: true, result });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // GET /api/verify/:trustObjectId (Instant verification via QR code or direct link)
    router.get('/:trustObjectId', async (req, res) => {
        try {
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
            const result = await verificationService.verifyTrustObject({
                trustObjectId: req.params.trustObjectId,
                clientIp,
            });
            res.json({ success: true, result });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
