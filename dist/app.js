"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const db_service_js_1 = require("./database/db.service.js");
const consortium_blockchain_adapter_js_1 = require("./core/blockchain/consortium-blockchain.adapter.js");
const did_service_js_1 = require("./core/identity/did.service.js");
const wallet_service_js_1 = require("./core/identity/wallet.service.js");
const trust_object_service_js_1 = require("./core/trust-object/trust-object.service.js");
const provenance_service_js_1 = require("./core/provenance/provenance.service.js");
const revocation_service_js_1 = require("./core/revocation/revocation.service.js");
const anomaly_service_js_1 = require("./core/risk-engine/anomaly.service.js");
const verification_service_js_1 = require("./core/verification/verification.service.js");
const graph_service_js_1 = require("./core/trust-graph/graph.service.js");
const passport_service_js_1 = require("./core/passport/passport.service.js");
const education_module_js_1 = require("./sectors/education.module.js");
const supply_chain_module_js_1 = require("./sectors/supply-chain.module.js");
const legal_module_js_1 = require("./sectors/legal.module.js");
const cybersecurity_module_js_1 = require("./sectors/cybersecurity.module.js");
const verify_routes_js_1 = require("./api/routes/verify.routes.js");
const trust_object_routes_js_1 = require("./api/routes/trust-object.routes.js");
const education_routes_js_1 = require("./api/routes/education.routes.js");
const supply_chain_routes_js_1 = require("./api/routes/supply-chain.routes.js");
const legal_routes_js_1 = require("./api/routes/legal.routes.js");
const cybersecurity_routes_js_1 = require("./api/routes/cybersecurity.routes.js");
const blockchain_routes_js_1 = require("./api/routes/blockchain.routes.js");
const multi_node_blockchain_adapter_js_1 = require("./core/blockchain/multi-node-blockchain.adapter.js");
const graph_routes_js_1 = require("./api/routes/graph.routes.js");
const passport_routes_js_1 = require("./api/routes/passport.routes.js");
const risk_routes_js_1 = require("./api/routes/risk.routes.js");
const identity_routes_js_1 = require("./api/routes/identity.routes.js");
const demo_routes_js_1 = require("./api/routes/demo.routes.js");
const node_routes_js_1 = require("./api/routes/node.routes.js");
function createApp() {
    const app = (0, express_1.default)();
    // Core Services
    const db = db_service_js_1.DatabaseService.getInstance();
    const didService = new did_service_js_1.DidService(db);
    const blockchain = new consortium_blockchain_adapter_js_1.ConsortiumBlockchainAdapter(db);
    const trustObjectService = new trust_object_service_js_1.TrustObjectService(blockchain, db, didService);
    const provenanceService = new provenance_service_js_1.ProvenanceService(blockchain, db);
    const revocationService = new revocation_service_js_1.RevocationService(blockchain, db);
    const riskEngine = new anomaly_service_js_1.AnomalyRiskEngine(db);
    const verificationService = new verification_service_js_1.VerificationService(blockchain, trustObjectService, provenanceService, revocationService, riskEngine, didService, db);
    const graphService = new graph_service_js_1.TrustGraphService(db);
    const passportService = new passport_service_js_1.TrustPassportService(db);
    const multiNodeAdapter = new multi_node_blockchain_adapter_js_1.MultiNodeBlockchainAdapter(db);
    // Sector Modules
    const eduModule = new education_module_js_1.EducationModule(trustObjectService, db);
    const scModule = new supply_chain_module_js_1.SupplyChainModule(trustObjectService, provenanceService);
    const legalModule = new legal_module_js_1.LegalEvidenceModule(trustObjectService, provenanceService);
    const secModule = new cybersecurity_module_js_1.CybersecurityModule(trustObjectService, blockchain, db);
    // Global Middlewares
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Audit Logging Middleware
    app.use((req, _res, next) => {
        if (req.path.startsWith('/api') && req.method !== 'GET') {
            try {
                const actorDid = req.headers['x-actor-did'] || 'did:trustgrid:anon:client';
                const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
                db.run(`INSERT INTO audit_logs (id, actor_did, action, target_resource, ip_address, user_agent, details)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    actorDid,
                    `${req.method} ${req.path}`,
                    req.path,
                    clientIp,
                    req.headers['user-agent'] || null,
                    JSON.stringify(req.body || {}),
                ]);
            }
            catch {
                // Continue regardless of log error
            }
        }
        next();
    });
    // Comprehensive System Health Check (addresses SIH requirement #24)
    const healthHandler = async (_req, res) => {
        try {
            // 1. Database check
            const dbCheck = db.getOne('SELECT 1 as ok');
            const dbStatus = dbCheck?.ok === 1 ? 'ok' : 'error';
            // 2. Blockchain check & ledger integrity
            const ledgerIntegrity = await blockchain.verifyLedgerIntegrity();
            const blockchainStatus = 'ok';
            // 3. Identity & Key store check
            const notaryKey = wallet_service_js_1.WalletService.getKeyPair('did:trustgrid:sys:consortium-notary', db);
            const identityStoreStatus = notaryKey ? 'ok' : 'uninitialized';
            // 4. Multi-node cluster audit
            const clusterAudit = multiNodeAdapter.verifyCrossNodeLedger();
            // 5. Seed / Demo data readiness check
            const demoEdu = db.getOne("SELECT COUNT(*) as count FROM trust_objects WHERE trust_object_id = 'TO-EDU-DEGREE-GENUINE-2024'");
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
                protocol: 'TOP (Trust Object Protocol) v2.0',
                network: blockchain.networkType,
                networkName: blockchain.name,
                cluster: {
                    totalNodes: 3,
                    quorumReachable: clusterAudit.quorumReachable,
                    consistent: clusterAudit.consistent,
                    nodes: multiNodeAdapter.getNodes().map((n) => ({ id: n.nodeId, status: n.status, height: n.height })),
                },
                ledgerDetails: {
                    totalBlocks: ledgerIntegrity.totalBlocks,
                    verifiedTransactions: ledgerIntegrity.verifiedTxs,
                    reason: ledgerIntegrity.reason,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (err) {
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
    app.use('/api/demo', (0, demo_routes_js_1.createDemoRoutes)(verificationService, db));
    app.use('/api/verify', (0, verify_routes_js_1.createVerifyRoutes)(verificationService));
    app.use('/api/trust-objects', (0, trust_object_routes_js_1.createTrustObjectRoutes)(trustObjectService, db));
    app.use('/api/education', (0, education_routes_js_1.createEducationRoutes)(eduModule, db));
    app.use('/api/supply-chain', (0, supply_chain_routes_js_1.createSupplyChainRoutes)(scModule, db));
    app.use('/api/legal', (0, legal_routes_js_1.createLegalRoutes)(legalModule, db));
    app.use('/api/cybersecurity', (0, cybersecurity_routes_js_1.createCybersecurityRoutes)(secModule, db));
    app.use('/api/blockchain', (0, blockchain_routes_js_1.createBlockchainRoutes)(blockchain, db));
    app.use('/api/nodes', (0, node_routes_js_1.createNodeRoutes)(multiNodeAdapter));
    app.use('/api/graph', (0, graph_routes_js_1.createGraphRoutes)(graphService));
    app.use('/api/passport', (0, passport_routes_js_1.createPassportRoutes)(passportService));
    app.use('/api/risk', (0, risk_routes_js_1.createRiskRoutes)(db));
    app.use('/api/identities', (0, identity_routes_js_1.createIdentityRoutes)(didService, db));
    // Serve frontend build if available
    const clientDistPath = node_path_1.default.resolve(process.cwd(), 'client', 'dist');
    if (node_fs_1.default.existsSync(clientDistPath)) {
        app.use(express_1.default.static(clientDistPath));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api')) {
                return next();
            }
            res.sendFile(node_path_1.default.join(clientDistPath, 'index.html'));
        });
    }
    // Global Error Handler
    app.use((err, _req, res, _next) => {
        console.error('[TRUSTGRID API Error]:', err);
        res.status(err.status || 500).json({
            success: false,
            error: err.message || 'Internal Server Error',
        });
    });
    return app;
}
