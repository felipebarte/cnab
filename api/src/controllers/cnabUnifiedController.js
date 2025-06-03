/**
 * Controller unificado para operações de CNAB
 * 
 * Detecta automaticamente o formato (CNAB 240 ou 400) e roteia 
 * o processamento para o serviço apropriado, mantendo uma API consistente.
 */

import CnabService from '../services/cnabService.js';
import Cnab240Service from '../services/cnab240/cnab240Service.js';
import FormatDetectorService from '../services/formatDetectorService.js';
import WebhookService from '../services/webhookService.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';
import {
  isFormatDetected,
  getDetectedFormat,
  isFormat
} from '../middleware/unifiedUploadMiddleware.js';
import crypto from 'crypto';
import sequelize from '../config/database.js';
import File from '../models/File.js';
import Operation from '../models/Operation.js';
import CnabDetector from '../utils/cnab/CnabDetector.js';

/**
 * Controller unificado para operações CNAB
 */
export class CnabUnifiedController {
  /**
   * GET /api/v1/cnab/info-auto
   * Informações sobre o sistema de detecção automática de formato
   */
  static async informacoes(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();

    try {
      const formatosSuportados = FormatDetectorService.getFormatosSuportados();

      return res.status(200).json({
        sucesso: true,
        sistema: 'API CNAB Unificada - Detecção Automática',
        versao: '1.0.0',
        descricao: 'Sistema que detecta automaticamente o formato CNAB (240 ou 400) e processa adequadamente',
        formatosSuportados,
        endpoints: {
          '/processar-auto/upload': 'Processa arquivo com detecção automática via upload',
          '/processar-auto': 'Processa conteúdo com detecção automática via JSON',
          '/validar-auto': 'Valida qualquer formato CNAB automaticamente',
          '/detectar-formato': 'Apenas detecta o formato sem processar',
          '/info-auto': 'Informações sobre o sistema unificado',
          '/webhook-auto/upload': 'Processa e envia para webhook com detecção automática'
        },
        middleware: {
          deteccaoAutomatica: true,
          limiteTamanho: '20MB',
          formatosReconhecidos: ['CNAB 240', 'CNAB 400']
        },
        operationId
      });

    } catch (error) {
      console.error('Erro ao obter informações:', error);
      return res.status(500).json({
        sucesso: false,
        erro: error.message,
        codigo: 'ERRO_INFORMACOES',
        operationId
      });
    }
  }

  /**
   * POST /api/v1/cnab/detectar-formato
   * Detecta o formato do arquivo sem processar
   */
  static async detectarFormato(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'detectar-formato');

