"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const db_service_js_1 = require("./database/db.service.js");
const seed_js_1 = require("./database/seed.js");
const PORT = Number(process.env.PORT) || 5000;
async function bootstrap() {
    const db = db_service_js_1.DatabaseService.getInstance();
    // Auto-seed if database is empty
    const countRow = db.getOne('SELECT COUNT(*) as count FROM trust_objects');
    if (!countRow || countRow.count === 0) {
        console.log('🚀 First launch detected: Auto-seeding database with 4 Flagship Scenarios...');
        await (0, seed_js_1.seedDatabase)(true);
    }
    const app = (0, app_js_1.createApp)();
    const server = app.listen(PORT, () => {
        console.log('================================================================');
        console.log(`🛡️  TRUSTGRID Trust Infrastructure Engine Active`);
        console.log(`🔗  Core Innovation: Trust Object Protocol (TOP) v1.0`);
        console.log(`🌐  Ledger: Consortium Notary Ledger (Production: Hyperledger Fabric)`);
        console.log(`📡  Server listening on: http://localhost:${PORT}`);
        console.log(`🎯  SIH 2026 Problem Statement 26194: Blockchain & Cybersecurity`);
        console.log('================================================================');
    });
    process.on('SIGINT', () => {
        console.log('Shutting down TRUSTGRID server...');
        server.close(() => {
            db_service_js_1.DatabaseService.getInstance().close();
            process.exit(0);
        });
    });
}
bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
