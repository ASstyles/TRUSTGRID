"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCybersecurityRoutes = createCybersecurityRoutes;
const express_1 = require("express");
function createCybersecurityRoutes(secModule, db) {
    const router = (0, express_1.Router)();
    // GET /api/cybersecurity/devices
    router.get('/devices', (_req, res) => {
        try {
            const rows = db.query(`SELECT * FROM trust_objects 
         WHERE object_type = 'DEVICE' 
         ORDER BY created_at_epoch DESC`);
            const devices = rows.map((r) => {
                const securityEvents = db.query('SELECT * FROM security_events WHERE trust_object_id = ? ORDER BY timestamp DESC', [r.trust_object_id]);
                return {
                    trustObjectId: r.trust_object_id,
                    deviceId: r.subject_id,
                    adminDid: r.issuer_id,
                    status: r.status,
                    blockchainTxId: r.blockchain_tx_id,
                    contentHash: r.content_hash,
                    createdAt: r.created_at,
                    metadata: JSON.parse(r.metadata),
                    securityIncidentsCount: securityEvents.length,
                    securityEvents,
                };
            });
            res.json({ success: true, count: devices.length, devices });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // POST /api/cybersecurity/register
    router.post('/register', async (req, res) => {
        try {
            const { adminDid, metadata, customId } = req.body;
            const validation = secModule.validateMetadata(metadata);
            if (!validation.valid) {
                return res.status(400).json({ success: false, errors: validation.errors });
            }
            const trustObject = await secModule.registerDeviceBaseline({
                adminDid,
                metadata,
                customId,
            });
            res.status(201).json({ success: true, trustObject });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // POST /api/cybersecurity/audit (Trigger live device integrity audit)
    router.post('/audit', async (req, res) => {
        try {
            const { trustObjectId, observedConfigHash, reporterDid } = req.body;
            if (!trustObjectId || !observedConfigHash) {
                return res.status(400).json({ success: false, error: 'trustObjectId and observedConfigHash are required' });
            }
            const auditResult = await secModule.auditDeviceIntegrity({
                trustObjectId,
                observedConfigHash,
                reporterDid: reporterDid || 'did:trustgrid:sec:soc-automated-probe',
            });
            res.json({ success: true, auditResult });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // GET /api/cybersecurity/events
    router.get('/events', (_req, res) => {
        try {
            const events = db.query('SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 50');
            res.json({ success: true, count: events.length, events });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
