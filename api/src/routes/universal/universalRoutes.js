/**
 * UniversalRoutes - Rotas Universais CNAB
 * 
 * Endpoints modernos e limpos para processamento universal de arquivos CNAB.
 * Integra detecção automática, parsing e validação em uma API unificada.
 * 
 * Documentação OpenAPI incluída para geração automática de docs.
 */

import express from 'express';
import CnabUniversalController from '../../controllers/universal/CnabUniversalController.js';
import {
  requiredUploadMiddleware,
  optionalUploadMiddleware,
  formatValidationMiddleware,
  operationIdMiddleware
} from '../../middleware/universal/universalUploadMiddleware.js';

const router = express.Router();

// Aplicar middleware de operationId para todas as rotas
router.use(operationIdMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     UniversalResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indica se a operação foi bem-sucedida
 *         operation:
 *           type: string
 *           description: Nome da operação executada
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp da resposta
 *         data:
 *           type: object
 *           description: Dados da resposta
 *         metadata:
 *           type: object
 *           properties:
 *             version:
 *               type: string
 *               example: "1.0.0"
 *             processedBy:
 *               type: string
 *               example: "cnab-universal-api"
 *             operationId:
 *               type: string
 *               description: ID único da operação
 *             timing:
 *               type: object
 *               description: Tempos de processamento
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         operation:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *             code:
 *               type: string
 *             type:
 *               type: string
 *             details:
 *               type: object
 * 
 *     DetectionResult:
 *       type: object
 *       properties:
 *         format:
 *           type: string
 *           enum: [CNAB240, CNAB400]
 *         bankCode:
 *           type: string
 *           example: "341"
 *         bankName:
 *           type: string
 *           example: "Banco Itaú"
 *         confidence:
 *           type: number
 *           example: 95
 *         reason:
 *           type: string
 * 
 *   parameters:
 *     OperationId:
 *       in: header
 *       name: X-Operation-Id
 *       schema:
 *         type: string
 *       description: ID único para rastreamento da operação
 *       example: "op_1234567890_abc123"
 */

/**
 * @swagger
 * /api/v1/cnab/universal/processar:
 *   post:
 *     tags:
 *       - CNAB Universal
 *     summary: Processamento completo de arquivo CNAB
 *     description: |
 *       Executa o ciclo completo de processamento CNAB:
 *       1. Detecção automática do formato (CNAB240/400)
 *       2. Parsing completo dos dados estruturados
 *       3. Validação abrangente (opcional, habilitada por padrão)
 *       
 *       Suporta upload de arquivo ou envio via JSON.
 *     parameters:
 *       - $ref: '#/components/parameters/OperationId'
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo CNAB (.txt, .cnab, .ret, .rem)
 *               includeValidation:
 *                 type: boolean
 *                 default: true
 *                 description: Se deve incluir validação no processamento
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Conteúdo do arquivo CNAB como texto
 *               data:
 *                 type: string
 *                 description: Alternativa ao campo 'content'
 *               includeValidation:
 *                 type: boolean
 *                 default: true
 *             required:
 *               - content
 *     responses:
 *       200:
 *         description: Processamento concluído com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/UniversalResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         detection:
 *                           $ref: '#/components/schemas/DetectionResult'
 *                         parsing:
 *                           type: object
 *                           properties:
 *                             success:
 *                               type: boolean
 *                             metadata:
 *                               type: object
 *                             data:
 *                               type: object
 *                             errors:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             warnings:
 *                               type: array
 *                               items:
 *                                 type: object
 *                         validation:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             isValid:
 *                               type: boolean
 *                             score:
 *                               type: number
 *                             errors:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             warnings:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             statistics:
 *                               type: object
 *       400:
 *         description: Erro de validação ou formato inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/processar',
  optionalUploadMiddleware,
  CnabUniversalController.processar
);

/**
 * @swagger
 * /api/v1/cnab/universal/upload:
 *   post:
 *     tags:
 *       - CNAB Universal
 *     summary: Upload e análise básica de arquivo CNAB
 *     description: |
 *       Faz upload de arquivo CNAB e executa análise básica:
 *       - Detecção do formato
 *       - Estatísticas do arquivo
 *       - Prévia da estrutura
 *       - Contagem de tipos de registro
 *       
 *       Operação mais rápida que não inclui parsing completo.
 *     parameters:
 *       - $ref: '#/components/parameters/OperationId'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo CNAB obrigatório
 *             required:
 *               - file
 *     responses:
 *       200:
 *         description: Upload e análise concluídos
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/UniversalResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         upload:
 *                           type: object
 *                           properties:
 *                             filename:
 *                               type: string
 *                             size:
 *                               type: number
 *                             mimeType:
 *                               type: string
 *                             uploadedAt:
 *                               type: string
 *                               format: date-time
 *                         detection:
 *                           $ref: '#/components/schemas/DetectionResult'
 *                         analysis:
 *                           type: object
 *                           properties:
 *                             statistics:
 *                               type: object
 *                             recordTypes:
 *                               type: object
 *                             structurePreview:
 *                               type: object
 *       400:
 *         description: Arquivo inválido ou não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/upload',
  requiredUploadMiddleware,
  CnabUniversalController.upload
);

/**
 * @swagger
 * /api/v1/cnab/universal/validar:
 *   post:
 *     tags:
 *       - CNAB Universal
 *     summary: Validação especializada de arquivo CNAB
 *     description: |
 *       Executa validação abrangente de arquivo CNAB:
 *       - Validação estrutural (tamanhos, posições)
 *       - Validação de campos (formatos, valores)
 *       - Validação de integridade (totais, sequências)
 *       - Validação de regras de negócio (CPF/CNPJ, datas)
 *       
 *       Retorna relatório detalhado com erros categorizados.
 *     parameters:
 *       - $ref: '#/components/parameters/OperationId'
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo CNAB para validação
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Conteúdo do arquivo CNAB
 *               data:
 *                 type: string
 *                 description: Alternativa ao campo 'content'
 *             required:
 *               - content
 *     responses:
 *       200:
 *         description: Validação concluída
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/UniversalResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         detection:
 *                           $ref: '#/components/schemas/DetectionResult'
 *                         validation:
 *                           type: object
 *                           properties:
 *                             isValid:
 *                               type: boolean
 *                             score:
 *                               type: number
 *                               description: Score de 0-100
 *                             summary:
 *                               type: object
 *                               properties:
 *                                 totalErrors:
 *                                   type: number
 *                                 totalWarnings:
 *                                   type: number
 *                                 errorsByCategory:
 *                                   type: object
 *                                 warningsByType:
 *                                   type: object
 *                             details:
 *                               type: object
 *                               properties:
 *                                 errorsByCategory:
 *                                   type: object
 *                                 warningsByType:
 *                                   type: object
 *                                 statistics:
 *                                   type: object
 */
router.post('/validar',
  optionalUploadMiddleware,
  CnabUniversalController.validar
);

/**
 * @swagger
 * /api/v1/cnab/universal/bancos:
 *   get:
 *     tags:
 *       - CNAB Universal
 *     summary: Lista bancos suportados
 *     description: |
 *       Retorna lista completa de bancos suportados pela API,
 *       incluindo quantos schemas cada banco possui para
 *       CNAB240 e CNAB400.
 *     responses:
 *       200:
 *         description: Lista de bancos
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/UniversalResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         banks:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               code:
 *                                 type: string
 *                                 example: "341"
 *                               name:
 *                                 type: string
 *                                 example: "Banco Itaú"
 *                               schemas:
 *                                 type: object
 *                                 properties:
 *                                   cnab240:
 *                                     type: number
 *                                   cnab400:
 *                                     type: number
 *                                   total:
 *                                     type: number
 *                               supported:
 *                                 type: boolean
 *                               lastUpdated:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                         statistics:
 *                           type: object
 *                           properties:
 *                             totalBanks:
 *                               type: number
 *                             supportedBanks:
 *                               type: number
 *                             totalSchemas:
 *                               type: number
 *                             formatDistribution:
 *                               type: object
 *                               properties:
 *                                 cnab240:
 *                                   type: number
 *                                 cnab400:
 *                                   type: number
 */
router.get('/bancos',
  CnabUniversalController.listarBancos
);

/**
 * @swagger
 * /api/v1/cnab/universal/schemas/{bankCode}:
 *   get:
 *     tags:
 *       - CNAB Universal
 *     summary: Obtém schemas de um banco específico
 *     description: |
 *       Retorna todos os schemas disponíveis para um banco específico.
 *       Pode filtrar por formato (CNAB240/CNAB400) via query parameter.
 *     parameters:
 *       - in: path
 *         name: bankCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código do banco (ex: "341", "001", "237")
 *         example: "341"
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [cnab240, cnab400]
 *         description: Filtrar por formato específico
 *         example: "cnab240"
 *     responses:
 *       200:
 *         description: Schemas do banco
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/UniversalResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         bankCode:
 *                           type: string
 *                         bankName:
 *                           type: string
 *                         filter:
 *                           type: string
 *                         schemas:
 *                           type: object
 *                           properties:
 *                             byType:
 *                               type: object
 *                               properties:
 *                                 header_arquivo:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                 header_lote:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                 detalhe:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                 trailer_lote:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                 trailer_arquivo:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                             total:
 *                               type: number
 *                             list:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   format:
 *                                     type: string
 *                                   type:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   path:
 *                                     type: string
 *                                   fields:
 *                                     type: number
 *                                   lastModified:
 *                                     type: string
 *                                     format: date-time
 *       404:
 *         description: Banco não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/schemas/:bankCode',
  CnabUniversalController.obterSchemasBanco
);

/**
 * Middleware de tratamento de erros específico para rotas universais
 */
router.use((error, req, res, next) => {
  const operationId = req.operationId || 'unknown';

  console.error('Erro nas rotas universais:', {
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
    success: false,
    operation: 'universal-route-error',
    timestamp: new Date().toISOString(),
    error: {
      message: error.message || 'Erro interno do servidor',
      code: error.code || 'INTERNAL_ERROR',
      type: 'UniversalRouteError'
    },
    metadata: {
      operationId,
      route: req.route?.path,
      method: req.method
    }
  });
});

export default router; 