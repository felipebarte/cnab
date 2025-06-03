import { setTimeout, clearTimeout } from 'node:timers';
import { Timer, metricsCollector } from '../../utils/metrics.js';

/**
 * Gerenciador centralizado de tokens OAuth
 * Implementa renovação automática, cache com TTL, métricas e logs
 */
class TokenManager {
  constructor(options = {}) {
    this.name = options.name || 'TokenManager';
    this.apiClient = options.apiClient; // Instância do cliente API (SwapFinancialService)

    // Configurações de token
    this.refreshMargin = options.refreshMargin || 300; // 5 minutos antes da expiração
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000; // 2 segundos

    // Cache de tokens
    this.tokenCache = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
      tokenType: 'Bearer'
    };

    // Estado de renovação automática
    this.refreshTimer = null;
    this.isRefreshing = false;
    this.refreshPromise = null;

    // Métricas e logs
    this.metrics = {
      tokenRequests: 0,
      tokenRefreshes: 0,
      tokenFailures: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.log('info', 'TokenManager initialized', {
      refreshMargin: this.refreshMargin,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Obter token válido (método principal)
   * Retorna token do cache ou renova automaticamente
   */
  async getValidToken() {
    const timer = new Timer('token_manager.get_valid_token.duration');
    this.metrics.tokenRequests++;
    metricsCollector.incrementCounter('token_manager.requests');

    try {
      // Verificar se token em cache é válido
      if (this.isTokenValid()) {
        this.metrics.cacheHits++;
        metricsCollector.incrementCounter('token_manager.cache_hits');
        this.log('debug', 'Using cached token');
        return this.tokenCache.accessToken;
      }

      this.metrics.cacheMisses++;
      metricsCollector.incrementCounter('token_manager.cache_misses');

      // Se já está renovando, aguardar renovação em andamento
      if (this.isRefreshing && this.refreshPromise) {
        this.log('debug', 'Waiting for ongoing token refresh');
        await this.refreshPromise;
        return this.tokenCache.accessToken;
      }

      // Renovar token
      return await this.refreshToken();

    } catch (error) {
      this.metrics.tokenFailures++;
      metricsCollector.incrementCounter('token_manager.failures');
      this.log('error', 'Failed to get valid token', { error: error.message });
      throw error;
    } finally {
      timer.end();
    }
  }

  /**
   * Renovar token OAuth
   */
  async refreshToken() {
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Executar renovação de token com retry
   */
  async _performTokenRefresh(retryCount = 0) {
    const timer = new Timer('token_manager.refresh.duration');
    this.metrics.tokenRefreshes++;
    metricsCollector.incrementCounter('token_manager.refreshes');

    try {
      this.log('info', 'Refreshing access token', {
        retryCount,
        hasRefreshToken: !!this.tokenCache.refreshToken
      });

      let tokenData;

      // Se tem refresh token válido, usar refresh flow
      if (this.tokenCache.refreshToken && this.isRefreshTokenValid()) {
        tokenData = await this._refreshWithRefreshToken();
      } else {
        // Solicitar novo token via client credentials
        tokenData = await this._requestNewToken();
      }

      // Atualizar cache
      this._updateTokenCache(tokenData);

      // Agendar próxima renovação
      this._scheduleNextRefresh();

      this.log('info', 'Token refreshed successfully', {
        expiresIn: tokenData.expires_in,
        hasRefreshToken: !!tokenData.refresh_token
      });

      metricsCollector.incrementCounter('token_manager.refresh_success');
      timer.end();

      return this.tokenCache.accessToken;

    } catch (error) {
      timer.end();
      this.log('error', 'Token refresh failed', {
        error: error.message,
        retryCount
      });

      // Retry com backoff exponencial
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        this.log('warn', `Retrying token refresh in ${delay}ms`, {
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries
        });

        await this._sleep(delay);
        return this._performTokenRefresh(retryCount + 1);
      }

      metricsCollector.incrementCounter('token_manager.refresh_failures');
      throw error;
    }
  }

  /**
   * Renovar usando refresh token
   */
  async _refreshWithRefreshToken() {
    if (!this.apiClient || !this.apiClient.refreshAccessToken) {
      throw new Error('API client não suporta refresh token');
    }

    return await this.apiClient.refreshAccessToken();
  }

  /**
   * Solicitar novo token via client credentials
   */
  async _requestNewToken() {
    if (!this.apiClient || !this.apiClient.requestNewToken) {
      throw new Error('API client não configurado para renovação de token');
    }

    const tokenResponse = await this.apiClient.requestNewToken();

    return {
      access_token: tokenResponse,
      expires_in: 3600, // Default 1 hora se não especificado
      token_type: 'Bearer'
    };
  }

  /**
   * Atualizar cache de tokens
   */
  _updateTokenCache(tokenData) {
    const now = Date.now();

    this.tokenCache.accessToken = tokenData.access_token;
    this.tokenCache.expiresAt = now + (tokenData.expires_in * 1000);
    this.tokenCache.tokenType = tokenData.token_type || 'Bearer';

    if (tokenData.refresh_token) {
      this.tokenCache.refreshToken = tokenData.refresh_token;
      this.tokenCache.refreshExpiresAt = tokenData.refresh_expires_in ?
        now + (tokenData.refresh_expires_in * 1000) :
        this.tokenCache.refreshExpiresAt; // Manter valor anterior se não especificado
    }

    // Atualizar métricas
    metricsCollector.setGauge('token_manager.token_expires_at', this.tokenCache.expiresAt);
    metricsCollector.setGauge('token_manager.time_until_expiry',
      this.tokenCache.expiresAt - now);
  }

  /**
   * Agendar próxima renovação automática
   */
  _scheduleNextRefresh() {
    // Limpar agendamento anterior
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokenCache.expiresAt) {
      return;
    }

    // Calcular quando renovar (com margem de segurança)
    const now = Date.now();
    const expiresAt = this.tokenCache.expiresAt;
    const refreshAt = expiresAt - (this.refreshMargin * 1000);
    const delay = Math.max(refreshAt - now, 30000); // Mínimo 30 segundos

    this.refreshTimer = setTimeout(async () => {
      try {
        this.log('info', 'Auto-refreshing token');
        await this.refreshToken();
      } catch (error) {
        this.log('error', 'Auto-refresh failed', { error: error.message });
      }
    }, delay);

    this.log('debug', 'Next token refresh scheduled', {
      refreshAt: new Date(refreshAt).toISOString(),
      delay: Math.round(delay / 1000) + 's'
    });
  }

  /**
   * Verificar se token de acesso é válido
   */
  isTokenValid() {
    if (!this.tokenCache.accessToken || !this.tokenCache.expiresAt) {
      return false;
    }

    const now = Date.now();
    const validUntil = this.tokenCache.expiresAt - (this.refreshMargin * 1000);
    return now < validUntil;
  }

  /**
   * Verificar se refresh token é válido
   */
  isRefreshTokenValid() {
    if (!this.tokenCache.refreshToken) {
      return false;
    }

    if (!this.tokenCache.refreshExpiresAt) {
      return true; // Assumir válido se não tem expiração
    }

    const now = Date.now();
    return now < this.tokenCache.refreshExpiresAt;
  }

  /**
   * Verificar se token expira em breve
   */
  isTokenExpiringSoon() {
    if (!this.tokenCache.expiresAt) {
      return true;
    }

    const now = Date.now();
    const warningTime = this.tokenCache.expiresAt - (this.refreshMargin * 1000 * 2); // Dobro da margem
    return now >= warningTime;
  }

  /**
   * Obter informações do token atual
   */
  getTokenInfo() {
    const now = Date.now();

    return {
      hasToken: !!this.tokenCache.accessToken,
      isValid: this.isTokenValid(),
      expiresAt: this.tokenCache.expiresAt ? new Date(this.tokenCache.expiresAt).toISOString() : null,
      expiresIn: this.tokenCache.expiresAt ? Math.max(0, this.tokenCache.expiresAt - now) : 0,
      isExpiringSoon: this.isTokenExpiringSoon(),
      hasRefreshToken: !!this.tokenCache.refreshToken,
      isRefreshTokenValid: this.isRefreshTokenValid(),
      tokenType: this.tokenCache.tokenType,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Limpar cache e cancelar agendamentos
   */
  clearCache() {
    // Limpar timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Limpar cache
    this.tokenCache = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
      tokenType: 'Bearer'
    };

    // Reset estado
    this.isRefreshing = false;
    this.refreshPromise = null;

    this.log('info', 'Token cache cleared');
    metricsCollector.incrementCounter('token_manager.cache_clears');
  }

  /**
   * Destruir TokenManager (cleanup)
   */
  destroy() {
    this.clearCache();
    this.log('info', 'TokenManager destroyed');
  }

  /**
   * Obter métricas do TokenManager
   */
  getMetrics() {
    return {
      ...this.metrics,
      tokenInfo: this.getTokenInfo(),
      refreshMargin: this.refreshMargin,
      maxRetries: this.maxRetries,
      isRefreshing: this.isRefreshing
    };
  }

  /**
   * Helper para sleep/delay
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logger helper
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
}

export default TokenManager; 