import { Router } from 'express';
import { TrustGraphService } from '../../core/trust-graph/graph.service.js';

export function createGraphRoutes(graphService: TrustGraphService): Router {
  const router = Router();

  // GET /api/graph (with optional ?sector=EDUCATION | SUPPLY_CHAIN | LEGAL | CYBERSECURITY)
  router.get('/', (req, res) => {
    try {
      const sector = req.query.sector as string | undefined;
      const graphData = graphService.getTrustGraph(sector);
      res.json({ success: true, graph: graphData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
