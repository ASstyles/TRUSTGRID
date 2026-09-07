import { createApp } from './app.js';
import { DatabaseService } from './database/db.service.js';
import { seedDatabase } from './database/seed.js';

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  const db = DatabaseService.getInstance();

  // Auto-seed if database is empty
  const countRow = db.getOne<{ count: number }>('SELECT COUNT(*) as count FROM trust_objects');
  if (!countRow || countRow.count === 0) {
    console.log('🚀 First launch detected: Auto-seeding database with 4 Flagship Scenarios...');
    await seedDatabase(true);
  }

  const app = createApp();

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
      DatabaseService.getInstance().close();
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
