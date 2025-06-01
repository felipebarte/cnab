/**
 * Sistema de Logging avançado para API CNAB
 * Suporta diferentes níveis de log, formatação estruturada e rastreamento de operações
 */
class Logger {
  /**
   * Níveis de log disponíveis
   */
  static LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  /**
   * Configuração do logger baseada em variáveis de ambiente
   */
  static config = {
    level: this.getLevelFromEnv(process.env.LOG_LEVEL || 'info'),
    includeTimestamp: true,
    includeStack: process.env.NODE_ENV === 'development',
    colorize: process.env.NODE_ENV !== 'production',
  };

  /**
   * Cores para diferentes níveis de log (apenas desenvolvimento)
   */
  static colors = {
    ERROR: '\x1b[31m', // Vermelho
    WARN: '\x1b[33m',  // Amarelo
    INFO: '\x1b[36m',  // Ciano
    DEBUG: '\x1b[37m', // Branco
    RESET: '\x1b[0m',  // Reset
  };

  /**
   * Converte string de nível para número
   * @param {string} levelStr - Nível como string
   * @returns {number} Nível numérico
   */
  static getLevelFromEnv(levelStr) {
    const normalizedLevel = levelStr.toUpperCase();
    return this.LEVELS[normalizedLevel] !== undefined ? this.LEVELS[normalizedLevel] : this.LEVELS.INFO;
  }

  /**
   * Verifica se deve logar baseado no nível configurado
   * @param {string} level - Nível do log
   * @returns {boolean} Se deve logar
   */
  static shouldLog(level) {
    return this.LEVELS[level] <= this.config.level;
  }

  /**
   * Formata mensagem de log com metadados
   * @param {string} level - Nível do log
   * @param {string} message - Mensagem principal
   * @param {Object} metadata - Metadados adicionais
   * @returns {string} Mensagem formatada
   */
  static formatMessage(level, message, metadata = {}) {
    const timestamp = this.config.includeTimestamp ? new Date().toISOString() : null;
    const color = this.config.colorize ? this.colors[level] : '';
    const reset = this.config.colorize ? this.colors.RESET : '';

    let formatted = '';

    if (timestamp) {
      formatted += `[${timestamp}] `;
    }

    formatted += `${color}${level}${reset}: ${message}`;

    // Adiciona metadados se existirem
    if (Object.keys(metadata).length > 0) {
      formatted += ` | ${JSON.stringify(metadata)}`;
    }

    return formatted;
  }

  /**
   * Log de erro
   * @param {string} message - Mensagem de erro
   * @param {Error|Object} error - Objeto de erro ou metadados
   * @param {Object} metadata - Metadados adicionais
   */
  static error(message, error = null, metadata = {}) {
    if (!this.shouldLog('ERROR')) return;

    const errorMetadata = { ...metadata };

    if (error instanceof Error) {
      errorMetadata.error = {
        name: error.name,
        message: error.message,
        stack: this.config.includeStack ? error.stack : undefined,
      };
    } else if (error && typeof error === 'object') {
      errorMetadata.error = error;
    }

    console.error(this.formatMessage('ERROR', message, errorMetadata));
  }

  /**
   * Log de aviso
   * @param {string} message - Mensagem de aviso
   * @param {Object} metadata - Metadados
   */
  static warn(message, metadata = {}) {
    if (!this.shouldLog('WARN')) return;
    console.warn(this.formatMessage('WARN', message, metadata));
  }

  /**
   * Log informativo
   * @param {string} message - Mensagem informativa
   * @param {Object} metadata - Metadados
   */
  static info(message, metadata = {}) {
    if (!this.shouldLog('INFO')) return;
    console.log(this.formatMessage('INFO', message, metadata));
  }

  /**
   * Log de debug
   * @param {string} message - Mensagem de debug
   * @param {Object} metadata - Metadados
   */
  static debug(message, metadata = {}) {
    if (!this.shouldLog('DEBUG')) return;
    console.log(this.formatMessage('DEBUG', message, metadata));
  }

