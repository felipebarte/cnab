import Logger from './logger.js';

/**
 * Sistema de tratamento de erros robusto para API CNAB
 * Classifica erros, padroniza códigos e estrutura respostas
 */
class ErrorHandler {
  /**
   * Tipos de erro da aplicação
   */
  static ERROR_TYPES = {
    VALIDATION: 'VALIDATION_ERROR',
    WEBHOOK: 'WEBHOOK_ERROR',
    CNAB_PROCESSING: 'CNAB_PROCESSING_ERROR',
    FILE_UPLOAD: 'FILE_UPLOAD_ERROR',
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    CONFIGURATION: 'CONFIGURATION_ERROR',
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    INTERNAL: 'INTERNAL_SERVER_ERROR',
  };

  /**
   * Códigos de erro HTTP específicos
   */
  static HTTP_STATUS = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    CONFLICT: 409,
    PAYLOAD_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  };

  /**
   * Mapeamento de códigos de erro específicos
   */
  static ERROR_CODES = {
    // Validação
    CONTEUDO_OBRIGATORIO: { status: 400, type: 'VALIDATION_ERROR' },
    ARQUIVO_OBRIGATORIO: { status: 400, type: 'FILE_UPLOAD_ERROR' },
    WEBHOOK_URL_OBRIGATORIA: { status: 400, type: 'VALIDATION_ERROR' },
    FORMATO_INVALIDO: { status: 400, type: 'VALIDATION_ERROR' },
    BANCO_OBRIGATORIO: { status: 400, type: 'VALIDATION_ERROR' },
    BANCO_NAO_SUPORTADO: { status: 400, type: 'VALIDATION_ERROR' },

    // CNAB
    CNAB_INVALIDO: { status: 400, type: 'CNAB_PROCESSING_ERROR' },
    CNAB_VAZIO: { status: 400, type: 'CNAB_PROCESSING_ERROR' },
    ERRO_PROCESSAMENTO: { status: 500, type: 'CNAB_PROCESSING_ERROR' },
    ERRO_EXTRACAO: { status: 500, type: 'CNAB_PROCESSING_ERROR' },
    ERRO_VALIDACAO: { status: 500, type: 'CNAB_PROCESSING_ERROR' },

    // Webhook
    WEBHOOK_DESABILITADO: { status: 200, type: 'WEBHOOK_ERROR' },
    ERRO_WEBHOOK: { status: 500, type: 'WEBHOOK_ERROR' },
    WEBHOOK_TIMEOUT: { status: 504, type: 'TIMEOUT_ERROR' },
    WEBHOOK_NETWORK_ERROR: { status: 502, type: 'NETWORK_ERROR' },
    WEBHOOK_AUTH_ERROR: { status: 401, type: 'AUTHENTICATION_ERROR' },

    // Upload
    ARQUIVO_MUITO_GRANDE: { status: 413, type: 'FILE_UPLOAD_ERROR' },
    TIPO_ARQUIVO_INVALIDO: { status: 400, type: 'FILE_UPLOAD_ERROR' },
    ERRO_UPLOAD: { status: 500, type: 'FILE_UPLOAD_ERROR' },

    // Configuração
    CONFIGURACAO_INVALIDA: { status: 500, type: 'CONFIGURATION_ERROR' },

    // Rate Limiting
    MUITAS_REQUISICOES: { status: 429, type: 'RATE_LIMIT_ERROR' },

    // Interno
    ERRO_INTERNO: { status: 500, type: 'INTERNAL_SERVER_ERROR' },
  };

  /**
   * Cria um erro estruturado
   * @param {string} code - Código do erro
   * @param {string} message - Mensagem de erro
   * @param {Object} details - Detalhes adicionais
   * @param {Error} originalError - Erro original (se houver)
   * @returns {Object} Erro estruturado
   */
  static createError(code, message, details = {}, originalError = null) {
    const errorConfig = this.ERROR_CODES[code] || {
      status: 500,
      type: this.ERROR_TYPES.INTERNAL
    };

    const error = {
      codigo: code,
      tipo: errorConfig.type,
      mensagem: message,
      status: errorConfig.status,
      detalhes: details,
      timestamp: new Date().toISOString(),
    };

    if (originalError) {
      error.erroOriginal = {
        name: originalError.name,
        message: originalError.message,
        stack: process.env.NODE_ENV === 'development' ? originalError.stack : undefined,
      };
    }

    return error;
  }

  /**
   * Cria resposta de erro estruturada para webhook
   * @param {string} code - Código do erro
   * @param {string} message - Mensagem de erro
   * @param {Object} webhookInfo - Informações do webhook
   * @param {Object} cnabInfo - Informações do CNAB processado
   * @returns {Object} Resposta estruturada
   */
  static createWebhookErrorResponse(code, message, webhookInfo = {}, cnabInfo = {}) {
    const error = this.createError(code, message);

    return {
      sucesso: false,
      erro: message,
      codigo: code,
      tipo: error.tipo,
      webhook: {
        enviado: false,
        url: webhookInfo.url || null,
        tentativas: webhookInfo.tentativas || 0,
        ultimaResposta: webhookInfo.ultimaResposta || null,
        tempoTotalGasto: webhookInfo.tempoTotalGasto || 0,
        detalhesErro: webhookInfo.detalhesErro || null,
      },
      cnab: {
        processado: cnabInfo.processado || false,
        totalRegistros: cnabInfo.totalRegistros || 0,
        dataProcessamento: cnabInfo.dataProcessamento || null,
        validacao: cnabInfo.validacao || null,
      },
      timestamp: error.timestamp,
      detalhes: {
        podeReitentar: this.isRetryableError(code),
        sugestoes: this.getErrorSuggestions(code),
      },
    };
  }

  /**
   * Verifica se o erro permite nova tentativa
   * @param {string} code - Código do erro
   * @returns {boolean} Se pode reinitentar
   */
  static isRetryableError(code) {
    const retryableErrors = [
      'WEBHOOK_TIMEOUT',
      'WEBHOOK_NETWORK_ERROR',
      'ERRO_WEBHOOK',
    ];
    return retryableErrors.includes(code);
  }

  /**
   * Fornece sugestões para resolver o erro
   * @param {string} code - Código do erro
   * @returns {Array<string>} Sugestões
   */
  static getErrorSuggestions(code) {
    const suggestions = {
      WEBHOOK_URL_OBRIGATORIA: [
        'Configure WEBHOOK_URL nas variáveis de ambiente',
        'Ou forneça webhookUrl no body da requisição',
      ],
      WEBHOOK_TIMEOUT: [
        'Aumente WEBHOOK_TIMEOUT nas variáveis de ambiente',
        'Verifique se o endpoint está respondendo',
        'Teste o endpoint manualmente',
      ],
      WEBHOOK_NETWORK_ERROR: [
        'Verifique conectividade com o endpoint',
        'Confirme se a URL está correta',
        'Verifique se o serviço está disponível',
      ],
      CNAB_INVALIDO: [
        'Verifique se o arquivo é CNAB 400 válido',
        'Confirme se não há caracteres especiais',
        'Use um arquivo de exemplo válido',
      ],
      ARQUIVO_MUITO_GRANDE: [
        'Reduza o tamanho do arquivo',
        'Processe o arquivo em partes menores',
      ],
      CONFIGURACAO_INVALIDA: [
        'Revise as variáveis de ambiente',
        'Use o arquivo .env.example como referência',
      ],
    };

    return suggestions[code] || [
      'Verifique os logs para mais informações',
      'Consulte a documentação da API',
    ];
  }

  /**
   * Classifica erro do axios/webhook
   * @param {Error} error - Erro do axios
   * @returns {Object} Erro classificado
   */
  static classifyWebhookError(error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return this.createError(
        'WEBHOOK_TIMEOUT',
        'Timeout na conexão com o webhook',
        { timeout: error.config?.timeout },
        error
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return this.createError(
        'WEBHOOK_NETWORK_ERROR',
        'Erro de rede ao conectar com o webhook',
        { url: error.config?.url, code: error.code },
        error
      );
    }

    const status = error.response?.status;

    if (status === 401) {
      return this.createError(
        'WEBHOOK_AUTH_ERROR',
        'Erro de autenticação no webhook',
        { status, response: error.response?.data },
        error
      );
    }

    if (status >= 500) {
      return this.createError(
        'ERRO_WEBHOOK',
        `Erro interno do webhook (${status})`,
        { status, response: error.response?.data },
        error
      );
    }

    if (status >= 400) {
      return this.createError(
        'ERRO_WEBHOOK',
        `Erro no webhook (${status}): ${error.response?.statusText || 'Bad Request'}`,
        { status, response: error.response?.data },
        error
      );
    }

    return this.createError(
      'ERRO_WEBHOOK',
      'Erro desconhecido no webhook',
      { message: error.message },
      error
    );
  }

  /**
   * Middleware para tratamento global de erros
   * @param {Error} error - Erro capturado
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next function
   */
  static globalErrorHandler(error, req, res, next) {
    const operationId = req.operationId || Logger.generateOperationId();

    // Log do erro
    Logger.error('Erro não tratado capturado', error, {
      operationId,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Se resposta já foi enviada, delega para o Express
    if (res.headersSent) {
      return next(error);
    }

    // Determina tipo de erro e resposta
    let errorResponse;

    if (error.code && this.ERROR_CODES[error.code]) {
      // Erro conhecido da aplicação
      const errorConfig = this.ERROR_CODES[error.code];
      errorResponse = {
        sucesso: false,
        erro: error.message,
        codigo: error.code,
        tipo: errorConfig.type,
        operationId,
        timestamp: new Date().toISOString(),
      };
      res.status(errorConfig.status);
    } else {
      // Erro desconhecido
      errorResponse = {
        sucesso: false,
        erro: 'Erro interno do servidor',
        codigo: 'ERRO_INTERNO',
        tipo: this.ERROR_TYPES.INTERNAL,
        operationId,
        timestamp: new Date().toISOString(),
      };
      res.status(500);
    }

    res.json(errorResponse);
  }

  /**
   * Wrapper para funções async com tratamento de erro
   * @param {Function} fn - Função async
   * @returns {Function} Função wrapped
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      // Adiciona operationId à requisição
      req.operationId = Logger.generateOperationId();

      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Valida se webhook está configurado corretamente
   * @param {string} webhookUrl - URL do webhook
   * @returns {Object} Resultado da validação
   */
  static validateWebhookConfig(webhookUrl) {
    if (!webhookUrl) {
      return {
        valido: false,
        erro: this.createError(
          'WEBHOOK_URL_OBRIGATORIA',
          'URL do webhook não configurada'
        ),
      };
    }

    try {
      new URL(webhookUrl);
    } catch (error) {
      return {
        valido: false,
        erro: this.createError(
          'WEBHOOK_URL_OBRIGATORIA',
          'URL do webhook inválida',
          { url: webhookUrl },
          error
        ),
      };
    }

    return { valido: true };
  }
}

export default ErrorHandler; 