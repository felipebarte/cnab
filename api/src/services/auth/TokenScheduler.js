import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';
import { metricsCollector } from '../../utils/metrics.js';

/**
 * Agendador de renovação automática de tokens
 * Implementa diferentes estratégias de agendamento e monitoramento
 */
class TokenScheduler {
  constructor(tokenManager, options = {}) {
    this.tokenManager = tokenManager;

    // Configurações
    this.strategy = options.strategy || 'adaptive'; // 'fixed', 'adaptive', 'aggressive'
    this.minRefreshInterval = options.minRefreshInterval || 30000; // 30 segundos mínimo
    this.maxRefreshInterval = options.maxRefreshInterval || 1800000; // 30 minutos máximo
    this.healthCheckInterval = options.healthCheckInterval || 60000; // 1 minuto
    this.enabled = options.enabled !== false; // Habilitado por padrão

    // Estado interno
    this.refreshTimer = null;
    this.healthCheckTimer = null;
    this.consecutiveFailures = 0;
    this.lastSuccessfulRefresh = null;
    this.isRunning = false;

    // Estratégias de agendamento
    this.strategies = {
      fixed: this._fixedStrategy.bind(this),
      adaptive: this._adaptiveStrategy.bind(this),
      aggressive: this._aggressiveStrategy.bind(this)
    };

    this.log('info', 'TokenScheduler initialized', {
      strategy: this.strategy,
      enabled: this.enabled,
      minInterval: this.minRefreshInterval,
      maxInterval: this.maxRefreshInterval
    });
  }

  /**
   * Iniciar agendamento automático
   */
  start() {
    if (this.isRunning) {
      this.log('warn', 'TokenScheduler already running');
      return;
    }

    if (!this.enabled) {
      this.log('info', 'TokenScheduler disabled, not starting');
      return;
    }

    this.isRunning = true;
    this.log('info', 'Starting TokenScheduler', { strategy: this.strategy });

    // Iniciar health check periódico
    this._startHealthCheck();

    // Agendar primeira renovação
    this._scheduleNextRefresh();

    metricsCollector.incrementCounter('token_scheduler.starts');
  }

  /**
   * Parar agendamento automático
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.log('info', 'Stopping TokenScheduler');

    // Limpar timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    metricsCollector.incrementCounter('token_scheduler.stops');
  }

  /**
   * Agendar próxima renovação baseada na estratégia
   */
  _scheduleNextRefresh() {
    if (!this.isRunning) {
      return;
    }

    // Limpar agendamento anterior
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Obter delay baseado na estratégia
    const delay = this._calculateRefreshDelay();

    if (delay <= 0) {
      // Renovar imediatamente
      this._performScheduledRefresh();
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this._performScheduledRefresh();
    }, delay);

    this.log('debug', 'Next refresh scheduled', {
      strategy: this.strategy,
      delay: Math.round(delay / 1000) + 's',
      scheduledAt: new Date(Date.now() + delay).toISOString()
    });

