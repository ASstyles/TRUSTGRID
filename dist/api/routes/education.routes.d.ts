import { Router } from 'express';
import { EducationModule } from '../../sectors/education.module.js';
import { DatabaseService } from '../../database/db.service.js';
export declare function createEducationRoutes(eduModule: EducationModule, db: DatabaseService): Router;
