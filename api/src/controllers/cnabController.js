import CnabService from '../services/cnabService.js';
import WebhookService from '../services/webhookService.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';
import multer from 'multer';
import { promisify } from 'util';

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
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
        ],
        endpoints: {
          'POST /api/v1/cnab/processar': 'Processa conteúdo CNAB via texto',
          'POST /api/v1/cnab/upload': 'Processa arquivo CNAB via upload',
          'POST /api/v1/cnab/processar-webhook': 'Processa CNAB e envia para webhook',
          'POST /api/v1/cnab/codigos-barras': 'Extrai códigos de barras',
          'POST /api/v1/cnab/linhas-digitaveis': 'Extrai linhas digitáveis',
          'POST /api/v1/cnab/validar': 'Valida arquivo CNAB',
          'GET /api/v1/cnab/info': 'Informações sobre a API',
        },
        webhook: {
          suportado: true,
          configuracao: 'Configure WEBHOOK_URL nas variáveis de ambiente',
          dados_enviados: 'Cabeçalho, registros, pagador/recebedor, resumos e estatísticas',
        },
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
}

// Middleware de upload de arquivo
export const uploadMiddleware = upload.single('arquivo');

export default CnabController; 