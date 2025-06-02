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

// Middlewares personalizados
//import { errorHandler } from './middleware/errorHandler.js';
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

// Configuração CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  })
);

// Middleware de compressão
app.use(compression());

// Middleware de logging
app.use(morgan('combined'));

// Rate limiting
app.use(limiter);

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

// Middleware de erro 404
app.use(notFound);

// Middleware global de tratamento de erros
app.use(ErrorHandler.globalErrorHandler);

// Inicialização do servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);

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
