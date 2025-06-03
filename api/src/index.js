import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Logger from './utils/logger.js';
import ErrorHandler from './utils/errorHandler.js';

// Configuração de variáveis de ambiente
dotenv.config();

// Importação do Swagger
import { setupSwagger } from './config/swagger.js';

// Importação das rotas
import healthRoutes from './routes/health.js';
import apiRoutes from './routes/api.js';

// Middlewares personalizados - Sistema de Métricas e Tratamento de Erros
import { metricsMiddleware } from './utils/metrics.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Configuração de rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutos por padrão
  max: process.env.RATE_LIMIT_MAX || 100, // limite de 100 requests por janela de tempo
  message: {
    error: 'Muitas requisições deste IP, tente novamente mais tarde.',
  },
});

// Middleware de segurança
app.use(helmet());

// Configuração CORS - Atualizada para incluir containers Docker
const allowedOrigins = [
  // Desenvolvimento local
  'http://localhost:3000',  // Frontend React (porta padrão)
  'http://localhost:3001',  // Frontend React (porta alternativa)
  'http://localhost:5173',  // Vite dev server (porta padrão)
  'http://localhost:5174',  // Vite dev server (porta alternativa)
  'http://localhost:8080',  // Backend (para testes internos)

  // Docker containers
  'http://frontend:80',     // Container frontend interno
  'http://cnab-frontend:80', // Container frontend por nome
  'http://127.0.0.1:3000',  // Docker host local
  'http://0.0.0.0:3000',    // Docker bind all interfaces
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requisições sem origin (ex: aplicativos mobile, Postman)
      if (!origin) return callback(null, true);

      // Verificar se a origin está na lista permitida
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`🚨 CORS: Origin '${origin}' não permitida`);
        callback(new Error('CORS: Origin não permitida'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Middleware de compressão
app.use(compression());

// Middleware de logging
app.use(morgan('combined'));

// Rate limiting
app.use(limiter);

// 📊 MIDDLEWARE DE MÉTRICAS - Deve vir antes das rotas
app.use(metricsMiddleware);

// Middleware de logging para requisições
app.use((req, res, next) => {
  const operationId = Logger.generateOperationId();
  req.operationId = operationId;

  Logger.info('Nova requisição recebida', {
    operationId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    component: 'api',
  });

  next();
});

// Parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração do Swagger (antes das rotas da API)
setupSwagger(app);

// Rotas
app.use('/health', healthRoutes);
app.use('/api/v1', apiRoutes);

// 🚫 MIDDLEWARE DE ERRO 404 - Sistema Atualizado
app.use(notFoundHandler);

// 🚨 MIDDLEWARE GLOBAL DE TRATAMENTO DE ERROS - Sistema Robusto  
app.use(errorHandler);

// Inicialização do servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Métricas: http://localhost:${PORT}/api/v1/metrics`);

  Logger.info('🚀 Servidor CNAB API iniciado', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    component: 'server',
  });

  Logger.info('📋 Configurações carregadas', {
    webhookEnabled: process.env.WEBHOOK_ENABLED !== 'false',
    webhookUrl: process.env.WEBHOOK_URL ? process.env.WEBHOOK_URL.substring(0, 50) + '...' : 'Não configurada',
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsEnabled: true,
    errorHandlingEnabled: true,
    component: 'config',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, fechando servidor graciosamente...');
  server.close(() => {
    console.log('Processo finalizado');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recebido, fechando servidor graciosamente...');
  server.close(() => {
    console.log('Processo finalizado');
  });
});

// Tratamento de processo para erros não capturados
process.on('uncaughtException', (error) => {
  Logger.error('Exceção não capturada', error, {
    component: 'process',
    fatal: true,
  });

  // Graceful shutdown
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Promise rejeitada não tratada', reason, {
    promise: promise.toString(),
    component: 'process',
  });
});

export default app;
