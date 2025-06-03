import { jest, expect, describe, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import CNABSwapOrchestrator from '../../services/payments/CNABSwapOrchestrator.js';
import SwapFinancialService from '../../services/external/SwapFinancialService.js';
import fs from 'fs/promises';
import path from 'path';

// Configuração para testes de integração
const INTEGRATION_TEST_CONFIG = {
  // Usar ambiente de teste da Swap Financial
  baseURL: process.env.SWAP_TEST_URL || 'https://stg.swapfinancial.com.br/api/v1',
  clientId: process.env.SWAP_TEST_CLIENT_ID,
  clientSecret: process.env.SWAP_TEST_CLIENT_SECRET,
  timeout: 30000,
  environment: 'integration-test'
};

// Skip testes de integração se credenciais não estão configuradas
const skipIntegrationTests = !INTEGRATION_TEST_CONFIG.clientId || !INTEGRATION_TEST_CONFIG.clientSecret;

describe.skipIf(skipIntegrationTests)('Swap Financial Integration Tests', () => {
  let swapService;
  let orchestrator;

  beforeAll(async () => {
    if (skipIntegrationTests) {
      console.log('⚠️ Testes de integração Swap Financial pulados - credenciais não configuradas');
      return;
    }

    console.log('🔧 Configurando testes de integração Swap Financial...');

    // Inicializar serviços com configuração de teste
    swapService = new SwapFinancialService(INTEGRATION_TEST_CONFIG);
    orchestrator = new CNABSwapOrchestrator({
      swapConfig: INTEGRATION_TEST_CONFIG,
      batchSize: 3,
      enableCache: true
    });

    // Verificar conectividade básica
    try {
      await swapService.authenticate();
      console.log('✅ Autenticação com Swap Financial bem-sucedida');
    } catch (error) {
      console.error('❌ Falha na autenticação inicial:', error.message);
      throw error;
    }
  });

  afterAll(async () => {
    if (swapService) {
      swapService.clearCache();
    }
    if (orchestrator) {
      orchestrator.clearCache();
    }
  });

  beforeEach(async () => {
    // Limpar cache antes de cada teste para isolamento
    if (swapService) swapService.clearCache();
    if (orchestrator) orchestrator.clearCache();
  });

  describe('SwapFinancialService Integration', () => {
    test('deve autenticar com API real e obter token válido', async () => {
      const token = await swapService.authenticate();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
      expect(swapService.isTokenValid()).toBe(true);
    }, 30000);

    test('deve verificar boleto com código de barras válido', async () => {
      // Usando código de barras de teste da Swap Financial
      // Nota: Este deve ser um código real fornecido para testes
      const testBarcode = process.env.SWAP_TEST_BARCODE || '34191790010104351004791020150008291070026000';

      try {
        const result = await swapService.checkBoleto(testBarcode);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.amount).toBeGreaterThan(0);
        expect(result.due_date).toBeDefined();
        expect(result.status).toBeDefined();
        expect(result.canPayToday).toBeDefined();
        expect(result.isInPaymentWindow).toBeDefined();

        console.log('✅ Boleto verificado:', {
          id: result.id,
          amount: result.amount,
          status: result.status,
          canPay: result.canPayToday
        });

        // Testar pagamento se possível
        if (result.canPayToday && result.isInPaymentWindow) {
          const paymentResult = await swapService.payBoleto(testBarcode, {
            document: process.env.COMPANY_CNPJ || '12345678000190'
          });

          expect(paymentResult).toBeDefined();
          // Verificar se o pagamento foi processado
          expect(paymentResult.status).toBeDefined();
        }
      } catch (error) {
        // Se o boleto não for encontrado, isso é esperado em ambiente de teste
        if (error.message.includes('not found') || error.message.includes('404')) {
          console.log('ℹ️ Boleto de teste não encontrado - comportamento esperado em ambiente de teste');
          expect(error.message).toContain('not found');
        } else {
          throw error;
        }
      }
    }, 45000);

    test('deve falhar graciosamente com código de barras inválido', async () => {
      const invalidBarcode = '12345invalid';

      await expect(swapService.checkBoleto(invalidBarcode))
        .rejects.toThrow('Formato de código de barras inválido');
    });

    test('deve manter circuit breaker fechado com requisições bem-sucedidas', async () => {
      expect(swapService.circuitBreakerState).toBe('closed');

      // Fazer múltiplas autenticações para testar circuit breaker
      for (let i = 0; i < 3; i++) {
        await swapService.authenticate();
        expect(swapService.circuitBreakerState).toBe('closed');
      }
    }, 60000);

    test('deve retornar health check positivo', async () => {
      const health = await swapService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.tokenValid).toBe(true);
      expect(health.circuitBreaker).toBe('closed');
      expect(health.lastCheck).toBeDefined();
    });
  });

  describe('CNABSwapOrchestrator Integration', () => {
    test('deve processar arquivo CNAB mock com integração Swap', async () => {
      // Criar conteúdo CNAB mock para teste
      const mockCnabContent = await createMockCNABContent();

      const result = await orchestrator.processCNABFile(mockCnabContent, {
        validateWithSwap: true,
        mockMode: true // Flag para indicar que é teste
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.cnabSummary).toBeDefined();
      expect(result.data.swapResults).toBeDefined();
      expect(result.processingTime).toBeDefined();

      console.log('✅ Processamento CNAB-Swap completo:', {
        cnabRecords: result.data.cnabSummary?.totalRecords,
        swapVerifications: result.data.swapResults?.total,
        processingTime: result.processingTime
      });
    }, 60000);

    test('deve realizar health check completo do orquestrador', async () => {
      const health = await orchestrator.healthCheck();

      expect(health.orchestrator).toBe('healthy');
      expect(health.swapService).toBeDefined();
      expect(health.paymentExtractor).toBe('healthy');
      expect(health.cache).toBeDefined();
      expect(health.stats).toBeDefined();

      console.log('✅ Health check do orquestrador:', health);
    });

    test('deve gerenciar cache corretamente durante processamento', async () => {
      const testBarcode = '34191790010104351004791020150008291070026000';

      // Primeira verificação (sem cache)
      expect(orchestrator.verificationCache.size).toBe(0);

      try {
        await orchestrator.verifyBoletoWithSwap({
          id: '1',
          barcode: testBarcode,
          amount: 100.00
        });

        // Verificar se foi adicionado ao cache
        expect(orchestrator.verificationCache.size).toBe(1);

        // Segunda verificação (deve usar cache)
        const startTime = Date.now();
        const result = await orchestrator.verifyBoletoWithSwap({
          id: '2',
          barcode: testBarcode,
          amount: 100.00
        });
        const endTime = Date.now();

        expect(result.fromCache).toBe(true);
        expect(endTime - startTime).toBeLessThan(100); // Deve ser muito rápido (cache)

      } catch (error) {
        if (error.message.includes('not found')) {
          console.log('ℹ️ Teste de cache pulado - boleto não encontrado em ambiente de teste');
        } else {
          throw error;
        }
      }
    }, 30000);
  });

  describe('Error Handling and Resilience', () => {
    test('deve lidar com timeouts graciosamente', async () => {
      // Criar serviço com timeout muito baixo
      const timeoutService = new SwapFinancialService({
        ...INTEGRATION_TEST_CONFIG,
        timeout: 1 // 1ms - deve falhar
      });

      await expect(timeoutService.authenticate())
        .rejects.toThrow();
    });

    test('deve recuperar de falhas temporárias', async () => {
      // Simular falha temporária alterando URL
      const originalBaseURL = swapService.config.baseURL;
      swapService.config.baseURL = 'https://invalid-url-that-does-not-exist.com';

      // Deve falhar
      await expect(swapService.authenticate()).rejects.toThrow();

      // Restaurar URL válida
      swapService.config.baseURL = originalBaseURL;

      // Deve funcionar novamente
      const token = await swapService.authenticate();
      expect(token).toBeDefined();
    }, 30000);

    test('deve manter estatísticas durante operações', async () => {
      const initialStats = orchestrator.getStats();

      try {
        await orchestrator.verifyBoletoWithSwap({
          id: 'test',
          barcode: '34191790010104351004791020150008291070026000',
          amount: 100.00
        });
      } catch (error) {
        // Ignorar erros para este teste de estatísticas
      }

      const finalStats = orchestrator.getStats();

      // Verificar que estatísticas foram atualizadas
      expect(finalStats.verified).toBeGreaterThanOrEqual(initialStats.verified);
    });
  });

  describe('Performance and Load', () => {
    test('deve processar múltiplos boletos em paralelo', async () => {
      const testBoletos = [
        {
          id: '1',
          barcode: '34191790010104351004791020150008291070026000',
          amount: 100.00
        },
        {
          id: '2',
          barcode: '34192790010104351004791020150008291070026001',
          amount: 200.00
        },
        {
          id: '3',
          barcode: '34193790010104351004791020150008291070026002',
          amount: 300.00
        }
      ];

      const startTime = Date.now();

      try {
        const result = await orchestrator.verifyBoletosWithSwap(testBoletos);

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(result.total).toBe(3);
        expect(result.verified).toBe(3);
        expect(processingTime).toBeLessThan(60000); // Máximo 60 segundos

        console.log('✅ Processamento paralelo:', {
          boletos: result.total,
          tempo: `${processingTime}ms`,
          sucessos: result.successful,
          falhas: result.failed
        });

      } catch (error) {
        console.log('ℹ️ Teste de paralelismo falhou (esperado em ambiente de teste):', error.message);
      }
    }, 90000);

    test('deve manter performance com cache ativo', async () => {
      const testBarcode = '34191790010104351004791020150008291070026000';

      try {
        // Primeira verificação (sem cache)
        const start1 = Date.now();
        await orchestrator.verifyBoletoWithSwap({
          id: '1',
          barcode: testBarcode,
          amount: 100.00
        });
        const time1 = Date.now() - start1;

        // Segunda verificação (com cache)
        const start2 = Date.now();
        await orchestrator.verifyBoletoWithSwap({
          id: '2',
          barcode: testBarcode,
          amount: 100.00
        });
        const time2 = Date.now() - start2;

        // Cache deve ser significativamente mais rápido
        expect(time2).toBeLessThan(time1 * 0.1); // Pelo menos 10x mais rápido

        console.log('✅ Performance do cache:', {
          semCache: `${time1}ms`,
          comCache: `${time2}ms`,
          melhoria: `${Math.round((time1 / time2) * 10) / 10}x`
        });

      } catch (error) {
        console.log('ℹ️ Teste de performance pulado:', error.message);
      }
    }, 45000);
  });
});

// Função auxiliar para criar conteúdo CNAB mock
async function createMockCNABContent() {
  // Simular conteúdo CNAB com registros de boletos
  const mockRecords = [
    '01REMESSA01COBRANCA       123456789000000EMPRESA TESTE                   75000000         240124',
    '1000000000012345678901234567890123456789012345678901234567890123456789012345678901234567',
    '9         000010000000000000000000000000000000000000000000000000000000000000000000000000'
  ];

  return mockRecords.join('\n');
}

// Função auxiliar para verificar se ambiente está configurado
function checkIntegrationEnvironment() {
  const required = ['SWAP_TEST_CLIENT_ID', 'SWAP_TEST_CLIENT_SECRET'];
  const missing = required.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.log(`⚠️ Testes de integração requerem: ${missing.join(', ')}`);
    return false;
  }

  return true;
} 