  /**
   * Cria logger específico para operações de webhook
   * @param {string} operationId - ID único da operação
   * @param {string} webhookUrl - URL do webhook
   * @returns {Object} Logger especializado
   */
  static createWebhookLogger(operationId, webhookUrl) {
    const baseMetadata = {
      operationId,
      webhookUrl: webhookUrl ? webhookUrl.substring(0, 50) + '...' : 'N/A',
      component: 'webhook',
    };

    return {
      /**
       * Log de início de operação webhook
       * @param {Object} metadata - Metadados da operação
       */
      start: (metadata = {}) => {
        this.info('🚀 Iniciando envio para webhook', { ...baseMetadata, ...metadata });
      },

      /**
       * Log de tentativa de envio
       * @param {number} attempt - Número da tentativa
       * @param {number} maxAttempts - Máximo de tentativas
       * @param {Object} metadata - Metadados
       */
      attempt: (attempt, maxAttempts, metadata = {}) => {
        this.info(`🔄 Tentativa ${attempt}/${maxAttempts}`, {
          ...baseMetadata,
          attempt,
          maxAttempts,
          ...metadata
        });
      },

      /**
       * Log de sucesso
       * @param {Object} response - Resposta do webhook
       * @param {Object} metadata - Metadados
       */
      success: (response, metadata = {}) => {
        this.info('✅ Webhook enviado com sucesso', {
          ...baseMetadata,
          response: {
            status: response.status,
            statusText: response.statusText,
            responseTime: metadata.responseTime,
          },
          ...metadata,
        });
      },

      /**
       * Log de falha em tentativa
       * @param {number} attempt - Número da tentativa
       * @param {Error} error - Erro ocorrido
       * @param {Object} metadata - Metadados
       */
      attemptFailed: (attempt, error, metadata = {}) => {
        this.warn(`❌ Tentativa ${attempt} falhou`, {
          ...baseMetadata,
          attempt,
          error: {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
          },
          ...metadata,
        });
      },

      /**
       * Log de falha total
       * @param {Error} error - Erro final
       * @param {number} totalAttempts - Total de tentativas feitas
       * @param {Object} metadata - Metadados
       */
      failed: (error, totalAttempts, metadata = {}) => {
        this.error('💥 Falha total no envio do webhook', error, {
          ...baseMetadata,
          totalAttempts,
          ...metadata,
        });
      },

      /**
       * Log de delay entre tentativas
       * @param {number} delay - Tempo de delay em ms
       * @param {number} nextAttempt - Próxima tentativa
       */
      delay: (delay, nextAttempt) => {
        this.debug(`⏳ Aguardando ${delay}ms antes da tentativa ${nextAttempt}`, {
          ...baseMetadata,
          delay,
          nextAttempt,
        });
      },

      /**
       * Log de timeout
       * @param {number} timeout - Tempo de timeout
       */
      timeout: (timeout) => {
        this.warn('⏰ Timeout na requisição do webhook', {
          ...baseMetadata,
          timeout,
        });
      },
    };
  }

  /**
   * Cria logger específico para operações CNAB
   * @param {string} operationId - ID único da operação
   * @param {string} operation - Tipo de operação (upload, text, webhook)
   * @returns {Object} Logger especializado
   */
  static createCnabLogger(operationId, operation) {
    const baseMetadata = {
      operationId,
      operation,
      component: 'cnab',
    };

    return {
      /**
       * Log de início de processamento CNAB
       * @param {Object} metadata - Metadados
       */
      start: (metadata = {}) => {
        this.info('📄 Iniciando processamento CNAB', { ...baseMetadata, ...metadata });
      },

      /**
       * Log de validação
       * @param {boolean} isValid - Se é válido
       * @param {Object} validation - Resultado da validação
       */
      validation: (isValid, validation = {}) => {
        if (isValid) {
          this.info('✅ CNAB validado com sucesso', { ...baseMetadata, validation });
        } else {
          this.warn('⚠️ CNAB com problemas de validação', { ...baseMetadata, validation });
        }
      },

      /**
       * Log de processamento concluído
       * @param {Object} result - Resultado do processamento
       */
      processed: (result) => {
        this.info('✅ CNAB processado com sucesso', {
          ...baseMetadata,
          totalRegistros: result.totalRegistros,
          totalValor: result.resumo?.totalValor,
          dataProcessamento: result.dataProcessamento,
        });
      },

      /**
       * Log de webhook
       * @param {string} url - URL do webhook
       * @param {Object} result - Resultado do envio
       */
      webhook: (url, result) => {
        if (result.sucesso) {
          this.info('🔔 Webhook enviado com sucesso', {
            ...baseMetadata,
            webhookUrl: url.substring(0, 50) + '...',
            status: result.status
          });
        } else {
          this.warn('⚠️ Falha no webhook', {
            ...baseMetadata,
            webhookUrl: url.substring(0, 50) + '...',
            error: result.erro
          });
        }
      },

      /**
       * Log informativo genérico
       * @param {string} message - Mensagem
       * @param {Object} metadata - Metadados adicionais
       */
      info: (message, metadata = {}) => {
        this.info(message, { ...baseMetadata, ...metadata });
      },

      /**
       * Log de aviso genérico
       * @param {string} message - Mensagem
       * @param {Object} metadata - Metadados adicionais
       */
      warn: (message, metadata = {}) => {
        this.warn(message, { ...baseMetadata, ...metadata });
      },

      /**
       * Log de erro genérico
       * @param {Error|string} error - Erro ou mensagem
       * @param {string} stage - Estágio onde ocorreu o erro
       * @param {Object} metadata - Metadados adicionais
       */
      error: (error, stage = 'unknown', metadata = {}) => {
        if (typeof error === 'string') {
          this.error(`❌ ${error} (${stage})`, null, { ...baseMetadata, stage, ...metadata });
        } else {
          this.error(`❌ Erro no processamento CNAB (${stage})`, error, { ...baseMetadata, stage, ...metadata });
        }
      },

      /**
       * Log de debug genérico
       * @param {string} message - Mensagem
       * @param {Object} metadata - Metadados adicionais
       */
      debug: (message, metadata = {}) => {
        this.debug(message, { ...baseMetadata, ...metadata });
      },
    };
  }

  /**
   * Gera ID único para operação
   * @returns {string} ID único
   */
  static generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calcula tempo de resposta
   * @param {number} startTime - Timestamp de início
   * @returns {number} Tempo em millisegundos
   */
  static calculateResponseTime(startTime) {
    return Date.now() - startTime;
  }

  /**
   * Sanitiza dados sensíveis para log
   * @param {Object} data - Dados a serem sanitizados
   * @returns {Object} Dados sanitizados
   */
  static sanitizeForLog(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'authorization', 'apikey', 'secret'];

    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        } else if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***REDACTED***';
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }
}

export default Logger; 