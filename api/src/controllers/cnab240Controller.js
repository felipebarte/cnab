/**
 * Controller para operações de CNAB 240
 * 
 * Implementa endpoints específicos para processamento de arquivos CNAB 240
 * incluindo processamento, validação, informações de formato e webhook.
 */

import Cnab240Service from '../services/cnab240/cnab240Service.js';
import WebhookService from '../services/webhookService.js';
import { BANCOS_240, CODIGOS_OPERACAO, SEGMENTOS } from '../config/bancos240.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';
import multer from 'multer';

// Importar modelos para consultas históricas
import {
  Operation,
  File,
  Cnab240File,
  getDatabaseStats,
  checkDatabaseHealth,
  sequelize,
  Op
} from '../models/index.js';

// Configuração do multer para upload de arquivos CNAB 240
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // Limite de 20MB (maior que CNAB 400)
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
        'Apenas arquivos de texto são aceitos para CNAB 240',
        { mimetype: file.mimetype }
      );
      cb(error, false);
    }
  },
});

/**
 * Middleware de upload para arquivos CNAB 240
 */
export const uploadMiddleware = upload.single('arquivo');

/**
 * Controller para operações de CNAB 240
 */
export class Cnab240Controller {
  /**
   * POST /api/v1/cnab240/processar
   * Processa arquivo CNAB 240 completo e retorna dados estruturados
   */
  static async processarArquivo(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-processar');

    try {
      const { conteudo, opcoes = {} } = req.body;

      if (conteudo === undefined || conteudo === null) {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'Campo "conteudo" é obrigatório para processamento CNAB 240'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.start({
        contentLength: conteudo.length,
        formato: 'CNAB 240',
        opcoes
      });

      if (!conteudo.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Conteúdo CNAB 240 está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
          formato: 'CNAB 240'
        });
      }

      // Processa arquivo CNAB 240
      const resultado = await Cnab240Service.processar(conteudo, opcoes);

      if (!resultado.sucesso) {
        logger.error(new Error(resultado.erro), 'processing');

        return res.status(400).json({
          sucesso: false,
          erro: resultado.erro,
          codigo: 'ERRO_PROCESSAMENTO_CNAB240',
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.processed(resultado);

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Arquivo CNAB 240 processado com sucesso',
        dados: resultado.dadosEstruturados,
        validacao: resultado.validacao,
        somatorias: resultado.somatorias,
        resumoProcessamento: resultado.resumoProcessamento,
        informacoesArquivo: resultado.informacoesArquivo,
        operationId,
        dataProcessamento: resultado.dataProcessamento
      });

    } catch (error) {
      logger.error(error, 'processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO_CNAB240',
        error.message,
        { operation: 'processar', formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        tipo: structuredError.tipo,
        operationId,
        formato: 'CNAB 240',
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * POST /api/v1/cnab240/processar (upload)
   * Processa arquivo CNAB 240 via upload
   */
  static async processarArquivoUpload(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-upload');

    try {
      // Verifica se arquivo foi enviado
      if (!req.file) {
        const error = ErrorHandler.createError(
          'ARQUIVO_OBRIGATORIO',
          'Nenhum arquivo CNAB 240 foi enviado'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.start({
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        formato: 'CNAB 240'
      });

      // Converte buffer para string
      const conteudoCnab = req.file.buffer.toString('utf8');

      if (!conteudoCnab.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Arquivo CNAB 240 está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Processa arquivo CNAB 240
      const opcoes = req.body.opcoes ? JSON.parse(req.body.opcoes) : {};
      const resultado = await Cnab240Service.processar(conteudoCnab, opcoes);

      if (!resultado.sucesso) {
        logger.error(new Error(resultado.erro), 'processing');

        return res.status(400).json({
          sucesso: false,
          erro: resultado.erro,
          codigo: 'ERRO_PROCESSAMENTO_CNAB240',
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.processed(resultado);

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Arquivo CNAB 240 processado com sucesso',
        dados: resultado.dadosEstruturados,
        validacao: resultado.validacao,
        somatorias: resultado.somatorias,
        resumoProcessamento: resultado.resumoProcessamento,
        informacoesArquivo: resultado.informacoesArquivo,
        arquivo: {
          nome: req.file.originalname,
          tamanho: req.file.size,
          tipo: req.file.mimetype,
        },
        operationId,
        dataProcessamento: resultado.dataProcessamento
      });

    } catch (error) {
      logger.error(error, 'processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO_CNAB240',
        error.message,
        { operation: 'upload', formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        tipo: structuredError.tipo,
        operationId,
        formato: 'CNAB 240',
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * POST /api/v1/cnab240/validar
   * Valida estrutura do arquivo CNAB 240 sem processar completamente
   */
  static async validarArquivo(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-validar');

    try {
      const { conteudo } = req.body;

      if (!conteudo) {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'Campo "conteudo" é obrigatório para validação CNAB 240'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.start({
        contentLength: conteudo.length,
        formato: 'CNAB 240',
        operation: 'validacao'
      });

      if (!conteudo.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Conteúdo CNAB 240 está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Validação básica do arquivo
      const validacaoInicial = Cnab240Service.validarArquivo(conteudo);

      // Se validação inicial falhar, retorna os erros
      if (!validacaoInicial.valido) {
        logger.validation(false, validacaoInicial);

        return res.status(400).json({
          sucesso: false,
          valido: false,
          erros: validacaoInicial.erros,
          avisos: validacaoInicial.avisos,
          operationId,
          formato: 'CNAB 240'
        });
      }

      // Processamento básico para validação estrutural
      const linhas = conteudo.split('\n').filter(linha => linha.trim() !== '');
      const dadosProcessados = Cnab240Service.processarLinhas(linhas);

      // Identificar banco e configuração
      const codigoBanco = dadosProcessados.headerArquivo?.codigoBanco;
      const configuracaoBanco = BANCOS_240[codigoBanco];

      // Validação estrutural mais detalhada
      const validacaoEstrutura = Cnab240Service.validarEstrutura(dadosProcessados, configuracaoBanco);

      logger.validation(validacaoEstrutura.valido, validacaoEstrutura);

      return res.status(200).json({
        sucesso: true,
        valido: validacaoEstrutura.valido,
        erros: validacaoEstrutura.erros,
        avisos: validacaoEstrutura.avisos,
        informacoesBasicas: {
          banco: configuracaoBanco?.nome || codigoBanco || 'Não identificado',
          codigoBanco,
          totalLinhas: linhas.length,
          totalLotes: dadosProcessados.lotes.length,
          formato: 'CNAB 240'
        },
        operationId,
        dataValidacao: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'validation');

      const structuredError = ErrorHandler.createError(
        'ERRO_VALIDACAO_CNAB240',
        error.message,
        { operation: 'validar', formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        valido: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        formato: 'CNAB 240',
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * GET /api/v1/cnab240/formatos/:banco
   * Retorna informações de formato/layout específico do banco
   */
  static async obterFormatoBanco(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-formato');

    try {
      const { banco } = req.params;

      if (!banco) {
        const error = ErrorHandler.createError(
          'BANCO_OBRIGATORIO',
          'Código do banco é obrigatório'
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
        banco,
        operation: 'formato',
        formato: 'CNAB 240'
      });

      // Buscar configuração do banco
      const configuracaoBanco = BANCOS_240[banco];

      if (!configuracaoBanco) {
        const error = ErrorHandler.createError(
          'BANCO_NAO_SUPORTADO',
          `Banco ${banco} não está configurado para CNAB 240`,
          { banco }
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          banco,
          operationId,
          timestamp: error.timestamp,
        });
      }

      // Montar informações completas do formato
      const formatoInfo = {
        banco: {
          codigo: banco,
          nome: configuracaoBanco.nome || 'Nome não disponível',
          versaoLayout: configuracaoBanco.versaoLayout || 'Não especificada'
        },
        operacoesSuportadas: configuracaoBanco.operacoesSuportadas || [],
        codigosOperacao: CODIGOS_OPERACAO,
        segmentosSuportados: SEGMENTOS,
        validadores: {
          agencia: !!configuracaoBanco.validarAgencia,
          conta: !!configuracaoBanco.validarConta,
          digitoVerificador: !!configuracaoBanco.validarDigitoVerificador
        },
        limites: configuracaoBanco.limites || {},
        caracteristicas: {
          suportaPix: configuracaoBanco.pix?.ativo || false,
          tiposChavePix: configuracaoBanco.pix?.tiposChaveSuportados || [],
          formatoLinha: '240 caracteres fixos',
          codificacao: 'UTF-8 ou ASCII',
          estrutura: 'Header Arquivo → Lotes (Header + Detalhes + Trailer) → Trailer Arquivo'
        },
        documentacao: {
          especificacao: 'FEBRABAN CNAB 240',
          versao: 'Layout Padrão',
          observacoes: 'Formato padronizado para transferências e pagamentos'
        }
      };

      logger.processed({ banco, configuracao: formatoInfo });

      return res.status(200).json({
        sucesso: true,
        banco,
        formato: formatoInfo,
        operationId,
        dataConsulta: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'formato');

      const structuredError = ErrorHandler.createError(
        'ERRO_CONSULTA_FORMATO',
        error.message,
        { operation: 'formato', banco: req.params.banco },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * GET /api/v1/cnab240/formatos
   * Lista todos os bancos suportados e suas configurações básicas
   */
  static async listarFormatosBancos(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-formatos');

    try {
      logger.start({
        operation: 'listar-formatos',
        formato: 'CNAB 240'
      });

      const bancosSuportados = Object.keys(BANCOS_240).map(codigo => {
        const config = BANCOS_240[codigo];
        return {
          codigo,
          nome: config.nome || 'Nome não disponível',
          versaoLayout: config.versaoLayout || 'Não especificada',
          operacoesSuportadas: config.operacoesSuportadas?.length || 0,
          suportaPix: config.pix?.ativo || false,
          tiposChavePix: config.pix?.tiposChaveSuportados?.length || 0
        };
      });

      const resultado = {
        totalBancos: bancosSuportados.length,
        bancosSuportados,
        estatisticas: {
          comSuportePix: bancosSuportados.filter(b => b.suportaPix).length,
          semSuportePix: bancosSuportados.filter(b => !b.suportaPix).length,
          mediaOperacoesPorBanco: bancosSuportados.reduce((acc, b) => acc + b.operacoesSuportadas, 0) / bancosSuportados.length
        },
        formato: 'CNAB 240',
        especificacao: 'FEBRABAN CNAB 240 - Layout Padrão'
      };

      logger.processed(resultado);

      return res.status(200).json({
        sucesso: true,
        dados: resultado,
        operationId,
        dataConsulta: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'listar-formatos');

      const structuredError = ErrorHandler.createError(
        'ERRO_LISTAR_FORMATOS',
        error.message,
        { operation: 'listar-formatos' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * POST /api/v1/cnab240/processar-webhook
   * Processa arquivo CNAB 240 e envia dados para webhook
   */
  static async processarEEnviarWebhook(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-webhook');

    try {
      let conteudo, webhookUrl, opcoes = {};

      // Verificar se é upload ou texto
      if (req.file) {
        // Upload
        conteudo = req.file.buffer.toString('utf8');
        webhookUrl = req.body.webhookUrl;
        opcoes = req.body.opcoes ? JSON.parse(req.body.opcoes) : {};
      } else {
        // Texto
        ({ conteudo, webhookUrl, opcoes = {} } = req.body);
      }

      if (!conteudo) {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'Campo "conteudo" ou arquivo é obrigatório para processamento CNAB 240'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.start({
        contentLength: conteudo.length,
        hasWebhookUrl: !!webhookUrl,
        isUpload: !!req.file,
        formato: 'CNAB 240'
      });

      if (!conteudo.trim()) {
        const error = ErrorHandler.createError(
          'CNAB_VAZIO',
          'Conteúdo CNAB 240 está vazio'
        );
        logger.error(error, 'validation');

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId,
        });
      }

      // Processa arquivo CNAB 240
      const resultado = await Cnab240Service.processar(conteudo, opcoes);

      if (!resultado.sucesso) {
        logger.error(new Error(resultado.erro), 'processing');

        return res.status(400).json({
          sucesso: false,
          erro: resultado.erro,
          codigo: 'ERRO_PROCESSAMENTO_CNAB240',
          operationId,
          formato: 'CNAB 240'
        });
      }

      logger.processed(resultado);

      // Preparar dados para webhook
      const dadosWebhook = {
        formato: 'CNAB 240',
        dadosEstruturados: resultado.dadosEstruturados,
        validacao: resultado.validacao,
        somatorias: resultado.somatorias,
        resumoProcessamento: resultado.resumoProcessamento,
        informacoesArquivo: resultado.informacoesArquivo,
        operationId,
        dataProcessamento: resultado.dataProcessamento,
        ...(req.file && {
          arquivo: {
            nome: req.file.originalname,
            tamanho: req.file.size,
            tipo: req.file.mimetype,
          }
        })
      };

      // Enviar para webhook se URL foi fornecida
      let resultadoWebhook = null;
      if (webhookUrl) {
        try {
          resultadoWebhook = await WebhookService.enviarParaWebhook(dadosWebhook, webhookUrl);
          logger.webhook(webhookUrl, resultadoWebhook);
        } catch (webhookError) {
          logger.error(webhookError, 'webhook');
          console.warn('Erro ao enviar webhook, mas processamento continua:', webhookError.message);
        }
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Arquivo CNAB 240 processado com sucesso',
        dados: resultado.dadosEstruturados,
        validacao: resultado.validacao,
        somatorias: resultado.somatorias,
        resumoProcessamento: resultado.resumoProcessamento,
        informacoesArquivo: resultado.informacoesArquivo,
        webhook: {
          enviado: !!webhookUrl,
          url: webhookUrl,
          sucesso: resultadoWebhook?.sucesso || false,
          ...(resultadoWebhook && { resposta: resultadoWebhook })
        },
        ...(req.file && {
          arquivo: {
            nome: req.file.originalname,
            tamanho: req.file.size,
            tipo: req.file.mimetype,
          }
        }),
        operationId,
        dataProcessamento: resultado.dataProcessamento
      });

    } catch (error) {
      logger.error(error, 'webhook-processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO_WEBHOOK_CNAB240',
        error.message,
        { operation: 'processar-webhook', formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        tipo: structuredError.tipo,
        operationId,
        formato: 'CNAB 240',
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * GET /api/v1/cnab240/info
   * Informações gerais sobre a API CNAB 240
   */
  static async informacoes(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();

    try {
      const info = {
        nome: 'API de Processamento CNAB 240',
        versao: '1.0.0',
        formato: 'CNAB 240',
        especificacao: 'FEBRABAN CNAB 240 - Layout Padrão',
        descricao: 'API para processamento completo de arquivos CNAB 240 incluindo validação, estruturação e webhook',
        recursos: {
          processamento: 'Processamento completo de arquivos CNAB 240',
          validacao: 'Validação estrutural e de dados',
          formatos: 'Consulta de formatos por banco',
          webhook: 'Envio de dados processados para webhook',
          upload: 'Suporte a upload de arquivos',
          pix: 'Processamento de transações PIX (Segmentos B)',
          persistencia: 'Histórico completo de processamentos no MySQL',
          consultas: 'APIs de consulta histórica e estatísticas'
        },
        endpoints: [
          {
            metodo: 'POST',
            rota: '/api/v1/cnab240/processar',
            descricao: 'Processa arquivo CNAB 240 via texto',
            parametros: ['conteudo', 'opcoes?']
          },
          {
            metodo: 'POST',
            rota: '/api/v1/cnab240/processar (upload)',
            descricao: 'Processa arquivo CNAB 240 via upload',
            parametros: ['arquivo', 'opcoes?']
          },
          {
            metodo: 'POST',
            rota: '/api/v1/cnab240/validar',
            descricao: 'Valida estrutura CNAB 240',
            parametros: ['conteudo']
          },
          {
            metodo: 'GET',
            rota: '/api/v1/cnab240/formatos',
            descricao: 'Lista bancos suportados',
            parametros: []
          },
          {
            metodo: 'GET',
            rota: '/api/v1/cnab240/formatos/:banco',
            descricao: 'Formato específico do banco',
            parametros: ['banco']
          },
          {
            metodo: 'POST',
            rota: '/api/v1/cnab240/processar-webhook',
            descricao: 'Processa e envia para webhook',
            parametros: ['conteudo', 'webhookUrl?', 'opcoes?']
          },
          {
            metodo: 'GET',
            rota: '/api/v1/cnab240/historico',
            descricao: 'Lista histórico de processamentos CNAB 240',
            parametros: ['page?', 'limit?', 'startDate?', 'endDate?', 'status?', 'banco?']
          },
          {
            metodo: 'GET',
            rota: '/api/v1/cnab240/historico/:hash',
            descricao: 'Busca arquivo processado por hash SHA-256',
            parametros: ['hash']
          },
          {
            metodo: 'GET',
            rota: '/api/v1/cnab240/estatisticas',
            descricao: 'Estatísticas do banco de dados',
            parametros: []
          },
          {
            metodo: 'GET',
            rota: '/api/v1/cnab240/operacoes/:operationId',
            descricao: 'Detalhes de operação específica',
            parametros: ['operationId']
          }
        ],
        bancosSuportados: Object.keys(BANCOS_240).length,
        segmentosSuportados: Object.keys(SEGMENTOS),
        operacoesSuportadas: Object.keys(CODIGOS_OPERACAO).length,
        caracteristicas: {
          formatoLinha: '240 caracteres fixos',
          estruturaHierarquica: 'Header → Lotes → Detalhes → Trailers',
          suportePix: true,
          validacaoCompleta: true,
          webhook: true,
          upload: true,
          persistencia: {
            ativo: true,
            banco: 'MySQL',
            features: [
              'Histórico completo de processamentos',
              'Deduplicação automática por hash',
              'Auditoria de operações',
              'Consultas por período e filtros',
              'Dados de lotes e segmentos persistidos'
            ]
          }
        },
        operationId,
        dataConsulta: new Date().toISOString()
      };

      return res.status(200).json({
        sucesso: true,
        informacoes: info
      });

    } catch (error) {
      const structuredError = ErrorHandler.createError(
        'ERRO_INFORMACOES',
        error.message,
        { operation: 'informacoes' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp,
      });
    }
  }

  /**
   * GET /api/v1/cnab240/historico
   * Lista histórico de arquivos CNAB 240 processados com paginação e filtros
   */
  static async listarHistorico(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-historico');

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
        banco,
        formato: 'CNAB 240'
      });

      // Validar parâmetros
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Construir filtros
      const whereConditions = {
        file_type: 'cnab240'
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
            where: status ? { status } : {},
            required: true
          },
          {
            model: Cnab240File,
            as: 'cnab240File',
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
      const historico = files.map((file) => {
        const cnab240File = file.cnab240File;

        return {
          operationId: file.operation.operation_id,
          fileId: file.id,
          fileName: file.file_name,
          fileHash: file.file_hash,
          fileSize: file.file_size,
          processedAt: file.created_at,
          status: file.operation.status,
          banco: {
            codigo: cnab240File?.banco_codigo || null,
            nome: cnab240File?.banco_nome || null
          },
          empresa: {
            documento: cnab240File?.empresa_documento || null,
            nome: cnab240File?.empresa_nome || null,
            codigo: cnab240File?.empresa_codigo || null
          },
          totals: {
            lotes: cnab240File?.total_lotes || 0,
            registros: cnab240File?.total_registros || 0,
            valorTotal: cnab240File?.valor_total || 0
          },
          arquivo: {
            sequencia: cnab240File?.arquivo_sequencia || null,
            dataGeracao: cnab240File?.data_geracao || null,
            horaGeracao: cnab240File?.hora_geracao || null,
            versaoLayout: cnab240File?.versao_layout || null
          },
          validationStatus: file.validation_status
        };
      });

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
        formato: 'CNAB 240',
        operationId
      });

    } catch (error) {
      logger.error(error, 'cnab240-historico');

      const structuredError = ErrorHandler.createError(
        'ERRO_CONSULTA_HISTORICO_CNAB240',
        error.message,
        { operation: 'listar_historico', formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        formato: 'CNAB 240',
        operationId
      });
    }
  }

  /**
   * GET /api/v1/cnab240/historico/:hash
   * Busca arquivo CNAB 240 processado por hash SHA-256
   */
  static async buscarPorHash(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-buscar-hash');

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
          formato: 'CNAB 240',
          operationId
        });
      }

      logger.start({ hash, formato: 'CNAB 240' });

      // Buscar dados utilizando o service
      const resultado = await Cnab240Service.buscarPorHash(hash);

      if (!resultado) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Arquivo CNAB 240 não encontrado',
          codigo: 'ARQUIVO_NAO_ENCONTRADO',
          hash,
          formato: 'CNAB 240',
          operationId
        });
      }

      logger.processed({ found: true, fileId: resultado.file.id });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Arquivo CNAB 240 encontrado',
        dados: resultado,
        formato: 'CNAB 240',
        operationId
      });

    } catch (error) {
      logger.error(error, 'cnab240-buscar-hash');

      const structuredError = ErrorHandler.createError(
        'ERRO_BUSCA_HASH_CNAB240',
        error.message,
        { operation: 'buscar_por_hash', hash: req.params.hash, formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        formato: 'CNAB 240',
        operationId
      });
    }
  }

  /**
   * GET /api/v1/cnab240/estatisticas
   * Retorna estatísticas do banco de dados específicas para CNAB 240
   */
  static async obterEstatisticas(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'cnab240-estatisticas');

    try {
      logger.start({ formato: 'CNAB 240' });

      // Obter estatísticas utilizando o service
      const estatisticas = await Cnab240Service.obterEstatisticas();

      logger.processed(estatisticas);

      return res.status(200).json({
        sucesso: true,
        estatisticas,
        formato: 'CNAB 240',
        operationId,
        dataConsulta: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'cnab240-estatisticas');

      const structuredError = ErrorHandler.createError(
        'ERRO_ESTATISTICAS_CNAB240',
        error.message,
        { operation: 'obter_estatisticas', formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        formato: 'CNAB 240',
        operationId
      });
    }
  }

  /**
   * GET /api/v1/cnab240/operacoes/:operationId
   * Retorna detalhes completos de uma operação CNAB 240 específica
   */
  static async buscarOperacao(req, res) {
    const requestOperationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(requestOperationId, 'cnab240-buscar-operacao');

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
          formato: 'CNAB 240',
          operationId: requestOperationId
        });
      }

      logger.start({ targetOperationId: operationId, formato: 'CNAB 240' });

      // Buscar operação
      const operation = await Operation.findByOperationId(operationId);

      if (!operation || operation.operation_type !== 'cnab240') {
        return res.status(404).json({
          sucesso: false,
          erro: 'Operação CNAB 240 não encontrada',
          codigo: 'OPERACAO_NAO_ENCONTRADA',
          formato: 'CNAB 240',
          operationId: requestOperationId
        });
      }

      // Buscar arquivo relacionado
      const file = await File.findOne({
        where: {
          operation_id: operationId,
          file_type: 'cnab240'
        },
        include: [
          {
            model: Cnab240File,
            as: 'cnab240File',
            required: false
          }
        ]
      });

      const resultado = {
        operation: operation.getFormattedData ? operation.getFormattedData() : operation,
        file: file?.getFormattedData ? file.getFormattedData() : file,
        cnab240: file?.cnab240File || null,
        resumo: {
          formato: 'CNAB 240',
          temArquivo: !!file,
          temDadosCnab240: !!(file?.cnab240File)
        }
      };

      logger.processed({
        found: true,
        operationId,
        hasFile: !!file,
        hasCnab240Data: !!(file?.cnab240File)
      });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Operação CNAB 240 encontrada',
        dados: resultado,
        formato: 'CNAB 240',
        operationId: requestOperationId
      });

    } catch (error) {
      logger.error(error, 'cnab240-buscar-operacao');

      const structuredError = ErrorHandler.createError(
        'ERRO_BUSCA_OPERACAO_CNAB240',
        error.message,
        { operation: 'buscar_operacao', targetOperationId: req.params.operationId, formato: 'CNAB 240' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        formato: 'CNAB 240',
        operationId: requestOperationId
      });
    }
  }

  /**
   * POST /api/v1/cnab240/validar-simples
   * Valida arquivo CNAB 240 de forma simples (seguindo padrão CNAB 400)
   * Verifica apenas o tamanho das linhas (240 caracteres)
   */
  static async validarArquivoSimples(req, res) {
    try {
      const { conteudo } = req.body;

      if (!conteudo) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Campo "conteudo" é obrigatório',
          codigo: 'CONTEUDO_OBRIGATORIO',
        });
      }

      const validacao = Cnab240Service.validarArquivoCnab240(conteudo);

      return res.status(200).json({
        sucesso: true,
        validacao,
      });
    } catch (error) {
      console.error('Erro ao validar arquivo CNAB 240:', error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: 'ERRO_VALIDACAO',
      });
    }
  }
}

export default Cnab240Controller; 