/**
 * Sistema de métricas e monitoramento para integração Swap Financial
 * Coleta métricas de performance, taxa de sucesso e erros
 */

/**
 * Classe para gerenciar métricas em memória
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      // Contadores globais
      counters: {
        'swap.auth.attempts': 0,
        'swap.auth.success': 0,
        'swap.auth.failures': 0,
        'swap.boleto.verify.attempts': 0,
        'swap.boleto.verify.success': 0,
        'swap.boleto.verify.failures': 0,
        'swap.boleto.pay.attempts': 0,
        'swap.boleto.pay.success': 0,
        'swap.boleto.pay.failures': 0,
        'cnab.process.attempts': 0,
        'cnab.process.success': 0,
        'cnab.process.failures': 0,
        'cnab.files.processed': 0,
        'cnab.boletos.extracted': 0,
        'cnab.boletos.verified': 0,
        'errors.critical': 0,
        'errors.warning': 0,
        'errors.info': 0
      },

      // Histogramas para tempos de resposta (em ms)
      histograms: {
        'swap.auth.duration': [],
        'swap.boleto.verify.duration': [],
        'swap.boleto.pay.duration': [],
        'cnab.process.duration': [],
        'api.request.duration': []
      },

      // Gauges para valores instantâneos
      gauges: {
        'swap.circuit_breaker.state': 'closed', // closed, open, half-open
        'swap.cache.size': 0,
        'swap.cache.hit_rate': 0,
        'cnab.active_processes': 0,
        'api.concurrent_requests': 0
      },

      // Métricas por tipo de erro
      errorsByType: {
        'authentication': 0,
        'authorization': 0,
        'validation': 0,
        'business_logic': 0,
        'service_unavailable': 0,
        'not_found': 0,
        'rate_limit': 0,
        'internal_server': 0,
        'unknown': 0
      },

      // Métricas por endpoint
      endpointMetrics: {},

      // Timestamps para cálculos de taxa
      timestamps: {
        startTime: Date.now(),
        lastReset: Date.now()
      }
    };

    // Limpar histogramas antigos periodicamente (manter apenas últimos 1000 pontos)
    this.histogramMaxSize = 1000;

    // Inicializar limpeza automática
    this.setupCleanup();
  }

  /**
   * Incrementar contador
   * @param {string} name - Nome da métrica
   * @param {number} value - Valor a incrementar (padrão: 1)
   */
  incrementCounter(name, value = 1) {
    if (this.metrics.counters.hasOwnProperty(name)) {
      this.metrics.counters[name] += value;
    } else {
      this.metrics.counters[name] = value;
    }
  }

  /**
   * Definir valor de gauge
   * @param {string} name - Nome da métrica
   * @param {any} value - Valor do gauge
   */
  setGauge(name, value) {
    this.metrics.gauges[name] = value;
  }

  /**
   * Adicionar valor ao histograma
   * @param {string} name - Nome da métrica
   * @param {number} value - Valor a adicionar
   */
  addToHistogram(name, value) {
    if (!this.metrics.histograms[name]) {
      this.metrics.histograms[name] = [];
    }

    this.metrics.histograms[name].push({
      value,
      timestamp: Date.now()
    });

    // Manter apenas os últimos N valores
    if (this.metrics.histograms[name].length > this.histogramMaxSize) {
      this.metrics.histograms[name] = this.metrics.histograms[name].slice(-this.histogramMaxSize);
    }
  }

  /**
   * Registrar erro por tipo
   * @param {string} errorType - Tipo do erro
   */
  recordError(errorType) {
    if (this.metrics.errorsByType.hasOwnProperty(errorType)) {
      this.metrics.errorsByType[errorType]++;
    } else {
      this.metrics.errorsByType[errorType] = 1;
    }
  }

  /**
   * Registrar métricas de endpoint
   * @param {string} method - Método HTTP
   * @param {string} path - Caminho da API
   * @param {number} statusCode - Código de status da resposta
   * @param {number} duration - Duração da requisição em ms
   */
  recordEndpoint(method, path, statusCode, duration) {
    const key = `${method} ${path}`;

    if (!this.metrics.endpointMetrics[key]) {
      this.metrics.endpointMetrics[key] = {
        requests: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastRequest: null
      };
    }

    const endpoint = this.metrics.endpointMetrics[key];
    endpoint.requests++;
    endpoint.totalDuration += duration;
    endpoint.avgDuration = endpoint.totalDuration / endpoint.requests;
    endpoint.minDuration = Math.min(endpoint.minDuration, duration);
    endpoint.maxDuration = Math.max(endpoint.maxDuration, duration);
    endpoint.lastRequest = new Date().toISOString();

    if (statusCode >= 200 && statusCode < 400) {
      endpoint.successCount++;
    } else {
      endpoint.errorCount++;
    }
  }

  /**
   * Calcular estatísticas de histograma
   * @param {string} name - Nome do histograma
   * @returns {Object} Estatísticas calculadas
   */
  getHistogramStats(name) {
    const data = this.metrics.histograms[name];
    if (!data || data.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }

    const values = data.map(item => item.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: sum / count,
      p95: values[Math.floor(count * 0.95)] || 0,
      p99: values[Math.floor(count * 0.99)] || 0
    };
  }

  /**
   * Calcular taxa de sucesso
   * @param {string} successCounter - Nome do contador de sucesso
   * @param {string} totalCounter - Nome do contador total
   * @returns {number} Taxa de sucesso (0-100)
   */
  getSuccessRate(successCounter, totalCounter) {
    const success = this.metrics.counters[successCounter] || 0;
    const total = this.metrics.counters[totalCounter] || 0;
    return total > 0 ? (success / total) * 100 : 0;
  }

  /**
   * Obter todas as métricas formatadas
   * @returns {Object} Métricas completas
   */
  getAllMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.timestamps.startTime;

    return {
      timestamp: new Date().toISOString(),
      uptime,
      uptimeFormatted: this.formatDuration(uptime),

      // Contadores
      counters: { ...this.metrics.counters },

      // Gauges
      gauges: { ...this.metrics.gauges },

      // Estatísticas de histogramas
      histograms: Object.keys(this.metrics.histograms).reduce((acc, name) => {
        acc[name] = this.getHistogramStats(name);
        return acc;
      }, {}),

      // Erros por tipo
      errorsByType: { ...this.metrics.errorsByType },

      // Métricas calculadas
      calculated: {
        'swap.auth.success_rate': this.getSuccessRate('swap.auth.success', 'swap.auth.attempts'),
        'swap.boleto.verify.success_rate': this.getSuccessRate('swap.boleto.verify.success', 'swap.boleto.verify.attempts'),
        'swap.boleto.pay.success_rate': this.getSuccessRate('swap.boleto.pay.success', 'swap.boleto.pay.attempts'),
        'cnab.process.success_rate': this.getSuccessRate('cnab.process.success', 'cnab.process.attempts'),
        'error.total': Object.values(this.metrics.errorsByType).reduce((sum, count) => sum + count, 0),
        'requests.per_minute': this.calculateRequestsPerMinute(),
        'cache.hit_rate': this.calculateCacheHitRate()
      },

      // Top endpoints por requests
      topEndpoints: this.getTopEndpoints(10),

      // Endpoints com mais erros
      errorEndpoints: this.getErrorEndpoints(5)
    };
  }

  /**
   * Calcular requisições por minuto
   * @returns {number} RPM atual
   */
  calculateRequestsPerMinute() {
    const totalRequests = Object.values(this.metrics.endpointMetrics)
      .reduce((sum, endpoint) => sum + endpoint.requests, 0);
    const uptimeMinutes = (Date.now() - this.metrics.timestamps.startTime) / (1000 * 60);
    return uptimeMinutes > 0 ? totalRequests / uptimeMinutes : 0;
  }

  /**
   * Calcular taxa de cache hit (placeholder - implementar baseado no cache real)
   * @returns {number} Taxa de hit do cache
   */
  calculateCacheHitRate() {
    // TODO: Implementar baseado nas métricas reais do cache
    return this.metrics.gauges['swap.cache.hit_rate'] || 0;
  }

  /**
   * Obter top endpoints por número de requisições
   * @param {number} limit - Limite de resultados
   * @returns {Array} Top endpoints
   */
  getTopEndpoints(limit = 10) {
    return Object.entries(this.metrics.endpointMetrics)
      .sort(([, a], [, b]) => b.requests - a.requests)
      .slice(0, limit)
      .map(([endpoint, metrics]) => ({
        endpoint,
        requests: metrics.requests,
        avgDuration: Math.round(metrics.avgDuration),
        successRate: metrics.requests > 0 ?
          (metrics.successCount / metrics.requests * 100).toFixed(1) : '0.0'
      }));
  }

  /**
   * Obter endpoints com mais erros
   * @param {number} limit - Limite de resultados
   * @returns {Array} Endpoints com erros
   */
  getErrorEndpoints(limit = 5) {
    return Object.entries(this.metrics.endpointMetrics)
      .filter(([, metrics]) => metrics.errorCount > 0)
      .sort(([, a], [, b]) => b.errorCount - a.errorCount)
      .slice(0, limit)
      .map(([endpoint, metrics]) => ({
        endpoint,
        errorCount: metrics.errorCount,
        totalRequests: metrics.requests,
        errorRate: (metrics.errorCount / metrics.requests * 100).toFixed(1)
      }));
  }

  /**
   * Formatar duração em formato legível
   * @param {number} ms - Duração em milissegundos
   * @returns {string} Duração formatada
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Resetar todas as métricas
   */
  reset() {
    this.metrics.counters = Object.keys(this.metrics.counters).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    this.metrics.histograms = Object.keys(this.metrics.histograms).reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});

    this.metrics.errorsByType = Object.keys(this.metrics.errorsByType).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    this.metrics.endpointMetrics = {};
    this.metrics.timestamps.lastReset = Date.now();
  }

  /**
   * Configurar limpeza automática de dados antigos
   */
  setupCleanup() {
    // Limpar dados de histograma mais antigos que 1 hora a cada 10 minutos
    setInterval(() => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      Object.keys(this.metrics.histograms).forEach(name => {
        this.metrics.histograms[name] = this.metrics.histograms[name]
          .filter(item => item.timestamp > oneHourAgo);
      });
    }, 10 * 60 * 1000); // 10 minutos
  }
}

