import express from 'express';
import {
  getAllMetrics,
  getPrometheusMetrics,
  getCounters,
  getPerformanceMetrics,
  getErrorMetrics,
  getSwapMetrics,
  getCnabMetrics,
  resetMetrics,
  healthCheck
} from '../controllers/metricsController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Metrics & Monitoring
 *   description: Sistema de métricas e monitoramento da aplicação
 */

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Obter todas as métricas do sistema
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Métricas coletadas com sucesso
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
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       example: 3600000
 *                     uptimeFormatted:
 *                       type: string
 *                       example: "1h 0m 0s"
 *                     counters:
 *                       type: object
 *                       properties:
 *                         "swap.auth.attempts":
 *                           type: number
 *                         "swap.auth.success":
 *                           type: number
 *                         "swap.boleto.verify.attempts":
 *                           type: number
 *                     histograms:
 *                       type: object
 *                       properties:
 *                         "swap.auth.duration":
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             min:
 *                               type: number
 *                             max:
 *                               type: number
 *                             avg:
 *                               type: number
 *                             p95:
 *                               type: number
 *                             p99:
 *                               type: number
 *                     calculated:
 *                       type: object
 *                       properties:
 *                         "swap.auth.success_rate":
 *                           type: number
 *                         "requests.per_minute":
 *                           type: number
 */
router.get('/', getAllMetrics);

/**
 * @swagger
 * /api/metrics/prometheus:
 *   get:
 *     summary: Obter métricas em formato Prometheus
 *     tags: [Metrics & Monitoring]
 *     produces:
 *       - text/plain
 *     responses:
 *       200:
 *         description: Métricas em formato Prometheus
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # TYPE cnab_requests_total counter
 *                 cnab_swap_auth_attempts_total 50 1640995200000
 *                 cnab_swap_auth_success_total 48 1640995200000
 *                 
 *                 # TYPE cnab_duration_seconds summary
 *                 cnab_swap_auth_duration_seconds{quantile="0.95"} 0.250 1640995200000
 */
router.get('/prometheus', getPrometheusMetrics);

/**
 * @swagger
 * /api/metrics/counters:
 *   get:
 *     summary: Obter apenas contadores e métricas calculadas
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Contadores coletados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     counters:
 *                       type: object
 *                       description: Contadores de eventos
 *                     calculated:
 *                       type: object
 *                       description: Métricas calculadas (taxas, médias)
 */
router.get('/counters', getCounters);

/**
 * @swagger
 * /api/metrics/performance:
 *   get:
 *     summary: Obter métricas de performance (histogramas e endpoints)
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Métricas de performance coletadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     histograms:
 *                       type: object
 *                       description: Estatísticas de tempo de resposta
 *                     topEndpoints:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           endpoint:
 *                             type: string
 *                           requests:
 *                             type: number
 *                           avgDuration:
 *                             type: number
 *                           successRate:
 *                             type: string
 *                     errorEndpoints:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           endpoint:
 *                             type: string
 *                           errorCount:
 *                             type: number
 *                           errorRate:
 *                             type: string
 */
router.get('/performance', getPerformanceMetrics);

/**
 * @swagger
 * /api/metrics/errors:
 *   get:
 *     summary: Obter métricas específicas de erros
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Métricas de erro coletadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     errorsByType:
 *                       type: object
 *                       description: Erros categorizados por tipo
 *                       properties:
 *                         authentication:
 *                           type: number
 *                         validation:
 *                           type: number
 *                         business_logic:
 *                           type: number
 *                         service_unavailable:
 *                           type: number
 *                     errorEndpoints:
 *                       type: array
 *                       description: Endpoints com mais erros
 *                     errorCounters:
 *                       type: object
 *                       properties:
 *                         critical:
 *                           type: number
 *                         warning:
 *                           type: number
 *                         total:
 *                           type: number
 */
router.get('/errors', getErrorMetrics);

/**
 * @swagger
 * /api/metrics/swap:
 *   get:
 *     summary: Obter métricas específicas da integração Swap Financial
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Métricas Swap Financial coletadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     auth:
 *                       type: object
 *                       properties:
 *                         attempts:
 *                           type: number
 *                           example: 50
 *                         success:
 *                           type: number
 *                           example: 48
 *                         failures:
 *                           type: number
 *                           example: 2
 *                         successRate:
 *                           type: number
 *                           example: 96.0
 *                         avgDuration:
 *                           type: number
 *                           example: 245.5
 *                     boleto:
 *                       type: object
 *                       properties:
 *                         verify:
 *                           type: object
 *                           properties:
 *                             attempts:
 *                               type: number
 *                             success:
 *                               type: number
 *                             successRate:
 *                               type: number
 *                         pay:
 *                           type: object
 *                           properties:
 *                             attempts:
 *                               type: number
 *                             success:
 *                               type: number
 *                             successRate:
 *                               type: number
 *                     system:
 *                       type: object
 *                       properties:
 *                         circuitBreakerState:
 *                           type: string
 *                           example: "closed"
 *                         cacheSize:
 *                           type: number
 *                         cacheHitRate:
 *                           type: number
 */
router.get('/swap', getSwapMetrics);

/**
 * @swagger
 * /api/metrics/cnab:
 *   get:
 *     summary: Obter métricas específicas do processamento CNAB
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Métricas CNAB coletadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     processing:
 *                       type: object
 *                       properties:
 *                         attempts:
 *                           type: number
 *                         success:
 *                           type: number
 *                         failures:
 *                           type: number
 *                         successRate:
 *                           type: number
 *                         avgDuration:
 *                           type: number
 *                     files:
 *                       type: object
 *                       properties:
 *                         processed:
 *                           type: number
 *                         activeProcesses:
 *                           type: number
 *                     boletos:
 *                       type: object
 *                       properties:
 *                         extracted:
 *                           type: number
 *                         verified:
 *                           type: number
 */
router.get('/cnab', getCnabMetrics);

/**
 * @swagger
 * /api/metrics/health:
 *   get:
 *     summary: Health check do sistema de métricas
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Sistema de métricas saudável
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
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     uptime:
 *                       type: string
 *                       example: "1h 30m 45s"
 *                     metricsCollection:
 *                       type: string
 *                       example: "active"
 *                     dataPoints:
 *                       type: object
 *                       properties:
 *                         counters:
 *                           type: number
 *                         histograms:
 *                           type: number
 *                         gauges:
 *                           type: number
 *       503:
 *         description: Sistema de métricas com problemas
 */
router.get('/health', healthCheck);

/**
 * @swagger
 * /api/metrics/reset:
 *   post:
 *     summary: Resetar todas as métricas coletadas
 *     tags: [Metrics & Monitoring]
 *     responses:
 *       200:
 *         description: Métricas resetadas com sucesso
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
 *                   example: "Métricas resetadas com sucesso"
 *       500:
 *         description: Erro ao resetar métricas
 */
router.post('/reset', resetMetrics);

export default router; 