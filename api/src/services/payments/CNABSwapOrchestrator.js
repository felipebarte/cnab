import SwapFinancialService from '../external/SwapFinancialService.js';
import PaymentExtractorService from './PaymentExtractorService.js';
import { getSwapServiceConfig } from '../../config/swapConfig.js';
import { Timer, metricsCollector } from '../../utils/metrics.js';

/**
 * Orquestrador que integra dados CNAB com a API Swap Financial
 * Responsável por processar boletos extraídos do CNAB, validar com Swap API,
 * e gerenciar o fluxo completo de verificação e processamento
 */
class CNABSwapOrchestrator {
  constructor(options = {}) {
    this.config = {
      validateAll: true,
      includeInvalidBarcodes: false,
      batchSize: 10,
      maxConcurrentRequests: 5,
      enableCache: true,
      ...options
    };

    // Inicializar serviços
    this.swapService = null;
    this.paymentExtractor = new PaymentExtractorService({
      validateBarcodes: true,
      includeMetadata: true,
      groupByType: true
    });

    this.initializeSwapService();

    // Cache de verificações para evitar duplicatas
    this.verificationCache = new Map();

    // Estatísticas de processamento
    this.stats = {
      processed: 0,
      verified: 0,
      successful: 0,
      failed: 0,
      cached: 0,
      errors: 0
    };

    // Atualizar métricas de cache
    this.updateCacheMetrics();
  }

  /**
   * Inicializar serviço Swap Financial
   */
  initializeSwapService() {
    try {
      const config = getSwapServiceConfig();
      this.swapService = new SwapFinancialService(config);
      this.log('info', 'Swap Financial service initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize Swap Financial service', { error: error.message });
      this.swapService = null;
    }
  }

