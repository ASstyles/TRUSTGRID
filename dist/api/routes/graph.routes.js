"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraphRoutes = createGraphRoutes;
const express_1 = require("express");
function createGraphRoutes(graphService) {
    const router = (0, express_1.Router)();
    // GET /api/graph (with optional ?sector=EDUCATION | SUPPLY_CHAIN | LEGAL | CYBERSECURITY)
    router.get('/', (req, res) => {
        try {
            const sector = req.query.sector;
            const graphData = graphService.getTrustGraph(sector);
            res.json({ success: true, graph: graphData });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
