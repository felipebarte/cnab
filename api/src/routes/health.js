import express from 'express';
import { getHealthStatus } from '../controllers/healthController.js';

const router = express.Router();

// GET /health - Verificação básica de saúde
router.get('/', getHealthStatus);

// GET /health/detailed - Verificação detalhada
router.get('/detailed', getHealthStatus);

export default router;
