/**
 * Middleware unificado para upload de arquivos CNAB
 * 
 * Detecta automaticamente o formato (CNAB 240 ou 400) e adiciona 
 * informações de formato ao request para uso pelos controllers.
 */

import multer from 'multer';
import FormatDetectorService from '../services/formatDetectorService.js';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';

/**
 * Configuração do multer para upload unificado
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB - limite maior para suportar ambos os formatos
    fieldSize: 20 * 1024 * 1024, // Campos de texto também com limite maior
    fieldNameSize: 100,
  },
  fileFilter: (req, file, cb) => {
    // Aceita arquivos de texto e formatos comuns de CNAB
    const allowedTypes = [
      'text/plain',
      'text/csv',
      'application/octet-stream',
      'application/vnd.ms-excel',
      'text/x-comma-separated-values'
    ];

    if (!file.mimetype ||
      file.mimetype.startsWith('text/') ||
      allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = ErrorHandler.createError(
        'TIPO_ARQUIVO_INVALIDO',
        `Tipo de arquivo não suportado: ${file.mimetype}. Aceitos: arquivos de texto (.txt, .cnab, .ret)`,
        { mimetype: file.mimetype, filename: file.originalname }
      );
      cb(error, false);
    }
  },
});

/**
 * Middleware de detecção automática de formato CNAB
 * Analisa o arquivo/conteúdo e adiciona informações de formato ao request
 */
const autoDetectFormatMiddleware = async (req, res, next) => {
  const operationId = req.operationId || Logger.generateOperationId();
  const logger = Logger.createCnabLogger(operationId, 'auto-detection');

  try {
    let conteudo = null;
    let tipoProcessamento = null;
    let informacoesArquivo = null;

    // Determinar fonte do conteúdo
    if (req.file) {
      // Upload de arquivo
      tipoProcessamento = 'upload';
      conteudo = req.file.buffer;
      informacoesArquivo = {
        nome: req.file.originalname,
        tamanho: req.file.size,
        tipo: req.file.mimetype,
        encoding: req.file.encoding
      };

      logger.info('Processando upload de arquivo', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

    } else if (req.body.conteudo) {
      // Conteúdo de texto
      tipoProcessamento = 'texto';
      conteudo = req.body.conteudo;

      logger.info('Processando conteúdo de texto', {
        contentLength: conteudo.length
      });

    } else {
      // Nenhum conteúdo fornecido - deixar controller decidir como tratar
      req.cnabFormat = null;
      req.formatDetection = {
        detectado: false,
        motivo: 'Nenhum conteúdo fornecido para detecção'
      };
      return next();
    }

    // Detectar formato automaticamente
    const deteccao = FormatDetectorService.detectarFormato(conteudo, { operationId });

    if (!deteccao.sucesso) {
      logger.error(new Error(deteccao.erro), 'format-detection');

      // Em caso de erro na detecção, continuar sem formato definido
      // e deixar controller decidir como tratar
      req.cnabFormat = null;
      req.formatDetection = {
        detectado: false,
        erro: deteccao.erro,
        codigo: deteccao.codigo
      };
      return next();
    }

    // Adicionar informações do formato ao request
    req.cnabFormat = {
      codigo: deteccao.formatoDetectado.codigo,
      nome: deteccao.formatoDetectado.nome,
      tamanhoLinha: deteccao.formatoDetectado.tamanhoLinha,
      servicoProcessamento: deteccao.formatoDetectado.servicoProcessamento,
      confianca: deteccao.formatoDetectado.confianca,
      motivo: deteccao.formatoDetectado.motivo
    };

    req.formatDetection = {
      detectado: true,
      analise: {
        totalLinhas: deteccao.analise.totalLinhas,
        tamanhoMaisComum: deteccao.analise.tamanhoMaisComum,
        consistencia: deteccao.analise.consistencia
      },
      validacao: deteccao.validacao,
      recomendacao: deteccao.recomendacao
    };

    req.processamento = {
      tipo: tipoProcessamento,
      arquivo: informacoesArquivo,
      operationId
    };

    logger.info('Formato detectado com sucesso', {
      formato: req.cnabFormat.codigo,
      confianca: req.cnabFormat.confianca,
      totalLinhas: req.formatDetection.analise.totalLinhas,
      recomendacao: req.formatDetection.recomendacao.tipo
    });

    // Adicionar avisos se existirem
    if (deteccao.validacao.avisos && deteccao.validacao.avisos.length > 0) {
      logger.warn('Avisos na detecção de formato', {
        avisos: deteccao.validacao.avisos,
        formato: req.cnabFormat.codigo
      });
    }

    next();

  } catch (error) {
    logger.error(error, 'middleware-execution');

    // Em caso de erro no middleware, continuar sem detecção
    // para manter compatibilidade
    req.cnabFormat = null;
    req.formatDetection = {
      detectado: false,
      erro: error.message,
      middleware_error: true
    };

    next(); // Não bloquear o pipeline
  }
};

/**
 * Middleware combinado: upload + detecção automática
 */
const unifiedUploadMiddleware = (req, res, next) => {
  // Primeiro fazer upload
  upload.single('arquivo')(req, res, (uploadError) => {
    if (uploadError) {
      const operationId = req.operationId || Logger.generateOperationId();
      const logger = Logger.createCnabLogger(operationId, 'upload-error');

      let structuredError;

      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        structuredError = ErrorHandler.createError(
          'ARQUIVO_MUITO_GRANDE',
          'Arquivo muito grande. Tamanho máximo permitido: 20MB',
          {
            maxSize: '20MB',
            receivedSize: req.headers['content-length']
          }
        );
      } else if (uploadError.code === 'LIMIT_UNEXPECTED_FILE') {
        structuredError = ErrorHandler.createError(
          'CAMPO_ARQUIVO_INVALIDO',
          'Campo de arquivo inválido. Use "arquivo" como nome do campo',
          { code: uploadError.code }
        );
      } else {
        structuredError = ErrorHandler.createError(
          'ERRO_UPLOAD',
          uploadError.message,
          { originalError: uploadError },
          uploadError
        );
      }

      logger.error(structuredError, 'upload');

      return res.status(structuredError.status).json({
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        tipo: structuredError.tipo,
        operationId,
        timestamp: structuredError.timestamp
      });
    }

    // Depois fazer detecção automática
    autoDetectFormatMiddleware(req, res, next);
  });
};

