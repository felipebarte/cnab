/**
 * Rotas para endpoints de dados CNAB persistidos
 * 
 * Endpoints para consultar e gerenciar dados CNAB salvos no banco
 * após processamento com lógica Python integrada.
 */

import express from 'express';
import { CnabPersistidosController } from '../controllers/cnabPersistidosController.js';
import { operationIdMiddleware } from '../middleware/operationIdMiddleware.js';

const router = express.Router();

// Aplicar middleware de operation ID para rastreamento
router.use(operationIdMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     CNABPersistedData:
 *       type: object
 *       properties:
 *         id:
 *           type: number
 *           description: ID único do arquivo
 *         operationId:
 *           type: string
 *           description: ID da operação de processamento
 *         banco_codigo:
 *           type: string
 *           description: Código do banco
 *         banco_nome:
 *           type: string
 *           description: Nome do banco
 *         empresa_nome:
 *           type: string
 *           description: Nome da empresa
 *         total_lotes:
 *           type: number
 *           description: Total de lotes no arquivo
 *         total_registros:
 *           type: number
 *           description: Total de registros no arquivo
 *         valor_total:
 *           type: number
 *           description: Valor total do arquivo
 *         status:
 *           type: string
 *           enum: [pending, processed, approved, rejected, sent]
 *           description: Status atual do arquivo
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data de atualização
 * 
 *     CNABPersistedListResponse:
 *       type: object
 *       properties:
 *         sucesso:
 *           type: boolean
 *         dados:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CNABPersistedData'
 *         paginacao:
 *           type: object
 *           properties:
 *             page:
 *               type: number
 *             limit:
 *               type: number
 *             total:
 *               type: number
 *             totalPages:
 *               type: number
 *             hasNext:
 *               type: boolean
 *             hasPrev:
 *               type: boolean
 *         filtros:
 *           type: object
 *         estatisticas:
 *           type: object
 *         operationId:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/cnab/persistidos:
 *   get:
 *     summary: Lista dados CNAB persistidos
 *     description: Recupera uma lista paginada de arquivos CNAB processados e salvos no banco
 *     tags: [CNAB Persistidos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Quantidade de itens por página
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial do filtro (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final do filtro (YYYY-MM-DD)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processed, approved, rejected, sent]
 *         description: Filtrar por status
 *       - in: query
 *         name: banco
 *         schema:
 *           type: string
 *         description: Filtrar por código do banco
 *       - in: query
 *         name: empresa
 *         schema:
 *           type: string
 *         description: Filtrar por nome da empresa
 *       - in: query
 *         name: minValue
 *         schema:
 *           type: number
 *         description: Valor mínimo do filtro
 *       - in: query
 *         name: maxValue
 *         schema:
 *           type: number
 *         description: Valor máximo do filtro
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: created_at
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de dados CNAB persistidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CNABPersistedListResponse'
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/', CnabPersistidosController.listarPersistidos);

/**
 * @swagger
 * /api/v1/cnab/persistidos/estatisticas:
 *   get:
 *     summary: Obtém estatísticas dos dados CNAB persistidos
 *     description: Retorna estatísticas agregadas dos arquivos CNAB processados
 *     tags: [CNAB Persistidos]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial do período para estatísticas
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final do período para estatísticas
 *     responses:
 *       200:
 *         description: Estatísticas dos dados CNAB persistidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 dados:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: number
 *                     totalPayments:
 *                       type: number
 *                     totalValue:
 *                       type: number
 *                     averageValue:
 *                       type: number
 *                     byStatus:
 *                       type: object
 *                     byBank:
 *                       type: object
 *                     recent:
 *                       type: array
 *                     trends:
 *                       type: array
 *                 operationId:
 *                   type: string
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/estatisticas', CnabPersistidosController.obterEstatisticas);

/**
 * @swagger
 * /api/v1/cnab/persistidos/{id}:
 *   get:
 *     summary: Busca dados CNAB persistidos por ID
 *     description: Recupera detalhes completos de um arquivo CNAB específico
 *     tags: [CNAB Persistidos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do arquivo CNAB
 *     responses:
 *       200:
 *         description: Dados detalhados do arquivo CNAB
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 dados:
 *                   $ref: '#/components/schemas/CNABPersistedData'
 *                 operationId:
 *                   type: string
 *       404:
 *         description: Arquivo não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/:id', CnabPersistidosController.buscarPersistido);

export default router; 