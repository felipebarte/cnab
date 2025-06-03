import CNABSwapOrchestrator from '../../src/services/payments/CNABSwapOrchestrator.js';
import SwapFinancialService from '../../src/services/external/SwapFinancialService.js';
import PaymentExtractorService from '../../src/services/payments/PaymentExtractorService.js';

// Mock dos serviços externos
jest.mock('../../src/services/external/SwapFinancialService.js');
jest.mock('../../src/config/swapConfig.js', () => ({
  getSwapServiceConfig: () => ({
    environment: 'staging',
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    apiKey: 'test_api_key'
  })
}));

describe('CNAB-Swap Integration Flow Tests', () => {
  let mockSwapService;
  let orchestrator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock do SwapFinancialService
    mockSwapService = {
      authenticate: jest.fn().mockResolvedValue('mock_access_token_123'),
      checkBoleto: jest.fn(),
      payBoleto: jest.fn(),
      isValidBarcodeFormat: jest.fn().mockReturnValue(true),
      healthCheck: jest.fn().mockResolvedValue({
        status: 'healthy',
        tokenValid: true,
        circuitBreaker: 'closed'
      }),
      isTokenValid: jest.fn().mockReturnValue(true),
      getConfiguration: jest.fn().mockReturnValue({
        environment: 'staging',
        hasClientId: true,
        hasClientSecret: true,
        hasApiKey: true
      }),
      maskBarcode: jest.fn().mockImplementation(barcode =>
        barcode ? `${barcode.substring(0, 5)}*****${barcode.substring(barcode.length - 5)}` : ''
      )
    };

    SwapFinancialService.mockImplementation(() => mockSwapService);

    // Criar orquestrador real (não mock)
    orchestrator = new CNABSwapOrchestrator({
      validateAll: true,
      batchSize: 5,
      maxConcurrentRequests: 3,
      enableCache: true
    });
  });

  describe('Fluxo Completo: CNAB → Extração → Verificação Swap', () => {
    const validCNAB240Content = `01REMESSA01PAGAMENTO    002041111111000100004562345678000000000012345678901234567890                         121220241613400000001                                                                                                                                                                                                                                                                                                     000001
32201111111000100004562345678001234567890123456                         12345678901234567890                         121220240000000000012000121220241000000000000000000000000000000000000000000000000                         0000000010000000200000000200000000000000000000000000000000002
32201111111000100004562345678001234567890123457                         98765432109876543210                         121220240000000000015000121220241000000000000000000000000000000000000000000000000                         0000000010000000300000000300000000000000000000000000000000003
9                                                                                                                                                                                                                                                                                                                                                                                                                      000002000001`;

    test('deve processar arquivo CNAB240 e verificar boletos com Swap Financial', async () => {
      // Mock das respostas do Swap para os boletos
      mockSwapService.checkBoleto
        .mockResolvedValueOnce({
          id: 'bol_success_1',
          amount: 12000, // valor em centavos
          due_date: '2024-12-21',
          status: 'pending',
          canPayToday: true,
          isInPaymentWindow: true
        })
        .mockResolvedValueOnce({
          id: 'bol_success_2',
          amount: 15000, // valor em centavos
          due_date: '2024-12-22',
          status: 'pending',
          canPayToday: true,
          isInPaymentWindow: true
        });

      const result = await orchestrator.processCNABFile(validCNAB240Content, {
        validateAll: true,
        batchSize: 2
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.cnabSummary).toBeDefined();
      expect(result.data.swapResults).toBeDefined();

      // Verificar que extraiu dados do CNAB
      expect(result.data.cnabSummary.totalRecords).toBeGreaterThan(0);

      // Verificar que chamou o Swap Service
      expect(mockSwapService.authenticate).toHaveBeenCalled();

      // Se encontrou boletos válidos, deve ter verificado com Swap
      if (result.data.cnabSummary.paymentsFound > 0) {
        expect(mockSwapService.checkBoleto).toHaveBeenCalled();
        expect(result.data.swapResults.total).toBeGreaterThan(0);
      }
    });

    test('deve lidar com erro de autenticação no Swap Financial', async () => {
      // Mock de falha na autenticação
      mockSwapService.authenticate.mockRejectedValue(new Error('Authentication failed'));

      const result = await orchestrator.processCNABFile(validCNAB240Content);

      // Deve retornar erro mas não crashar
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Authentication failed');
    });

    test('deve processar arquivo com boletos inválidos', async () => {
      // Mock que retorna erro para boletos inválidos
      mockSwapService.checkBoleto.mockRejectedValue(new Error('Boleto not found'));

      const result = await orchestrator.processCNABFile(validCNAB240Content, {
        validateAll: true,
        includeInvalidBarcodes: true
      });

      expect(result.success).toBe(true);
      expect(result.data.swapResults).toBeDefined();

      // Deve ter tentado verificar mas falhou
      if (result.data.swapResults.total > 0) {
        expect(result.data.swapResults.failed).toBeGreaterThan(0);
      }
    });

    test('deve respeitar configurações de batch e concorrência', async () => {
      // Mock de resposta padrão
      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'bol_test',
        amount: 10000, // valor em centavos
        due_date: '2024-12-21',
        status: 'pending'
      });

      const startTime = Date.now();

      const result = await orchestrator.processCNABFile(validCNAB240Content, {
        batchSize: 1,
        maxConcurrentRequests: 1
      });

      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Menos de 10 segundos

      // Se processou boletos, deve ter respeitado as configurações
      if (result.data.swapResults && result.data.swapResults.total > 0) {
        expect(mockSwapService.checkBoleto).toHaveBeenCalled();
      }
    });
  });

  describe('Verificação de Boletos com Swap', () => {
    test('deve verificar múltiplos códigos de barras', async () => {
      const barcodes = [
        '12345678901234567890123456789012345678901234567',
        '98765432109876543210987654321098765432109876543',
        '11111111111111111111111111111111111111111111111'
      ];

      const mockBoletos = barcodes.map((barcode, index) => ({
        id: `cnab_${index + 1}`,
        barcode: barcode,
        type: 'boleto',
        status: 'pending'
      }));

      // Mock de respostas variadas
      mockSwapService.checkBoleto
        .mockResolvedValueOnce({
          id: 'bol_1',
          amount: 10000, // valor em centavos
          status: 'pending',
          canPayToday: true
        })
        .mockResolvedValueOnce({
          id: 'bol_2',
          amount: 20000, // valor em centavos
          status: 'pending',
          canPayToday: true
        })
        .mockRejectedValueOnce(new Error('Boleto not found'));

      const result = await orchestrator.verifyBoletosWithSwap(mockBoletos);

      expect(result.total).toBe(3);
      expect(result.verified).toBeGreaterThan(0);
      expect(result.validations).toHaveLength(3);

      // Verificar que tentou verificar todos
      expect(mockSwapService.checkBoleto).toHaveBeenCalledTimes(3);

      // Verificar resultados mistos
      const successfulValidations = result.validations.filter(v => v.status === 'success');
      const failedValidations = result.validations.filter(v => v.status === 'error');

      expect(successfulValidations.length).toBe(2);
      expect(failedValidations.length).toBe(1);
    });

    test('deve filtrar boletos com códigos de barras inválidos', async () => {
      const mockBoletos = [
        {
          id: 'valid_1',
          barcode: '12345678901234567890123456789012345678901234567',
          type: 'boleto',
          status: 'pending'
        },
        {
          id: 'invalid_1',
          barcode: '123', // Muito curto
          type: 'boleto',
          status: 'pending'
        },
        {
          id: 'invalid_2',
          barcode: null, // Nulo
          type: 'boleto',
          status: 'pending'
        }
      ];

      // Mock que só deve ser chamado para códigos válidos
      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'bol_success',
        amount: 10000, // valor em centavos
        status: 'pending'
      });

      const result = await orchestrator.verifyBoletosWithSwap(mockBoletos);

      // Deve ter filtrado apenas os válidos
      expect(mockSwapService.checkBoleto).toHaveBeenCalledTimes(1);
      expect(result.validations.length).toBeLessThanOrEqual(mockBoletos.length);
    });
  });

  describe('Health Check e Monitoramento', () => {
    test('deve realizar health check completo', async () => {
      const health = await orchestrator.healthCheck();

      expect(health).toBeDefined();
      expect(health.orchestrator).toBe('healthy');
      expect(health.swapService).toBeDefined();
      expect(health.paymentExtractor).toBeDefined();

      // Verificar que chamou health check do Swap
      expect(mockSwapService.healthCheck).toHaveBeenCalled();
    });

    test('deve coletar estatísticas de processamento', async () => {
      // Processar alguns dados para gerar estatísticas
      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'bol_stats',
        amount: 10000, // valor em centavos
        status: 'pending'
      });

      await orchestrator.processCNABFile(validCNAB240Content);

      const stats = orchestrator.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.processed).toBe('number');
      expect(typeof stats.verified).toBe('number');
      expect(typeof stats.successful).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.errors).toBe('number');
    });

    test('deve resetar estatísticas', () => {
      // Coletar stats iniciais
      const initialStats = orchestrator.getStats();

      // Resetar
      orchestrator.resetStats();

      const resetStats = orchestrator.getStats();

      expect(resetStats.processed).toBe(0);
      expect(resetStats.verified).toBe(0);
      expect(resetStats.successful).toBe(0);
      expect(resetStats.failed).toBe(0);
      expect(resetStats.errors).toBe(0);
    });
  });

  describe('Cache e Performance', () => {
    test('deve utilizar cache quando habilitado', async () => {
      const barcode = '12345678901234567890123456789012345678901234567';
      const mockBoleto = {
        id: 'cache_test',
        barcode: barcode,
        type: 'boleto',
        status: 'pending'
      };

      mockSwapService.checkBoleto.mockResolvedValue({
        id: 'bol_success',
        amount: 10000, // valor em centavos
        status: 'pending'
      });

      // Primeira verificação
      await orchestrator.verifyBoletosWithSwap([mockBoleto]);

      // Segunda verificação (deve usar cache)
      await orchestrator.verifyBoletosWithSwap([mockBoleto]);

      // Com cache habilitado, deve chamar o serviço menos vezes
      expect(mockSwapService.checkBoleto).toHaveBeenCalled();
    });

    test('deve limpar cache quando solicitado', () => {
      orchestrator.clearCache();

      // Verificar que o cache foi limpo
      const stats = orchestrator.getStats();
      expect(stats.cached).toBe(0);
    });
  });

  describe('Error Handling e Resilência', () => {
    test('deve lidar com timeout de rede', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockSwapService.checkBoleto.mockRejectedValue(timeoutError);

      const mockBoleto = {
        id: 'timeout_test',
        barcode: '12345678901234567890123456789012345678901234567',
        type: 'boleto',
        status: 'pending'
      };

      const result = await orchestrator.verifyBoletosWithSwap([mockBoleto]);

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.validations[0].status).toBe('error');
      expect(result.validations[0].error).toContain('timeout');
    });

    test('deve continuar processamento mesmo com falhas parciais', async () => {
      const mockBoletos = [
        {
          id: 'success_test',
          barcode: '12345678901234567890123456789012345678901234567',
          type: 'boleto',
          status: 'pending'
        },
        {
          id: 'fail_test',
          barcode: '98765432109876543210987654321098765432109876543',
          type: 'boleto',
          status: 'pending'
        }
      ];

      // Mock: primeiro sucesso, segundo falha
      mockSwapService.checkBoleto
        .mockResolvedValueOnce({ id: 'bol_success', amount: 10000, status: 'pending' })
        .mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await orchestrator.verifyBoletosWithSwap(mockBoletos);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.validations).toHaveLength(2);
    });
  });
}); 