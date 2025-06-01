/**
 * Rotas unificadas para operações CNAB com detecção automática de formato
 * 
 * Endpoints que detectam automaticamente se o arquivo é CNAB 240 ou 400
 * e roteiam o processamento para o serviço apropriado.
 */

import express from 'express';
import CnabUnifiedController from '../controllers/cnabUnifiedController.js';
import unifiedUploadMiddleware, {
  autoDetectOnlyMiddleware,
  validateFormatMiddleware
} from '../middleware/unifiedUploadMiddleware.js';
import operationIdMiddleware from '../middleware/operationIdMiddleware.js';

const router = express.Router();

// Middleware de operationId para todas as rotas
router.use(operationIdMiddleware);

/**
 * GET /api/v1/cnab/info-auto
 * Informações sobre o sistema de detecção automática
 */
router.get('/info-auto', CnabUnifiedController.informacoes);

/**
 * POST /api/v1/cnab/detectar-formato
 * Detecta o formato do arquivo CNAB sem processar
 * Suporta upload de arquivo ou conteúdo via JSON
 */
router.post('/detectar-formato',
  unifiedUploadMiddleware, // Suporta upload opcional
  CnabUnifiedController.detectarFormato
);

/**
 * POST /api/v1/cnab/processar-auto/upload
 * Processa arquivo CNAB com detecção automática via upload
 * Detecta automaticamente se é CNAB 240 ou 400 e processa adequadamente
 */
router.post('/processar-auto/upload',
  unifiedUploadMiddleware, // Upload + detecção automática
  validateFormatMiddleware(['CNAB_240', 'CNAB_400']), // Valida formatos suportados
  CnabUnifiedController.processarArquivoAutoUpload
);

/**
 * POST /api/v1/cnab/processar-auto
 * Processa conteúdo CNAB com detecção automática via JSON
 * Detecta automaticamente se é CNAB 240 ou 400 e processa adequadamente
 */
router.post('/processar-auto',
  autoDetectOnlyMiddleware, // Apenas detecção (sem upload)
  validateFormatMiddleware(['CNAB_240', 'CNAB_400']), // Valida formatos suportados
  CnabUnifiedController.processarConteudoAuto
);

/**
 * POST /api/v1/cnab/validar-auto
 * Valida arquivo CNAB automaticamente
 * Detecta o formato e aplica as validações específicas
 * Suporta upload de arquivo ou conteúdo via JSON
 */
router.post('/validar-auto',
  unifiedUploadMiddleware, // Suporta upload opcional
  CnabUnifiedController.validarAuto
);

/**
 * POST /api/v1/cnab/webhook-auto/upload
 * Processa arquivo e envia para webhook com detecção automática
 * Detecta automaticamente o formato e processa adequadamente
 */
router.post('/webhook-auto/upload',
  unifiedUploadMiddleware, // Upload + detecção automática
  validateFormatMiddleware(['CNAB_240', 'CNAB_400']), // Valida formatos suportados
  CnabUnifiedController.webhookAutoUpload
);

/**
 * Rotas para compatibilidade com endpoints específicos por formato
 * Mantém compatibilidade com rotas existentes
 */

/**
 * POST /api/v1/cnab/processar-240
 * Força processamento como CNAB 240 (sem detecção automática)
 */
router.post('/processar-240',
  unifiedUploadMiddleware,
  validateFormatMiddleware(['CNAB_240']), // Apenas CNAB 240
  (req, res, next) => {
    // Forçar formato CNAB 240 mesmo se detectou diferente
    if (req.cnabFormat && req.cnabFormat.codigo !== 'CNAB_240') {
      return res.status(400).json({
        sucesso: false,
        erro: `Formato detectado (${req.cnabFormat.nome}) não é CNAB 240`,
        codigo: 'FORMATO_INCORRETO',
        formatoDetectado: req.cnabFormat.codigo,
        formatoRequerido: 'CNAB_240',
        operationId: req.operationId
      });
    }
    next();
  },
  CnabUnifiedController.processarArquivoAutoUpload
);

/**
 * POST /api/v1/cnab/processar-400
 * Força processamento como CNAB 400 (sem detecção automática)
 */
router.post('/processar-400',
  unifiedUploadMiddleware,
  validateFormatMiddleware(['CNAB_400']), // Apenas CNAB 400
  (req, res, next) => {
    // Forçar formato CNAB 400 mesmo se detectou diferente
    if (req.cnabFormat && req.cnabFormat.codigo !== 'CNAB_400') {
      return res.status(400).json({
        sucesso: false,
        erro: `Formato detectado (${req.cnabFormat.nome}) não é CNAB 400`,
        codigo: 'FORMATO_INCORRETO',
        formatoDetectado: req.cnabFormat.codigo,
        formatoRequerido: 'CNAB_400',
        operationId: req.operationId
      });
    }
    next();
  },
  CnabUnifiedController.processarArquivoAutoUpload
);

/**
 * Middleware de error handling para rotas unificadas
 */
router.use((error, req, res, next) => {
  const operationId = req.operationId || 'unknown';
  console.log('Erro nas rotas unificadas CNAB:', {
    operationId,
    error: error.message,
    stack: error.stack,
    route: req.route?.path,
    method: req.method
  });

  // Se já foi enviado response, não fazer nada
  if (res.headersSent) {
    return next(error);
  }

  // Determinar status code
  let statusCode = 500;
  if (error.status) {
    statusCode = error.status;
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
  } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
  }

  return res.status(statusCode).json({
    sucesso: false,
    erro: error.message || 'Erro interno do servidor',
    codigo: error.codigo || 'ERRO_INTERNO',
    tipo: 'ERRO_ROTA_UNIFICADA',
    operationId,
    timestamp: new Date().toISOString()
  });
});

export default router; 