/**
 * Middleware apenas para detecção (sem upload de arquivo)
 * Útil para endpoints que recebem conteúdo via JSON
 */
const autoDetectOnlyMiddleware = autoDetectFormatMiddleware;

/**
 * Função helper para verificar se formato foi detectado
 */
const isFormatDetected = (req) => {
  return req.formatDetection && req.formatDetection.detectado === true;
};

/**
 * Função helper para obter formato detectado
 */
const getDetectedFormat = (req) => {
  return isFormatDetected(req) ? req.cnabFormat : null;
};

/**
 * Função helper para verificar se é formato específico
 */
const isFormat = (req, formatCode) => {
  const format = getDetectedFormat(req);
  return format && format.codigo === formatCode;
};

/**
 * Middleware de validação de formato (opcional)
 * Pode ser usado após o middleware principal para validar se formato é suportado
 */
const validateFormatMiddleware = (allowedFormats = ['CNAB_240', 'CNAB_400']) => {
  return (req, res, next) => {
    if (!isFormatDetected(req)) {
      // Se não detectou formato, deixar controller decidir
      return next();
    }

    const format = getDetectedFormat(req);
    if (!allowedFormats.includes(format.codigo)) {
      const operationId = req.operationId || Logger.generateOperationId();

      return res.status(400).json({
        sucesso: false,
        erro: `Formato ${format.nome} não é suportado por este endpoint`,
        codigo: 'FORMATO_NAO_SUPORTADO',
        formatoDetectado: format.codigo,
        formatosSuportados: allowedFormats,
        operationId
      });
    }

    next();
  };
};

export {
  unifiedUploadMiddleware,
  autoDetectOnlyMiddleware,
  validateFormatMiddleware,
  isFormatDetected,
  getDetectedFormat,
  isFormat
};

export default unifiedUploadMiddleware; 