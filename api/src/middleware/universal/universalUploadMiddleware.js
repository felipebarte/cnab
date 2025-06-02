/**
 * UniversalUploadMiddleware - Middleware de Upload Universal
 * 
 * Middleware especializado para upload de arquivos CNAB nos endpoints universais.
 * Suporta validação de tamanho, tipo e conteúdo.
 */

import multer from 'multer';
import path from 'path';

/**
 * Configurações padrão do upload
 */
const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_EXTENSIONS: ['.txt', '.cnab', '.ret', '.rem'],
  ALLOWED_MIME_TYPES: [
    'text/plain',
    'application/octet-stream',
    'text/x-cnab',
    'application/x-cnab'
  ]
};

/**
 * Configuração do multer para upload em memória
 */
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
    files: 1 // Apenas um arquivo por vez
  },

  fileFilter: (req, file, cb) => {
    try {
      // Verificar extensão do arquivo
      const fileExtension = path.extname(file.originalname).toLowerCase();

      // Permitir arquivos sem extensão (comum em CNAB)
      if (fileExtension === '' || UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error(`Extensão de arquivo não permitida: ${fileExtension}. Permitidas: ${UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`));
      }
    } catch (error) {
      cb(error);
    }
  }
});

/**
 * Middleware principal de upload (obrigatório)
 */
export const requiredUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        operation: 'upload',
        timestamp: new Date().toISOString(),
        error: {
          message: err.message,
          code: err.code || 'UPLOAD_ERROR',
          type: 'UploadError'
        }
      });
    }

    // Verificar se arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({
        success: false,
        operation: 'upload',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Arquivo é obrigatório',
          code: 'FILE_REQUIRED',
          type: 'ValidationError'
        }
      });
    }

    // Validação adicional do conteúdo
    try {
      const content = req.file.buffer.toString('utf8');

      // Verificar se o conteúdo parece ser CNAB
      if (content.length === 0) {
        return res.status(400).json({
          success: false,
          operation: 'upload',
          timestamp: new Date().toISOString(),
          error: {
            message: 'Arquivo está vazio',
            code: 'EMPTY_FILE',
            type: 'ValidationError'
          }
        });
      }

      // Verificar se tem quebras de linha (indicativo de arquivo CNAB)
      const lines = content.trim().split('\n');
      if (lines.length < 1) {
        return res.status(400).json({
          success: false,
          operation: 'upload',
          timestamp: new Date().toISOString(),
          error: {
            message: 'Arquivo não contém linhas válidas',
            code: 'INVALID_FORMAT',
            type: 'ValidationError'
          }
        });
      }

      // Verificar tamanho das linhas (CNAB240 = 240, CNAB400 = 400)
      const firstLineLength = lines[0].length;
      if (firstLineLength !== 240 && firstLineLength !== 400) {
        return res.status(400).json({
          success: false,
          operation: 'upload',
          timestamp: new Date().toISOString(),
          error: {
            message: `Tamanho de linha inválido: ${firstLineLength}. Esperado: 240 (CNAB240) ou 400 (CNAB400)`,
            code: 'INVALID_LINE_LENGTH',
            type: 'ValidationError',
            details: {
              lineLength: firstLineLength,
              expected: [240, 400]
            }
          }
        });
      }

      // Adicionar informações do arquivo ao request
      req.fileInfo = {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        encoding: 'utf8',
        lines: lines.length,
        lineLength: firstLineLength,
        estimatedFormat: firstLineLength === 240 ? 'CNAB240' : 'CNAB400'
      };

      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        operation: 'upload',
        timestamp: new Date().toISOString(),
        error: {
          message: `Erro ao processar arquivo: ${error.message}`,
          code: 'FILE_PROCESSING_ERROR',
          type: 'ProcessingError'
        }
      });
    }
  });
};

/**
 * Middleware de upload opcional (permite JSON como alternativa)
 */
export const optionalUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        operation: 'upload',
        timestamp: new Date().toISOString(),
        error: {
          message: err.message,
          code: err.code || 'UPLOAD_ERROR',
          type: 'UploadError'
        }
      });
    }

    // Se não tem arquivo, verificar se tem conteúdo no body
    if (!req.file) {
      // Verificar se tem conteúdo no JSON
      if (!req.body.content && !req.body.data) {
        return res.status(400).json({
          success: false,
          operation: 'upload',
          timestamp: new Date().toISOString(),
          error: {
            message: 'Arquivo ou conteúdo CNAB é obrigatório. Use upload de arquivo ou campos "content"/"data" no JSON.',
            code: 'FILE_OR_CONTENT_REQUIRED',
            type: 'ValidationError'
          }
        });
      }

      // Validar conteúdo do JSON
      const content = req.body.content || req.body.data;
      const lines = content.trim().split('\n');
      const firstLineLength = lines[0]?.length || 0;

      if (firstLineLength !== 240 && firstLineLength !== 400) {
        return res.status(400).json({
          success: false,
          operation: 'upload',
          timestamp: new Date().toISOString(),
          error: {
            message: `Tamanho de linha inválido no conteúdo: ${firstLineLength}. Esperado: 240 (CNAB240) ou 400 (CNAB400)`,
            code: 'INVALID_CONTENT_LINE_LENGTH',
            type: 'ValidationError'
          }
        });
      }

      req.contentInfo = {
        source: 'json',
        lines: lines.length,
        lineLength: firstLineLength,
        estimatedFormat: firstLineLength === 240 ? 'CNAB240' : 'CNAB400'
      };
    } else {
      // Processar arquivo se fornecido
      try {
        const content = req.file.buffer.toString('utf8');
        const lines = content.trim().split('\n');
        const firstLineLength = lines[0]?.length || 0;

        req.fileInfo = {
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          encoding: 'utf8',
          lines: lines.length,
          lineLength: firstLineLength,
          estimatedFormat: firstLineLength === 240 ? 'CNAB240' : 'CNAB400'
        };
      } catch (error) {
        return res.status(400).json({
          success: false,
          operation: 'upload',
          timestamp: new Date().toISOString(),
          error: {
            message: `Erro ao processar arquivo: ${error.message}`,
            code: 'FILE_PROCESSING_ERROR',
            type: 'ProcessingError'
          }
        });
      }
    }

    next();
  });
};

/**
 * Middleware de validação de formato específico
 */
export const formatValidationMiddleware = (allowedFormats = ['CNAB240', 'CNAB400']) => {
  return (req, res, next) => {
    const estimatedFormat = req.fileInfo?.estimatedFormat || req.contentInfo?.estimatedFormat;

    if (!estimatedFormat) {
      return res.status(400).json({
        success: false,
        operation: 'format-validation',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Não foi possível determinar o formato do arquivo',
          code: 'UNKNOWN_FORMAT',
          type: 'ValidationError'
        }
      });
    }

    if (!allowedFormats.includes(estimatedFormat)) {
      return res.status(400).json({
        success: false,
        operation: 'format-validation',
        timestamp: new Date().toISOString(),
        error: {
          message: `Formato ${estimatedFormat} não é permitido neste endpoint. Formatos permitidos: ${allowedFormats.join(', ')}`,
          code: 'FORMAT_NOT_ALLOWED',
          type: 'ValidationError',
          details: {
            detected: estimatedFormat,
            allowed: allowedFormats
          }
        }
      });
    }

    next();
  };
};

/**
 * Middleware de operationId para rastreamento
 */
export const operationIdMiddleware = (req, res, next) => {
  req.operationId = req.headers['x-operation-id'] || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  next();
};

// Exportações principais
export default optionalUploadMiddleware; 