// Instância singleton do coletor de métricas
const metricsCollector = new MetricsCollector();

/**
 * Middleware Express para coletar métricas de requisições
 */
export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Incrementar requisições ativas
  metricsCollector.setGauge('api.concurrent_requests',
    (metricsCollector.metrics.gauges['api.concurrent_requests'] || 0) + 1);

  // Hook no final da resposta
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    // Registrar métricas da requisição
    metricsCollector.recordEndpoint(req.method, req.path, res.statusCode, duration);
    metricsCollector.addToHistogram('api.request.duration', duration);

    // Decrementar requisições ativas
    metricsCollector.setGauge('api.concurrent_requests',
      Math.max(0, (metricsCollector.metrics.gauges['api.concurrent_requests'] || 0) - 1));

    // Chamar método original
    originalSend.call(this, data);
  };

  next();
};

/**
 * Timer para medir duração de operações
 */
export class Timer {
  constructor(metricName) {
    this.metricName = metricName;
    this.startTime = Date.now();
  }

  /**
   * Finalizar timer e registrar métrica
   * @returns {number} Duração em ms
   */
  end() {
    const duration = Date.now() - this.startTime;
    if (this.metricName) {
      metricsCollector.addToHistogram(this.metricName, duration);
    }
    return duration;
  }
}

/**
 * Função utilitária para medir duração de função async
 * @param {string} metricName - Nome da métrica
 * @param {Function} fn - Função a ser medida
 * @returns {Function} Função wrapper
 */
export const timed = (metricName, fn) => {
  return async (...args) => {
    const timer = new Timer(metricName);
    try {
      const result = await fn(...args);
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      throw error;
    }
  };
};

// Exportar instância e funções utilitárias
export {
  metricsCollector
};

export default metricsCollector; 