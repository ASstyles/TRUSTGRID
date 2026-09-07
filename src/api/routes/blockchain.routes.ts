import { Router } from 'express';
import { BlockchainAdapter } from '../../core/blockchain/blockchain.interface.js';
import { DatabaseService } from '../../database/db.service.js';

export function createBlockchainRoutes(blockchain: BlockchainAdapter, db: DatabaseService): Router {
  const router = Router();

  // GET /api/blockchain/status
  router.get('/status', async (_req, res) => {
    try {
      const integrity = await blockchain.verifyLedgerIntegrity();
      const blocks = await blockchain.getAuditLedger();
      const txCountRow = db.getOne<{ count: number }>('SELECT COUNT(*) as count FROM blockchain_transactions');

      res.json({
        success: true,
        networkType: blockchain.networkType,
        networkName: blockchain.name,
        architectureNote: 'MVP operates an in-process consortium-style cryptographic ledger. Production targets Hyperledger Fabric with zero protocol changes.',
        totalBlocks: blocks.length,
        currentHeight: blocks.length > 0 ? blocks[blocks.length - 1].header.height : 0,
        totalTransactions: txCountRow?.count || 0,
        ledgerIntegrity: integrity,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/blockchain/blocks
  router.get('/blocks', async (_req, res) => {
    try {
      const blocks = await blockchain.getAuditLedger();
      res.json({ success: true, count: blocks.length, blocks: blocks.slice().reverse() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/blockchain/transactions/:txId
  router.get('/transactions/:txId', async (req, res) => {
    try {
      const tx = await blockchain.getTransaction(req.params.txId);
      if (!tx) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      res.json({ success: true, transaction: tx });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/blockchain/proof/:trustObjectId
  router.get('/proof/:trustObjectId', async (req, res) => {
    try {
      const proof = await blockchain.getProof(req.params.trustObjectId);
      if (!proof) {
        return res.status(404).json({ success: false, error: 'Proof not found' });
      }
      res.json({ success: true, proof });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
