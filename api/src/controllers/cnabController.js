import CnabService from '../services/cnabService.js';
import WebhookService from '../services/webhookService.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';
import multer from 'multer';
import { promisify } from 'util';

// Importar modelos para consultas históricas
import {
  Operation,
  File,
  CnabHeader,
  CnabRecord,
  getDatabaseStats,
  checkDatabaseHealth,
  sequelize,
  Op
} from '../models/index.js';

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB
  },
  fileFilter: (req, file, cb) => {
    // Aceita arquivos de texto
    if (file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/octet-stream' ||
      !file.mimetype) {
      cb(null, true);
    } else {
      const error = ErrorHandler.createError(
        'TIPO_ARQUIVO_INVALIDO',
        'Apenas arquivos de texto são aceitos',
        { mimetype: file.mimetype }
      );
      cb(error, false);
    }
  },
});

/**
 * Controller para operações de CNAB
 */
export class CnabController {
  /**
   * Processa arquivo CNAB 400 do Itaú via upload
   */
  static async processarArquivoUpload(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'upload');

    try {
      // Verifica se arquivo foi enviado
      if (!req.file) {
        const error = ErrorHandler.createError(
          'ARQUIVO_OBRIGATORIO',
          'Nenhum arquivo foi enviado'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      logger.start({
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      // Converte buffer para string
      const conteudoCnab = req.file.buffer.toString('utf8');

      if (!conteudoCnab.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Arquivo CNAB está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Valida arquivo CNAB
      const validacao = CnabService.validarArquivoCnab(conteudoCnab);
      logger.validation(validacao.valido, validacao);

      if (!validacao.valido) {
        Logger.warn('Arquivo CNAB com problemas de validação', {
          operationId,
          validation: validacao,
          component: 'cnab',
        });
      }

      // Processa arquivo
      const resultado = await CnabService.processarArquivoCnab(conteudoCnab);
      logger.processed(resultado);

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Arquivo CNAB processado com sucesso',
        dados: resultado,
        arquivo: {
          nome: req.file.originalname,
          tamanho: req.file.size,
          tipo: req.file.mimetype,
        },
        validacao,
        operationId,
      });

    } catch (error) {
      logger.error(error, 'processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO',
        error.message,
        { operation: 'upload' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        tipo: structuredError.tipo,
        operationId,
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * Processa conteúdo CNAB 400 enviado como texto
   */
  static async processarConteudoTexto(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'text');

    try {
      const { conteudo } = req.body;

      if (!conteudo) {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'Campo "conteudo" é obrigatório'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      logger.start({
        contentLength: conteudo.length,
        hasContent: !!conteudo.trim(),
      });

      if (!conteudo.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Conteúdo CNAB está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Valida conteúdo CNAB
      const validacao = CnabService.validarArquivoCnab(conteudo);
      logger.validation(validacao.valido, validacao);

      // Processa conteúdo
      const resultado = await CnabService.processarArquivoCnab(conteudo);
      logger.processed(resultado);

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Conteúdo CNAB processado com sucesso',
        dados: resultado,
        validacao,
        operationId,
      });

    } catch (error) {
      logger.error(error, 'processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO',
        error.message,
        { operation: 'text' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        tipo: structuredError.tipo,
        operationId,
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * Processa CNAB e envia dados estruturados para webhook
   * Aceita tanto upload de arquivo quanto conteúdo de texto
   */
  static async processarCnabEEnviarWebhook(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'webhook');

    const startTime = Date.now();
    let cnabProcessado = false;
    let dadosProcessados = null;
    let validacao = null;

    try {
      // Determina fonte dos dados (arquivo ou texto)
      let conteudoCnab;
      let tipoProcessamento;
      let informacoesArquivo = null;

      if (req.file) {
        // Upload de arquivo
        tipoProcessamento = 'upload';
        conteudoCnab = req.file.buffer.toString('utf8');
        informacoesArquivo = {
          nome: req.file.originalname,
          tamanho: req.file.size,
          tipo: req.file.mimetype,
        };

        logger.start({
          type: 'upload',
          filename: req.file.originalname,
          size: req.file.size,
        });
      } else if (req.body.conteudo) {
        // Conteúdo de texto
        tipoProcessamento = 'texto';
        conteudoCnab = req.body.conteudo;

        logger.start({
          type: 'text',
          contentLength: conteudoCnab.length,
        });
      } else {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'É necessário enviar um arquivo via upload ou conteúdo via campo "conteudo"'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Valida conteúdo
      if (!conteudoCnab || !conteudoCnab.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Conteúdo CNAB está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Valida arquivo CNAB
      validacao = CnabService.validarArquivoCnab(conteudoCnab);
      logger.validation(validacao.valido, validacao);

      // Processa CNAB
      dadosProcessados = await CnabService.processarArquivoCnab(conteudoCnab);
      cnabProcessado = true;
      logger.processed(dadosProcessados);

      // Extrai dados estruturados
      const dadosCompletos = await CnabService.extrairDadosEstruturados(conteudoCnab);

      // Configura URL do webhook
      const webhookUrl = req.body.webhookUrl || process.env.WEBHOOK_URL;

      // Valida configuração do webhook
      const webhookValidation = ErrorHandler.validateWebhookConfig(webhookUrl);
      if (!webhookValidation.valido) {
        logger.error(webhookValidation.erro, 'webhook_config');

        return res.status(webhookValidation.erro.status).json(
          ErrorHandler.createWebhookErrorResponse(
            webhookValidation.erro.codigo,
            webhookValidation.erro.mensagem,
            { url: webhookUrl },
            {
              processado: cnabProcessado,
              totalRegistros: dadosProcessados?.totalRegistros,
              dataProcessamento: dadosProcessados?.dataProcessamento,
              validacao,
            }
          )
        );
      }

      Logger.info('Iniciando envio para webhook', {
        operationId,
        webhookUrl: webhookUrl?.substring(0, 50) + '...',
        cnabRegistros: dadosCompletos.resumo?.totalRegistros,
        component: 'webhook',
      });

      // Envia dados para o webhook
      const resultadoWebhook = await WebhookService.enviarParaWebhook(dadosCompletos, webhookUrl);

      const responseTime = Logger.calculateResponseTime(startTime);

      // Resposta de sucesso
      return res.status(200).json({
        sucesso: true,
        mensagem: 'CNAB processado e enviado para webhook com sucesso',
        dados: dadosProcessados,
        webhook: {
          enviado: resultadoWebhook.enviado,
          url: webhookUrl,
          status: resultadoWebhook.sucesso ? 'sucesso' : 'erro',
          tentativas: resultadoWebhook.tentativas,
          tempoResposta: resultadoWebhook.tempoResposta,
          operationId: resultadoWebhook.operationId,
          detalhes: resultadoWebhook.enviado ? 'Dados enviados com sucesso' : resultadoWebhook.motivo,
        },
        processamento: {
          tipo: tipoProcessamento,
          arquivo: informacoesArquivo,
          dataProcessamento: dadosProcessados.dataProcessamento,
          totalRegistros: dadosProcessados.totalRegistros,
          tempoTotal: responseTime,
        },
        validacao,
        operationId,
      });

    } catch (error) {
      const responseTime = Logger.calculateResponseTime(startTime);
      logger.error(error, 'webhook_processing');

      // Classifica o erro
      let structuredError;

      if (error.codigo) {
        // Erro já estruturado
        structuredError = error;
      } else if (error.message?.includes('webhook') || error.originalError) {
        // Erro de webhook
        structuredError = ErrorHandler.classifyWebhookError(error);
      } else {
        // Erro geral de processamento
        structuredError = ErrorHandler.createError(
          'ERRO_PROCESSAMENTO',
          error.message,
          { operation: 'webhook_processing' },
          error
        );
      }

      // Resposta estruturada de erro
      return res.status(structuredError.status || 500).json(
        ErrorHandler.createWebhookErrorResponse(
          structuredError.codigo,
          structuredError.mensagem,
          {
            url: req.body.webhookUrl || process.env.WEBHOOK_URL,
            tentativas: error.totalAttempts || 0,
            tempoTotalGasto: responseTime,
            detalhesErro: error.originalError?.message || error.message,
          },
          {
            processado: cnabProcessado,
            totalRegistros: dadosProcessados?.totalRegistros,
            dataProcessamento: dadosProcessados?.dataProcessamento,
            validacao,
          }
        )
      );
    }
  }

  /**
   * Extrai códigos de barras de arquivo CNAB
   */
  static async extrairCodigosBarras(req, res) {
    try {
      const { conteudo } = req.body;

      if (!conteudo) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Campo "conteudo" é obrigatório',
          codigo: 'CONTEUDO_OBRIGATORIO',
        });
      }

      const resultado = await CnabService.extrairCodigosBarras(conteudo);

      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Erro ao extrair códigos de barras:', error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: 'ERRO_EXTRACAO',
      });
    }
  }

  /**
   * Extrai linhas digitáveis de arquivo CNAB
   */
  static async extrairLinhasDigitaveis(req, res) {
    try {
      const { conteudo } = req.body;

      if (!conteudo) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Campo "conteudo" é obrigatório',
          codigo: 'CONTEUDO_OBRIGATORIO',
        });
      }

      const resultado = await CnabService.extrairLinhasDigitaveis(conteudo);

      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Erro ao extrair linhas digitáveis:', error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: 'ERRO_EXTRACAO',
      });
    }
  }

