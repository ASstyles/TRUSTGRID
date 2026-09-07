import { Router } from 'express';
import { DatabaseService } from '../../database/db.service.js';

export function createRiskRoutes(db: DatabaseService): Router {
  const router = Router();

  // GET /api/risk/events
  router.get('/events', (_req, res) => {
    try {
      const rows = db.query<any>('SELECT * FROM risk_events ORDER BY timestamp DESC LIMIT 50');
      const events = rows.map((r) => ({
        id: r.id,
        trustObjectId: r.trust_object_id,
        actorDid: r.actor_did,
        riskScore: r.risk_score,
        riskLevel: r.risk_level,
        anomalyType: r.anomaly_type,
        primaryFactors: JSON.parse(r.primary_factors),
        timestamp: r.timestamp,
      }));

      res.json({ success: true, count: events.length, events });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/risk/stats
  router.get('/stats', (_req, res) => {
    try {
      const totalVerifications = db.getOne<{ count: number }>('SELECT COUNT(*) as count FROM verification_events');
      const tamperedCount = db.getOne<{ count: number }>("SELECT COUNT(*) as count FROM verification_events WHERE result_status = 'TAMPERED'");
      const revokedCount = db.getOne<{ count: number }>("SELECT COUNT(*) as count FROM verification_events WHERE result_status = 'REVOKED'");
      const authenticCount = db.getOne<{ count: number }>("SELECT COUNT(*) as count FROM verification_events WHERE result_status = 'AUTHENTIC'");
      const avgScoreRow = db.getOne<{ avg: number }>('SELECT AVG(risk_score) as avg FROM verification_events');

      res.json({
        success: true,
        stats: {
          totalVerifications: totalVerifications?.count || 0,
          authentic: authenticCount?.count || 0,
          tampered: tamperedCount?.count || 0,
          revoked: revokedCount?.count || 0,
          avgRiskScore: Math.round(avgScoreRow?.avg || 0),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
