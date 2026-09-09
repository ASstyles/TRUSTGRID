import { ConsortiumNode } from './consortium-node.js';

function parseArgs(): {
  nodeId: string;
  name?: string;
  port: number;
  peers: string[];
  dbPath?: string;
} {
  const args = process.argv.slice(2);
  let nodeId = process.env.NODE_ID || 'node-1';
  let port = Number(process.env.PORT || process.env.NODE_PORT) || 4101;
  let peersStr = process.env.PEER_URLS || process.env.PEER_NODES || process.env.PEERS || '';
  let name = process.env.NODE_NAME;
  let dbPath = process.env.DATABASE_FILE || process.env.DB_PATH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) {
      nodeId = args[++i];
    } else if (args[i] === '--port' && args[i + 1]) {
      port = Number(args[++i]);
    } else if ((args[i] === '--peers' || args[i] === '--peer-urls') && args[i + 1]) {
      peersStr = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--db' && args[i + 1]) {
      dbPath = args[++i];
    }
  }

  const peers = peersStr
    ? peersStr.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    : [];

  return { nodeId, name, port, peers, dbPath };
}

async function main() {
  const config = parseArgs();
  console.log('================================================================');
  console.log(`🔷 TRUSTGRID Consortium Node Process: [${config.nodeId}]`);
  console.log(`📡 Port: ${config.port}`);
  console.log(`🌐 Configured Peers: ${config.peers.join(', ') || 'None (standalone)'}`);
  console.log('================================================================');

  const node = new ConsortiumNode({
    nodeId: config.nodeId,
    name: config.name,
    port: config.port,
    peers: config.peers,
    dbPath: config.dbPath,
  });

  await node.start();
  console.log(`✅ [${config.nodeId}] Node online and listening at http://localhost:${config.port}`);
  console.log(`   ↳ Status Endpoint:  GET  http://localhost:${config.port}/blocks/status`);
  console.log(`   ↳ Receive Endpoint: POST http://localhost:${config.port}/blocks/receive`);
  console.log(`   ↳ Propose Endpoint: POST http://localhost:${config.port}/blocks/propose`);
  console.log(`   ↳ Verify Endpoint:  GET  http://localhost:${config.port}/verify`);

  const shutdown = async () => {
    console.log(`\n🛑 Shutting down node [${config.nodeId}]...`);
    await node.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error starting consortium node:', err);
  process.exit(1);
});
