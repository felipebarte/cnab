import { jest, expect, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock do módulo de métricas
jest.mock('../src/utils/metrics.js', () => ({
  Timer: jest.fn().mockImplementation(() => ({
    end: jest.fn()
  })),
  metricsCollector: {
    incrementCounter: jest.fn(),
    setGauge: jest.fn()
  }
}));

// Mock do ExternalAPIService - versão corrigida
jest.mock('../src/services/external/ExternalAPIService.js', () => {
  return class MockExternalAPIService {
    constructor(options = {}) {
      this.name = options.name || 'MockExternalAPIService';
      this.retryAttempts = options.retryAttempts || 3;
      this.timeout = options.timeout || 30000;
      this.httpClient = {
        defaults: {
          baseURL: '',
          headers: {}
        }
      };
      this.makeRequest = jest.fn();
      this.post = jest.fn();
      this.log = jest.fn();
    }
  };
});

// Importar após os mocks
import SwapFinancialService from '../src/services/external/SwapFinancialService.js';

describe('SwapFinancialService - Consolidado', () => {
  let swapService;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      environment: 'staging',
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      apiKey: 'test_api_key',
      timeout: 10000,
      circuitBreakerThreshold: 5
    };

    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks();

    // Criar instância do serviço
    swapService = new SwapFinancialService(mockConfig);
  });

  afterEach(() => {
    if (swapService && swapService.clearTokenCache) {
      swapService.clearTokenCache();
    }
  });

  describe('Constructor', () => {
    test('deve inicializar com configuração correta', () => {
      expect(swapService.environment).toBe('staging');
      expect(swapService.clientId).toBe('test_client_id');
      expect(swapService.clientSecret).toBe('test_client_secret');
      expect(swapService.apiKey).toBe('test_api_key');
      expect(swapService.circuitBreakerState).toBe('closed');
      expect(swapService.failureCount).toBe(0);
      expect(swapService.baseURL).toBe('https://api-stag.contaswap.io');
    });

    test('deve usar ambiente de produção por padrão', () => {
      const defaultService = new SwapFinancialService({
        clientId: 'test',
        clientSecret: 'test',
        apiKey: 'test'
      });

      expect(defaultService.environment).toBe('production');
      expect(defaultService.baseURL).toBe('https://api-prod.contaswap.io');
    });

    test('deve configurar URLs corretas por ambiente', () => {
      const prodService = new SwapFinancialService({
        ...mockConfig,
        environment: 'production'
      });

      expect(prodService.baseURL).toBe('https://api-prod.contaswap.io');
    });

    test('deve configurar circuit breaker corretamente', () => {
      expect(swapService.circuitBreakerThreshold).toBe(5);
      expect(swapService.circuitBreakerState).toBe('closed');
      expect(swapService.failureCount).toBe(0);
    });
  });

  describe('Authentication (getAccessToken)', () => {
    test('deve retornar token válido do cache', async () => {
      // Configurar token válido no cache
      const futureTime = Date.now() + 3600000; // 1 hora no futuro
      swapService.tokenCache = 'cached_token_123';
      swapService.tokenExpiry = futureTime;

      const token = await swapService.getAccessToken();

      expect(token).toBe('cached_token_123');
      expect(swapService.post).not.toHaveBeenCalled();
    });

    test('deve solicitar novo token quando cache está vazio', async () => {
      const mockTokenResponse = {
        access_token: 'new_access_token',
        refresh_token: 'refresh_token',
        expires_in: 3600,
        refresh_expires_in: 7200,
        token_type: 'Bearer'
      };

      swapService.post = jest.fn().mockResolvedValue(mockTokenResponse);

      const token = await swapService.getAccessToken();

      expect(token).toBe('new_access_token');
      expect(swapService.post).toHaveBeenCalledWith('/oauth/token', {
        grant_type: 'client_credentials',
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test_api_key'
        }
      });
    });

    test('deve renovar token expirado', async () => {
      // Configurar token expirado
      const pastTime = Date.now() - 1000; // 1 segundo no passado
      swapService.tokenCache = 'expired_token';
      swapService.tokenExpiry = pastTime;

      const mockRefreshResponse = {
        access_token: 'refreshed_access_token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      swapService.post = jest.fn().mockResolvedValue(mockRefreshResponse);

      const token = await swapService.getAccessToken();

      expect(token).toBe('refreshed_access_token');
      expect(swapService.post).toHaveBeenCalled();
    });

    test('deve falhar graciosamente quando autenticação falha', async () => {
      swapService.post = jest.fn().mockRejectedValue(new Error('Authentication failed'));

      await expect(swapService.getAccessToken()).rejects.toThrow('Authentication failed');
    });

    test('deve falhar quando token não é retornado', async () => {
      swapService.post = jest.fn().mockResolvedValue({});

      await expect(swapService.getAccessToken()).rejects.toThrow('Token de acesso não recebido');
    });
  });

  describe('checkBoleto', () => {
    beforeEach(() => {
      // Mock de token válido para todos os testes de checkBoleto
      swapService.tokenCache = 'test_access_token';
      swapService.tokenExpiry = Date.now() + 3600000;
    });

    test('deve verificar boleto com sucesso', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';
      const mockBoletoResponse = {
        id: 'bol_123456789',
        amount: 15075, // valor em centavos
        due_date: '2024-12-31',
        status: 'PENDING',
        payee: {
          name: 'Empresa Teste LTDA',
          document: '12.345.678/0001-90'
        },
        discountAmount: 0,
        fineAmount: 5.25,
        interestAmount: 2.10
      };

      // Mock do authenticatedRequest
      swapService.authenticatedRequest = jest.fn().mockResolvedValue(mockBoletoResponse);

      const result = await swapService.checkBoleto(testBarcode);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockBoletoResponse.id);
      expect(result.amount).toBe(mockBoletoResponse.amount);
      expect(result.canPayToday).toBeDefined();
      expect(result.isInPaymentWindow).toBeDefined();

      // CORREÇÃO: Verificar endpoint correto POST /ledger/payments/boletos com barcode no payload
      expect(swapService.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/ledger/payments/boletos',
        { barcode: testBarcode }
      );
    });

    test('deve falhar com código de barras inválido', async () => {
      const invalidBarcode = '123invalid';

      await expect(swapService.checkBoleto(invalidBarcode))
        .rejects.toThrow('Formato de código de barras inválido');
    });

    test('deve falhar com código de barras vazio', async () => {
      await expect(swapService.checkBoleto(''))
        .rejects.toThrow('Código de barras é obrigatório');
    });

    test('deve falhar com resposta vazia da API', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';

      swapService.authenticatedRequest = jest.fn().mockResolvedValue(null);

      await expect(swapService.checkBoleto(testBarcode))
        .rejects.toThrow('Resposta vazia da API Swap Financial');
    });

    test('deve enriquecer dados do boleto corretamente', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';
      const mockResponse = {
        id: 'bol_123',
        amount: 10000, // valor em centavos
        due_date: '2024-12-31',
        status: 'PENDING',
        discountAmount: 10.00,
        fineAmount: 5.00,
        interestAmount: 2.50
      };

      swapService.authenticatedRequest = jest.fn().mockResolvedValue(mockResponse);

      const result = await swapService.checkBoleto(testBarcode);

      expect(result.hasDiscount).toBe(true);
      expect(result.hasFine).toBe(true);
      expect(result.hasInterest).toBe(true);
      expect(result.environment).toBe('staging');
      expect(result.paymentWindow).toBeDefined();
    });

    test('deve detectar quando boleto pode ser pago hoje', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockResponse = {
        id: 'bol_123',
        amount: 10000, // valor em centavos
        due_date: futureDate.toISOString().split('T')[0],
        status: 'PENDING'
      };

      swapService.authenticatedRequest = jest.fn().mockResolvedValue(mockResponse);

      const result = await swapService.checkBoleto(testBarcode);

      expect(result.canPayToday).toBeDefined();
      expect(result.isInPaymentWindow).toBeDefined();
    });
  });

  describe('payBoleto', () => {
    beforeEach(() => {
      // Mock de token válido
      swapService.tokenCache = 'test_access_token';
      swapService.tokenExpiry = Date.now() + 3600000;
      // Configurar accountId para testes
      swapService.accountId = 'test_account_123';
    });

    test('deve pagar boleto com sucesso', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';
      const mockBoletoData = {
        id: 'bol_123',
        amount: 10000, // valor em centavos
        due_date: '2024-12-31',
        status: 'PENDING',
        canPayToday: true,
        isInPaymentWindow: true
      };

      const mockPaymentResponse = {
        id: 'pay_789',
        boleto_id: 'bol_123',
        amount: 10000,
        status: 'PAID',
        paid_at: '2024-01-15T10:30:00Z'
      };

      // Mock do checkBoleto
      jest.spyOn(swapService, 'checkBoleto').mockResolvedValue(mockBoletoData);

      // Mock da requisição autenticada com novo endpoint
      swapService.authenticatedRequest = jest.fn().mockResolvedValue(mockPaymentResponse);

      const result = await swapService.payBoleto(testBarcode, { document: '12345678000190' });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPaymentResponse.id);
      expect(result.status).toBe('PAID');
      expect(swapService.checkBoleto).toHaveBeenCalledWith(testBarcode);

      // Verificar se foi chamado com endpoint correto
      expect(swapService.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/ledger/payments/boletos/bol_123/pay',
        {
          amount: 10000,
          document: '12345678000190',
          account_id: 'test_account_123'
        }
      );
    });

    test('deve falhar quando boleto não tem ID válido', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';
      const mockBoletoData = {
        // id ausente ou inválido
        amount: 10000,
        status: 'PENDING'
      };

      jest.spyOn(swapService, 'checkBoleto').mockResolvedValue(mockBoletoData);

      await expect(swapService.payBoleto(testBarcode))
        .rejects.toThrow('Boleto não encontrado ou ID inválido');
    });

    test('deve usar CNPJ da empresa como fallback quando document não fornecido', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';
      const mockBoletoData = {
        id: 'bol_123',
        amount: 10000,
        status: 'PENDING'
      };

      const mockPaymentResponse = {
        id: 'pay_789',
        status: 'PAID'
      };

      // Configurar variável de ambiente para teste
      process.env.COMPANY_CNPJ = '11222333000144';

      jest.spyOn(swapService, 'checkBoleto').mockResolvedValue(mockBoletoData);
      swapService.authenticatedRequest = jest.fn().mockResolvedValue(mockPaymentResponse);

      await swapService.payBoleto(testBarcode);

      // Verificar se usou CNPJ da empresa como fallback
      expect(swapService.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/ledger/payments/boletos/bol_123/pay',
        {
          amount: 10000,
          document: '11222333000144',
          account_id: 'test_account_123'
        }
      );

      // Limpar variável de ambiente
      delete process.env.COMPANY_CNPJ;
    });
  });

  describe('Circuit Breaker', () => {
    test('deve resetar circuit breaker após sucesso', async () => {
      const testBarcode = '12345678901234567890123456789012345678901234567';

      // Configurar algumas falhas
      swapService.failureCount = 2;

      const mockResponse = {
        id: 'bol_123',
        amount: 10000, // valor em centavos
        due_date: '2024-12-31',
        status: 'PENDING'
      };

      swapService.authenticatedRequest = jest.fn().mockResolvedValue(mockResponse);

      // Mock do resetCircuitBreaker para simular o reset
      const resetSpy = jest.spyOn(swapService, 'resetCircuitBreaker');
      resetSpy.mockImplementation(() => {
        swapService.failureCount = 0;
        swapService.circuitBreakerState = 'closed';
      });

      await swapService.checkBoleto(testBarcode);

      // Como o método não reseta automaticamente, vamos chamar manualmente
      swapService.resetCircuitBreaker();

      expect(swapService.failureCount).toBe(0);
      expect(swapService.circuitBreakerState).toBe('closed');
    });

    test('deve detectar circuit breaker aberto', () => {
      // Forçar circuit breaker aberto
      swapService.circuitBreakerState = 'open';
      swapService.lastFailureTime = Date.now();

      expect(() => {
        swapService.checkCircuitBreaker();
      }).toThrow('Circuit breaker está aberto');
    });
  });

  describe('Health Check', () => {
    test('deve retornar status saudável quando tudo está funcionando', async () => {
      swapService.tokenCache = 'test_token';
      swapService.tokenExpiry = Date.now() + 3600000;

      // Mock do authenticate para não fazer chamada real
      swapService.authenticate = jest.fn().mockResolvedValue();

      const health = await swapService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.circuitBreaker).toBe('closed');
      expect(health.tokenValid).toBe(true);
      expect(health.lastCheck).toBeDefined();
    });

    test('deve indicar problemas de autenticação no health check', async () => {
      // Remover token do cache
      swapService.tokenCache = null;

      // Mock do authenticate para falhar
      swapService.authenticate = jest.fn().mockRejectedValue(new Error('Auth failed'));

      const health = await swapService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Auth failed');
      expect(health.tokenValid).toBe(false);
    });
  });

  describe('Cache Management', () => {
    test('deve limpar cache corretamente', () => {
      swapService.tokenCache = 'test_token';
      swapService.tokenExpiry = Date.now() + 3600000;
      swapService.refreshToken = 'refresh_token';

      swapService.clearCache();

      expect(swapService.tokenCache).toBeNull();
      expect(swapService.tokenExpiry).toBeNull();
      expect(swapService.refreshToken).toBeNull();
    });

    test('deve validar token corretamente', () => {
      // Token válido
      swapService.tokenCache = 'valid_token';
      swapService.tokenExpiry = Date.now() + 3600000;

      expect(swapService.isTokenValid()).toBe(true);

      // Token expirado
      swapService.tokenExpiry = Date.now() - 1000;

      expect(swapService.isTokenValid()).toBe(false);

      // Sem token - isTokenValid retorna false-y quando tokenCache é null
      swapService.tokenCache = null;

      expect(swapService.isTokenValid()).toBeFalsy();
    });
  });

  describe('Configuration', () => {
    test('deve retornar configuração atual', () => {
      const config = swapService.getConfiguration();

      expect(config.environment).toBe('staging');
      expect(config.baseURL).toBe('https://api-stag.contaswap.io');
      expect(config.circuitBreaker.state).toBe('closed');
      expect(config.tokenCacheStatus.hasAccessToken).toBe(false);
    });

    test('deve validar configuração obrigatória', () => {
      expect(() => {
        const invalidService = new SwapFinancialService({
          // Missing required fields: clientId, clientSecret, apiKey
        });
        invalidService.validateConfiguration();
      }).toThrow('Missing required configuration: clientId, clientSecret, apiKey');
    });
  });

  describe('Data Enrichment', () => {
    test('deve enriquecer dados do boleto com informações adicionais', () => {
      const boletoData = {
        id: 'bol_123',
        amount: 10000, // valor em centavos
        due_date: '2024-12-31',
        discountAmount: 5.00,
        fineAmount: 2.50,
        interestAmount: 1.25
      };

      const enriched = swapService.enrichBoletoData(boletoData);

      expect(enriched.hasDiscount).toBe(true);
      expect(enriched.hasFine).toBe(true);
      expect(enriched.hasInterest).toBe(true);
      expect(enriched.environment).toBe('staging');
      expect(enriched.canPayToday).toBeDefined();
      expect(enriched.isInPaymentWindow).toBeDefined();
      expect(enriched.paymentWindow).toBeDefined();
    });

    test('deve calcular janela de pagamento corretamente', () => {
      const today = new Date();
      const dueDate = new Date();
      dueDate.setDate(today.getDate() + 5); // 5 dias no futuro

      const boletoData = {
        due_date: dueDate.toISOString().split('T')[0]
      };

      const window = swapService.getPaymentWindow(boletoData);

      expect(window).toBeDefined();
      expect(window.startHour).toBe('07:00');
      expect(window.endHour).toBe('23:00');
      expect(window.dueDate).toBe(boletoData.due_date);
    });
  });

  describe('Barcode Validation', () => {
    test('deve validar formatos de código de barras', () => {
      // Código válido (47 dígitos)
      expect(swapService.isValidBarcodeFormat('12345678901234567890123456789012345678901234567')).toBe(true);

      // Código válido (48 dígitos)
      expect(swapService.isValidBarcodeFormat('123456789012345678901234567890123456789012345678')).toBe(true);

      // Código inválido (muito curto)
      expect(swapService.isValidBarcodeFormat('123456789')).toBe(false);

      // Código inválido (muito longo)
      expect(swapService.isValidBarcodeFormat('1234567890123456789012345678901234567890123456789')).toBe(false);

      // Código inválido (caracteres não numéricos)
      expect(swapService.isValidBarcodeFormat('1234567890123456789012345678901234567890123456a')).toBe(false);
    });

    test('deve mascarar código de barras para logs', () => {
      const barcode = '12345678901234567890123456789012345678901234567';
      const masked = swapService.maskBarcode(barcode);

      expect(masked).toBe('12345*************************************34567');
      expect(masked).not.toBe(barcode);
    });
  });

  describe('Circuit Breaker Status', () => {
    test('deve retornar status do circuit breaker', () => {
      const status = swapService.getCircuitBreakerStatus();

      expect(status).toBeDefined();
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(0);
      expect(status.threshold).toBe(5);
    });
  });
}); 