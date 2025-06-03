/**
 * Middleware de tratamento global de erros para Express
 * Padroniza respostas de erro e implementa logging estruturado
 */

/**
 * Classificar tipo de erro baseado na mensagem e contexto
 * @param {Error} error - Erro a ser classificado
 * @returns {string} Tipo do erro
 */
function classifyError(error) {
  const message = error.message.toLowerCase();

  // Erros de autenticação
  if (message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('invalid token') ||
    error.status === 401) {
    return 'authentication';
  }

  // Erros de autorização
  if (message.includes('forbidden') ||
    message.includes('access denied') ||
    error.status === 403) {
    return 'authorization';
  }

  // Erros de validação
  if (message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    error.status === 400) {
    return 'validation';
  }

  // Erros de negócio (Swap Financial específicos)
  if (message.includes('business hours') ||
    message.includes('payment window') ||
    message.includes('already paid') ||
    error.status === 422) {
    return 'business_logic';
  }

  // Erros de conectividade/serviço
  if (message.includes('network') ||
    message.includes('timeout') ||
    message.includes('service unavailable') ||
    message.includes('circuit breaker') ||
    error.status === 503 ||
    error.status === 504) {
    return 'service_unavailable';
  }

  // Erros de recurso não encontrado
  if (message.includes('not found') ||
    error.status === 404) {
    return 'not_found';
  }

  // Erros de rate limiting
  if (message.includes('rate limit') ||
    message.includes('too many requests') ||
    error.status === 429) {
    return 'rate_limit';
  }

  // Erros de servidor interno
  if (error.status === 500 ||
    message.includes('internal server error')) {
    return 'internal_server';
  }

  return 'unknown';
}

/**
 * Obter severity baseado no tipo de erro
 * @param {string} errorType - Tipo do erro
 * @param {number} statusCode - Código de status HTTP
 * @returns {string} Nível de severity
 */
function getErrorSeverity(errorType, statusCode) {
  switch (errorType) {
    case 'authentication':
    case 'authorization':
      return 'warning';

    case 'validation':
    case 'not_found':
    case 'business_logic':
      return 'info';

    case 'rate_limit':
      return 'warning';

    case 'service_unavailable':
      return statusCode >= 500 ? 'error' : 'warning';

    case 'internal_server':
      return 'error';

    default:
      return statusCode >= 500 ? 'error' : 'warning';
  }
}

/**
 * Gerar mensagem user-friendly baseada no tipo de erro
 * @param {string} errorType - Tipo do erro
 * @param {Error} error - Erro original
 * @returns {string} Mensagem amigável
 */
