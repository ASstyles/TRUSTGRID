import { Router } from 'express';
import { BlockchainAdapter } from '../../core/blockchain/blockchain.interface.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createBlockchainRoutes(blockchain: BlockchainAdapter, db: DatabaseService): Router;
