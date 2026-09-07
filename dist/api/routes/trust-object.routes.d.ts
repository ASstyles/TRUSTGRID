import { Router } from 'express';
import { TrustObjectService } from '../../core/trust-object/trust-object.service.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createTrustObjectRoutes(trustObjectService: TrustObjectService, db: DatabaseService): Router;
