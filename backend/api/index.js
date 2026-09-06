import { Router } from 'express';
import fileUpload from './fileUpload.js';
import fileRoutes from './files.js';
import graphqlRouter from './graphql.js';
import eventsRouter from './events.js';
import queuesRouter from './queues.js';

const router = Router();

// add more here as you create them
router.use('/', fileUpload);
router.use('/', fileRoutes);
router.use('/', graphqlRouter);
router.use('/', eventsRouter);
router.use('/', queuesRouter);

export default router;
