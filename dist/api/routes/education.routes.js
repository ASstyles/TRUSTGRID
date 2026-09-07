"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEducationRoutes = createEducationRoutes;
const express_1 = require("express");
function createEducationRoutes(eduModule, db) {
    const router = (0, express_1.Router)();
    // GET /api/education/credentials
    router.get('/credentials', (_req, res) => {
        try {
            const rows = db.query(`SELECT c.*, t.status, t.content_hash, t.blockchain_tx_id, t.created_at, t.metadata
         FROM credentials c 
         JOIN trust_objects t ON c.trust_object_id = t.trust_object_id
         ORDER BY t.created_at_epoch DESC`);
            const credentials = rows.map((r) => ({
                id: r.id,
                trustObjectId: r.trust_object_id,
                studentDid: r.student_did,
                institutionDid: r.institution_did,
                degreeName: r.degree_name,
                major: r.major,
                graduationYear: r.graduation_year,
                cgpa: r.grade,
                serialNumber: r.serial_number,
                status: r.status,
                blockchainTxId: r.blockchain_tx_id,
                contentHash: r.content_hash,
                createdAt: r.created_at,
                metadata: JSON.parse(r.metadata),
            }));
            res.json({ success: true, count: credentials.length, credentials });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // POST /api/education/issue
    router.post('/issue', async (req, res) => {
        try {
            const { institutionDid, studentDid, metadata, customId } = req.body;
            const validation = eduModule.validateMetadata(metadata);
            if (!validation.valid) {
                return res.status(400).json({ success: false, errors: validation.errors });
            }
            const trustObject = await eduModule.issueDegree({
                institutionDid,
                studentDid,
                metadata,
                customId,
            });
            res.status(201).json({ success: true, trustObject });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
