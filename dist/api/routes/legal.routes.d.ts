import { Router } from 'express';
import { LegalEvidenceModule } from '../../sectors/legal.module.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createLegalRoutes(legalModule: LegalEvidenceModule, db: DatabaseService): Router;
