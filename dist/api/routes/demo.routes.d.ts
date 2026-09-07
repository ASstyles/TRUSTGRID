import { Router } from 'express';
import { VerificationService } from '../../core/verification/verification.service.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createDemoRoutes(verificationService: VerificationService, db: DatabaseService): Router;
