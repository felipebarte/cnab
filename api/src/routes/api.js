import express from 'express';
import { getWelcome, getStatus } from '../controllers/apiController.js';
import cnabRoutes from './cnabRoutes.js';
import cnab240Routes from './cnab240Routes.js';
import cnabUnifiedRoutes from './cnabUnifiedRoutes.js';
import universalRoutes from './universal/universalRoutes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from '../config/swaggerSpec.js';
import statusRoutes from './statusRoutes.js';
import healthRoutes from './healthRoutes.js';

const router = express.Router();

// Rotas principais
router.get('/', getWelcome);
router.get('/status', getStatus);

// Rotas específicas por recursos
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

// Rotas da API
router.use('/status', statusRoutes);
router.use('/health', healthRoutes);

// Aqui você pode adicionar mais rotas organizadas por recursos
// Exemplo:
// router.use('/users', userRoutes);
// router.use('/products', productRoutes);
// router.use('/auth', authRoutes);

export default router;
