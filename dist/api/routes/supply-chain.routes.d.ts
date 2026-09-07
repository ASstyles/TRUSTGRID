import { Router } from 'express';
import { SupplyChainModule } from '../../sectors/supply-chain.module.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createSupplyChainRoutes(scModule: SupplyChainModule, db: DatabaseService): Router;
