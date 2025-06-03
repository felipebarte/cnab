import express from 'express';
import {
  processFile,
  verifyBarcodes,
  healthCheck,
  getStats,
  resetStats,
  clearCache,
  simulate,
  upload
} from '../controllers/cnabSwapController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CNAB-Swap Integration
 *   description: Orquestração entre arquivos CNAB e API Swap Financial
 */

/**
 * @swagger
 * /api/cnab-swap/health:
 *   get:
 *     summary: Health check do orquestrador CNAB-Swap
 *     tags: [CNAB-Swap Integration]
 *     responses:
 *       200:
 *         description: Orquestrador saudável
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 components:
 *                   type: object
 *                   properties:
 *                     orchestrator:
 *                       type: string
 *                       example: healthy
 *                     swapService:
 *                       type: string
 *                       example: healthy
 *                     paymentExtractor:
 *                       type: string
 *                       example: healthy
 *                 stats:
 *                   type: object
 *                   properties:
 *                     processed:
 *                       type: number
 *                     verified:
 *                       type: number
 *                     successful:
 *                       type: number
 *       503:
 *         description: Orquestrador indisponível
 */
router.get('/health', healthCheck);

/**
 * @swagger
 * /api/cnab-swap/stats:
 *   get:
 *     summary: Obter estatísticas do orquestrador
 *     tags: [CNAB-Swap Integration]
 *     responses:
 *       200:
 *         description: Estatísticas do orquestrador
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     processed:
 *                       type: number
 *                       example: 10
 *                     verified:
 *                       type: number
 *                       example: 25
 *                     successful:
 *                       type: number
 *                       example: 23
 *                     failed:
 *                       type: number
 *                       example: 2
 *                     cached:
 *                       type: number
 *                       example: 5
 *                     cacheSize:
 *                       type: number
 *                       example: 15
 */
router.get('/stats', getStats);

/**
 * @swagger
 * /api/cnab-swap/process:
 *   post:
 *     summary: Processar arquivo CNAB com verificação Swap Financial
 *     tags: [CNAB-Swap Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo CNAB (.ret, .rem, .txt, .cnab, .240, .400)
 *               validateAll:
 *                 type: boolean
 *                 default: true
 *                 description: Validar todos os boletos encontrados
 *               batchSize:
 *                 type: integer
 *                 default: 10
 *                 description: Tamanho do lote para processamento
 *               maxConcurrentRequests:
 *                 type: integer
 *                 default: 5
 *                 description: Máximo de requisições simultâneas para API Swap
 *               includeInvalidBarcodes:
 *                 type: boolean
 *                 default: false
 *                 description: Incluir códigos de barras inválidos no resultado
 *     responses:
 *       200:
 *         description: Arquivo processado com sucesso
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
 *                     cnabSummary:
 *                       type: object
 *                       properties:
 *                         totalRecords:
 *                           type: number
 *                         paymentsFound:
 *                           type: number
 *                     swapResults:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         verified:
 *                           type: number
 *                         successful:
 *                           type: number
 *                         failed:
 *                           type: number
 *                         validations:
 *                           type: array
 *                           items:
 *                             type: object
 *                     compatibility:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: object
 *                         recommendations:
 *                           type: array
 *                 file:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     size:
 *                       type: number
 *       400:
 *         description: Arquivo obrigatório ou tipo inválido
 *       500:
 *         description: Erro no processamento
 */
router.post('/process', upload.single('file'), processFile);

/**
 * @swagger
 * /api/cnab-swap/verify-barcodes:
 *   post:
 *     summary: Verificar códigos de barras específicos com Swap Financial
 *     tags: [CNAB-Swap Integration]
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
 *                 description: Array de códigos de barras para verificar (máximo 100)
 *                 items:
 *                   type: string
 *                   example: "34191790010104351004791020150008291070026000"
 *                 example: 
 *                   - "34191790010104351004791020150008291070026000"
 *                   - "34191790010104351004791020150008291070027000"
 *     responses:
 *       200:
 *         description: Códigos de barras verificados com sucesso
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
 *                     total:
 *                       type: number
 *                     verified:
 *                       type: number
 *                     successful:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     validations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           cnabId:
 *                             type: string
 *                           barcode:
 *                             type: string
 *                           success:
 *                             type: boolean
 *                           swapData:
 *                             type: object
 *                           mappedData:
 *                             type: object
 *                           compatibility:
 *                             type: object
 *       400:
 *         description: Array de códigos de barras inválido
 */
router.post('/verify-barcodes', verifyBarcodes);

/**
 * @swagger
 * /api/cnab-swap/simulate:
 *   post:
 *     summary: Simular processamento CNAB com códigos de barras fornecidos
 *     tags: [CNAB-Swap Integration]
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
 *                 description: Códigos de barras para simular
 *                 items:
 *                   type: string
 *                 example: 
 *                   - "34191790010104351004791020150008291070026000"
 *               mockCnabData:
 *                 type: object
 *                 description: Dados CNAB simulados opcionais
 *                 properties:
 *                   value:
 *                     type: number
 *                     example: 10000
 *                   dueDate:
 *                     type: string
 *                     example: "20241215"
 *               validateAll:
 *                 type: boolean
 *                 default: true
 *               batchSize:
 *                 type: integer
 *                 default: 5
 *               maxConcurrentRequests:
 *                 type: integer
 *                 default: 3
 *     responses:
 *       200:
 *         description: Simulação executada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 simulation:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                 simulatedData:
 *                   type: object
 *                   properties:
 *                     barcodesCount:
 *                       type: number
 *                     mockData:
 *                       type: object
 *       400:
 *         description: Códigos de barras obrigatórios para simulação
 */
router.post('/simulate', simulate);

/**
 * @swagger
 * /api/cnab-swap/reset-stats:
 *   post:
 *     summary: Resetar estatísticas do orquestrador
 *     tags: [CNAB-Swap Integration]
 *     responses:
 *       200:
 *         description: Estatísticas resetadas com sucesso
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
 *                   example: Estatísticas resetadas com sucesso
 */
router.post('/reset-stats', resetStats);

/**
 * @swagger
 * /api/cnab-swap/cache:
 *   delete:
 *     summary: Limpar cache de verificações
 *     tags: [CNAB-Swap Integration]
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
 *                   example: Cache limpo com sucesso
 */
router.delete('/cache', clearCache);

export default router; 