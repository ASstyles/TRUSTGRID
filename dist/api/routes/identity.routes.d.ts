import { Router } from 'express';
import { DatabaseService } from '../../database/db.service.js';
import { DidService } from '../../core/identity/did.service.js';
export declare function createIdentityRoutes(didService: DidService, db: DatabaseService): Router;
