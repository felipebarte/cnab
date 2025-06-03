import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { setTimeout } from 'node:timers';

/**
 * Serviço base para integração com APIs externas
 * Fornece funcionalidades comuns como retry logic, circuit breaker, logging, etc.
 */
class ExternalAPIService {
  constructor(options = {}) {
    this.name = options.name || 'ExternalAPI';
    this.baseURL = options.baseURL;
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.circuitBreaker = options.circuitBreaker || false;

    // Circuit breaker state
    this.circuitState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout_interval = options.circuitTimeout || 60000;
    this.lastFailureTime = null;

    // Configurar axios instance
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `CNABProcessor/${process.env.npm_package_version || '1.0.0'}`
      }
    });

    // Interceptors para logging e tratamento de erros
    this.setupInterceptors();
  }

  /**
   * Configurar interceptors do axios para logging automático
   */
  setupInterceptors() {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        const requestId = uuidv4();
        config.metadata = { startTime: Date.now(), requestId };

        this.log('debug', `[${requestId}] ${config.method?.toUpperCase()} ${config.url}`, {
          headers: this.sanitizeHeaders(config.headers),
          data: this.sanitizeData(config.data)
        });

        return config;
      },
      (error) => {
        this.log('error', 'Request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        const { config } = response;
        const duration = Date.now() - config.metadata.startTime;

        this.log('debug', `[${config.metadata.requestId}] Response ${response.status} (${duration}ms)`, {
          status: response.status,
          duration
        });

        // Reset circuit breaker on success
        if (this.circuitBreaker) {
          this.resetCircuitBreaker();
        }

        return response;
      },
      (error) => {
        const { config } = error;
        const duration = config?.metadata ? Date.now() - config.metadata.startTime : 0;

        this.log('error', `[${config?.metadata?.requestId || 'unknown'}] Error ${error.response?.status || 'NETWORK'} (${duration}ms)`, {
          status: error.response?.status,
          message: error.message,
          duration
        });

        // Handle circuit breaker
        if (this.circuitBreaker) {
          this.recordFailure();
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Realizar requisição HTTP com retry logic e circuit breaker
   */
  async makeRequest(config, retryCount = 0) {
    // Check circuit breaker
    if (this.circuitBreaker && !this.canMakeRequest()) {
      throw new Error(`Circuit breaker is OPEN for ${this.name}. Service temporarily unavailable.`);
    }

    try {
      const response = await this.httpClient(config);
      return response;
    } catch (error) {
      // Determine if should retry
      if (this.shouldRetry(error, retryCount)) {
        const delay = this.calculateRetryDelay(retryCount);
        this.log('warn', `Retrying request in ${delay}ms (attempt ${retryCount + 1}/${this.retryAttempts})`, {
          error: error.message,
          status: error.response?.status
        });

        await this.sleep(delay);
        return this.makeRequest(config, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Verificar se deve tentar novamente a requisição
   */
  shouldRetry(error, retryCount) {
    if (retryCount >= this.retryAttempts) {
      return false;
    }

    // Retry on network errors
    if (!error.response) {
      return true;
    }

    // Retry on specific HTTP status codes
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.response.status);
  }

  /**
   * Calcular delay para retry com exponential backoff
   */
  calculateRetryDelay(retryCount) {
    return this.retryDelay * Math.pow(2, retryCount);
  }

  /**
   * Verificar se pode fazer requisição (circuit breaker)
   */
  canMakeRequest() {
    if (this.circuitState === 'CLOSED') {
      return true;
    }

    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout_interval) {
        this.circuitState = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  /**
   * Registrar falha no circuit breaker
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.circuitState = 'OPEN';
      this.log('warn', `Circuit breaker opened for ${this.name}`, {
        failureCount: this.failureCount,
        threshold: this.failureThreshold
      });
    }
  }

  /**
   * Resetar circuit breaker
   */
  resetCircuitBreaker() {
    if (this.failureCount > 0 || this.circuitState !== 'CLOSED') {
      this.log('info', `Circuit breaker reset for ${this.name}`);
      this.failureCount = 0;
      this.circuitState = 'CLOSED';
      this.lastFailureTime = null;
    }
  }

  /**
   * Limpar headers sensíveis para logs
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'password'];

    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Limpar dados sensíveis para logs
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = JSON.parse(JSON.stringify(data));
    const sensitiveKeys = ['password', 'client_secret', 'access_token', 'refresh_token'];

    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Método de logging (pode ser sobrescrito por subclasses)
   */
  log(level, message, metadata = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      service: this.name,
      level,
      message,
      ...metadata
    };

    console.log(JSON.stringify(logData));
  }

  /**
   * Helper para sleep
   */
  async sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obter status do circuit breaker
   */
  getCircuitBreakerStatus() {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Realizar health check da API externa
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: '/health',
        timeout: 5000
      });

      return {
        status: 'healthy',
        response_time: response.duration,
        circuit_breaker: this.getCircuitBreakerStatus()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        circuit_breaker: this.getCircuitBreakerStatus()
      };
    }
  }
}

export default ExternalAPIService; 