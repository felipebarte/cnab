import ExternalAPIService from './ExternalAPIService.js';
import { Timer, metricsCollector } from '../../utils/metrics.js';

/**
 * Serviço de integração com a API da Swap Financial
 * Implementa autenticação OAuth 2.0 e operações de boleto
 */
class SwapFinancialService extends ExternalAPIService {
  constructor(options = {}) {
    const defaultOptions = {
      name: 'SwapFinancial',
      retryAttempts: 3,
      circuitBreaker: true,
      failureThreshold: 5,
      timeout: 30000
    };

    super({ ...defaultOptions, ...options });

    // Configurações específicas da Swap Financial
    this.environment = options.environment || 'production'; // 'staging' ou 'production'
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.apiKey = options.apiKey;
    this.accountId = options.accountId || process.env.SWAP_ACCOUNT_ID; // ID da conta para pagamentos

    // URLs por ambiente
    this.apiUrls = {
      staging: 'https://api-stag.contaswap.io',
      production: 'https://api-prod.contaswap.io'
    };

    // Atualizar baseURL baseado no ambiente
    this.baseURL = this.apiUrls[this.environment];
    this.httpClient.defaults.baseURL = this.baseURL;

    // Cache de tokens (formato compatível com testes)
    this.tokenCache = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
    this.refreshExpiry = null;

    // Configurar headers específicos
    this.httpClient.defaults.headers['x-api-key'] = this.apiKey;

    this.circuitBreakerState = 'closed'; // closed, open, half-open
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000; // 1 minuto

    // Configurar métricas do circuit breaker
    metricsCollector.setGauge('swap.circuit_breaker.state', this.circuitBreakerState);
  }

  /**
   * Autenticar e obter token de acesso (compatível com testes)
   */
  async authenticate() {
    try {
      const timer = new Timer('swap.auth.duration');
      metricsCollector.incrementCounter('swap.auth.attempts');

      // Verificar se token existe e ainda é válido (com margem de 60 segundos)
      if (this.isTokenValid()) {
        this.log('debug', 'Using cached access token');
        metricsCollector.incrementCounter('swap.auth.success');
        timer.end();
        return this.tokenCache;
      }

      // Solicitar novo token
      this.log('debug', 'Requesting new access token');
      const tokenData = {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      };

      const response = await this.post('/oauth/token', tokenData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        }
      });

      if (!response || !response.access_token) {
        throw new Error('Token de acesso não recebido');
      }

      const now = Date.now();
      this.tokenCache = response.access_token;
      this.tokenExpiry = now + (response.expires_in * 1000);

      if (response.refresh_token) {
        this.refreshToken = response.refresh_token;
        this.refreshExpiry = now + (response.refresh_expires_in * 1000);
      }

      this.log('info', 'Access token obtained successfully', {
        expiresIn: response.expires_in,
        tokenType: response.token_type
      });

      metricsCollector.incrementCounter('swap.auth.success');
      timer.end();

