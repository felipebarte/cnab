import express from 'express';
import { getWelcome, getStatus } from '../controllers/apiController.js';
import cnabRoutes from './cnabRoutes.js';
import cnab240Routes from './cnab240Routes.js';
import cnabUnifiedRoutes from './cnabUnifiedRoutes.js';
import universalRoutes from './universal/universalRoutes.js';
import compatibilityRoutes from './compatibilityRoutes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from '../config/swaggerSpec.js';

// Importar middleware de compatibilidade
import { fullBackwardsCompatibilityMiddleware } from '../middleware/backwardsCompatibilityMiddleware.js';

const router = express.Router();

// ✨ APLICAR MIDDLEWARE DE BACKWARDS COMPATIBILITY ✨
// Aplicado globalmente para interceptar todos os endpoints legacy
router.use(fullBackwardsCompatibilityMiddleware);

// Rotas principais
router.get('/', getWelcome);
router.get('/status', getStatus);

// 📋 ROTAS DE COMPATIBILIDADE (prioritárias)
router.use('/compatibility', compatibilityRoutes);

// Rotas específicas por recursos (LEGACY - com compatibilidade automática)
router.use('/cnab', cnabRoutes);
router.use('/cnab240', cnab240Routes);

// Rotas unificadas com detecção automática (novos endpoints inteligentes)
router.use('/cnab', cnabUnifiedRoutes);

// ✨ NOVAS ROTAS UNIVERSAIS ✨
router.use('/cnab/universal', universalRoutes);

// Documentação Swagger
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpec));

// Middleware de log
router.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

export default router;