  /**
   * Processar arquivo CNAB e verificar boletos com Swap Financial
   * @param {string|Buffer} cnabContent - Conteúdo do arquivo CNAB
   * @param {Object} options - Opções de processamento
   * @returns {Object} Resultado do processamento
   */
  async processCNABFile(cnabContent, options = {}) {
    const timer = new Timer('cnab.process.duration');
    metricsCollector.incrementCounter('cnab.process.attempts');
    metricsCollector.setGauge('cnab.active_processes',
      (metricsCollector.metrics.gauges['cnab.active_processes'] || 0) + 1);

    const startTime = Date.now();
    this.stats.processed++;

    try {
      this.log('info', 'Starting CNAB-Swap orchestration process');

      // Verificar se Swap service está disponível
      if (!this.swapService) {
        throw new Error('Swap Financial service is not available');
      }

      // 1. Extrair dados de pagamento do CNAB
      const cnabResult = await this.paymentExtractor.extractPaymentData(cnabContent, options);

      if (!cnabResult.success) {
        throw new Error(`CNAB extraction failed: ${cnabResult.error?.message}`);
      }

      // Métricas CNAB
      metricsCollector.incrementCounter('cnab.files.processed');
      metricsCollector.incrementCounter('cnab.boletos.extracted', cnabResult.summary.paymentsFound);

      this.log('info', 'CNAB data extracted successfully', {
        totalRecords: cnabResult.summary.totalRecords,
        paymentsFound: cnabResult.summary.paymentsFound
      });

      // 2. Filtrar boletos válidos
      const validBoletos = this.filterValidBoletos(cnabResult.data.payments);

      if (validBoletos.length === 0) {
        const result = {
          success: true,
          message: 'No valid boletos found for processing',
          data: {
            cnabSummary: cnabResult.summary,
            swapResults: {
              total: 0,
              verified: 0,
              successful: 0,
              failed: 0,
              validations: []
            }
          },
          processingTime: `${Date.now() - startTime}ms`
        };

        metricsCollector.incrementCounter('cnab.process.success');
        timer.end();
        this.decrementActiveProcesses();

        return result;
      }

      this.log('info', `Processing ${validBoletos.length} valid boletos`);

      // 3. Verificar boletos com Swap Financial API
      const swapResults = await this.verifyBoletosWithSwap(validBoletos, options);

      // Métricas de verificação
      metricsCollector.incrementCounter('cnab.boletos.verified', swapResults.verified);

      // 4. Consolidar resultados
      const result = {
        success: true,
        data: {
          cnabSummary: cnabResult.summary,
          cnabMetadata: cnabResult.metadata,
          swapResults,
          compatibility: this.analyzeCompatibility(cnabResult.data.payments, swapResults.validations)
        },
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };

      this.log('info', 'CNAB-Swap orchestration completed successfully', {
        totalBoletos: validBoletos.length,
        verified: swapResults.verified,
        successful: swapResults.successful
      });

      metricsCollector.incrementCounter('cnab.process.success');
      timer.end();
      this.decrementActiveProcesses();

      return result;

    } catch (error) {
      this.stats.errors++;
      metricsCollector.incrementCounter('cnab.process.failures');

      this.log('error', 'CNAB-Swap orchestration failed', { error: error.message });

      timer.end();
      this.decrementActiveProcesses();

      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString()
        },
        processingTime: `${Date.now() - startTime}ms`
      };
    }
  }

  /**
   * Verificar múltiplos boletos com Swap Financial API
   * @param {Array} boletos - Lista de boletos para verificar
   * @param {Object} options - Opções de verificação
   * @returns {Object} Resultados das verificações
   */
  async verifyBoletosWithSwap(boletos, options = {}) {
    const batchSize = options.batchSize || this.config.batchSize;
    const maxConcurrent = options.maxConcurrentRequests || this.config.maxConcurrentRequests;

    const results = {
      total: boletos.length,
      verified: 0,
      successful: 0,
      failed: 0,
      validations: []
    };

    // Processar em batches para evitar sobrecarga
    for (let i = 0; i < boletos.length; i += batchSize) {
      const batch = boletos.slice(i, i + batchSize);

      this.log('debug', `Processing batch ${Math.floor(i / batchSize) + 1}`, {
        batchSize: batch.length,
        remaining: boletos.length - i - batch.length
      });

      // Processar batch com limite de concorrência
      const batchPromises = batch.map(boleto =>
        this.verifyBoletoWithSwap(boleto)
          .catch(error => ({
            cnabId: boleto.id,
            barcode: boleto.barcode,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          }))
      );

      // Aguardar batch com controle de concorrência
      const batchResults = await this.limitConcurrency(batchPromises, maxConcurrent);

      // Consolidar resultados do batch
      batchResults.forEach(result => {
        results.verified++;

        if (result.success) {
          results.successful++;
          this.stats.successful++;
        } else {
          results.failed++;
          this.stats.failed++;
        }

        results.validations.push(result);
      });

      // Pequena pausa entre batches para não sobrecarregar a API
      if (i + batchSize < boletos.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  /**
   * Verificar boleto individual com Swap Financial API
   * @param {Object} boleto - Dados do boleto CNAB
   * @returns {Object} Resultado da verificação
   */
  async verifyBoletoWithSwap(boleto) {
    const barcode = boleto.barcode;

    try {
      // Verificar cache se habilitado
      if (this.config.enableCache && this.verificationCache.has(barcode)) {
        this.stats.cached++;
        metricsCollector.incrementCounter('swap.cache.hits');
        this.log('debug', 'Using cached verification result', { barcode: this.maskBarcode(barcode) });
        return {
          ...this.verificationCache.get(barcode),
          fromCache: true
        };
      }

      // Verificar com Swap Financial API
      this.stats.verified++;
      const swapData = await this.swapService.checkBoleto(barcode);

      // Mapear dados CNAB com dados Swap
      const mappedData = this.mapCNABToSwapData(boleto, swapData);

      const result = {
        cnabId: boleto.id,
        barcode,
        success: true,
        cnabData: boleto,
        swapData,
        mappedData,
        compatibility: this.analyzeBoletoCompatibility(boleto, swapData),
        timestamp: new Date().toISOString()
      };

      // Adicionar ao cache se habilitado
      if (this.config.enableCache) {
        this.verificationCache.set(barcode, result);
        this.updateCacheMetrics();
      }

      return result;

    } catch (error) {
      const result = {
        cnabId: boleto.id,
        barcode,
        success: false,
        cnabData: boleto,
        error: error.message,
        errorType: this.classifySwapError(error),
        timestamp: new Date().toISOString()
      };

      this.log('warn', 'Boleto verification failed', {
        barcode: this.maskBarcode(barcode),
        error: error.message
      });

      return result;
    }
  }

  /**
   * Filtrar boletos válidos para processamento
   * @param {Array} payments - Lista de pagamentos extraídos do CNAB
   * @returns {Array} Boletos válidos
   */
  filterValidBoletos(payments) {
    return payments.filter(payment => {
      // Deve ter código de barras
      if (!payment.barcode) {
        return false;
      }

      // Validar formato do código de barras
      if (!this.isValidBarcodeFormat(payment.barcode)) {
        return false;
      }

      // Incluir apenas tipos de pagamento compatíveis
      const compatibleTypes = ['boleto', 'utility_bill', 'tax', 'tributo', 'generic'];
      if (payment.type && !compatibleTypes.includes(payment.type)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Mapear dados CNAB com dados Swap
   * @param {Object} cnabData - Dados do boleto CNAB
   * @param {Object} swapData - Dados do boleto Swap
   * @returns {Object} Dados mapeados
   */
  mapCNABToSwapData(cnabData, swapData) {
    return {
      // Identificação
      cnabId: cnabData.id,
      swapId: swapData.id,
      barcode: cnabData.barcode,

      // Valores
      cnabValue: cnabData.value,
      swapValue: swapData.amountInReais,
      valueDifference: Math.abs((cnabData.value || 0) - (swapData.amountInReais || 0)),
      valuesMatch: Math.abs((cnabData.value || 0) - (swapData.amountInReais || 0)) < 0.01,

      // Datas
      cnabDueDate: cnabData.dueDate,
      swapDueDate: swapData.due_date,
      datesMatch: this.compareDates(cnabData.dueDate, swapData.due_date),

      // Status e pagabilidade
      cnabStatus: cnabData.status,
      swapStatus: swapData.status,
      canPayNow: swapData.canPayToday && swapData.isInPaymentWindow,
      paymentWindow: swapData.paymentWindow,

      // Beneficiário
      cnabBeneficiary: cnabData.beneficiary?.name,
      swapPayee: swapData.payee?.name,
      beneficiaryMatch: this.compareNames(cnabData.beneficiary?.name, swapData.payee?.name),

      // Metadados
      cnabMetadata: cnabData.metadata,
      swapMetadata: {
        type: swapData.type,
        environment: swapData.environment,
        hasDiscount: swapData.hasDiscount,
        hasFine: swapData.hasFine,
        hasInterest: swapData.hasInterest
      }
    };
  }

  /**
   * Analisar compatibilidade entre dados CNAB e Swap
   * @param {Object} cnabData - Dados CNAB
   * @param {Object} swapData - Dados Swap
   * @returns {Object} Análise de compatibilidade
   */
  analyzeBoletoCompatibility(cnabData, swapData) {
    const issues = [];
    const warnings = [];

    // Verificar diferenças de valor
    const valueDiff = Math.abs((cnabData.value || 0) - (swapData.amountInReais || 0));
    if (valueDiff > 0.01) {
      if (valueDiff > (cnabData.value || 0) * 0.1) {
        issues.push(`Significant value difference: CNAB=${cnabData.value}, Swap=${swapData.amountInReais}`);
      } else {
        warnings.push(`Minor value difference: CNAB=${cnabData.value}, Swap=${swapData.amountInReais}`);
      }
    }

    // Verificar datas
    if (!this.compareDates(cnabData.dueDate, swapData.due_date)) {
      issues.push(`Due date mismatch: CNAB=${cnabData.dueDate}, Swap=${swapData.due_date}`);
    }

    // Verificar se pode ser pago
    if (!swapData.canPayToday) {
      warnings.push('Cannot be paid today due to business hours restriction');
    }

    if (!swapData.isInPaymentWindow) {
      issues.push('Outside payment window - cannot be processed');
    }

    return {
      isCompatible: issues.length === 0,
      hasWarnings: warnings.length > 0,
      issues,
      warnings,
      score: this.calculateCompatibilityScore(issues, warnings)
    };
  }

  /**
   * Analisar compatibilidade geral do lote
   * @param {Array} cnabPayments - Pagamentos CNAB
   * @param {Array} swapValidations - Validações Swap
   * @returns {Object} Análise geral de compatibilidade
   */
  analyzeCompatibility(cnabPayments, swapValidations) {
    const total = swapValidations.length;
    const successful = swapValidations.filter(v => v.success).length;
    const compatible = swapValidations.filter(v =>
      v.success && v.compatibility?.isCompatible
    ).length;
    const payableNow = swapValidations.filter(v =>
      v.success && v.mappedData?.canPayNow
    ).length;

    return {
      summary: {
        total,
        successful,
        compatible,
        payableNow,
        successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
        compatibilityRate: successful > 0 ? (compatible / successful * 100).toFixed(2) + '%' : '0%',
        payabilityRate: successful > 0 ? (payableNow / successful * 100).toFixed(2) + '%' : '0%'
      },
      recommendations: this.generateRecommendations(swapValidations)
    };
  }

  /**
   * Gerar recomendações baseadas nos resultados
   * @param {Array} validations - Validações realizadas
   * @returns {Array} Lista de recomendações
   */
  generateRecommendations(validations) {
    const recommendations = [];

    const outsideWindow = validations.filter(v =>
      v.success && !v.mappedData?.canPayNow
    ).length;

    const valueIssues = validations.filter(v =>
      v.success && !v.mappedData?.valuesMatch
    ).length;

    const authErrors = validations.filter(v =>
      !v.success && v.errorType === 'authentication'
    ).length;

    if (outsideWindow > 0) {
      recommendations.push({
        type: 'scheduling',
        message: `${outsideWindow} boletos estão fora da janela de pagamento. Agende para processar durante horário comercial (07:00-23:00).`
      });
    }

    if (valueIssues > 0) {
      recommendations.push({
        type: 'validation',
        message: `${valueIssues} boletos têm divergências de valor. Verifique se os dados CNAB estão atualizados.`
      });
    }

    if (authErrors > 0) {
      recommendations.push({
        type: 'configuration',
        message: `${authErrors} falhas de autenticação. Verifique as credenciais da API Swap Financial.`
      });
    }

    return recommendations;
  }

  /**
   * Classificar tipo de erro Swap
   * @param {Error} error - Erro da API Swap
   * @returns {string} Tipo do erro
   */
  classifySwapError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('authentication') || message.includes('unauthorized')) {
      return 'authentication';
    }

    if (message.includes('business hours') || message.includes('payment window')) {
      return 'timing';
    }

    if (message.includes('already paid')) {
      return 'status';
    }

    if (message.includes('invalid barcode')) {
      return 'validation';
    }

    if (message.includes('service temporarily unavailable') || message.includes('circuit breaker')) {
      return 'service_unavailable';
    }

    return 'unknown';
  }

  /**
   * Validar formato do código de barras
   * @param {string} barcode - Código de barras
   * @returns {boolean} True se válido
   */
  isValidBarcodeFormat(barcode) {
    if (!barcode || typeof barcode !== 'string') {
      return false;
    }

    const cleaned = barcode.replace(/\D/g, '');
    return /^\d{47,48}$/.test(cleaned);
  }

  /**
   * Comparar datas
   * @param {Date|string} date1 - Primeira data
   * @param {Date|string} date2 - Segunda data
   * @returns {boolean} True se são iguais
   */
  compareDates(date1, date2) {
    if (!date1 || !date2) return false;

    const d1 = new Date(date1);
    const d2 = new Date(date2);

    return d1.getTime() === d2.getTime();
  }

  /**
   * Comparar nomes (beneficiário/pagador)
   * @param {string} name1 - Primeiro nome
   * @param {string} name2 - Segundo nome
   * @returns {boolean} True se são similares
   */
  compareNames(name1, name2) {
    if (!name1 || !name2) return false;

    const normalize = (str) => str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    return n1.includes(n2) || n2.includes(n1);
  }

  /**
   * Calcular score de compatibilidade
   * @param {Array} issues - Problemas encontrados
   * @param {Array} warnings - Avisos encontrados
   * @returns {number} Score de 0 a 100
   */
  calculateCompatibilityScore(issues, warnings) {
    let score = 100;
    score -= issues.length * 25;
    score -= warnings.length * 10;
    return Math.max(0, score);
  }

  /**
   * Mascarar código de barras para logs
   * @param {string} barcode - Código de barras
   * @returns {string} Código mascarado
   */
  maskBarcode(barcode) {
    if (!barcode || barcode.length < 10) return barcode;
    const start = barcode.substring(0, 5);
    const end = barcode.substring(barcode.length - 5);
    const middle = '*'.repeat(barcode.length - 10);
    return `${start}${middle}${end}`;
  }

  /**
   * Limitar concorrência de promises
   * @param {Array} promises - Array de promises
   * @param {number} limit - Limite de concorrência
   * @returns {Promise} Promise resolvida com todos os resultados
   */
  async limitConcurrency(promises, limit) {
    const results = [];

    for (let i = 0; i < promises.length; i += limit) {
      const batch = promises.slice(i, i + limit);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Helper para sleep
   * @param {number} ms - Milissegundos para aguardar
   * @returns {Promise} Promise resolvida após o tempo
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Método de logging
   * @param {string} level - Nível do log
   * @param {string} message - Mensagem
   * @param {Object} metadata - Metadados adicionais
   */
  log(level, message, metadata = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'CNABSwapOrchestrator',
      level,
      message,
      ...metadata
    };

    console.log(JSON.stringify(logData));
  }

  /**
   * Obter estatísticas de processamento
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.verificationCache.size,
      serviceStatus: this.swapService ? 'available' : 'unavailable'
    };
  }

  /**
   * Resetar estatísticas
   */
  resetStats() {
    this.stats = {
      processed: 0,
      verified: 0,
      successful: 0,
      failed: 0,
      cached: 0,
      errors: 0
    };
  }

  /**
   * Limpar cache de verificações
   */
  clearCache() {
    this.verificationCache.clear();
    this.updateCacheMetrics();
    this.log('info', 'Verification cache cleared');
  }

  /**
   * Health check do orquestrador
   * @returns {Object} Status de saúde
   */
  async healthCheck() {
    const health = {
      orchestrator: 'healthy',
      swapService: 'unknown',
      paymentExtractor: 'healthy',
      cache: {
        enabled: this.config.enableCache,
        size: this.verificationCache.size
      },
      stats: this.getStats()
    };

    // Verificar Swap service
    if (this.swapService) {
      try {
        const swapHealth = await this.swapService.healthCheck();
        health.swapService = swapHealth.status;
      } catch (error) {
        health.swapService = 'unhealthy';
        health.swapServiceError = error.message;
      }
    } else {
      health.swapService = 'not_initialized';
    }

    return health;
  }

  /**
   * Atualizar métricas de cache
   */
  updateCacheMetrics() {
    metricsCollector.setGauge('swap.cache.size', this.verificationCache.size);

    // Calcular hit rate baseado nas estatísticas
    const totalVerifications = this.stats.verified + this.stats.cached;
    const hitRate = totalVerifications > 0 ? (this.stats.cached / totalVerifications) * 100 : 0;
    metricsCollector.setGauge('swap.cache.hit_rate', hitRate);
  }

  /**
   * Decrementar contador de processos ativos
   */
  decrementActiveProcesses() {
    const current = metricsCollector.metrics.gauges['cnab.active_processes'] || 0;
    metricsCollector.setGauge('cnab.active_processes', Math.max(0, current - 1));
  }
}

export default CNABSwapOrchestrator; 