  /**
   * Valida arquivo CNAB
   */
  static async validarArquivo(req, res) {
    try {
      const { conteudo } = req.body;

      if (!conteudo) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Campo "conteudo" é obrigatório',
          codigo: 'CONTEUDO_OBRIGATORIO',
        });
      }

      const validacao = CnabService.validarArquivoCnab(conteudo);

      return res.status(200).json({
        sucesso: true,
        validacao,
      });
    } catch (error) {
      console.error('Erro ao validar arquivo CNAB:', error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: 'ERRO_VALIDACAO',
      });
    }
  }

  /**
   * Retorna informações sobre a API CNAB
   */
  static async informacoes(req, res) {
    try {
      return res.status(200).json({
        sucesso: true,
        api: 'CNAB 400 Itaú Parser API',
        versao: '1.0.0',
        banco: 'Itaú',
        formato: 'CNAB 400',
        funcionalidades: [
          'Processamento de arquivos CNAB 400',
          'Extração de códigos de barras',
          'Extração de linhas digitáveis',
          'Validação de arquivos CNAB',
          'Upload de arquivos',
          'Processamento via texto',
          'Envio automático para webhooks',
          'Dados estruturados completos',
          'Consulta de histórico persistido',
          'Estatísticas de processamento',
        ],
        endpoints: {
          'POST /api/v1/cnab/processar': 'Processa conteúdo CNAB via texto',
          'POST /api/v1/cnab/upload': 'Processa arquivo CNAB via upload',
          'POST /api/v1/cnab/processar-webhook': 'Processa CNAB e envia para webhook',
          'POST /api/v1/cnab/codigos-barras': 'Extrai códigos de barras',
          'POST /api/v1/cnab/linhas-digitaveis': 'Extrai linhas digitáveis',
          'POST /api/v1/cnab/validar': 'Valida arquivo CNAB',
          'GET /api/v1/cnab/info': 'Informações sobre a API',
          'GET /api/v1/cnab/historico': 'Lista histórico de processamentos CNAB 400',
          'GET /api/v1/cnab/historico/:hash': 'Busca arquivo processado por hash',
          'GET /api/v1/cnab/estatisticas': 'Estatísticas do banco de dados',
          'GET /api/v1/cnab/operacoes/:operationId': 'Detalhes de operação específica'
        },
        webhook: {
          suportado: true,
          configuracao: 'Configure WEBHOOK_URL nas variáveis de ambiente',
          dados_enviados: 'Cabeçalho, registros, pagador/recebedor, resumos e estatísticas',
        },
        persistencia: {
          ativo: true,
          banco: 'MySQL',
          features: [
            'Histórico completo de processamentos',
            'Deduplicação automática por hash',
            'Auditoria de operações',
            'Consultas por período e filtros'
          ]
        }
      });
    } catch (error) {
      console.error('Erro ao obter informações:', error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: 'ERRO_INFORMACOES',
      });
    }
  }

  /**
   * GET /api/v1/cnab/historico
   * Lista histórico de arquivos CNAB 400 processados com paginação e filtros
   */
  static async listarHistorico(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'historico');

    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        status,
        banco
      } = req.query;

      logger.start({
        page: parseInt(page),
        limit: parseInt(limit),
        startDate,
        endDate,
        status,
        banco
      });

      // Validar parâmetros
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Construir filtros
      const whereConditions = {
        file_type: 'cnab400'
      };

      if (startDate || endDate) {
        whereConditions.created_at = {};
        if (startDate) whereConditions.created_at[Op.gte] = new Date(startDate);
        if (endDate) whereConditions.created_at[Op.lte] = new Date(endDate);
      }

      // Buscar arquivos com informações relacionadas
      const { count, rows: files } = await File.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Operation,
            as: 'operation',
            required: true,
            where: status ? { status } : {}
          },
          {
            model: CnabHeader,
            as: 'cnabHeader',
            required: false,
            where: banco ? { banco_codigo: banco } : {}
          }
        ],
        order: [['created_at', 'DESC']],
        limit: limitNum,
        offset,
        distinct: true
      });

      // Formatar resposta
      const historico = await Promise.all(files.map(async (file) => {
        const header = file.cnabHeader;
        const totalRecords = await CnabRecord.count({
          where: { file_id: file.id }
        });

        return {
          operationId: file.operation.operation_id,
          fileId: file.id,
          fileName: file.file_name,
          fileHash: file.file_hash,
          fileSize: file.file_size,
          processedAt: file.created_at,
          status: file.operation.status,
          banco: {
            codigo: header?.banco_codigo || null,
            nome: header?.banco_nome || null
          },
          empresa: {
            documento: header?.empresa_documento || null,
            nome: header?.empresa_nome || null
          },
          totals: {
            registros: totalRecords,
            valorTotal: header?.valor_total || 0
          },
          validationStatus: file.validation_status
        };
      }));

      logger.processed({
        totalCount: count,
        returnedCount: historico.length,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum)
      });

      return res.status(200).json({
        sucesso: true,
        dados: historico,
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
          banco
        },
        operationId
      });

    } catch (error) {
      logger.error(error, 'historico');

      const structuredError = ErrorHandler.createError(
        'ERRO_CONSULTA_HISTORICO',
        error.message,
        { operation: 'listar_historico' },
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
   * GET /api/v1/cnab/historico/:hash
   * Busca arquivo CNAB 400 processado por hash SHA-256
   */
  static async buscarPorHash(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'buscar-hash');

    try {
      const { hash } = req.params;

      if (!hash || hash.length !== 64) {
        const error = ErrorHandler.createError(
          'HASH_INVALIDO',
          'Hash SHA-256 inválido. Deve ter 64 caracteres hexadecimais.'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId
        });
      }

      logger.start({ hash });

      // Buscar dados utilizando o service
      const resultado = await CnabService.buscarPorHash(hash);

      if (!resultado) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Arquivo não encontrado',
          codigo: 'ARQUIVO_NAO_ENCONTRADO',
          hash,
          operationId
        });
      }

      logger.processed({ found: true, fileId: resultado.file.id });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Arquivo encontrado',
        dados: resultado,
        operationId
      });

    } catch (error) {
      logger.error(error, 'buscar_hash');

      const structuredError = ErrorHandler.createError(
        'ERRO_BUSCA_HASH',
        error.message,
        { operation: 'buscar_por_hash', hash: req.params.hash },
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
   * GET /api/v1/cnab/estatisticas
   * Retorna estatísticas do banco de dados e sistema
   */
  static async obterEstatisticas(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'estatisticas');

    try {
      logger.start({});

      // Obter estatísticas utilizando o service
      const estatisticas = await CnabService.obterEstatisticas();

      logger.processed(estatisticas);

      return res.status(200).json({
        sucesso: true,
        estatisticas,
        operationId,
        dataConsulta: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'estatisticas');

      const structuredError = ErrorHandler.createError(
        'ERRO_ESTATISTICAS',
        error.message,
        { operation: 'obter_estatisticas' },
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
   * GET /api/v1/cnab/operacoes/:operationId
   * Retorna detalhes completos de uma operação específica
   */
  static async buscarOperacao(req, res) {
    const requestOperationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(requestOperationId, 'buscar-operacao');

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
          erro: 'Operação não encontrada',
          codigo: 'OPERACAO_NAO_ENCONTRADA',
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
      if (file) {
        registros = await CnabRecord.findAll({
          where: { file_id: file.id },
          order: [['registro_sequencia', 'ASC']],
          limit: 100 // Limitar para não sobrecarregar
        });
      }

      const resultado = {
        operation: operation.getFormattedData ? operation.getFormattedData() : operation,
        file: file?.getFormattedData ? file.getFormattedData() : file,
        header: file?.cnabHeader || null,
        registros: registros.map(r => r.getFormattedData ? r.getFormattedData() : r),
        resumo: {
          totalRegistros: registros.length,
          temLimitRegistros: registros.length >= 100
        }
      };

      logger.processed({
        found: true,
        operationId,
        hasFile: !!file,
        recordCount: registros.length
      });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Operação encontrada',
        dados: resultado,
        operationId: requestOperationId
      });

    } catch (error) {
      logger.error(error, 'buscar_operacao');

      const structuredError = ErrorHandler.createError(
        'ERRO_BUSCA_OPERACAO',
        error.message,
        { operation: 'buscar_operacao', targetOperationId: req.params.operationId },
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
}

// Middleware de upload de arquivo
export const uploadMiddleware = upload.single('arquivo');

export default CnabController; 