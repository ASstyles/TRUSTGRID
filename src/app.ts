import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';

import { DatabaseService } from './database/db.service.js';
import { ConsortiumBlockchainAdapter } from './core/blockchain/consortium-blockchain.adapter.js';
import { DidService } from './core/identity/did.service.js';
import { WalletService } from './core/identity/wallet.service.js';
import { TrustObjectService } from './core/trust-object/trust-object.service.js';
import { ProvenanceService } from './core/provenance/provenance.service.js';
import { RevocationService } from './core/revocation/revocation.service.js';
import { AnomalyRiskEngine } from './core/risk-engine/anomaly.service.js';
import { VerificationService } from './core/verification/verification.service.js';
import { TrustGraphService } from './core/trust-graph/graph.service.js';
import { TrustPassportService } from './core/passport/passport.service.js';

import { EducationModule } from './sectors/education.module.js';
import { SupplyChainModule } from './sectors/supply-chain.module.js';
import { LegalEvidenceModule } from './sectors/legal.module.js';
import { CybersecurityModule } from './sectors/cybersecurity.module.js';

import { createVerifyRoutes } from './api/routes/verify.routes.js';
import { createTrustObjectRoutes } from './api/routes/trust-object.routes.js';
import { createEducationRoutes } from './api/routes/education.routes.js';
import { createSupplyChainRoutes } from './api/routes/supply-chain.routes.js';
import { createLegalRoutes } from './api/routes/legal.routes.js';
import { createCybersecurityRoutes } from './api/routes/cybersecurity.routes.js';
import { createBlockchainRoutes } from './api/routes/blockchain.routes.js';
import { createGraphRoutes } from './api/routes/graph.routes.js';
import { createPassportRoutes } from './api/routes/passport.routes.js';
import { createRiskRoutes } from './api/routes/risk.routes.js';
import { createIdentityRoutes } from './api/routes/identity.routes.js';
import { createDemoRoutes } from './api/routes/demo.routes.js';

export function createApp() {
  const app = express();

  // Core Services
  const db = DatabaseService.getInstance();
  const didService = new DidService(db);
  const blockchain = new ConsortiumBlockchainAdapter(db);
  const trustObjectService = new TrustObjectService(blockchain, db, didService);
  const provenanceService = new ProvenanceService(blockchain, db);
  const revocationService = new RevocationService(blockchain, db);
  const riskEngine = new AnomalyRiskEngine(db);
  const verificationService = new VerificationService(
    blockchain,
    trustObjectService,
    provenanceService,
    revocationService,
    riskEngine,
    didService,
    db
  );
  const graphService = new TrustGraphService(db);
  const passportService = new TrustPassportService(db);

  // Sector Modules
  const eduModule = new EducationModule(trustObjectService, db);
  const scModule = new SupplyChainModule(trustObjectService, provenanceService);
  const legalModule = new LegalEvidenceModule(trustObjectService, provenanceService);
  const secModule = new CybersecurityModule(trustObjectService, blockchain, db);

  // Global Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Audit Logging Middleware
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api') && req.method !== 'GET') {
      try {
        const actorDid = (req.headers['x-actor-did'] as string) || 'did:trustgrid:anon:client';
        const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
        db.run(
          `INSERT INTO audit_logs (id, actor_did, action, target_resource, ip_address, user_agent, details)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            actorDid,
            `${req.method} ${req.path}`,
            req.path,
            clientIp,
            req.headers['user-agent'] || null,
            JSON.stringify(req.body || {}),
          ]
        );
      } catch {
        // Continue regardless of log error
      }
    }
    next();
  });

  // Comprehensive System Health Check (addresses SIH requirement #24)
  const healthHandler = async (_req: express.Request, res: express.Response) => {
    try {
      // 1. Database check
      const dbCheck = db.getOne<{ ok: number }>('SELECT 1 as ok');
      const dbStatus = dbCheck?.ok === 1 ? 'ok' : 'error';

      // 2. Blockchain check & ledger integrity
      const ledgerIntegrity = await blockchain.verifyLedgerIntegrity();
      const blockchainStatus = 'ok';

      // 3. Identity & Key store check
      const notaryKey = WalletService.getKeyPair('did:trustgrid:sys:consortium-notary', db);
      const identityStoreStatus = notaryKey ? 'ok' : 'uninitialized';

      // 4. Seed / Demo data readiness check
      const demoEdu = db.getOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM trust_objects WHERE trust_object_id = 'TO-EDU-DEGREE-GENUINE-2024'"
      );
      const demoDataStatus = (demoEdu && demoEdu.count > 0) ? 'ready' : 'unseeded';

      const allOk = dbStatus === 'ok' && ledgerIntegrity.valid && identityStoreStatus === 'ok';

      res.status(allOk ? 200 : 503).json({
        status: allOk ? 'UP' : 'DEGRADED',
        api: 'ok',
        database: dbStatus,
        blockchain: blockchainStatus,
        ledgerIntegrity: ledgerIntegrity.valid,
        identityStore: identityStoreStatus,
        demoData: demoDataStatus,
        service: 'TRUSTGRID Trust Infrastructure',
        protocol: 'TOP (Trust Object Protocol) v1.0',
        network: blockchain.networkType,
        networkName: blockchain.name,
        ledgerDetails: {
          totalBlocks: ledgerIntegrity.totalBlocks,
          verifiedTransactions: ledgerIntegrity.verifiedTxs,
          reason: ledgerIntegrity.reason,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'DOWN',
        api: 'error',
        database: 'error',
        blockchain: 'error',
        ledgerIntegrity: false,
        identityStore: 'error',
        demoData: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Mount API Routes
  app.use('/api/demo', createDemoRoutes(verificationService, db));
  app.use('/api/verify', createVerifyRoutes(verificationService));
  app.use('/api/trust-objects', createTrustObjectRoutes(trustObjectService, db));
  app.use('/api/education', createEducationRoutes(eduModule, db));
  app.use('/api/supply-chain', createSupplyChainRoutes(scModule, db));
  app.use('/api/legal', createLegalRoutes(legalModule, db));
  app.use('/api/cybersecurity', createCybersecurityRoutes(secModule, db));
  app.use('/api/blockchain', createBlockchainRoutes(blockchain, db));
  app.use('/api/graph', createGraphRoutes(graphService));
  app.use('/api/passport', createPassportRoutes(passportService));
  app.use('/api/risk', createRiskRoutes(db));
  app.use('/api/identities', createIdentityRoutes(didService, db));

  // Serve frontend build if available
  const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[TRUSTGRID API Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}
