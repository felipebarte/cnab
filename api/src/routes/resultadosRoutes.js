import express from 'express';
import ResultadosController from '../controllers/resultadosController.js';
import operationIdMiddleware from '../middleware/operationIdMiddleware.js';

const router = express.Router();

// Middleware de operationId para todas as rotas
router.use(operationIdMiddleware);

/**
 * @route GET /cnab/resultados
 * @desc Lista todos os resultados de operações CNAB com paginação e filtros
 * @query { page?, limit?, startDate?, endDate?, status?, operationType?, sortBy?, sortOrder? }
 */
router.get('/', ResultadosController.listarResultados);

/**
 * @route GET /cnab/resultados/estatisticas
 * @desc Retorna estatísticas gerais dos resultados
 */
router.get('/estatisticas', ResultadosController.obterEstatisticasResultados);

/**
 * @route GET /cnab/resultados/:operationId
 * @desc Retorna resultado detalhado de uma operação específica
 * @param { operationId } ID único da operação
 */
router.get('/:operationId', ResultadosController.buscarResultado);

export default router; 