    metricsCollector.setGauge('token_scheduler.next_refresh_delay', delay);
  }

  /**
   * Executar renovação agendada
   */
  async _performScheduledRefresh() {
    if (!this.isRunning) {
      return;
    }

    try {
      this.log('info', 'Performing scheduled token refresh');

      await this.tokenManager.refreshToken();

      this.consecutiveFailures = 0;
      this.lastSuccessfulRefresh = Date.now();

      this.log('info', 'Scheduled refresh successful');
      metricsCollector.incrementCounter('token_scheduler.refresh_success');

    } catch (error) {
      this.consecutiveFailures++;

      this.log('error', 'Scheduled refresh failed', {
        error: error.message,
        consecutiveFailures: this.consecutiveFailures
      });

      metricsCollector.incrementCounter('token_scheduler.refresh_failures');
      metricsCollector.setGauge('token_scheduler.consecutive_failures', this.consecutiveFailures);
    }

    // Agendar próxima renovação
    this._scheduleNextRefresh();
  }

  /**
   * Calcular delay para próxima renovação
   */
  _calculateRefreshDelay() {
    const strategyFunc = this.strategies[this.strategy];
    if (!strategyFunc) {
      this.log('warn', `Unknown strategy: ${this.strategy}, using adaptive`);
      return this._adaptiveStrategy();
    }

    return strategyFunc();
  }

  /**
   * Estratégia fixa - renovar com margem fixa
   */
  _fixedStrategy() {
    const tokenInfo = this.tokenManager.getTokenInfo();

    if (!tokenInfo.hasToken || !tokenInfo.expiresIn) {
      return this.minRefreshInterval;
    }

    // Renovar 5 minutos antes da expiração
    const refreshDelay = tokenInfo.expiresIn - (5 * 60 * 1000);
    return Math.max(refreshDelay, this.minRefreshInterval);
  }

  /**
   * Estratégia adaptativa - ajustar baseado no histórico
   */
  _adaptiveStrategy() {
    const tokenInfo = this.tokenManager.getTokenInfo();

    if (!tokenInfo.hasToken || !tokenInfo.expiresIn) {
      return this.minRefreshInterval;
    }

    // Base: renovar com 20% do tempo restante como margem
    let marginPercentage = 0.2;

    // Ajustar baseado em falhas consecutivas
    if (this.consecutiveFailures > 0) {
      marginPercentage += this.consecutiveFailures * 0.1; // +10% por falha
      marginPercentage = Math.min(marginPercentage, 0.8); // Máximo 80%
    }

    // Ajustar baseado no sucesso recente
    if (this.lastSuccessfulRefresh) {
      const timeSinceSuccess = Date.now() - this.lastSuccessfulRefresh;
      if (timeSinceSuccess < 300000) { // Menos de 5 minutos
        marginPercentage *= 0.8; // Reduzir margem se renovação recente foi bem-sucedida
      }
    }

    const refreshMargin = tokenInfo.expiresIn * marginPercentage;
    const refreshDelay = tokenInfo.expiresIn - refreshMargin;

    return Math.max(
      Math.min(refreshDelay, this.maxRefreshInterval),
      this.minRefreshInterval
    );
  }

  /**
   * Estratégia agressiva - renovar frequentemente
   */
  _aggressiveStrategy() {
    const tokenInfo = this.tokenManager.getTokenInfo();

    if (!tokenInfo.hasToken || !tokenInfo.expiresIn) {
      return this.minRefreshInterval;
    }

    // Renovar com margem de 50% do tempo total
    const refreshDelay = tokenInfo.expiresIn * 0.5;

    return Math.max(refreshDelay, this.minRefreshInterval);
  }

  /**
   * Iniciar health check periódico
   */
  _startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this._performHealthCheck();
    }, this.healthCheckInterval);

    this.log('debug', 'Health check started', {
      interval: this.healthCheckInterval
    });
  }

  /**
   * Executar health check
   */
  _performHealthCheck() {
    if (!this.isRunning) {
      return;
    }

    const tokenInfo = this.tokenManager.getTokenInfo();
    const metrics = this.getMetrics();

    // Verificar se token está expirado e não há renovação agendada
    if (tokenInfo.hasToken && !tokenInfo.isValid && !this.refreshTimer) {
      this.log('warn', 'Token expired with no refresh scheduled, triggering immediate refresh');
      this._performScheduledRefresh();
    }

    // Verificar se há muitas falhas consecutivas
    if (this.consecutiveFailures >= 3) {
      this.log('error', 'Too many consecutive failures, may need intervention', {
        consecutiveFailures: this.consecutiveFailures
      });
    }

    // Atualizar métricas
    metricsCollector.setGauge('token_scheduler.consecutive_failures', this.consecutiveFailures);
    metricsCollector.setGauge('token_scheduler.is_running', this.isRunning ? 1 : 0);
    metricsCollector.setGauge('token_scheduler.health_score', this._calculateHealthScore());

    this.log('debug', 'Health check completed', {
      tokenValid: tokenInfo.isValid,
      consecutiveFailures: this.consecutiveFailures,
      healthScore: this._calculateHealthScore()
    });
  }

  /**
   * Calcular score de saúde (0-100)
   */
  _calculateHealthScore() {
    let score = 100;

    // Penalizar falhas consecutivas
    score -= this.consecutiveFailures * 20;

    // Penalizar se não há renovação bem-sucedida recente
    if (this.lastSuccessfulRefresh) {
      const timeSinceSuccess = Date.now() - this.lastSuccessfulRefresh;
      const hoursSinceSuccess = timeSinceSuccess / (1000 * 60 * 60);

      if (hoursSinceSuccess > 24) {
        score -= 30; // Penalizar se não há sucesso em 24h
      } else if (hoursSinceSuccess > 12) {
        score -= 15; // Penalizar se não há sucesso em 12h
      }
    } else {
      score -= 25; // Penalizar se nunca houve renovação bem-sucedida
    }

    // Verificar se token está válido
    const tokenInfo = this.tokenManager.getTokenInfo();
    if (!tokenInfo.isValid) {
      score -= 40;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Forçar renovação imediata
   */
  async forceRefresh() {
    this.log('info', 'Force refresh requested');

    try {
      await this.tokenManager.refreshToken();
      this.consecutiveFailures = 0;
      this.lastSuccessfulRefresh = Date.now();

      // Re-agendar próxima renovação
      this._scheduleNextRefresh();

      metricsCollector.incrementCounter('token_scheduler.force_refresh_success');
      return true;

    } catch (error) {
      this.consecutiveFailures++;
      this.log('error', 'Force refresh failed', { error: error.message });
      metricsCollector.incrementCounter('token_scheduler.force_refresh_failures');
      throw error;
    }
  }

  /**
   * Alterar estratégia em tempo de execução
   */
  setStrategy(newStrategy) {
    if (!this.strategies[newStrategy]) {
      throw new Error(`Invalid strategy: ${newStrategy}`);
    }

    const oldStrategy = this.strategy;
    this.strategy = newStrategy;

    this.log('info', 'Strategy changed', {
      from: oldStrategy,
      to: newStrategy
    });

    // Re-agendar com nova estratégia
    if (this.isRunning) {
      this._scheduleNextRefresh();
    }

    metricsCollector.incrementCounter('token_scheduler.strategy_changes');
  }

  /**
   * Obter métricas do scheduler
   */
  getMetrics() {
    return {
      isRunning: this.isRunning,
      strategy: this.strategy,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessfulRefresh: this.lastSuccessfulRefresh,
      healthScore: this._calculateHealthScore(),
      hasRefreshScheduled: !!this.refreshTimer,
      nextRefreshIn: this.refreshTimer ? this._getTimeUntilNextRefresh() : null,
      tokenInfo: this.tokenManager.getTokenInfo()
    };
  }

  /**
   * Obter tempo até próxima renovação
   */
  _getTimeUntilNextRefresh() {
    if (!this.refreshTimer) {
      return null;
    }

    // Isto é uma estimativa, o timer real pode variar
    const tokenInfo = this.tokenManager.getTokenInfo();
    return tokenInfo.expiresIn ? Math.max(0, tokenInfo.expiresIn - 300000) : null; // 5 min margin
  }

  /**
   * Logger helper
   */
  log(level, message, metadata = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'TokenScheduler',
      level,
      message,
      ...metadata
    };

    console.log(JSON.stringify(logData));
  }
}

export default TokenScheduler; 