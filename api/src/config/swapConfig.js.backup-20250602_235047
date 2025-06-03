import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Configurações da API Swap Financial
 */
const swapConfig = {
  // Ambiente (staging ou production)
  environment: process.env.SWAP_ENVIRONMENT || 'staging',

  // Credenciais de autenticação
  credentials: {
    clientId: process.env.SWAP_CLIENT_ID,
    clientSecret: process.env.SWAP_CLIENT_SECRET,
    apiKey: process.env.SWAP_API_KEY
  },

  // Configurações de timeout e retry
  api: {
    timeout: parseInt(process.env.SWAP_API_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.SWAP_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.SWAP_RETRY_DELAY) || 1000
  },

  // Configurações do circuit breaker
  circuitBreaker: {
    enabled: process.env.SWAP_CIRCUIT_BREAKER_ENABLED !== 'false',
    failureThreshold: parseInt(process.env.SWAP_FAILURE_THRESHOLD) || 5,
    timeout: parseInt(process.env.SWAP_CIRCUIT_TIMEOUT) || 60000
  },

  // URLs por ambiente
  urls: {
    staging: 'https://api-stag.contaswap.io',
    production: 'https://api-prod.contaswap.io'
  },

  // Configurações de cache de token
  tokenCache: {
    // Margem de segurança para renovação de token (em segundos)
    renewalMargin: parseInt(process.env.SWAP_TOKEN_RENEWAL_MARGIN) || 60
  }
};

/**
 * Validar configurações obrigatórias
 */
export function validateSwapConfig() {
  const errors = [];

  if (!swapConfig.credentials.clientId) {
    errors.push('SWAP_CLIENT_ID is required');
  }

  if (!swapConfig.credentials.clientSecret) {
    errors.push('SWAP_CLIENT_SECRET is required');
  }

  if (!swapConfig.credentials.apiKey) {
    errors.push('SWAP_API_KEY is required');
  }

  if (!['staging', 'production'].includes(swapConfig.environment)) {
    errors.push('SWAP_ENVIRONMENT must be either "staging" or "production"');
  }

  if (errors.length > 0) {
    throw new Error(`Swap Financial configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Obter configuração para o SwapFinancialService
 */
export function getSwapServiceConfig() {
  validateSwapConfig();

  return {
    environment: swapConfig.environment,
    baseURL: swapConfig.urls[swapConfig.environment],
    clientId: swapConfig.credentials.clientId,
    clientSecret: swapConfig.credentials.clientSecret,
    apiKey: swapConfig.credentials.apiKey,
    timeout: swapConfig.api.timeout,
    retryAttempts: swapConfig.api.retryAttempts,
    retryDelay: swapConfig.api.retryDelay,
    circuitBreaker: swapConfig.circuitBreaker.enabled,
    failureThreshold: swapConfig.circuitBreaker.failureThreshold,
    circuitTimeout: swapConfig.circuitBreaker.timeout
  };
}

/**
 * Obter informações de configuração (sem dados sensíveis) para logs/debug
 */
export function getSwapConfigInfo() {
  return {
    environment: swapConfig.environment,
    baseURL: swapConfig.urls[swapConfig.environment],
    hasClientId: !!swapConfig.credentials.clientId,
    hasClientSecret: !!swapConfig.credentials.clientSecret,
    hasApiKey: !!swapConfig.credentials.apiKey,
    api: swapConfig.api,
    circuitBreaker: swapConfig.circuitBreaker,
    tokenCache: swapConfig.tokenCache
  };
}

export default swapConfig; 