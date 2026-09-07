"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPassportRoutes = createPassportRoutes;
const express_1 = require("express");
function createPassportRoutes(passportService) {
    const router = (0, express_1.Router)();
    // GET /api/passport/:did (supports ?selective=true|false)
    router.get('/:did', (req, res) => {
        try {
            const selective = req.query.selective !== 'false';
            const passport = passportService.generatePassport(req.params.did, selective);
            if (!passport) {
                return res.status(404).json({ success: false, error: 'Identity not found for DID' });
            }
            res.json({ success: true, passport });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