    try {
      // Usar detecção do middleware se disponível
      if (isFormatDetected(req)) {
        const formato = getDetectedFormat(req);

        return res.status(200).json({
          sucesso: true,
          formatoDetectado: formato,
          deteccao: req.formatDetection,
          processamento: req.processamento,
          operationId
        });
      }

      // Detecção manual se middleware não detectou
      let conteudo = null;
      if (req.file) {
        conteudo = req.file.buffer.toString('utf8');
      } else if (req.body.conteudo) {
        conteudo = req.body.conteudo;
      } else {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'É necessário fornecer arquivo via upload ou conteúdo via JSON'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId
        });
      }

      const deteccao = FormatDetectorService.detectarFormato(conteudo, { operationId });

      return res.status(200).json({
        sucesso: deteccao.sucesso,
        ...(deteccao.sucesso ? {
          formatoDetectado: deteccao.formatoDetectado,
          analise: deteccao.analise,
          validacao: deteccao.validacao,
          recomendacao: deteccao.recomendacao
        } : {
          erro: deteccao.erro,
          codigo: deteccao.codigo
        }),
        operationId
      });

    } catch (error) {
      logger.error(error, 'detection');

      const structuredError = ErrorHandler.createError(
        'ERRO_DETECCAO_FORMATO',
        error.message,
        { operation: 'detectar-formato' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp
      });
    }
  }

  /**
   * POST /api/v1/cnab/processar-auto/upload
   * Processa arquivo CNAB com detecção automática via upload
   */
  static async processarArquivoAutoUpload(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'processar-auto-upload');

    try {
      // Verificar se arquivo foi enviado
      if (!req.file) {
        const error = ErrorHandler.createError(
          'ARQUIVO_OBRIGATORIO',
          'Nenhum arquivo foi enviado'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId
        });
      }

      // Verificar se formato foi detectado
      if (!isFormatDetected(req)) {
        const error = ErrorHandler.createError(
          'FORMATO_NAO_DETECTADO',
          'Não foi possível detectar o formato do arquivo automaticamente',
          { deteccao: req.formatDetection }
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          deteccao: req.formatDetection,
          operationId
        });
      }

      const formato = getDetectedFormat(req);
      const conteudoCnab = req.file.buffer.toString('utf8');

      logger.start({
        filename: req.file.originalname,
        size: req.file.size,
        formatoDetectado: formato.codigo,
        confianca: formato.confianca
      });

      // Processar opções se fornecidas
      const opcoes = req.body.opcoes ? JSON.parse(req.body.opcoes) : {};

      // Rotear para o serviço correto baseado no formato
      let resultado;

      if (isFormat(req, 'CNAB_240')) {
        resultado = await Cnab240Service.processar(conteudoCnab, opcoes);
      } else if (isFormat(req, 'CNAB_400')) {
        resultado = await CnabService.processarArquivoCnab(conteudoCnab, opcoes);
      } else {
        throw new Error(`Formato ${formato.codigo} não suportado para processamento`);
      }

      if (!resultado.sucesso) {
        logger.error(new Error(resultado.erro), 'processing');

        return res.status(400).json({
          sucesso: false,
          erro: resultado.erro,
          codigo: 'ERRO_PROCESSAMENTO_CNAB',
          formatoDetectado: formato.codigo,
          operationId
        });
      }

      logger.processed(resultado);

      // ✅ NOVO: Compilar todos os códigos de barras encontrados
      const codigosBarras = [];

      if (resultado.dadosEstruturados?.lotes) {
        resultado.dadosEstruturados.lotes.forEach(lote => {
          if (lote.detalhes) {
            lote.detalhes.forEach(detalhe => {
              // Códigos de barras de segmentos J (títulos)
              if (detalhe.segmento === 'J' && detalhe.titulo?.codigoBarras) {
                codigosBarras.push({
                  tipo: 'titulo',
                  segmento: 'J',
                  codigo: detalhe.titulo.codigoBarras,
                  favorecido: detalhe.titulo.nomeFavorecido,
                  valor: detalhe.titulo.valorPago || detalhe.titulo.valorTitulo,
                  dataVencimento: detalhe.titulo.dataVencimento,
                  dataPagamento: detalhe.titulo.dataPagamento
                });
              }

              // Códigos de barras de segmentos O (tributos)
              if (detalhe.segmento === 'O' && detalhe.tributo?.codigoBarras) {
                codigosBarras.push({
                  tipo: 'tributo',
                  segmento: 'O',
                  codigo: detalhe.tributo.codigoBarras,
                  concessionaria: detalhe.tributo.nomeConcessionaria,
                  valor: detalhe.tributo.valorPago || detalhe.tributo.valorDocumento,
                  dataVencimento: detalhe.tributo.dataVencimento,
                  dataPagamento: detalhe.tributo.dataPagamento
                });
              }

              // Fallback: verificar diretamente nos dados originais
              if (!detalhe.titulo?.codigoBarras && !detalhe.tributo?.codigoBarras && detalhe.dadosOriginais?.codigoBarras) {
                codigosBarras.push({
                  tipo: 'outro',
                  segmento: detalhe.segmento,
                  codigo: detalhe.dadosOriginais.codigoBarras,
                  favorecido: detalhe.dadosOriginais.nomeFavorecido || 'N/A',
                  valor: detalhe.dadosOriginais.valorPago || detalhe.dadosOriginais.valorTitulo || detalhe.dadosOriginais.valorDocumento,
                  observacao: 'Extraído dos dados originais'
                });
              }
            });
          }
        });
      }

      // ✅ MELHORADO: Resposta mais completa incluindo códigos de barras
      const response = {
        sucesso: true,
        mensagem: `Arquivo ${formato.nome} processado com sucesso via detecção automática`,
        dados: resultado.dadosEstruturados || resultado.dados,
        formatoDetectado: formato,
        deteccao: req.formatDetection,
        validacao: resultado.validacao,
        ...(resultado.somatorias && { somatorias: resultado.somatorias }),
        ...(resultado.resumoProcessamento && { resumoProcessamento: resultado.resumoProcessamento }),
        informacoesArquivo: resultado.informacoesArquivo,
        arquivo: {
          nome: req.file.originalname,
          tamanho: req.file.size,
          tipo: req.file.mimetype,
        },
        operationId,
        dataProcessamento: resultado.dataProcessamento || new Date().toISOString(),
        codigosBarras: {
          total: codigosBarras.length,
          lista: codigosBarras
        }
      };

      return res.status(200).json(response);

    } catch (error) {
      logger.error(error, 'processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO_AUTO',
        error.message,
        { operation: 'processar-auto-upload' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        formatoDetectado: getDetectedFormat(req)?.codigo || null,
        operationId,
        timestamp: structuredError.timestamp
      });
    }
  }

  /**
   * POST /api/v1/cnab/processar-auto
   * Processa conteúdo CNAB com detecção automática via JSON
   */
  static async processarConteudoAuto(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'processar-auto-texto');

    try {
      const { conteudo, opcoes = {} } = req.body;

      if (!conteudo) {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'Campo "conteudo" é obrigatório'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId
        });
      }

      // Usar detecção do middleware ou fazer detecção manual
      let formato;
      if (isFormatDetected(req)) {
        formato = getDetectedFormat(req);
      } else {
        const deteccao = FormatDetectorService.detectarFormato(conteudo, { operationId });
        if (!deteccao.sucesso) {
          return res.status(400).json({
            sucesso: false,
            erro: deteccao.erro,
            codigo: deteccao.codigo,
            operationId
          });
        }
        formato = deteccao.formatoDetectado;
      }

      logger.start({
        contentLength: conteudo.length,
        formatoDetectado: formato.codigo,
        confianca: formato.confianca
      });

      // Rotear para o serviço correto
      let resultado;

      if (formato.codigo === 'CNAB_240') {
        resultado = await Cnab240Service.processar(conteudo, opcoes);
      } else if (formato.codigo === 'CNAB_400') {
        resultado = await CnabService.processarArquivoCnab(conteudo, opcoes);
      } else {
        throw new Error(`Formato ${formato.codigo} não suportado para processamento`);
      }

      if (!resultado.sucesso) {
        logger.error(new Error(resultado.erro), 'processing');

        return res.status(400).json({
          sucesso: false,
          erro: resultado.erro,
          codigo: 'ERRO_PROCESSAMENTO_CNAB',
          formatoDetectado: formato.codigo,
          operationId
        });
      }

      logger.processed(resultado);

      // ✅ NOVO: Compilar todos os códigos de barras encontrados
      const codigosBarras = [];

      if (resultado.dadosEstruturados?.lotes) {
        resultado.dadosEstruturados.lotes.forEach(lote => {
          if (lote.detalhes) {
            lote.detalhes.forEach(detalhe => {
              // Códigos de barras de segmentos J (títulos)
              if (detalhe.segmento === 'J' && detalhe.titulo?.codigoBarras) {
                codigosBarras.push({
                  tipo: 'titulo',
                  segmento: 'J',
                  codigo: detalhe.titulo.codigoBarras,
                  favorecido: detalhe.titulo.nomeFavorecido,
                  valor: detalhe.titulo.valorPago || detalhe.titulo.valorTitulo,
                  dataVencimento: detalhe.titulo.dataVencimento,
                  dataPagamento: detalhe.titulo.dataPagamento
                });
              }

              // Códigos de barras de segmentos O (tributos)
              if (detalhe.segmento === 'O' && detalhe.tributo?.codigoBarras) {
                codigosBarras.push({
                  tipo: 'tributo',
                  segmento: 'O',
                  codigo: detalhe.tributo.codigoBarras,
                  concessionaria: detalhe.tributo.nomeConcessionaria,
                  valor: detalhe.tributo.valorPago || detalhe.tributo.valorDocumento,
                  dataVencimento: detalhe.tributo.dataVencimento,
                  dataPagamento: detalhe.tributo.dataPagamento
                });
              }

              // Fallback: verificar diretamente nos dados originais
              if (!detalhe.titulo?.codigoBarras && !detalhe.tributo?.codigoBarras && detalhe.dadosOriginais?.codigoBarras) {
                codigosBarras.push({
                  tipo: 'outro',
                  segmento: detalhe.segmento,
                  codigo: detalhe.dadosOriginais.codigoBarras,
                  favorecido: detalhe.dadosOriginais.nomeFavorecido || 'N/A',
                  valor: detalhe.dadosOriginais.valorPago || detalhe.dadosOriginais.valorTitulo || detalhe.dadosOriginais.valorDocumento,
                  observacao: 'Extraído dos dados originais'
                });
              }
            });
          }
        });
      }

      // ✅ MELHORADO: Resposta mais completa incluindo códigos de barras
      const response = {
        sucesso: true,
        mensagem: `Conteúdo ${formato.nome} processado com sucesso via detecção automática`,
        dados: resultado.dadosEstruturados || resultado.dados,
        formatoDetectado: formato,
        deteccao: req.formatDetection,
        validacao: resultado.validacao,
        ...(resultado.somatorias && { somatorias: resultado.somatorias }),
        ...(resultado.resumoProcessamento && { resumoProcessamento: resultado.resumoProcessamento }),
        informacoesArquivo: resultado.informacoesArquivo,
        operationId,
        dataProcessamento: resultado.dataProcessamento || new Date().toISOString()
      };

      return res.status(200).json(response);

    } catch (error) {
      logger.error(error, 'processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_PROCESSAMENTO_AUTO',
        error.message,
        { operation: 'processar-auto-texto' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp
      });
    }
  }

  /**
   * POST /api/v1/cnab/validar-auto
   * Valida arquivo CNAB automaticamente
   */
  static async validarAuto(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'validar-auto');

    try {
      let conteudo = null;
      if (req.file) {
        conteudo = req.file.buffer.toString('utf8');
      } else if (req.body.conteudo) {
        conteudo = req.body.conteudo;
      } else {
        const error = ErrorHandler.createError(
          'CONTEUDO_OBRIGATORIO',
          'É necessário fornecer arquivo via upload ou conteúdo via JSON'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId
        });
      }

      // Detectar formato
      const deteccao = FormatDetectorService.detectarFormato(conteudo, { operationId });

      if (!deteccao.sucesso) {
        return res.status(400).json({
          sucesso: false,
          erro: deteccao.erro,
          codigo: deteccao.codigo,
          operationId
        });
      }

      // Validar usando o serviço correto
      let validacao;

      if (deteccao.formatoDetectado.codigo === 'CNAB_240') {
        validacao = Cnab240Service.validarArquivo(conteudo);
      } else if (deteccao.formatoDetectado.codigo === 'CNAB_400') {
        validacao = CnabService.validarArquivoCnab(conteudo);
      } else {
        throw new Error(`Formato ${deteccao.formatoDetectado.codigo} não suportado para validação`);
      }

      logger.validation(validacao.valido, validacao);

      return res.status(200).json({
        sucesso: true,
        formatoDetectado: deteccao.formatoDetectado,
        deteccao: {
          analise: deteccao.analise,
          validacao: deteccao.validacao,
          recomendacao: deteccao.recomendacao
        },
        validacaoEspecifica: validacao,
        operationId
      });

    } catch (error) {
      logger.error(error, 'validation');

      const structuredError = ErrorHandler.createError(
        'ERRO_VALIDACAO_AUTO',
        error.message,
        { operation: 'validar-auto' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp
      });
    }
  }

  /**
   * POST /api/v1/cnab/webhook-auto/upload
   * Processa arquivo e envia para webhook com detecção automática
   */
  static async webhookAutoUpload(req, res) {
    const operationId = req.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'webhook-auto');

    try {
      // Verificar se arquivo foi enviado
      if (!req.file) {
        const error = ErrorHandler.createError(
          'ARQUIVO_OBRIGATORIO',
          'Nenhum arquivo foi enviado'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          operationId
        });
      }

      // Verificar se formato foi detectado
      if (!isFormatDetected(req)) {
        const error = ErrorHandler.createError(
          'FORMATO_NAO_DETECTADO',
          'Não foi possível detectar o formato do arquivo automaticamente'
        );

        return res.status(error.status).json({
          sucesso: false,
          erro: error.mensagem,
          codigo: error.codigo,
          deteccao: req.formatDetection,
          operationId
        });
      }

      const formato = getDetectedFormat(req);
      const conteudoCnab = req.file.buffer.toString('utf8');
      const webhookUrl = req.body.webhookUrl;
      const opcoes = req.body.opcoes ? JSON.parse(req.body.opcoes) : {};

      logger.start({
        filename: req.file.originalname,
        size: req.file.size,
        formatoDetectado: formato.codigo,
        hasWebhookUrl: !!webhookUrl
      });

      // Processar usando o serviço correto
      let resultado;

      if (isFormat(req, 'CNAB_240')) {
        resultado = await Cnab240Service.processar(conteudoCnab, opcoes);
      } else if (isFormat(req, 'CNAB_400')) {
        resultado = await CnabService.processarArquivoCnab(conteudoCnab, opcoes);
      } else {
        throw new Error(`Formato ${formato.codigo} não suportado para processamento`);
      }

      if (!resultado.sucesso) {
        logger.error(new Error(resultado.erro), 'processing');

        return res.status(400).json({
          sucesso: false,
          erro: resultado.erro,
          codigo: 'ERRO_PROCESSAMENTO_CNAB',
          formatoDetectado: formato.codigo,
          operationId
        });
      }

      logger.processed(resultado);

      // Preparar dados para webhook
      const dadosWebhook = {
        formatoDetectado: formato,
        deteccao: req.formatDetection,
        dados: resultado.dadosEstruturados || resultado.dados,
        validacao: resultado.validacao,
        ...(resultado.somatorias && { somatorias: resultado.somatorias }),
        ...(resultado.resumoProcessamento && { resumoProcessamento: resultado.resumoProcessamento }),
        informacoesArquivo: resultado.informacoesArquivo,
        arquivo: {
          nome: req.file.originalname,
          tamanho: req.file.size,
          tipo: req.file.mimetype,
        },
        operationId,
        dataProcessamento: resultado.dataProcessamento || new Date().toISOString()
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
        mensagem: `Arquivo ${formato.nome} processado e webhook enviado com sucesso`,
        dados: resultado.dadosEstruturados || resultado.dados,
        formatoDetectado: formato,
        deteccao: req.formatDetection,
        validacao: resultado.validacao,
        ...(resultado.somatorias && { somatorias: resultado.somatorias }),
        ...(resultado.resumoProcessamento && { resumoProcessamento: resultado.resumoProcessamento }),
        informacoesArquivo: resultado.informacoesArquivo,
        webhook: {
          enviado: !!webhookUrl,
          url: webhookUrl,
          sucesso: resultadoWebhook?.sucesso || false,
          ...(resultadoWebhook && { resposta: resultadoWebhook })
        },
        arquivo: {
          nome: req.file.originalname,
          tamanho: req.file.size,
          tipo: req.file.mimetype,
        },
        operationId,
        dataProcessamento: resultado.dataProcessamento || new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, 'webhook-processing');

      const structuredError = ErrorHandler.createError(
        'ERRO_WEBHOOK_AUTO',
        error.message,
        { operation: 'webhook-auto' },
        error
      );

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        formatoDetectado: getDetectedFormat(req)?.codigo || null,
        operationId,
        timestamp: structuredError.timestamp
      });
    }
  }

  /**
   * Processamento automático de arquivo CNAB com detecção de formato
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   */
  static async processarAuto(req, res) {
    const operationId = crypto.randomUUID();
    let transaction;

    try {
      // Validar se há arquivo
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo foi enviado'
        });
      }

      console.log(`[INFO] Iniciando processamento automático - Operation ID: ${operationId}`);
      console.log(`[INFO] Arquivo: ${req.file.originalname}, Tamanho: ${req.file.size} bytes`);

      // Inicializar transação para controle de dados
      transaction = await sequelize.transaction();

      // Ler conteúdo do arquivo
      const cnabContent = req.file.buffer.toString('utf8');

      // Gerar hash do arquivo para verificação de duplicatas
      const fileHash = crypto.createHash('sha256').update(cnabContent).digest('hex');

      // Verificar se arquivo já foi processado
      const existingFile = await File.findByHash(fileHash);
      if (existingFile && !req.body.forceReprocess) {
        await transaction.rollback();

        console.log(`[INFO] Arquivo já processado - Hash: ${fileHash}`);
        return res.status(200).json({
          success: true,
          message: 'Arquivo já foi processado anteriormente',
          duplicado: true,
          operationId,
          arquivoId: existingFile.id,
          dataProcessamentoOriginal: existingFile.created_at,
          hash: fileHash
        });
      }

      // Criar operação no banco
      const operation = await Operation.create({
        operation_id: operationId,
        operation_type: 'cnab_auto',
        status: 'processing',
        request_data: {
          file_name: req.file.originalname,
          file_size: req.file.size,
          auto_detect: true,
          started_at: new Date().toISOString()
        }
      }, { transaction });

      // Criar registro do arquivo
      const file = await File.create({
        operation_id: operationId,
        file_hash: fileHash,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: 'unknown', // Será detectado automaticamente
        content_preview: File.generatePreview(cnabContent, 3),
        validation_status: 'pending'
      }, { transaction });

      // Detectar formato do arquivo
      const formatoDetectado = CnabDetector.detectarFormato(cnabContent);
      console.log(`[INFO] Formato detectado: ${formatoDetectado.formato} (confiança: ${formatoDetectado.confianca}%)`);

      // Atualizar tipo do arquivo com formato detectado
      await file.update({
        file_type: formatoDetectado.formato.toLowerCase()
      }, { transaction });

      let resultado;

      // Processar baseado no formato detectado
      switch (formatoDetectado.formato) {
      case 'CNAB_240':
        console.log('[INFO] Processando como CNAB 240...');

        // ✅ NOVO: Passar fileId e operationId para o CNAB240Service
        resultado = await Cnab240Service.processar(cnabContent, {
          fileId: file.id,
          operationId,
          nomeArquivo: req.file.originalname,
          forceReprocess: req.body.forceReprocess || false
        });

        break;

      case 'CNAB_400':
        console.log('[INFO] Processando como CNAB 400...');
        resultado = await CnabService.processar(cnabContent, {
          detectarFormato: false,
          formato: 'CNAB_400'
        });
        break;

      case 'CNAB_150':
        console.log('[INFO] Processando como CNAB 150...');
        resultado = await CnabService.processar(cnabContent, {
          detectarFormato: false,
          formato: 'CNAB_150'
        });
        break;

      default:
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Formato não suportado ou não identificado: ${formatoDetectado.formato}`,
          formatoDetectado,
          operationId
        });
      }

      // Verificar se processamento foi bem-sucedido
      if (!resultado.sucesso) {
        await transaction.rollback();

        await operation.update({
          status: 'error',
          response_data: {
            error: resultado.erro?.message || 'Erro no processamento',
            completed_at: new Date().toISOString()
          }
        });

        return res.status(400).json({
          success: false,
          error: resultado.erro?.message || 'Erro no processamento',
          operationId,
          formatoDetectado
        });
      }

      // Atualizar arquivo como válido
      await file.update({
        validation_status: resultado.valido ? 'valid' : 'valid_with_warnings'
      }, { transaction });

      // ✅ NOVO: Capturar estatísticas de persistência
      const estatisticasPersistencia = resultado.persistencia ? {
        totalLotes: resultado.persistencia.estatisticas.totalLotes,
        totalSegmentos: resultado.persistencia.estatisticas.totalSegmentos,
        totalCodigosBarras: resultado.persistencia.estatisticas.totalCodigosBarras,
        errosPersistencia: resultado.persistencia.estatisticas.erros.length
      } : null;

      // Atualizar operação como sucesso
      await operation.update({
        status: 'success',
        response_data: {
          file_id: file.id,
          formato_detectado: formatoDetectado.formato,
          confianca_deteccao: formatoDetectado.confianca,
          valido: resultado.valido,
          total_lotes: resultado.resumo?.totalLotes || 0,
          total_registros: resultado.resumo?.totalRegistros || 0,
          valor_total: resultado.resumo?.valorTotal || 0,
          // ✅ NOVO: Adicionar estatísticas de persistência
          persistencia: estatisticasPersistencia,
          completed_at: new Date().toISOString()
        }
      }, { transaction });

      // Commit da transação
      await transaction.commit();

      console.log(`[SUCCESS] Processamento automático concluído - Operation ID: ${operationId}`);

      // ✅ NOVO: Incluir informações de códigos de barras na resposta
      const resposta = {
        success: true,
        message: `Arquivo processado com sucesso como ${formatoDetectado.formato}`,
        operationId,
        formatoDetectado: {
          formato: formatoDetectado.formato,
          confianca: formatoDetectado.confianca,
          detalhes: formatoDetectado.detalhes
        },
        arquivo: {
          id: file.id,
          nome: req.file.originalname,
          tamanho: req.file.size,
          hash: fileHash,
          valido: resultado.valido
        },
        processamento: {
          timestamp: new Date().toISOString(),
          tempoProcessamento: Date.now() - operation.created_at.getTime()
        },
        dados: resultado.dados || resultado.dadosEstruturados,
        resumo: resultado.resumo || resultado.resumoProcessamento,
        validacao: resultado.validacao
      };

      // ✅ NOVO: Adicionar informações de persistência se disponível
      if (resultado.persistencia) {
        resposta.persistencia = {
          dadosSalvos: true,
          totalLotes: resultado.persistencia.estatisticas.totalLotes,
          totalSegmentos: resultado.persistencia.estatisticas.totalSegmentos,
          totalCodigosBarras: resultado.persistencia.estatisticas.totalCodigosBarras,
          erros: resultado.persistencia.estatisticas.erros,
          // ✅ CRÍTICO: Lista dos códigos de barras salvos para uso na API Swap
          codigosBarras: resultado.persistencia.codigosBarras.map(cb => ({
            id: cb.id,
            codigo: cb.codigo_barras,
            tipo: cb.tipo_documento,
            valor: cb.valor_documento,
            vencimento: cb.data_vencimento,
            favorecido: cb.favorecido_nome,
            status: cb.status_pagamento
          }))
        };

        console.log(`[INFO] Códigos de barras disponíveis para API Swap: ${resposta.persistencia.totalCodigosBarras}`);
      } else {
        resposta.persistencia = {
          dadosSalvos: false,
          motivo: 'Dados de arquivo/operação não fornecidos para persistência'
        };
      }

      return res.status(200).json(resposta);

    } catch (error) {
      // Rollback da transação em caso de erro
      if (transaction) {
        await transaction.rollback();
      }

      // Tentar marcar operação como erro
      try {
        const operation = await Operation.findByOperationId(operationId);
        if (operation) {
          await operation.markAsError({
            error_message: error.message,
            error_stack: error.stack,
            failed_at: new Date().toISOString()
          });
        }
      } catch (updateError) {
        console.error('[ERROR] Erro ao atualizar operação com falha:', updateError);
      }

      console.error('[ERROR] Erro no processamento automático:', error);

      return res.status(500).json({
        success: false,
        error: 'Erro interno no processamento do arquivo',
        details: error.message,
        operationId,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default CnabUnifiedController; 