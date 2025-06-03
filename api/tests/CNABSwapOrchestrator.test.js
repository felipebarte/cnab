import { jest, expect, describe, test, beforeEach, afterEach } from '@jest/globals';
import CNABSwapOrchestrator from '../src/services/payments/CNABSwapOrchestrator.js';

// Mock dos módulos externos
jest.mock('../src/services/external/SwapFinancialService.js');
jest.mock('../src/services/payments/PaymentExtractorService.js');
jest.mock('../src/config/swapConfig.js');
jest.mock('../src/utils/metrics.js', () => ({
  Timer: jest.fn().mockImplementation(() => ({
    end: jest.fn()
  })),
  metricsCollector: {
    incrementCounter: jest.fn(),
    setGauge: jest.fn(),
    metrics: {
      gauges: {}
    }
  }
}));

import SwapFinancialService from '../src/services/external/SwapFinancialService.js';
import PaymentExtractorService from '../src/services/payments/PaymentExtractorService.js';
import { getSwapServiceConfig } from '../src/config/swapConfig.js';

describe('CNABSwapOrchestrator', () => {
  let orchestrator;
  let mockSwapService;
  let mockPaymentExtractor;

  beforeEach(() => {
    // Reset todos os mocks
    jest.clearAllMocks();

    // Mock da configuração Swap
    getSwapServiceConfig.mockReturnValue({
      environment: 'staging',
      clientId: 'test_client',
      clientSecret: 'test_secret',
      apiKey: 'test_api_key',
      baseURL: 'https://api-stag.contaswap.io'
    });

    // Mock do SwapFinancialService
    mockSwapService = {
      checkBoleto: jest.fn(),
      healthCheck: jest.fn(),
      getAccessToken: jest.fn(),
      clearTokenCache: jest.fn(),
      circuitBreakerState: 'closed',
      isTokenValid: jest.fn().mockReturnValue(true),
      environment: 'staging'
    };
    SwapFinancialService.mockImplementation(() => mockSwapService);

    // Mock do PaymentExtractorService
    mockPaymentExtractor = {
      extractPaymentData: jest.fn()
    };
    PaymentExtractorService.mockImplementation(() => mockPaymentExtractor);

    // Criar instância do orquestrador
    orchestrator = new CNABSwapOrchestrator({
      batchSize: 5,
      maxConcurrentRequests: 3,
      enableCache: true,
      validateAll: true
    });
  });

  afterEach(() => {
    if (orchestrator.clearCache) {
      orchestrator.clearCache();
    }
  });

  describe('Constructor', () => {
    test('deve inicializar com configuração padrão', () => {
      const defaultOrchestrator = new CNABSwapOrchestrator();

      expect(defaultOrchestrator.config.validateAll).toBe(true);
      expect(defaultOrchestrator.config.batchSize).toBe(10);
      expect(defaultOrchestrator.config.enableCache).toBe(true);
      expect(defaultOrchestrator.verificationCache).toBeDefined();
      expect(defaultOrchestrator.stats).toBeDefined();
    });

    test('deve aceitar configuração personalizada', () => {
      const customConfig = {
        batchSize: 20,
        maxConcurrentRequests: 10,
        enableCache: false,
        validateAll: false
      };

      const customOrchestrator = new CNABSwapOrchestrator(customConfig);

      expect(customOrchestrator.config.batchSize).toBe(20);
      expect(customOrchestrator.config.maxConcurrentRequests).toBe(10);
      expect(customOrchestrator.config.enableCache).toBe(false);
      expect(customOrchestrator.config.validateAll).toBe(false);
    });

    test('deve inicializar serviços corretamente', () => {
      expect(SwapFinancialService).toHaveBeenCalled();
      expect(PaymentExtractorService).toHaveBeenCalled();
    });

    test('deve configurar estatísticas iniciais', () => {
      expect(orchestrator.stats.totalProcessed).toBe(0);
      expect(orchestrator.stats.totalValidated).toBe(0);
      expect(orchestrator.stats.totalErrors).toBe(0);
      expect(orchestrator.stats.successRate).toBe(0);
    });
  });

  describe('processCNABFile', () => {
    const mockCnabContent = 'mock cnab file content';

    test('deve processar arquivo CNAB com sucesso', async () => {
      // Mock de extração CNAB bem-sucedida
      const mockCnabResult = {
        success: true,
        data: {
          payments: [
            {
              id: '1',
              barcode: '12345678901234567890123456789012345678901234567',
              amount: 100.00,
              dueDate: '2024-12-31',
              payee: 'Empresa Test LTDA'
            },
            {
              id: '2',
              barcode: '23456789012345678901234567890123456789012345678',
              amount: 200.00,
              dueDate: '2024-12-31',
              payee: 'Outra Empresa LTDA'
            }
          ]
        },
        summary: {
          totalRecords: 5,
          paymentsFound: 2,
          processed: true
        },
        metadata: {
          fileName: 'test.cnab',
          processedAt: new Date().toISOString(),
          fileSize: 1024
        }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);

      // Mock de verificação Swap bem-sucedida
      const mockSwapResponse = {
        id: 'bol_123',
        amount: 100.00,
        due_date: '2024-12-31',
        status: 'PENDING',
        canPayToday: true,
        isInPaymentWindow: true,
        environment: 'staging'
      };

      mockSwapService.checkBoleto.mockResolvedValue(mockSwapResponse);

      const result = await orchestrator.processCNABFile(mockCnabContent, {
        validateWithSwap: true
      });

      expect(result.success).toBe(true);
      expect(result.data.cnabSummary).toEqual(mockCnabResult.summary);
      expect(result.data.swapResults).toBeDefined();
      expect(result.data.swapResults.total).toBe(2);
      expect(result.data.swapResults.success).toBe(2);
      expect(result.data.swapResults.failed).toBe(0);

      expect(mockPaymentExtractor.extractPaymentData).toHaveBeenCalledWith(mockCnabContent, {
        validateWithSwap: true
      });
      expect(mockSwapService.checkBoleto).toHaveBeenCalledTimes(2);
    });

    test('deve processar arquivo com alguns boletos inválidos', async () => {
      const mockCnabResult = {
        success: true,
        data: {
          payments: [
            {
              id: '1',
              barcode: '12345678901234567890123456789012345678901234567',
              amount: 100.00,
              dueDate: '2024-12-31'
            },
            {
              id: '2',
              barcode: '23456789012345678901234567890123456789012345678',
              amount: 200.00,
              dueDate: '2024-12-31'
            }
          ]
        },
        summary: {
          totalRecords: 5,
          paymentsFound: 2
        }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);

      // Mock: primeiro boleto sucesso, segundo falha
      mockSwapService.checkBoleto
        .mockResolvedValueOnce({
          id: 'bol_123',
          amount: 100.00,
          status: 'PENDING'
        })
        .mockRejectedValueOnce(new Error('Boleto not found'));

      const result = await orchestrator.processCNABFile(mockCnabContent);

      expect(result.success).toBe(true);
      expect(result.data.swapResults.total).toBe(2);
      expect(result.data.swapResults.success).toBe(1);
      expect(result.data.swapResults.failed).toBe(1);
      expect(result.data.swapResults.results).toHaveLength(2);
      expect(result.data.swapResults.results[0].success).toBe(true);
      expect(result.data.swapResults.results[1].success).toBe(false);
    });

    test('deve falhar quando extração CNAB falha', async () => {
      const mockCnabResult = {
        success: false,
        error: {
          message: 'Invalid CNAB format',
          code: 'CNAB_PARSE_ERROR'
        }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);

      const result = await orchestrator.processCNABFile(mockCnabContent);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('CNAB extraction failed');
      expect(result.error.details).toEqual(mockCnabResult.error);
      expect(mockSwapService.checkBoleto).not.toHaveBeenCalled();
    });

    test('deve processar arquivo sem boletos válidos', async () => {
      const mockCnabResult = {
        success: true,
        data: {
          payments: [] // Nenhum boleto
        },
        summary: {
          totalRecords: 5,
          paymentsFound: 0
        }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);

      const result = await orchestrator.processCNABFile(mockCnabContent);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No valid boletos found');
      expect(result.data.swapResults.total).toBe(0);
      expect(mockSwapService.checkBoleto).not.toHaveBeenCalled();
    });

    test('deve processar em lotes quando muitos boletos', async () => {
      // Criar muitos boletos para testar processamento em lotes
      const manyPayments = Array.from({ length: 25 }, (_, i) => ({
        id: `${i + 1}`,
        barcode: `1234567890123456789012345678901234567890123456${i.toString().padStart(1, '0')}`,
        amount: (i + 1) * 100,
        dueDate: '2024-12-31'
      }));

      const mockCnabResult = {
        success: true,
        data: {
          payments: manyPayments
        },
        summary: {
          totalRecords: 30,
          paymentsFound: 25
        }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);
      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'bol_test',
        amount: 100,
        status: 'PENDING'
      });

      const result = await orchestrator.processCNABFile(mockCnabContent);

      expect(result.success).toBe(true);
      expect(result.data.swapResults.total).toBe(25);
      expect(mockSwapService.checkBoleto).toHaveBeenCalledTimes(25);

      // Verificar se processamento foi dividido em lotes
      expect(result.data.processingInfo.batchesProcessed).toBeGreaterThan(1);
    });
  });

  describe('verifyBoletoWithSwap', () => {
    test('deve verificar boleto individual com sucesso', async () => {
      const testPayment = {
        id: '1',
        barcode: '12345678901234567890123456789012345678901234567',
        amount: 100.00,
        dueDate: '2024-12-31'
      };

      const mockSwapResponse = {
        id: 'bol_123',
        amount: 100.00,
        due_date: '2024-12-31',
        status: 'PENDING',
        canPayToday: true,
        isInPaymentWindow: true
      };

      mockSwapService.checkBoleto.mockResolvedValue(mockSwapResponse);

      const result = await orchestrator.verifyBoletoWithSwap(testPayment);

      expect(result.success).toBe(true);
      expect(result.cnabData).toEqual(testPayment);
      expect(result.swapData).toEqual(mockSwapResponse);
      expect(result.fromCache).toBe(false);
      expect(mockSwapService.checkBoleto).toHaveBeenCalledWith(testPayment.barcode);
    });

    test('deve usar cache quando disponível', async () => {
      const testPayment = {
        id: '1',
        barcode: '12345678901234567890123456789012345678901234567',
        amount: 100.00
      };

      // Adicionar ao cache
      orchestrator.verificationCache.set(testPayment.barcode, {
        data: { id: 'cached_bol', amount: 100 },
        timestamp: Date.now()
      });

      const result = await orchestrator.verifyBoletoWithSwap(testPayment);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.swapData.id).toBe('cached_bol');
      expect(mockSwapService.checkBoleto).not.toHaveBeenCalled();
    });

    test('deve falhar graciosamente com erro da API Swap', async () => {
      const testPayment = {
        id: '1',
        barcode: '12345678901234567890123456789012345678901234567',
        amount: 100.00
      };

      const swapError = new Error('Boleto not found');
      swapError.response = { status: 404 };
      mockSwapService.checkBoleto.mockRejectedValue(swapError);

      const result = await orchestrator.verifyBoletoWithSwap(testPayment);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Boleto not found');
      expect(result.cnabData).toEqual(testPayment);
    });

    test('deve invalidar cache expirado', async () => {
      const testPayment = {
        id: '1',
        barcode: '12345678901234567890123456789012345678901234567',
        amount: 100.00
      };

      // Adicionar entrada expirada ao cache
      const expiredTimestamp = Date.now() - (orchestrator.config.cacheTimeout + 1000);
      orchestrator.verificationCache.set(testPayment.barcode, {
        data: { id: 'expired_bol' },
        timestamp: expiredTimestamp
      });

      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'fresh_bol',
        amount: 100
      });

      const result = await orchestrator.verifyBoletoWithSwap(testPayment);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.swapData.id).toBe('fresh_bol');
      expect(mockSwapService.checkBoleto).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    test('deve retornar status healthy quando todos os serviços estão funcionando', async () => {
      mockSwapService.healthCheck.mockResolvedValue({
        status: 'healthy',
        circuitBreaker: 'closed',
        tokenValid: true
      });

      const health = await orchestrator.healthCheck();

      expect(health.orchestrator).toBe('healthy');
      expect(health.swapService).toBeDefined();
      expect(health.paymentExtractor).toBe('healthy');
      expect(health.cache).toBeDefined();
      expect(health.stats).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    test('deve detectar problemas no serviço Swap', async () => {
      mockSwapService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        circuitBreaker: 'open',
        tokenValid: false
      });

      const health = await orchestrator.healthCheck();

      expect(health.swapService.status).toBe('unhealthy');
      expect(health.swapService.circuitBreaker).toBe('open');
    });

    test('deve lidar com falha no health check do Swap', async () => {
      mockSwapService.healthCheck.mockRejectedValue(new Error('Service unavailable'));

      const health = await orchestrator.healthCheck();

      expect(health.swapService.status).toBe('error');
      expect(health.swapService.error).toBe('Service unavailable');
    });
  });

  describe('Cache Management', () => {
    test('deve gerenciar cache corretamente', () => {
      const testKey = 'test_barcode';
      const testData = { id: 'bol_123', amount: 100 };

      // Adicionar ao cache
      orchestrator.verificationCache.set(testKey, {
        data: testData,
        timestamp: Date.now()
      });

      expect(orchestrator.verificationCache.size).toBe(1);
      expect(orchestrator.verificationCache.has(testKey)).toBe(true);

      // Limpar cache
      orchestrator.clearCache();
      expect(orchestrator.verificationCache.size).toBe(0);
    });

    test('deve configurar cache com diferentes configurações', () => {
      const orchestratorWithoutCache = new CNABSwapOrchestrator({
        enableCache: false
      });

      expect(orchestratorWithoutCache.config.enableCache).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('deve atualizar estatísticas durante processamento', async () => {
      const mockCnabResult = {
        success: true,
        data: {
          payments: [
            {
              id: '1',
              barcode: '12345678901234567890123456789012345678901234567',
              amount: 100.00
            }
          ]
        },
        summary: { totalRecords: 1, paymentsFound: 1 }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);
      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'bol_123',
        status: 'PENDING'
      });

      await orchestrator.processCNABFile('test content');

      expect(orchestrator.stats.totalProcessed).toBeGreaterThan(0);
      expect(orchestrator.stats.totalValidated).toBeGreaterThan(0);
      expect(orchestrator.stats.successRate).toBeGreaterThan(0);
    });

    test('deve fornecer métricas de performance', async () => {
      const stats = orchestrator.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(stats.totalProcessed).toBeDefined();
      expect(stats.totalValidated).toBeDefined();
      expect(stats.totalErrors).toBeDefined();
      expect(stats.successRate).toBeDefined();
      expect(stats.averageResponseTime).toBeDefined();
      expect(stats.cacheHitRate).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    test('deve validar configuração no constructor', () => {
      expect(() => {
        new CNABSwapOrchestrator({
          batchSize: -1 // Valor inválido
        });
      }).toThrow();
    });

    test('deve usar valores padrão seguros', () => {
      const defaultOrchestrator = new CNABSwapOrchestrator();

      expect(defaultOrchestrator.config.batchSize).toBeGreaterThan(0);
      expect(defaultOrchestrator.config.maxConcurrentRequests).toBeGreaterThan(0);
      expect(defaultOrchestrator.config.timeout).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('deve lidar com erros de rede graciosamente', async () => {
      const networkError = new Error('Network timeout');
      networkError.code = 'NETWORK_ERROR';

      mockPaymentExtractor.extractPaymentData.mockRejectedValue(networkError);

      const result = await orchestrator.processCNABFile('test content');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NETWORK_ERROR');
    });

    test('deve continuar processamento mesmo com falhas individuais', async () => {
      const mockCnabResult = {
        success: true,
        data: {
          payments: [
            { id: '1', barcode: '12345678901234567890123456789012345678901234567' },
            { id: '2', barcode: '23456789012345678901234567890123456789012345678' },
            { id: '3', barcode: '34567890123456789012345678901234567890123456789' }
          ]
        },
        summary: { totalRecords: 3, paymentsFound: 3 }
      };

      mockPaymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);

      // Mock: sucesso, falha, sucesso
      mockSwapService.checkBoleto
        .mockResolvedValueOnce({ id: 'bol_1', status: 'PENDING' })
        .mockRejectedValueOnce(new Error('Service error'))
        .mockResolvedValueOnce({ id: 'bol_3', status: 'PENDING' });

      const result = await orchestrator.processCNABFile('test content');

      expect(result.success).toBe(true);
      expect(result.data.swapResults.success).toBe(2);
      expect(result.data.swapResults.failed).toBe(1);
    });
  });

  // NOVOS TESTES PARA FLUXO COMPLETO
  describe('processCompletePaymentFlow', () => {
    beforeEach(() => {
      // Mock dos serviços para o fluxo completo
      orchestrator.swapService = {
        checkBoleto: jest.fn(),
        payBoleto: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue({ status: 'ok' })
      };

      orchestrator.paymentExtractor = {
        extractPaymentData: jest.fn()
      };
    });

    test('deve executar fluxo completo com sucesso', async () => {
      // Mock CNAB extraction
      const mockCnabResult = {
        success: true,
        summary: { totalRecords: 10, paymentsFound: 3 },
        metadata: { sourceFormat: 'CNAB240', confidence: 0.95 },
        data: {
          payments: [
            {
              id: 'cnab_1',
              barcode: '12345678901234567890123456789012345678901234567',
              value: 100.50,
              dueDate: '2024-12-31',
              type: 'boleto',
              payer: { document: '12345678000190' }
            }
          ]
        }
      };

      // Mock check boleto response
      const mockSwapData = {
        id: 'bol_123456789',
        amount: 10050, // valor em centavos
        due_date: '2024-12-31',
        status: 'pending',
        canPayToday: true,
        isInPaymentWindow: true
      };

      // Mock payment response
      const mockPaymentResult = {
        id: 'pay_987654321',
        amount: 10050,
        authentication: '5100',
        authentication_api: {
          Bloco1: 'B7.42.0B.AC.98.E2.2A.D7',
          Bloco2: '36.B4.93.6F.60.30.44.75'
        },
        status: 'paid',
        receipt: 'PROTOCOLO 0006363616...'
      };

      // Setup mocks
      orchestrator.paymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);
      orchestrator.swapService.checkBoleto.mockResolvedValue(mockSwapData);
      orchestrator.swapService.payBoleto.mockResolvedValue(mockPaymentResult);

      // Executar fluxo completo
      const result = await orchestrator.processCompletePaymentFlow('cnab content');

      // Verificações
      expect(result.success).toBe(true);
      expect(result.flowId).toBeDefined();
      expect(result.data.phases.extraction.success).toBe(true);
      expect(result.data.phases.verification.verified).toBe(1);
      expect(result.data.phases.payment.successful).toBe(1);

      // Verificar chamadas
      expect(orchestrator.paymentExtractor.extractPaymentData).toHaveBeenCalledWith('cnab content', {});
      expect(orchestrator.swapService.checkBoleto).toHaveBeenCalledWith(mockCnabResult.data.payments[0].barcode);
      expect(orchestrator.swapService.payBoleto).toHaveBeenCalledWith(
        mockCnabResult.data.payments[0].barcode,
        { document: '12345678000190' }
      );
    });

    test('deve lidar com boletos não compatíveis', async () => {
      const mockCnabResult = {
        success: true,
        summary: { totalRecords: 5, paymentsFound: 2 },
        metadata: { sourceFormat: 'CNAB240' },
        data: {
          payments: [
            {
              id: 'cnab_1',
              barcode: '12345678901234567890123456789012345678901234567',
              value: 100.00,
              dueDate: '2024-12-31',
              type: 'boleto'
            }
          ]
        }
      };

      const mockSwapData = {
        id: 'bol_123456789',
        amount: 15000, // Valor muito diferente
        due_date: '2024-11-30', // Data diferente
        status: 'pending',
        canPayToday: false, // Não pode pagar
        isInPaymentWindow: false
      };

      orchestrator.paymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);
      orchestrator.swapService.checkBoleto.mockResolvedValue(mockSwapData);

      const result = await orchestrator.processCompletePaymentFlow('cnab content');

      expect(result.success).toBe(true);
      expect(result.data.phases.verification.verified).toBe(1);
      expect(result.data.phases.verification.compatible).toBe(0);
      expect(result.data.phases.payment.processed).toBe(0);

      // Não deve chamar payBoleto para boletos incompatíveis
      expect(orchestrator.swapService.payBoleto).not.toHaveBeenCalled();
    });

    test('deve processar lotes grandes com controle de concorrência', async () => {
      const mockPayments = Array.from({ length: 15 }, (_, i) => ({
        id: `cnab_${i + 1}`,
        barcode: `1234567890123456789012345678901234567890123456${i.toString().padStart(1, '0')}`,
        value: 100 + i,
        dueDate: '2024-12-31',
        type: 'boleto',
        payer: { document: `1234567800019${i}` }
      }));

      const mockCnabResult = {
        success: true,
        summary: { totalRecords: 20, paymentsFound: 15 },
        metadata: { sourceFormat: 'CNAB240' },
        data: { payments: mockPayments }
      };

      const mockSwapData = {
        id: 'bol_123456789',
        amount: 10000,
        due_date: '2024-12-31',
        status: 'pending',
        canPayToday: true,
        isInPaymentWindow: true
      };

      const mockPaymentResult = {
        id: 'pay_987654321',
        amount: 10000,
        authentication: '5100',
        status: 'paid'
      };

      orchestrator.paymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);
      orchestrator.swapService.checkBoleto.mockResolvedValue(mockSwapData);
      orchestrator.swapService.payBoleto.mockResolvedValue(mockPaymentResult);

      const result = await orchestrator.processCompletePaymentFlow('cnab content', {
        batchSize: 5,
        maxConcurrentRequests: 3
      });

      expect(result.success).toBe(true);
      expect(result.data.phases.verification.verified).toBe(15);
      expect(result.data.phases.payment.successful).toBe(15);

      // Verificar se chamou checkBoleto para todos
      expect(orchestrator.swapService.checkBoleto).toHaveBeenCalledTimes(15);
      expect(orchestrator.swapService.payBoleto).toHaveBeenCalledTimes(15);
    });

    test('deve lidar com erros durante verificação', async () => {
      const mockCnabResult = {
        success: true,
        summary: { totalRecords: 5, paymentsFound: 2 },
        metadata: { sourceFormat: 'CNAB240' },
        data: {
          payments: [
            {
              id: 'cnab_1',
              barcode: '12345678901234567890123456789012345678901234567',
              value: 100.00,
              type: 'boleto'
            }
          ]
        }
      };

      orchestrator.paymentExtractor.extractPaymentData.mockResolvedValue(mockCnabResult);
      orchestrator.swapService.checkBoleto.mockRejectedValue(new Error('Boleto not found'));

      const result = await orchestrator.processCompletePaymentFlow('cnab content');

      expect(result.success).toBe(true);
      expect(result.data.phases.verification.failed).toBe(1);
      expect(result.data.phases.payment.processed).toBe(0);
    });

    test('deve validar dados antes do pagamento', async () => {
      const mockBoletoData = {
        cnabId: 'cnab_1',
        barcode: '12345678901234567890123456789012345678901234567',
        swapData: { id: 'bol_123', status: 'pending' },
        compatibility: { isCompatible: true },
        mappedData: { canPayNow: true },
        paymentData: {
          boletoId: 'bol_123',
          amount: 10000,
          document: '12345678000190',
          account_id: 'acc_123'
        }
      };

      const validation = orchestrator.validatePrePayment(mockBoletoData);
      expect(validation.valid).toBe(true);
      expect(validation.reasons).toHaveLength(0);
    });

    test('deve rejeitar boletos com dados inválidos', async () => {
      const mockBoletoData = {
        cnabId: 'cnab_1',
        barcode: '12345678901234567890123456789012345678901234567',
        swapData: { id: 'bol_123', status: 'paid' }, // Já pago
        compatibility: { isCompatible: false }, // Não compatível
        mappedData: { canPayNow: false }, // Não pode pagar agora
        paymentData: {
          boletoId: '',  // ID vazio
          amount: 0,     // Valor inválido
          document: '',  // Document vazio
          account_id: '' // Account ID vazio
        }
      };

      const validation = orchestrator.validatePrePayment(mockBoletoData);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain('Missing boleto ID');
      expect(validation.reasons).toContain('Invalid payment amount');
      expect(validation.reasons).toContain('Missing payer document');
      expect(validation.reasons).toContain('Missing account ID');
      expect(validation.reasons).toContain('Boleto is not compatible for payment');
      expect(validation.reasons).toContain('Boleto cannot be paid at this time');
      expect(validation.reasons).toContain('Boleto is already paid');
    });

    test('deve preparar dados de pagamento corretamente', async () => {
      const mockCnabData = {
        id: 'cnab_1',
        barcode: '12345678901234567890123456789012345678901234567',
        value: 100.50,
        payer: { document: '12.345.678/0001-90' }
      };

      const mockSwapData = {
        id: 'bol_123456789',
        amount: 10050,
        due_date: '2024-12-31'
      };

      const mockMappedData = {
        canPayNow: true
      };

      // Mock environment variable
      process.env.SWAP_ACCOUNT_ID = 'acc_test_123';

      const paymentData = orchestrator.preparePaymentData(mockCnabData, mockSwapData, mockMappedData);

      expect(paymentData).toEqual({
        boletoId: 'bol_123456789',
        amount: 10050,
        document: '12345678000190', // Limpo
        account_id: 'acc_test_123',
        cnabId: 'cnab_1',
        barcode: '12345678901234567890123456789012345678901234567',
        originalValue: 100.50,
        dueDate: '2024-12-31',
        paymentMethod: 'swap_financial',
        preparedAt: expect.any(String)
      });

      // Cleanup
      delete process.env.SWAP_ACCOUNT_ID;
    });
  });

  describe('verifyAndMapForPayment', () => {
    // Implemente os testes para a nova função verifyAndMapForPayment
  });
}); 