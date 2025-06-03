import express from 'express';
import {
  healthCheck,
  getConfiguration,
  authenticate,
  clearAuthCache,
  checkBoleto,
  checkBoletoBatch,
  revalidateService,
  getMetrics,
  checkServiceAvailability
} from '../controllers/swapController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Swap Financial
 *   description: Integração com a API da Swap Financial para processamento de boletos
 */

/**
 * @swagger
 * /api/swap/health:
 *   get:
 *     summary: Health check da integração Swap Financial
 *     tags: [Swap Financial]
 *     responses:
 *       200:
 *         description: Serviço saudável
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 service:
 *                   type: string
 *                   example: SwapFinancial
 *                 environment:
 *                   type: string
 *                   example: staging
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Serviço indisponível
 */
router.get('/health', healthCheck);

/**
 * @swagger
 * /api/swap/config:
 *   get:
 *     summary: Obter configurações do serviço (sem dados sensíveis)
 *     tags: [Swap Financial]
 *     responses:
 *       200:
 *         description: Configurações do serviço
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: SwapFinancial
 *                 environment:
 *                   type: string
 *                   example: staging
 *                 baseURL:
 *                   type: string
 *                   example: https://api-stag.contaswap.io
 *                 hasClientId:
 *                   type: boolean
 *                 hasClientSecret:
 *                   type: boolean
 *                 hasApiKey:
 *                   type: boolean
 *       503:
 *         description: Serviço não disponível
 */
router.get('/config', getConfiguration);

/**
 * @swagger
 * /api/swap/metrics:
 *   get:
 *     summary: Obter métricas do circuit breaker e cache de tokens
 *     tags: [Swap Financial]
 *     responses:
 *       200:
 *         description: Métricas do serviço
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: SwapFinancial
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     circuitBreaker:
 *                       type: object
 *                       properties:
 *                         state:
 *                           type: string
 *                           example: CLOSED
 *                         failureCount:
 *                           type: number
 *                           example: 0
 *                     tokenCache:
 *                       type: object
 *                       properties:
 *                         hasAccessToken:
 *                           type: boolean
 */
router.get('/metrics', getMetrics);

/**
 * @swagger
 * /api/swap/auth:
 *   post:
 *     summary: Verificar autenticação com a API Swap Financial
 *     tags: [Swap Financial]
 *     responses:
 *       200:
 *         description: Autenticação bem-sucedida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Authentication successful
 *                 hasAccessToken:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Falha na autenticação
 *   delete:
 *     summary: Limpar cache de tokens de autenticação
 *     tags: [Swap Financial]
 *     responses:
 *       200:
 *         description: Cache limpo com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Authentication cache cleared
 */
router.post('/auth', checkServiceAvailability, authenticate);
router.delete('/auth', checkServiceAvailability, clearAuthCache);

/**
 * @swagger
 * /api/swap/boletos/check:
 *   post:
 *     summary: Verificar dados de um boleto pelo código de barras
 *     tags: [Swap Financial]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barcode
 *             properties:
 *               barcode:
 *                 type: string
 *                 description: Código de barras do boleto (47-48 dígitos)
 *                 example: "34191790010104351004791020150008291070026000"
 *     responses:
 *       200:
 *         description: Boleto verificado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "bol_1234567890"
 *                     amount:
 *                       type: number
 *                       description: Valor em centavos
 *                       example: 26000
 *                     due_date:
 *                       type: string
 *                       format: date
 *                       example: "2024-02-15"
 *                     payee:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Empresa XYZ LTDA"
 *                         document:
 *                           type: string
 *                           example: "12.345.678/0001-90"
 *                     status:
 *                       type: string
 *                       example: "issued"
 *                     type:
 *                       type: string
 *                       example: "generic"
 *                     canPayToday:
 *                       type: boolean
 *                       example: true
 *                     isInPaymentWindow:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Código de barras inválido ou ausente
 *       401:
 *         description: Erro de autenticação
 *       422:
 *         description: Boleto fora do horário comercial ou já pago
 *       503:
 *         description: Serviço temporariamente indisponível
 */
router.post('/boletos/check', checkServiceAvailability, checkBoleto);

/**
 * @swagger
 * /api/swap/boletos/check-batch:
 *   post:
 *     summary: Verificar múltiplos boletos em lote
 *     tags: [Swap Financial]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barcodes
 *             properties:
 *               barcodes:
 *                 type: array
 *                 description: Array de códigos de barras (máximo 100)
 *                 items:
 *                   type: string
 *                   example: "34191790010104351004791020150008291070026000"
 *                 example: 
 *                   - "34191790010104351004791020150008291070026000"
 *                   - "34191790010104351004791020150008291070027000"
 *     responses:
 *       200:
 *         description: Lote processado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 2
 *                     successful:
 *                       type: number
 *                       example: 1
 *                     failed:
 *                       type: number
 *                       example: 1
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       barcode:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                       data:
 *                         type: object
 *                         description: Dados do boleto (quando success=true)
 *                       error:
 *                         type: string
 *                         description: Mensagem de erro (quando success=false)
 *       400:
 *         description: Array de códigos de barras inválido ou muito grande
 */
router.post('/boletos/check-batch', checkServiceAvailability, checkBoletoBatch);

/**
 * @swagger
 * /api/swap/revalidate:
 *   post:
 *     summary: Revalidar configuração e reinicializar serviço
 *     tags: [Swap Financial]
 *     responses:
 *       200:
 *         description: Serviço revalidado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Service revalidated and reinitialized successfully
 *                 configuration:
 *                   type: object
 *                   description: Nova configuração do serviço
 *       503:
 *         description: Falha na revalidação
 */
router.post('/revalidate', revalidateService);

export default router; 