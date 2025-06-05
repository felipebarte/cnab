import express from 'express';
import { getWelcome, getStatus } from '../controllers/apiController.js';
import cnabRoutes from './cnabRoutes.js';
import cnab240Routes from './cnab240Routes.js';
import cnabUnifiedRoutes from './cnabUnifiedRoutes.js';
import resultadosRoutes from './resultadosRoutes.js';
import universalRoutes from './universal/universalRoutes.js';
import compatibilityRoutes from './compatibilityRoutes.js';
import swapRoutes from './swapRoutes.js';
import cnabSwapRoutes from './cnabSwapRoutes.js';
import cnabPersistidosRoutes from './cnabPersistidosRoutes.js';
import metricsRoutes from './metricsRoutes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

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

// 🎯 ROTAS DE RESULTADOS (PRD) ✨
router.use('/cnab/resultados', resultadosRoutes);

// 💾 ROTAS DE DADOS PERSISTIDOS ✨
router.use('/cnab/persistidos', cnabPersistidosRoutes);

// ✨ NOVAS ROTAS UNIVERSAIS ✨
router.use('/cnab/universal', universalRoutes);

// 🔄 ROTAS SWAP FINANCIAL INTEGRATION ✨
router.use('/swap', swapRoutes);

// 🎯 ROTAS CNAB-SWAP ORCHESTRATION ✨
router.use('/cnab-swap', cnabSwapRoutes);

// 📊 ROTAS METRICS & MONITORING ✨
router.use('/metrics', metricsRoutes);

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CNAB Payment System API',
      version: '1.0.0',
      description: 'API para processamento de arquivos CNAB e pagamento de boletos com integração Swap Financial',
      contact: {
        name: 'API Support',
        email: 'support@cnabsystem.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desenvolvimento'
      },
      {
        url: 'https://api.cnabsystem.com',
        description: 'Servidor de produção'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js'] // Caminho para os arquivos de rotas
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Rota da documentação Swagger
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rota para obter o spec JSON do Swagger
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Rota de saúde da API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      cnab: 'available',
      cnab240: 'available',
      cnabUnified: 'available',
      universal: 'available',
      compatibility: 'available',
      swap: 'available',
      cnabSwap: 'available',
      metrics: 'available'
    }
  });
});

// Middleware de log
router.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

export default router;
