import { Router } from 'express';
import { CybersecurityModule } from '../../sectors/cybersecurity.module.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createCybersecurityRoutes(secModule: CybersecurityModule, db: DatabaseService): Router;
