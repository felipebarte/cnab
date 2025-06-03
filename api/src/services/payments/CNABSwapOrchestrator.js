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
      swapValue: swapData.amount,
      valueDifference: Math.abs((cnabData.value || 0) - (swapData.amount || 0)),
      valuesMatch: Math.abs((cnabData.value || 0) - (swapData.amount || 0)) < 0.01,

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
    const valueDiff = Math.abs((cnabData.value || 0) - (swapData.amount || 0));
    if (valueDiff > 0.01) {
      if (valueDiff > (cnabData.value || 0) * 0.1) {
        issues.push(`Significant value difference: CNAB=${cnabData.value}, Swap=${swapData.amount}`);
      } else {
        warnings.push(`Minor value difference: CNAB=${cnabData.value}, Swap=${swapData.amount}`);
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

  /**
   * NOVO: Processar fluxo completo CNAB-Check-Pagamento
   * @param {string|Buffer} cnabContent - Conteúdo do arquivo CNAB
   * @param {Object} options - Opções de processamento
   * @returns {Object} Resultado do processamento completo
   */
  async processCompletePaymentFlow(cnabContent, options = {}) {
    const timer = new Timer('cnab.complete_flow.duration');
    metricsCollector.incrementCounter('cnab.complete_flow.attempts');

    const startTime = Date.now();
    const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.log('info', 'Starting complete CNAB-Check-Payment flow', { flowId });

      // Verificar se Swap service está disponível
      if (!this.swapService) {
        throw new Error('Swap Financial service is not available');
      }

      // 1. FASE: Extrair dados de pagamento do CNAB
      this.log('info', 'Phase 1: Extracting payment data from CNAB', { flowId });
      const cnabResult = await this.paymentExtractor.extractPaymentData(cnabContent, options);

      if (!cnabResult.success) {
        throw new Error(`CNAB extraction failed: ${cnabResult.error?.message}`);
      }

      // 2. FASE: Filtrar boletos válidos
      const validBoletos = this.filterValidBoletos(cnabResult.data.payments);
      this.log('info', `Phase 2: Filtered ${validBoletos.length} valid boletos`, { flowId });

      if (validBoletos.length === 0) {
        return {
          success: true,
          flowId,
          message: 'No valid boletos found for payment processing',
          phases: {
            extraction: { success: true, boletos: 0 },
            verification: { success: true, verified: 0 },
            payment: { success: true, processed: 0 }
          },
          processingTime: `${Date.now() - startTime}ms`
        };
      }

      // 3. FASE: Verificar boletos e preparar para pagamento
      this.log('info', 'Phase 3: Verifying boletos and preparing payment data', { flowId });
      const verificationResults = await this.verifyAndMapForPayment(validBoletos, options, flowId);

      // 4. FASE: Executar pagamentos
      this.log('info', 'Phase 4: Processing payments', { flowId });
      const paymentResults = await this.processPaymentBatch(verificationResults.payableboletos, options, flowId);

      // 5. CONSOLIDAR RESULTADOS
      const result = {
        success: true,
        flowId,
        data: {
          cnabSummary: cnabResult.summary,
          cnabMetadata: cnabResult.metadata,
          phases: {
            extraction: {
              success: true,
              totalRecords: cnabResult.summary.totalRecords,
              boletosFound: cnabResult.summary.paymentsFound,
              validBoletos: validBoletos.length
            },
            verification: verificationResults.summary,
            payment: paymentResults.summary
          },
          verificationDetails: verificationResults.details,
          paymentDetails: paymentResults.details,
          compatibility: this.analyzeCompatibility(cnabResult.data.payments, verificationResults.details)
        },
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };

      this.log('info', 'Complete flow finished successfully', {
        flowId,
        processed: paymentResults.summary.processed,
        successful: paymentResults.summary.successful
      });

      metricsCollector.incrementCounter('cnab.complete_flow.success');
      timer.end();

      return result;

    } catch (error) {
      this.log('error', 'Complete flow failed', { flowId, error: error.message });

      metricsCollector.incrementCounter('cnab.complete_flow.failures');
      timer.end();

      return {
        success: false,
        flowId,
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
   * NOVO: Verificar boletos e mapear dados para pagamento
   * @param {Array} boletos - Lista de boletos para verificar
   * @param {Object} options - Opções de verificação
   * @param {string} flowId - ID do fluxo para logs
   * @returns {Object} Resultados da verificação e mapeamento
   */
  async verifyAndMapForPayment(boletos, options = {}, flowId) {
    const results = {
      summary: {
        total: boletos.length,
        verified: 0,
        compatible: 0,
        payable: 0,
        failed: 0
      },
      details: [],
      payableboletos: []
    };

    const batchSize = options.batchSize || this.config.batchSize;
    const maxConcurrent = options.maxConcurrentRequests || this.config.maxConcurrentRequests;

    // Processar em lotes
    for (let i = 0; i < boletos.length; i += batchSize) {
      const batch = boletos.slice(i, i + batchSize);
      this.log('debug', `Processing verification batch ${Math.floor(i / batchSize) + 1}`, {
        flowId,
        batchSize: batch.length
      });

      // Processar lote com controle de concorrência
      const batchPromises = batch.map(boleto =>
        this.verifyAndMapSingleBoleto(boleto, flowId)
      );

      const batchResults = await this.limitConcurrency(batchPromises, maxConcurrent);

      // Consolidar resultados do lote
      for (const result of batchResults) {
        results.details.push(result);

        if (result.success) {
          results.summary.verified++;

          if (result.compatibility?.isCompatible) {
            results.summary.compatible++;

            if (result.paymentData) {
              results.summary.payable++;
              results.payableboletos.push(result);
            }
          }
        } else {
          results.summary.failed++;
        }
      }

      // Pequena pausa entre lotes para não sobrecarregar a API
      if (i + batchSize < boletos.length) {
        await this.sleep(100);
      }
    }

    this.log('info', 'Verification and mapping completed', {
      flowId,
      verified: results.summary.verified,
      payable: results.summary.payable
    });

    return results;
  }

  /**
   * NOVO: Verificar e mapear um único boleto para pagamento
   * @param {Object} boleto - Dados do boleto CNAB
   * @param {string} flowId - ID do fluxo para logs
   * @returns {Object} Resultado da verificação e mapeamento
   */
  async verifyAndMapSingleBoleto(boleto, flowId) {
    const barcode = boleto.barcode;

    try {
      // 1. Verificar boleto com Swap API (get ID and data)
      const swapData = await this.swapService.checkBoleto(barcode);

      // 2. Mapear dados CNAB com dados Swap
      const mappedData = this.mapCNABToSwapData(boleto, swapData);

      // 3. Analisar compatibilidade
      const compatibility = this.analyzeBoletoCompatibility(boleto, swapData);

      // 4. Preparar dados de pagamento se compatível
      let paymentData = null;
      if (compatibility.isCompatible && mappedData.canPayNow) {
        paymentData = this.preparePaymentData(boleto, swapData, mappedData);
      }

      const result = {
        cnabId: boleto.id,
        barcode,
        success: true,
        cnabData: boleto,
        swapData,
        mappedData,
        compatibility,
        paymentData,
        canPay: !!paymentData,
        timestamp: new Date().toISOString()
      };

      this.log('debug', 'Boleto verified and mapped successfully', {
        flowId,
        barcode: this.maskBarcode(barcode),
        canPay: !!paymentData
      });

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

      this.log('warn', 'Boleto verification failed during mapping', {
        flowId,
        barcode: this.maskBarcode(barcode),
        error: error.message
      });

      return result;
    }
  }

  /**
   * NOVO: Preparar dados de pagamento conforme API Swap Financial
   * @param {Object} cnabData - Dados do boleto CNAB
   * @param {Object} swapData - Dados do boleto Swap
   * @param {Object} mappedData - Dados mapeados
   * @returns {Object} Dados preparados para pagamento
   */
  preparePaymentData(cnabData, swapData, mappedData) {
    // Extrair document do CNAB ou usar fallback
    const payerDocument = cnabData.payer?.document ||
      cnabData.beneficiary?.document ||
      process.env.COMPANY_CNPJ || '';

    return {
      // Dados para API Swap Financial
      boletoId: swapData.id,
      amount: swapData.amount,  // Valor em centavos da Swap API
      document: payerDocument.replace(/[^\d]/g, ''), // Limpar formatação
      account_id: process.env.SWAP_ACCOUNT_ID || '',

      // Metadados para tracking
      cnabId: cnabData.id,
      barcode: cnabData.barcode,
      originalValue: cnabData.value,
      dueDate: swapData.due_date,

      // Dados para logs e auditoria
      paymentMethod: 'swap_financial',
      preparedAt: new Date().toISOString()
    };
  }

  /**
   * NOVO: Processar lote de pagamentos
   * @param {Array} payableboletos - Boletos preparados para pagamento
   * @param {Object} options - Opções de processamento
   * @param {string} flowId - ID do fluxo para logs
   * @returns {Object} Resultados dos pagamentos
   */
  async processPaymentBatch(payableboletos, options = {}, flowId) {
    const results = {
      summary: {
        total: payableboletos.length,
        processed: 0,
        successful: 0,
        failed: 0
      },
      details: []
    };

    if (payableboletos.length === 0) {
      this.log('info', 'No boletos available for payment processing', { flowId });
      return results;
    }

    const batchSize = options.paymentBatchSize || 5; // Menor para pagamentos
    const maxConcurrent = options.paymentMaxConcurrent || 2; // Menor para pagamentos

    // Processar pagamentos em lotes menores
    for (let i = 0; i < payableboletos.length; i += batchSize) {
      const batch = payableboletos.slice(i, i + batchSize);
      this.log('info', `Processing payment batch ${Math.floor(i / batchSize) + 1}`, {
        flowId,
        batchSize: batch.length
      });

      // Processar lote com controle de concorrência
      const batchPromises = batch.map(boletoData =>
        this.processSinglePayment(boletoData, flowId)
      );

      const batchResults = await this.limitConcurrency(batchPromises, maxConcurrent);

      // Consolidar resultados do lote
      for (const result of batchResults) {
        results.details.push(result);
        results.summary.processed++;

        if (result.success) {
          results.summary.successful++;
        } else {
          results.summary.failed++;
        }
      }

      // Pausa maior entre lotes de pagamento
      if (i + batchSize < payableboletos.length) {
        await this.sleep(500);
      }
    }

    this.log('info', 'Payment batch processing completed', {
      flowId,
      processed: results.summary.processed,
      successful: results.summary.successful
    });

    return results;
  }

  /**
   * NOVO: Processar um único pagamento
   * @param {Object} boletoData - Dados do boleto preparado para pagamento
   * @param {string} flowId - ID do fluxo para logs
   * @returns {Object} Resultado do pagamento
   */
  async processSinglePayment(boletoData, flowId) {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();

    try {
      this.log('info', 'Processing payment', {
        flowId,
        paymentId,
        boletoId: boletoData.paymentData.boletoId,
        amount: boletoData.paymentData.amount
      });

      // Validações pré-pagamento
      const validationResult = this.validatePrePayment(boletoData);
      if (!validationResult.valid) {
        throw new Error(`Pre-payment validation failed: ${validationResult.reasons.join(', ')}`);
      }

      // Executar pagamento via Swap Financial API
      const paymentResult = await this.swapService.payBoleto(
        boletoData.barcode,
        {
          document: boletoData.paymentData.document,
          // Pode adicionar outros dados do pagador se necessário
        }
      );

      const result = {
        paymentId,
        cnabId: boletoData.cnabId,
        boletoId: boletoData.paymentData.boletoId,
        barcode: boletoData.barcode,
        success: true,
        amount: boletoData.paymentData.amount,
        paymentData: boletoData.paymentData,
        swapResponse: paymentResult,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };

      this.log('info', 'Payment processed successfully', {
        flowId,
        paymentId,
        amount: boletoData.paymentData.amount,
        authenticationCode: paymentResult.authentication
      });

      // Métricas de sucesso
      metricsCollector.incrementCounter('swap.payments.successful');
      metricsCollector.incrementCounter('swap.payments.amount', boletoData.paymentData.amount);

      return result;

    } catch (error) {
      const result = {
        paymentId,
        cnabId: boletoData.cnabId,
        boletoId: boletoData.paymentData?.boletoId,
        barcode: boletoData.barcode,
        success: false,
        error: error.message,
        errorType: this.classifySwapError(error),
        paymentData: boletoData.paymentData,
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };

      this.log('error', 'Payment processing failed', {
        flowId,
        paymentId,
        barcode: this.maskBarcode(boletoData.barcode),
        error: error.message
      });

      // Métricas de falha
      metricsCollector.incrementCounter('swap.payments.failed');

      return result;
    }
  }

  /**
   * NOVO: Validar se boleto pode ser pago
   * @param {Object} boletoData - Dados do boleto para validação
   * @returns {Object} Resultado da validação
   */
  validatePrePayment(boletoData) {
    const reasons = [];

    // Verificar se tem ID do boleto
    if (!boletoData.paymentData?.boletoId) {
      reasons.push('Missing boleto ID');
    }

    // Verificar se tem valor
    if (!boletoData.paymentData?.amount || boletoData.paymentData.amount <= 0) {
      reasons.push('Invalid payment amount');
    }

    // Verificar se tem document
    if (!boletoData.paymentData?.document) {
      reasons.push('Missing payer document');
    }

    // Verificar se tem account_id
    if (!boletoData.paymentData?.account_id) {
      reasons.push('Missing account ID');
    }

    // Verificar compatibilidade
    if (!boletoData.compatibility?.isCompatible) {
      reasons.push('Boleto is not compatible for payment');
    }

    // Verificar se pode pagar agora
    if (!boletoData.mappedData?.canPayNow) {
      reasons.push('Boleto cannot be paid at this time');
    }

    // Verificar status do boleto
    if (boletoData.swapData?.status === 'paid') {
      reasons.push('Boleto is already paid');
    }

    return {
      valid: reasons.length === 0,
      reasons
    };
  }
}

export default CNABSwapOrchestrator; 