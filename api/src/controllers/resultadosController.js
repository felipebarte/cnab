/**
 * Controller para gerenciar resultados de operações CNAB
 * 
 * Endpoints unificados para buscar resultados de processamentos CNAB 240 e 400
 * Compatível com frontend React para integração completa
 */

import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Operation from '../models/Operation.js';
import File from '../models/File.js';
import CnabHeader from '../models/CnabHeader.js';
import CnabRecord from '../models/CnabRecord.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';

export class ResultadosController {
  /**
   * GET /api/v1/cnab/resultados
   * Lista todos os resultados de operações CNAB com paginação e filtros
   * Endpoint unificado para CNAB 240 e 400
   */
  static async listarResultados(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'listar-resultados');

    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        status,
        operationType,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      logger.start({
        page: parseInt(page),
        limit: parseInt(limit),
        startDate,
        endDate,
        status,
        operationType,
        sortBy,
        sortOrder
      });

      // Validar parâmetros
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Construir filtros para operações
      const whereConditions = {};

      // Filtrar por tipos de operação CNAB
      if (operationType) {
        whereConditions.operation_type = operationType;
      } else {
        // Por padrão, mostrar apenas operações CNAB
        whereConditions.operation_type = {
          [Op.in]: ['cnab400', 'cnab240']
        };
      }

      // Filtro por status
      if (status) {
        whereConditions.status = status;
      }

      // Filtro por data
      if (startDate || endDate) {
        whereConditions.created_at = {};
        if (startDate) whereConditions.created_at[Op.gte] = new Date(startDate);
        if (endDate) whereConditions.created_at[Op.lte] = new Date(endDate);
      }

