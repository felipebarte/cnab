/**
 * Controller para gerenciar dados CNAB persistidos no banco
 * 
 * Endpoints específicos para consultar e gerenciar dados CNAB salvos
 * após processamento com lógica Python integrada ao banco de dados.
 */

import { Op } from 'sequelize';
import {
  File,
  Operation,
  Cnab240File
} from '../models/index.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';

export class CnabPersistidosController {
  /**
   * GET /api/v1/cnab/persistidos
   * Lista dados CNAB persistidos com filtros avançados
   */
  static async listarPersistidos(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'listar-persistidos');

    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        status,
        banco,
        empresa
      } = req.query;

      logger.start({
        page: parseInt(page),
        limit: parseInt(limit),
        filtros: { startDate, endDate, status, banco, empresa }
      });

      // Validar parâmetros
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Construir filtros base
      const whereConditions = {
        file_type: 'cnab240'
      };

      // Filtros de data
      if (startDate || endDate) {
        whereConditions.created_at = {};
        if (startDate) whereConditions.created_at[Op.gte] = new Date(startDate);
        if (endDate) whereConditions.created_at[Op.lte] = new Date(endDate);
      }

      // Filtros de status para operação
      const operationFilters = {};
      if (status) operationFilters.status = status;

      // Filtros específicos para CNAB240
      const cnabFilters = {};
      if (banco) cnabFilters.banco_codigo = banco;
      if (empresa) cnabFilters.empresa_nome = { [Op.like]: `%${empresa}%` };

      // Buscar arquivos com dados relacionados
      const { count, rows: files } = await File.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Operation,
            as: 'operation',
            where: Object.keys(operationFilters).length > 0 ? operationFilters : {},
            required: true
          },
          {
            model: Cnab240File,
            as: 'cnab240File',
            where: Object.keys(cnabFilters).length > 0 ? cnabFilters : {},
            required: true
          }
        ],
        order: [['created_at', 'DESC']],
        limit: limitNum,
        offset,
        distinct: true
      });

      // Formatar dados
      const dados = files.map(file => this.formatarDadosPersistidos(file));

      logger.processed({
        totalCount: count,
        returnedCount: dados.length,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum)
      });

      return res.status(200).json({
        sucesso: true,
        dados,
        paginacao: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
          hasNext: pageNum < Math.ceil(count / limitNum),
          hasPrev: pageNum > 1
        },
        operationId
      });

    } catch (error) {
      logger.error(error, 'listar-persistidos');

      const structuredError = ErrorHandler.createError(
        'ERRO_LISTAR_PERSISTIDOS',
        error.message,
        { operation: 'listarPersistidos' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId
      });
    }
  }

  /**
   * GET /api/v1/cnab/persistidos/:id
   * Busca dados CNAB persistidos específicos por ID
   */
  static async buscarPersistido(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'buscar-persistido');

    try {
      const { id } = req.params;

      logger.start({ id });

      const file = await File.findByPk(id, {
        include: [
          {
            model: Operation,
            as: 'operation',
            required: true
          },
          {
            model: Cnab240File,
            as: 'cnab240File',
            required: true
          }
        ]
      });

      if (!file) {
        logger.error({ message: 'Arquivo não encontrado', id }, 'buscar-persistido');
        return res.status(404).json({
          sucesso: false,
          erro: 'Arquivo CNAB não encontrado',
          codigo: 'CNAB_NAO_ENCONTRADO',
          operationId
        });
      }

      const dados = this.formatarDadosPersistidos(file, true);

      logger.processed({ id, totalRegistros: dados.total_registros });

      return res.status(200).json({
        sucesso: true,
        dados,
        operationId
      });

    } catch (error) {
      logger.error(error, 'buscar-persistido');

      const structuredError = ErrorHandler.createError(
        'ERRO_BUSCAR_PERSISTIDO',
        error.message,
        { operation: 'buscarPersistido', id: req.params.id },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId
      });
    }
  }

  /**
   * GET /api/v1/cnab/persistidos/estatisticas
   * Obtém estatísticas dos dados CNAB persistidos
   */
  static async obterEstatisticas(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'estatisticas-persistidos');

    try {
      const { startDate, endDate } = req.query;

      logger.start({ periodo: { startDate, endDate } });

      // Construir filtros de data
      const dateFilters = {};
      if (startDate || endDate) {
        dateFilters.created_at = {};
        if (startDate) dateFilters.created_at[Op.gte] = new Date(startDate);
        if (endDate) dateFilters.created_at[Op.lte] = new Date(endDate);
      }

      // Estatísticas básicas
      const [totalFiles, totalValue] = await Promise.all([
        File.count({
          where: { file_type: 'cnab240', ...dateFilters }
        }),
        Cnab240File.sum('valor_total', {
          include: [{
            model: File,
            as: 'file',
            where: { file_type: 'cnab240', ...dateFilters },
            required: true
          }]
        })
      ]);

      const estatisticas = {
        totalFiles: totalFiles || 0,
        totalValue: parseFloat(totalValue || 0),
        averageValue: totalFiles > 0 ? parseFloat(totalValue || 0) / totalFiles : 0,
        periodo: { startDate, endDate }
      };

      logger.processed({ estatisticas });

      return res.status(200).json({
        sucesso: true,
        dados: estatisticas,
        operationId
      });

    } catch (error) {
      logger.error(error, 'estatisticas-persistidos');

      const structuredError = ErrorHandler.createError(
        'ERRO_ESTATISTICAS_PERSISTIDOS',
        error.message,
        { operation: 'obterEstatisticas' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId
      });
    }
  }

  // ========================
  // MÉTODOS UTILITÁRIOS
  // ========================

  /**
   * Formata dados persistidos para resposta da API
   */
  static formatarDadosPersistidos(file, incluirDetalhes = false) {
    const cnabFile = file.cnab240File;
    const operation = file.operation;

    return {
      id: file.id,
      operationId: operation.operation_id,
      banco_codigo: cnabFile.banco_codigo,
      banco_nome: cnabFile.banco_nome,
      arquivo_sequencia: cnabFile.arquivo_sequencia,
      data_geracao: cnabFile.data_geracao,
      hora_geracao: cnabFile.hora_geracao,
      empresa_tipo_pessoa: cnabFile.empresa_tipo_pessoa,
      empresa_documento: cnabFile.empresa_documento,
      empresa_nome: cnabFile.empresa_nome,
      empresa_codigo: cnabFile.empresa_codigo,
      total_lotes: cnabFile.total_lotes,
      total_registros: cnabFile.total_registros,
      valor_total: parseFloat(cnabFile.valor_total || 0),
      header_dados: cnabFile.header_dados,
      trailer_dados: cnabFile.trailer_dados,
      status: operation.status,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    };
  }
} 