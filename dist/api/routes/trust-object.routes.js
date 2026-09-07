"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrustObjectRoutes = createTrustObjectRoutes;
const express_1 = require("express");
function createTrustObjectRoutes(trustObjectService, db) {
    const router = (0, express_1.Router)();
    // GET /api/trust-objects - list all with optional sector filtering
    router.get('/', (req, res) => {
        try {
            const { sector, status, limit = 50 } = req.query;
            let query = 'SELECT * FROM trust_objects WHERE 1=1';
            const params = [];
            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }
            if (sector === 'EDUCATION') {
                query += " AND object_type = 'CREDENTIAL'";
            }
            else if (sector === 'SUPPLY_CHAIN') {
                query += " AND object_type = 'PRODUCT'";
            }
            else if (sector === 'LEGAL') {
                query += " AND object_type = 'EVIDENCE'";
            }
            else if (sector === 'CYBERSECURITY') {
                query += " AND object_type = 'DEVICE'";
            }
            query += ' ORDER BY created_at_epoch DESC LIMIT ?';
            params.push(Number(limit));
            const rows = db.query(query, params);
            const objects = rows.map((r) => ({
                trustObjectId: r.trust_object_id,
                objectType: r.object_type,
                subjectId: r.subject_id,
                issuerId: r.issuer_id,
                ownerId: r.owner_id,
                createdAt: r.created_at,
                expiresAt: r.expires_at,
                contentHash: r.content_hash,
                signature: r.signature,
                blockchainTxId: r.blockchain_tx_id,
                status: r.status,
                metadata: JSON.parse(r.metadata),
                version: r.version,
            }));
            res.json({ success: true, count: objects.length, objects });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // GET /api/trust-objects/:id
    router.get('/:id', async (req, res) => {
        try {
            const obj = await trustObjectService.getTrustObject(req.params.id);
            if (!obj) {
                return res.status(404).json({ success: false, error: 'Trust Object not found' });
            }
            res.json({ success: true, trustObject: obj });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // POST /api/trust-objects (Generic Trust Object Protocol creation)
    router.post('/', async (req, res) => {
        try {
            const { objectType, subjectId, issuerId, ownerId, metadata, expiresAt, customId } = req.body;
            if (!objectType || !subjectId || !issuerId || !metadata) {
                return res.status(400).json({ success: false, error: 'Missing required parameters (objectType, subjectId, issuerId, metadata)' });
            }
            const obj = await trustObjectService.createTrustObject({
                objectType,
                subjectId,
                issuerId,
                ownerId,
                metadata,
                expiresAt,
                customId,
            });
            res.status(201).json({ success: true, trustObject: obj });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // POST /api/trust-objects/:id/tamper (Simulate tampering for demo)
    router.post('/:id/tamper', async (req, res) => {
        try {
            const { modifiedMetadata } = req.body;
            trustObjectService.simulateTamper(req.params.id, modifiedMetadata || { tamperedField: 'UNAUTHORIZED_ALTERATION' });
            res.json({ success: true, message: `Tampering simulated for object ${req.params.id}` });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
