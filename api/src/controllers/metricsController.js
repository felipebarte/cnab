import metricsCollector from '../utils/metrics.js';

/**
 * Controller para exposição de métricas de monitoramento
 */
class MetricsController {

  /**
   * Obter todas as métricas do sistema
   * GET /api/metrics
   */
  getAllMetrics = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao obter métricas',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter métricas em formato Prometheus
   * GET /api/metrics/prometheus
   */
  getPrometheusMetrics = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();
      const prometheusFormat = this.convertToPrometheusFormat(metrics);

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusFormat);

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao gerar métricas Prometheus',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter apenas contadores
   * GET /api/metrics/counters
   */
  getCounters = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      res.json({
        success: true,
        data: {
          counters: metrics.counters,
          calculated: metrics.calculated
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao obter contadores',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter métricas de performance (histogramas)
   * GET /api/metrics/performance
   */
  getPerformanceMetrics = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      res.json({
        success: true,
        data: {
          histograms: metrics.histograms,
          topEndpoints: metrics.topEndpoints,
          errorEndpoints: metrics.errorEndpoints
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao obter métricas de performance',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter métricas de erros
   * GET /api/metrics/errors
   */
  getErrorMetrics = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      res.json({
        success: true,
        data: {
          errorsByType: metrics.errorsByType,
          errorEndpoints: metrics.errorEndpoints,
          errorCounters: {
            critical: metrics.counters['errors.critical'],
            warning: metrics.counters['errors.warning'],
            info: metrics.counters['errors.info'],
            total: metrics.calculated['error.total']
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao obter métricas de erro',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter métricas específicas da integração Swap Financial
   * GET /api/metrics/swap
   */
  getSwapMetrics = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      const swapMetrics = {
        auth: {
          attempts: metrics.counters['swap.auth.attempts'],
          success: metrics.counters['swap.auth.success'],
          failures: metrics.counters['swap.auth.failures'],
          successRate: metrics.calculated['swap.auth.success_rate'],
          avgDuration: metrics.histograms['swap.auth.duration']?.avg || 0
        },
        boleto: {
          verify: {
            attempts: metrics.counters['swap.boleto.verify.attempts'],
            success: metrics.counters['swap.boleto.verify.success'],
            failures: metrics.counters['swap.boleto.verify.failures'],
            successRate: metrics.calculated['swap.boleto.verify.success_rate'],
            avgDuration: metrics.histograms['swap.boleto.verify.duration']?.avg || 0
          },
          pay: {
            attempts: metrics.counters['swap.boleto.pay.attempts'],
            success: metrics.counters['swap.boleto.pay.success'],
            failures: metrics.counters['swap.boleto.pay.failures'],
            successRate: metrics.calculated['swap.boleto.pay.success_rate'],
            avgDuration: metrics.histograms['swap.boleto.pay.duration']?.avg || 0
          }
        },
        system: {
          circuitBreakerState: metrics.gauges['swap.circuit_breaker.state'],
          cacheSize: metrics.gauges['swap.cache.size'],
          cacheHitRate: metrics.gauges['swap.cache.hit_rate']
        }
      };

      res.json({
        success: true,
        data: swapMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao obter métricas Swap Financial',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter métricas específicas do processamento CNAB
   * GET /api/metrics/cnab
   */
  getCnabMetrics = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      const cnabMetrics = {
        processing: {
          attempts: metrics.counters['cnab.process.attempts'],
          success: metrics.counters['cnab.process.success'],
          failures: metrics.counters['cnab.process.failures'],
          successRate: metrics.calculated['cnab.process.success_rate'],
          avgDuration: metrics.histograms['cnab.process.duration']?.avg || 0
        },
        files: {
          processed: metrics.counters['cnab.files.processed'],
          activeProcesses: metrics.gauges['cnab.active_processes']
        },
        boletos: {
          extracted: metrics.counters['cnab.boletos.extracted'],
          verified: metrics.counters['cnab.boletos.verified']
        }
      };

      res.json({
        success: true,
        data: cnabMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao obter métricas CNAB',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Resetar todas as métricas
   * POST /api/metrics/reset
   */
  resetMetrics = async (req, res) => {
    try {
      metricsCollector.reset();

      res.json({
        success: true,
        message: 'Métricas resetadas com sucesso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao resetar métricas',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Health check para o sistema de métricas
   * GET /api/metrics/health
   */
  healthCheck = async (req, res) => {
    try {
      const metrics = metricsCollector.getAllMetrics();
      const isHealthy = true; // TODO: Adicionar verificações de saúde específicas

      const health = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        uptime: metrics.uptimeFormatted,
        metricsCollection: 'active',
        dataPoints: {
          counters: Object.keys(metrics.counters).length,
          histograms: Object.keys(metrics.histograms).length,
          gauges: Object.keys(metrics.gauges).length,
          endpoints: Object.keys(metrics.topEndpoints).length
        },
        lastUpdate: metrics.timestamp
      };

      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json({
        success: isHealthy,
        data: health,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro no health check de métricas',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Converter métricas para formato Prometheus
   * @param {Object} metrics - Métricas coletadas
   * @returns {string} Métricas em formato Prometheus
   */
  convertToPrometheusFormat(metrics) {
    let output = '';

    // Adicionar timestamp
    const timestamp = Date.now();

    // Contadores
    output += '# TYPE cnab_requests_total counter\n';
    Object.entries(metrics.counters).forEach(([name, value]) => {
      const metricName = name.replace(/\./g, '_');
      output += `cnab_${metricName}_total ${value} ${timestamp}\n`;
    });

    // Gauges
    output += '\n# TYPE cnab_gauge gauge\n';
    Object.entries(metrics.gauges).forEach(([name, value]) => {
      const metricName = name.replace(/\./g, '_');
      const numValue = typeof value === 'string' ? 0 : value;
      output += `cnab_${metricName} ${numValue} ${timestamp}\n`;
    });

    // Histogramas (como sumário)
    output += '\n# TYPE cnab_duration_seconds summary\n';
    Object.entries(metrics.histograms).forEach(([name, stats]) => {
      const metricName = name.replace(/\./g, '_');
      if (stats.count > 0) {
        output += `cnab_${metricName}_seconds{quantile="0.5"} ${(stats.avg / 1000).toFixed(3)} ${timestamp}\n`;
        output += `cnab_${metricName}_seconds{quantile="0.95"} ${(stats.p95 / 1000).toFixed(3)} ${timestamp}\n`;
        output += `cnab_${metricName}_seconds{quantile="0.99"} ${(stats.p99 / 1000).toFixed(3)} ${timestamp}\n`;
        output += `cnab_${metricName}_seconds_sum ${(stats.avg * stats.count / 1000).toFixed(3)} ${timestamp}\n`;
        output += `cnab_${metricName}_seconds_count ${stats.count} ${timestamp}\n`;
      }
    });

    // Métricas calculadas
    output += '\n# TYPE cnab_calculated gauge\n';
    Object.entries(metrics.calculated).forEach(([name, value]) => {
      const metricName = name.replace(/\./g, '_');
      output += `cnab_${metricName} ${value} ${timestamp}\n`;
    });

    return output;
  }

  /**
   * Método de logging
   */
  log(level, message, metadata = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'MetricsController',
      level,
      message,
      ...metadata
    };

    console.log(JSON.stringify(logData));
  }
}

// Instância singleton do controller
const metricsController = new MetricsController();

// Exportar métodos bound para uso nas rotas
export const getAllMetrics = metricsController.getAllMetrics;
export const getPrometheusMetrics = metricsController.getPrometheusMetrics;
export const getCounters = metricsController.getCounters;
export const getPerformanceMetrics = metricsController.getPerformanceMetrics;
export const getErrorMetrics = metricsController.getErrorMetrics;
export const getSwapMetrics = metricsController.getSwapMetrics;
export const getCnabMetrics = metricsController.getCnabMetrics;
export const resetMetrics = metricsController.resetMetrics;
export const healthCheck = metricsController.healthCheck;

export default metricsController; 