      // Validar ordenação
      const allowedSortFields = ['created_at', 'status', 'operation_type', 'processing_time_ms'];
      const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Buscar operações com informações relacionadas
      const { count, rows: operations } = await Operation.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: File,
            as: 'files',
            required: false,
            include: [
              {
                model: CnabHeader,
                as: 'cnabHeader',
                required: false
              }
            ]
          }
        ],
        order: [[validSortBy, validSortOrder]],
        limit: limitNum,
        offset: offset,
        distinct: true
      });

      // Formatar resposta
      const resultados = await Promise.all(operations.map(async (operation) => {
        const file = operation.files?.[0]; // Pegar primeiro arquivo relacionado
        const header = file?.cnabHeader;

        // Contar registros se arquivo existir
        let totalRecords = 0;
        if (file) {
          totalRecords = await CnabRecord.count({
            where: { file_id: file.id }
          });
        }

        return {
          operationId: operation.operation_id,
          operationType: operation.operation_type,
          status: operation.status,
          processedAt: operation.created_at,
          updatedAt: operation.updated_at,
          processingTimeMs: operation.processing_time_ms,

          // Informações do arquivo (se houver)
          file: file ? {
            id: file.id,
            name: file.file_name,
            hash: file.file_hash,
            size: file.file_size,
            validationStatus: file.validation_status
          } : null,

          // Informações do banco/empresa (se houver)
          banco: header ? {
            codigo: header.banco_codigo,
            nome: header.banco_nome
          } : null,

          empresa: header ? {
            documento: header.empresa_documento,
            nome: header.empresa_nome
          } : null,

          // Totalizadores
          totals: {
            registros: totalRecords,
            valorTotal: header?.valor_total || 0
          },

          // Dados da requisição (metadata)
          metadata: {
            userAgent: operation.user_agent,
            ipAddress: operation.ip_address,
            hasError: !!operation.error_details
          }
        };
      }));

      logger.processed({
        totalCount: count,
        returnedCount: resultados.length,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum)
      });

      return res.status(200).json({
        sucesso: true,
        dados: resultados,
        paginacao: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
          hasNext: pageNum < Math.ceil(count / limitNum),
          hasPrev: pageNum > 1
        },
        filtros: {
          startDate,
          endDate,
          status,
          operationType,
          sortBy: validSortBy,
          sortOrder: validSortOrder
        },
        operationId
      });

    } catch (error) {
      logger.error(error, 'listar_resultados');

      const structuredError = ErrorHandler.createError(
        'ERRO_LISTAR_RESULTADOS',
        error.message,
        { operation: 'listar_resultados' },
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
   * GET /api/v1/cnab/resultados/:operationId
   * Retorna resultado detalhado de uma operação específica
   * Compatível com operações CNAB 240 e 400
   */
  static async buscarResultado(req, res) {
    const requestOperationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(requestOperationId, 'buscar-resultado');

    try {
      const { operationId } = req.params;

      if (!operationId) {
        const error = ErrorHandler.createError(
          'OPERATION_ID_OBRIGATORIO',
          'Operation ID é obrigatório'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId: requestOperationId
        });
      }

      logger.start({ targetOperationId: operationId });

      // Buscar operação
      const operation = await Operation.findByOperationId(operationId);

      if (!operation) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Resultado não encontrado',
          codigo: 'RESULTADO_NAO_ENCONTRADO',
          operationId: requestOperationId
        });
      }

      // Verificar se é operação CNAB
      if (!['cnab400', 'cnab240'].includes(operation.operation_type)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Operação não é do tipo CNAB',
          codigo: 'OPERACAO_NAO_CNAB',
          operationType: operation.operation_type,
          operationId: requestOperationId
        });
      }

      // Buscar arquivo relacionado
      const file = await File.findOne({
        where: { operation_id: operationId },
        include: [
          {
            model: CnabHeader,
            as: 'cnabHeader',
            required: false
          }
        ]
      });

      // Buscar registros se arquivo existir
      let registros = [];
      let totalRegistros = 0;

      if (file) {
        // Contar total de registros
        totalRegistros = await CnabRecord.count({
          where: { file_id: file.id }
        });

        // Buscar primeiros registros (limitado para performance)
        registros = await CnabRecord.findAll({
          where: { file_id: file.id },
          // order: [['registro_sequencia', 'ASC']], // Comentado temporariamente para debug
          limit: 100
        });
      }

      // Construir resposta detalhada
      const resultado = {
        operationId: operation.operation_id,
        operationType: operation.operation_type,
        status: operation.status,
        processedAt: operation.created_at,
        updatedAt: operation.updated_at,
        processingTimeMs: operation.processing_time_ms,

        // Dados da requisição original
        requestData: operation.request_data,
        responseData: operation.response_data,
        errorDetails: operation.error_details,

        // Informações do arquivo
        file: file ? {
          id: file.id,
          name: file.file_name,
          hash: file.file_hash,
          size: file.file_size,
          validationStatus: file.validation_status,
          createdAt: file.created_at
        } : null,

        // Cabeçalho CNAB
        header: file?.cnabHeader ? {
          banco: {
            codigo: file.cnabHeader.banco_codigo,
            nome: file.cnabHeader.banco_nome
          },
          empresa: {
            documento: file.cnabHeader.empresa_documento,
            nome: file.cnabHeader.empresa_nome
          },
          arquivo: {
            dataGeracao: file.cnabHeader.arquivo_data_geracao,
            numeroSequencial: file.cnabHeader.arquivo_numero_sequencial
          },
          totals: {
            valorTotal: file.cnabHeader.valor_total,
            quantidadeRegistros: file.cnabHeader.quantidade_registros
          }
        } : null,

        // Registros (limitados)
        registros: registros.map(record => ({
          id: record.id,
          sequencia: record.registro_sequencia,
          tipo: record.tipo_registro,
          conteudo: record.conteudo_original,
          dadosEstruturados: record.dados_estruturados,
          validationStatus: record.validation_status
        })),

        // Estatísticas
        estatisticas: {
          totalRegistros,
          registrosMostrados: registros.length,
          temMaisRegistros: totalRegistros > 100,
          percentualProcessado: totalRegistros > 0 ? Math.round((registros.length / totalRegistros) * 100) : 0
        },

        // Metadata da operação
        metadata: {
          userAgent: operation.user_agent,
          ipAddress: operation.ip_address,
          hasError: !!operation.error_details,
          isComplete: operation.status === 'success'
        }
      };

      logger.processed({
        found: true,
        operationId,
        operationType: operation.operation_type,
        hasFile: !!file,
        recordCount: registros.length,
        totalRecords: totalRegistros
      });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Resultado encontrado',
        dados: resultado,
        operationId: requestOperationId
      });

    } catch (error) {
      logger.error(error, 'buscar_resultado');

      const structuredError = ErrorHandler.createError(
        'ERRO_BUSCAR_RESULTADO',
        error.message,
        { operation: 'buscar_resultado', targetOperationId: req.params.operationId },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId: requestOperationId
      });
    }
  }

  /**
   * GET /api/v1/cnab/resultados/estatisticas
   * Retorna estatísticas gerais dos resultados
   */
  static async obterEstatisticasResultados(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'estatisticas-resultados');

    try {
      logger.start({});

      // Estatísticas por tipo de operação
      const estatisticasPorTipo = await Operation.findAll({
        where: {
          operation_type: {
            [Op.in]: ['cnab400', 'cnab240']
          }
        },
        attributes: [
          'operation_type',
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total']
        ],
        group: ['operation_type', 'status'],
        raw: true
      });

      // Estatísticas por período (últimos 30 dias)
      const ultimoMes = new Date();
      ultimoMes.setDate(ultimoMes.getDate() - 30);

      const estatisticasRecentes = await Operation.findAll({
        where: {
          operation_type: {
            [Op.in]: ['cnab400', 'cnab240']
          },
          created_at: {
            [Op.gte]: ultimoMes
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'data'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'total']
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'DESC']],
        raw: true
      });

      // Tempo médio de processamento
      const tempoMedio = await Operation.findOne({
        where: {
          operation_type: {
            [Op.in]: ['cnab400', 'cnab240']
          },
          processing_time_ms: {
            [Op.not]: null
          }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('processing_time_ms')), 'tempo_medio_ms']
        ],
        raw: true
      });

      const estatisticas = {
        porTipo: estatisticasPorTipo,
        recentes: estatisticasRecentes,
        performance: {
          tempoMedioProcessamento: Math.round(tempoMedio?.tempo_medio_ms || 0),
          unidade: 'millisegundos'
        },
        periodo: {
          inicio: ultimoMes.toISOString(),
          fim: new Date().toISOString()
        }
      };

      logger.processed(estatisticas);

      return res.status(200).json({
        sucesso: true,
        estatisticas,
        operationId,
        dataConsulta: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'estatisticas_resultados');

      const structuredError = ErrorHandler.createError(
        'ERRO_ESTATISTICAS_RESULTADOS',
        error.message,
        { operation: 'obter_estatisticas_resultados' },
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
}

export default ResultadosController; 