function generateUserFriendlyMessage(errorType, error) {
  switch (errorType) {
    case 'authentication':
      return 'Credenciais inválidas ou token expirado. Faça login novamente.';

    case 'authorization':
      return 'Você não tem permissão para acessar este recurso.';

    case 'validation':
      return 'Dados fornecidos são inválidos. Verifique os campos obrigatórios.';

    case 'business_logic':
      if (error.message.includes('business hours')) {
        return 'Operação disponível apenas durante horário comercial (07:00-23:00).';
      }
      if (error.message.includes('already paid')) {
        return 'Este boleto já foi pago anteriormente.';
      }
      return 'Operação não permitida devido a regras de negócio.';

    case 'service_unavailable':
      return 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.';

    case 'not_found':
      return 'Recurso não encontrado.';

    case 'rate_limit':
      return 'Muitas requisições. Aguarde alguns segundos antes de tentar novamente.';

    case 'internal_server':
      return 'Erro interno do servidor. Nossa equipe foi notificada.';

    default:
      return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}

/**
 * Gerar ID único para rastreamento de erro
 * @returns {string} ID do erro
 */
function generateErrorId() {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${randomSuffix}`;
}

/**
 * Extrair informações relevantes da requisição
 * @param {Object} req - Objeto de requisição Express
 * @returns {Object} Informações da requisição
 */
function extractRequestInfo(req) {
  return {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    userAgent: req.get('user-agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || 'anonymous',
    sessionId: req.sessionID,
    contentType: req.get('content-type'),
    bodySize: req.get('content-length') || 0
  };
}

/**
 * Determinar se erro deve ser reportado como crítico
 * @param {string} errorType - Tipo do erro
 * @param {number} statusCode - Código de status
 * @returns {boolean} True se é crítico
 */
function isCriticalError(errorType, statusCode) {
  return errorType === 'internal_server' ||
    statusCode >= 500 ||
    errorType === 'service_unavailable';
}

/**
 * Log estruturado do erro
 * @param {Error} error - Erro a ser logado
 * @param {Object} req - Objeto de requisição
 * @param {Object} errorContext - Contexto adicional do erro
 */
function logError(error, req, errorContext) {
  const logData = {
    timestamp: new Date().toISOString(),
    service: 'ErrorHandler',
    level: errorContext.severity,
    errorId: errorContext.errorId,
    errorType: errorContext.errorType,
    message: error.message,
    stack: error.stack,
    statusCode: errorContext.statusCode,
    request: extractRequestInfo(req),
    isCritical: errorContext.isCritical,
    environment: process.env.NODE_ENV || 'development',

    // Contexto específico do erro
    ...(error.context || {}),

    // Metadados adicionais se disponíveis
    ...(error.metadata || {})
  };

  // Log baseado na severity
  if (errorContext.severity === 'error') {
    console.error(JSON.stringify(logData));
  } else if (errorContext.severity === 'warning') {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }

  // Se for erro crítico, também log como error para garantir visibilidade
  if (errorContext.isCritical && errorContext.severity !== 'error') {
    console.error(`[CRITICAL] ${JSON.stringify(logData)}`);
  }
}

/**
 * Enviar alerta para erro crítico (implementação placeholder)
 * @param {Object} errorContext - Contexto do erro
 * @param {Object} req - Objeto de requisição
 */
async function sendCriticalAlert(errorContext, req) {
  // TODO: Implementar integração com sistema de alertas (Slack, email, etc.)
  console.error(`[ALERT] Critical error detected: ${errorContext.errorId}`);

  // Placeholder para integração futura
  if (process.env.SLACK_WEBHOOK_URL) {
    // await sendSlackAlert(errorContext, req);
  }

  if (process.env.ALERT_EMAIL) {
    // await sendEmailAlert(errorContext, req);
  }
}

/**
 * Middleware principal de tratamento de erros
 * Deve ser registrado por último no Express app
 */
export const errorHandler = async (error, req, res, next) => {
  // Se resposta já foi enviada, delegar para o Express
  if (res.headersSent) {
    return next(error);
  }

  // Gerar contexto do erro
  const errorType = classifyError(error);
  const statusCode = error.status || error.statusCode || 500;
  const severity = getErrorSeverity(errorType, statusCode);
  const errorId = generateErrorId();
  const isCritical = isCriticalError(errorType, statusCode);
  const userMessage = generateUserFriendlyMessage(errorType, error);

  const errorContext = {
    errorId,
    errorType,
    severity,
    statusCode,
    isCritical,
    userMessage
  };

  // Log estruturado do erro
  logError(error, req, errorContext);

  // Enviar alerta se for crítico
  if (isCritical) {
    try {
      await sendCriticalAlert(errorContext, req);
    } catch (alertError) {
      console.error('Failed to send critical alert:', alertError.message);
    }
  }

  // Resposta JSON padronizada
  const errorResponse = {
    success: false,
    error: {
      id: errorId,
      type: errorType,
      message: userMessage,
      timestamp: new Date().toISOString()
    }
  };

  // Incluir detalhes técnicos apenas em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      originalMessage: error.message,
      stack: error.stack,
      statusCode
    };
  }

  // Enviar resposta
  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para tratar erros 404 (rota não encontrada)
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  next(error);
};

/**
 * Wrapper para async route handlers que automaticamente captura erros
 * @param {Function} fn - Função async do route handler
 * @returns {Function} Função wrapper que captura erros
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Criar erro customizado com contexto adicional
 * @param {string} message - Mensagem do erro
 * @param {number} statusCode - Código de status HTTP
 * @param {Object} context - Contexto adicional
 * @returns {Error} Erro customizado
 */
export const createError = (message, statusCode = 500, context = {}) => {
  const error = new Error(message);
  error.status = statusCode;
  error.context = context;
  return error;
};

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError
};