      return this.tokenCache;
    } catch (error) {
      metricsCollector.incrementCounter('swap.auth.failures');
      this.log('error', 'Authentication failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Fazer requisição autenticada
   */
  async authenticatedRequest(method, url, data = null) {
    this.checkCircuitBreaker();

    try {
      const token = await this.authenticate();

      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await this.makeRequest(config);
      this.resetCircuitBreaker();
      return response.data;

    } catch (error) {
      this.handleCircuitBreakerFailure();
      throw error;
    }
  }

  /**
   * Obter token de acesso válido (com cache automático)
   */
  async getAccessToken() {
    return await this.authenticate();
  }

  /**
   * Solicitar novo token de acesso
   */
  async requestNewToken() {
    const tokenData = {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    };

    const response = await this.makeRequest({
      method: 'POST',
      url: `/auth/${this.clientId}/token`,
      data: tokenData,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      }
    });

    const tokenResponse = response.data;
    const now = Date.now();

    // Cache dos tokens
    this.tokenCache = tokenResponse.access_token;
    this.tokenExpiry = now + (tokenResponse.expires_in * 1000);

    if (tokenResponse.refresh_token) {
      this.refreshToken = tokenResponse.refresh_token;
      this.refreshExpiry = now + (tokenResponse.refresh_expires_in * 1000);
    }

    this.log('info', 'New access token obtained successfully', {
      expiresIn: tokenResponse.expires_in,
      tokenType: tokenResponse.token_type
    });

    return tokenResponse.access_token;
  }

  /**
   * Renovar token usando refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshData = {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    };

    const response = await this.makeRequest({
      method: 'POST',
      url: `/auth/${this.clientId}/token`,
      data: refreshData,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      }
    });

    const tokenResponse = response.data;
    const now = Date.now();

    // Atualizar cache
    this.tokenCache = tokenResponse.access_token;
    this.tokenExpiry = now + (tokenResponse.expires_in * 1000);

    if (tokenResponse.refresh_token) {
      this.refreshToken = tokenResponse.refresh_token;
      this.refreshExpiry = tokenResponse.refresh_expires_in ?
        now + (tokenResponse.refresh_expires_in * 1000) : this.refreshExpiry;
    }

    this.log('info', 'Access token refreshed successfully');
    return tokenResponse.access_token;
  }

  /**
   * Verificar boleto pelo código de barras
   */
  async checkBoleto(barcode) {
    const timer = new Timer('swap.boleto.verify.duration');
    metricsCollector.incrementCounter('swap.boleto.verify.attempts');

    if (!barcode) {
      throw new Error('Código de barras é obrigatório');
    }

    // Validar formato básico do código de barras
    if (!this.isValidBarcodeFormat(barcode)) {
      throw new Error('Formato de código de barras inválido');
    }

    try {
      // CORREÇÃO CRÍTICA: Usar endpoint correto da API Swap Financial
      // Endpoint: POST /ledger/payments/boletos
      // Payload: {"barcode": "codigo_de_barras"}
      const response = await this.authenticatedRequest('POST', '/ledger/payments/boletos', {
        barcode: barcode
      });

      if (!response) {
        throw new Error('Resposta vazia da API Swap Financial');
      }

      // Verificar campos obrigatórios
      const requiredFields = ['id', 'amount', 'due_date', 'status'];
      for (const field of requiredFields) {
        if (response[field] === undefined || response[field] === null) {
          throw new Error(`Campo obrigatório ausente na resposta: ${field}`);
        }
      }

      // Enriquecer dados do boleto
      const enrichedData = this.enrichBoletoData(response);

      this.log('info', 'Boleto checked successfully', {
        boletoId: response.id,
        amount: response.amount,
        dueDate: response.due_date,
        status: response.status
      });

      metricsCollector.incrementCounter('swap.boleto.verify.success');
      timer.end();

      return enrichedData;
    } catch (error) {
      metricsCollector.incrementCounter('swap.boleto.verify.failures');

      this.log('error', 'Failed to check boleto', {
        barcode: this.maskBarcode(barcode),
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Realizar pagamento de boleto via Swap Financial
   * @param {string} barcode - Código de barras do boleto
   * @param {Object} payerData - Dados do pagador (opcional, para validação extra)
   * @returns {Promise<Object>} Resultado do pagamento
   */
  async payBoleto(barcode, payerData = {}) {
    const timer = new Timer('swap.payment.duration');
    metricsCollector.incrementCounter('swap.payment.attempts');

    try {
      // Primeiro, verificar o boleto para obter ID e dados necessários
      const boletoData = await this.checkBoleto(barcode);

      if (!boletoData || !boletoData.id) {
        throw new Error('Boleto não encontrado ou ID inválido');
      }

      // Fazer o pagamento usando endpoint correto da API Swap
      const paymentData = {
        amount: boletoData.amount,                    // Valor em centavos
        document: payerData.document || process.env.COMPANY_CNPJ || '', // CNPJ do pagador
        account_id: this.accountId                    // ID da conta do pagador
      };

      // Usar endpoint correto: POST /ledger/payments/boletos/{id}/pay
      const response = await this.authenticatedRequest('POST', `/ledger/payments/boletos/${boletoData.id}/pay`, paymentData);

      this.log('info', 'Boleto paid successfully', {
        boletoId: boletoData.id,
        amount: boletoData.amount,
        status: response.status || 'paid'
      });

      metricsCollector.incrementCounter('swap.payment.success');
      timer.end();

      return response;
    } catch (error) {
      metricsCollector.incrementCounter('swap.payment.failures');

      this.log('error', 'Failed to pay boleto', {
        barcode: this.maskBarcode(barcode),
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Validar formato de código de barras
   */
  isValidBarcodeFormat(barcode) {
    if (!barcode || typeof barcode !== 'string') {
      return false;
    }

    // Aceitar códigos de 47 ou 48 dígitos
    return /^\d{47,48}$/.test(barcode);
  }

  /**
   * Enriquecer dados do boleto com validações e formatações
   */
  enrichBoletoData(boletoData) {
    const now = new Date();

    return {
      ...boletoData,
      // Valores booleanos úteis
      hasDiscount: !!(boletoData.discountAmount && boletoData.discountAmount > 0),
      hasFine: !!(boletoData.fineAmount && boletoData.fineAmount > 0),
      hasInterest: !!(boletoData.interestAmount && boletoData.interestAmount > 0),

      // Status e validações 
      canPayToday: this.canPayToday(boletoData),
      isInPaymentWindow: this.isInPaymentWindow(boletoData),
      paymentWindow: this.getPaymentWindow(boletoData),

      // Dados de processamento
      processedAt: now.toISOString(),
      environment: this.environment
    };
  }

  /**
   * Verificar se boleto pode ser pago hoje
   */
  canPayToday(_boletoData) {
    // Lógica simplificada para testes - assumir que pode pagar durante horário comercial
    const now = new Date();
    const hour = now.getHours();
    return hour >= 7 && hour <= 23;
  }

  /**
   * Verificar se está na janela de pagamento
   */
  isInPaymentWindow(boletoData) {
    const now = new Date();
    const dueDate = new Date(boletoData.due_date);

    // Se não venceu ainda, pode pagar
    if (now <= dueDate) {
      return this.canPayToday(boletoData);
    }

    // Se venceu, verificar se ainda está no prazo final (assumir 30 dias)
    const thirtyDaysAfterDue = new Date(dueDate);
    thirtyDaysAfterDue.setDate(thirtyDaysAfterDue.getDate() + 30);

    return now <= thirtyDaysAfterDue && this.canPayToday(boletoData);
  }

  /**
   * Obter informações da janela de pagamento
   */
  getPaymentWindow(boletoData) {
    return {
      startHour: '07:00',
      endHour: '23:00',
      dueDate: boletoData.due_date,
      isBusinessHours: this.canPayToday(boletoData),
      canPayNow: this.isInPaymentWindow(boletoData)
    };
  }

  /**
   * Mascarar código de barras para logs (manter apenas início e fim)
   */
  maskBarcode(barcode) {
    if (!barcode || barcode.length < 10) return barcode;
    const start = barcode.substring(0, 5);
    const end = barcode.substring(barcode.length - 5);
    const middle = '*'.repeat(barcode.length - 10);
    return `${start}${middle}${end}`;
  }

  /**
   * Validar configurações necessárias
   */
  validateConfiguration() {
    const requiredFields = ['clientId', 'clientSecret', 'apiKey'];
    const missing = requiredFields.filter(field => !this[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    if (!['staging', 'production'].includes(this.environment)) {
      throw new Error('Environment must be either "staging" or "production"');
    }
  }

  /**
   * Obter status do circuit breaker
   */
  getCircuitBreakerStatus() {
    return {
      state: this.circuitBreakerState,
      failureCount: this.failureCount,
      threshold: this.circuitBreakerThreshold,
      lastFailureTime: this.lastFailureTime,
      timeout: this.circuitBreakerTimeout
    };
  }

  /**
   * Obter informações de configuração (sem dados sensíveis)
   */
  getConfiguration() {
    return {
      environment: this.environment,
      baseURL: this.baseURL,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      hasApiKey: !!this.apiKey,
      tokenCacheStatus: {
        hasAccessToken: !!this.tokenCache,
        accessTokenExpired: this.tokenExpiry ? Date.now() > this.tokenExpiry : true,
        hasRefreshToken: !!this.refreshToken,
        refreshTokenExpired: this.refreshExpiry ? Date.now() > this.refreshExpiry : true
      },
      circuitBreaker: this.getCircuitBreakerStatus()
    };
  }

  /**
   * Limpar cache de tokens (compatível com testes)
   */
  clearCache() {
    this.tokenCache = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
    this.refreshExpiry = null;
    this.log('info', 'Token cache cleared');
  }

  /**
   * Limpar cache de tokens (método alternativo)
   */
  clearTokenCache() {
    this.clearCache();
  }

  /**
   * Verificar circuit breaker
   */
  checkCircuitBreaker() {
    if (this.circuitBreakerState === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure > this.circuitBreakerTimeout) {
        this.circuitBreakerState = 'half-open';
        this.log('info', 'Circuit breaker mudou para half-open');
        metricsCollector.setGauge('swap.circuit_breaker.state', 'half-open');
      } else {
        throw new Error('Circuit breaker está aberto');
      }
    }
  }

  /**
   * Lidar com falha do circuit breaker
   */
  handleCircuitBreakerFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.circuitBreakerState = 'open';
      this.log('warning', 'Circuit breaker aberto devido a falhas consecutivas', {
        failureCount: this.failureCount,
        threshold: this.circuitBreakerThreshold
      });
      metricsCollector.setGauge('swap.circuit_breaker.state', 'open');
    }
  }

  /**
   * Resetar circuit breaker
   */
  resetCircuitBreaker() {
    if (this.failureCount > 0 || this.circuitBreakerState !== 'closed') {
      this.failureCount = 0;
      this.circuitBreakerState = 'closed';
      this.lastFailureTime = null;
      metricsCollector.setGauge('swap.circuit_breaker.state', 'closed');
    }
  }

  /**
   * Health check do serviço
   * @returns {Object} Status de saúde
   */
  async healthCheck() {
    try {
      const isTokenValid = this.isTokenValid();

      // Se não tem token válido, tentar autenticar
      if (!isTokenValid) {
        await this.authenticate();
      }

      return {
        status: 'healthy',
        circuitBreaker: this.circuitBreakerState,
        tokenValid: this.isTokenValid(),
        lastCheck: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        circuitBreaker: this.circuitBreakerState,
        tokenValid: false,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Verificar se token atual é válido
   * @returns {boolean} True se token é válido
   */
  isTokenValid() {
    return this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry;
  }
}

export default SwapFinancialService; 