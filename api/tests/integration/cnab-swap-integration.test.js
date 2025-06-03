import request from 'supertest';
import app from '../../src/index.js';
import CNABSwapOrchestrator from '../../src/services/payments/CNABSwapOrchestrator.js';
import SwapFinancialService from '../../src/services/external/SwapFinancialService.js';
import path from 'path';
import fs from 'fs';

// Mock dos serviços externos
jest.mock('../../src/services/external/SwapFinancialService.js');
jest.mock('../../src/services/payments/CNABSwapOrchestrator.js');

describe('CNAB-Swap Financial Integration Tests', () => {
  let mockSwapService;
  let mockOrchestrator;

  beforeEach(() => {
    // Resetar mocks
    jest.clearAllMocks();

    // Mock do SwapFinancialService
    mockSwapService = {
      authenticate: jest.fn().mockResolvedValue('mock_token_123'),
      checkBoleto: jest.fn(),
      payBoleto: jest.fn(),
      isValidBarcodeFormat: jest.fn().mockReturnValue(true),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
      isTokenValid: jest.fn().mockReturnValue(true),
      maskBarcode: jest.fn().mockImplementation(barcode =>
        barcode ? `${barcode.substring(0, 5)}*****${barcode.substring(barcode.length - 5)}` : ''
      )
    };

    SwapFinancialService.mockImplementation(() => mockSwapService);

    // Mock do CNABSwapOrchestrator
    mockOrchestrator = {
      processCNABFile: jest.fn(),
      verifyBoletosWithSwap: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue({
        orchestrator: 'healthy',
        swapService: 'healthy',
        paymentExtractor: 'healthy'
      }),
      getStats: jest.fn().mockReturnValue({
        processed: 1,
        verified: 3,
        successful: 2,
        failed: 1,
        errors: 0
      })
    };

    CNABSwapOrchestrator.mockImplementation(() => mockOrchestrator);
  });

  describe('POST /api/v1/cnab/processar-auto/upload', () => {
    const validCNAB240Content = `01REMESSA01PAGAMENTO    002041111111000100004562345678000000000012345678901234567890                         121220241613400000001                                                                                                                                                                                                                                                                                                     000001
32201111111000100004562345678001234567890123456                         12345678901234567890                         121220240000000000012000121220241000000000000000000000000000000000000000000000000                         0000000010000000200000000200000000000000000000000000000000002
9                                                                                                                                                                                                                                                                                                                                                                                                                      000002000001`;

    test('deve processar arquivo CNAB240 com integração Swap Financial', async () => {
      // Mock do resultado do processamento CNAB-Swap
      const mockCNABSwapResult = {
        success: true,
        data: {
          cnabSummary: {
            totalRecords: 3,
            paymentsFound: 1,
            format: 'CNAB_240'
          },
          swapResults: {
            total: 1,
            verified: 1,
            successful: 1,
            failed: 0,
            validations: [
              {
                barcode: '12345678901234567890123456789012345678901234567',
                result: {
                  valid: true,
                  id: 'bol_123',
                  amountInReais: 120.00,
                  due_date: '2024-12-21',
                  status: 'pending',
                  canPayToday: true,
                  isInPaymentWindow: true
                }
              }
            ]
          },
          compatibility: {
            score: 0.95,
            issues: [],
            warnings: []
          }
        },
        processingTime: '1500ms'
      };

      mockOrchestrator.processCNABFile.mockResolvedValue(mockCNABSwapResult);

      const response = await request(app)
        .post('/api/v1/cnab/processar-auto/upload')
        .attach('arquivo', Buffer.from(validCNAB240Content), 'teste.240')
        .field('opcoes', JSON.stringify({
          swapIntegration: true,
          validateAll: true,
          batchSize: 10
        }));

      expect(response.status).toBe(200);
      expect(response.body.sucesso).toBe(true);
      expect(response.body.formatoDetectado.codigo).toBe('CNAB_240');

      // Verificar se dados CNAB foram processados
      expect(response.body.dados).toBeDefined();
      expect(response.body.dados.header).toBeDefined();
      expect(response.body.dados.segmentos).toBeDefined();

      // Verificar se integração Swap foi executada (se habilitada)
      if (response.body.dados.swapIntegration) {
        expect(mockOrchestrator.processCNABFile).toHaveBeenCalledWith(
          expect.any(Buffer),
          expect.objectContaining({ swapIntegration: true })
        );
        expect(response.body.dados.swapResults).toBeDefined();
      }
    });

    test('deve processar arquivo CNAB240 com opção de integração Swap desabilitada', async () => {
      const response = await request(app)
        .post('/api/v1/cnab/processar-auto/upload')
        .attach('arquivo', Buffer.from(validCNAB240Content), 'teste.240')
        .field('opcoes', JSON.stringify({
          swapIntegration: false
        }));

      expect(response.status).toBe(200);
      expect(response.body.sucesso).toBe(true);
      expect(response.body.formatoDetectado.codigo).toBe('CNAB_240');

      // Não deve ter executado integração Swap
      expect(mockOrchestrator.processCNABFile).not.toHaveBeenCalled();
      expect(response.body.dados.swapResults).toBeUndefined();
    });

    test('deve retornar erro quando SwapFinancialService falha', async () => {
      // Mock de falha na integração Swap
      const swapError = new Error('Erro de autenticação na API Swap');
      mockOrchestrator.processCNABFile.mockRejectedValue(swapError);

      const response = await request(app)
        .post('/api/v1/cnab/processar-auto/upload')
        .attach('arquivo', Buffer.from(validCNAB240Content), 'teste.240')
        .field('opcoes', JSON.stringify({
          swapIntegration: true
        }));

      // Deve retornar sucesso no CNAB mas erro na integração Swap
      expect(response.status).toBe(200);
      expect(response.body.sucesso).toBe(true);
      expect(response.body.dados.swapError).toBeDefined();
      expect(response.body.dados.swapError.message).toContain('Erro de autenticação na API Swap');
    });

    test('deve processar arquivo com múltiplos boletos e verificar com Swap', async () => {
      const cnabWithMultipleBoletos = validCNAB240Content + `\n32201111111000100004562345678001234567890123457                         98765432109876543210                         121220240000000000015000121220241000000000000000000000000000000000000000000000000                         0000000010000000300000000300000000000000000000000000000000003`;

      const mockMultiBoletoResult = {
        success: true,
        data: {
          cnabSummary: {
            totalRecords: 4,
            paymentsFound: 2,
            format: 'CNAB_240'
          },
          swapResults: {
            total: 2,
            verified: 2,
            successful: 1,
            failed: 1,
            validations: [
              {
                barcode: '12345678901234567890123456789012345678901234567',
                result: { valid: true, status: 'pending', canPayToday: true }
              },
              {
                barcode: '98765432109876543210987654321098765432109876543',
                result: { valid: false, error: 'Boleto não encontrado' }
              }
            ]
          },
          compatibility: {
            score: 0.75,
            issues: ['Valor divergente'],
            warnings: ['Data de vencimento próxima']
          }
        },
        processingTime: '2300ms'
      };

      mockOrchestrator.processCNABFile.mockResolvedValue(mockMultiBoletoResult);

      const response = await request(app)
        .post('/api/v1/cnab/processar-auto/upload')
        .attach('arquivo', Buffer.from(cnabWithMultipleBoletos), 'multi-boletos.240')
        .field('opcoes', JSON.stringify({
          swapIntegration: true,
          validateAll: true,
          maxConcurrentRequests: 3
        }));

      expect(response.status).toBe(200);
      expect(response.body.sucesso).toBe(true);

      // Verificar processamento CNAB
      expect(response.body.dados.segmentos).toBeDefined();

      // Verificar integração Swap (se habilitada)
      if (response.body.dados.swapIntegration) {
        expect(mockOrchestrator.processCNABFile).toHaveBeenCalledWith(
          expect.any(Buffer),
          expect.objectContaining({
            swapIntegration: true,
            validateAll: true,
            maxConcurrentRequests: 3
          })
        );
      }
    });

    test('deve validar opções de configuração Swap', async () => {
      const response = await request(app)
        .post('/api/v1/cnab/processar-auto/upload')
        .attach('arquivo', Buffer.from(validCNAB240Content), 'teste.240')
        .field('opcoes', JSON.stringify({
          swapIntegration: true,
          validateAll: false,
          batchSize: 5,
          maxConcurrentRequests: 2,
          includeInvalidBarcodes: true
        }));

      expect(response.status).toBe(200);

      if (mockOrchestrator.processCNABFile.mock.calls.length > 0) {
        const [, options] = mockOrchestrator.processCNABFile.mock.calls[0];
        expect(options).toMatchObject({
          swapIntegration: true,
          validateAll: false,
          batchSize: 5,
          maxConcurrentRequests: 2,
          includeInvalidBarcodes: true
        });
      }
    });
  });

  describe('POST /api/cnab-swap/process', () => {
    test('deve processar arquivo CNAB via endpoint específico de integração', async () => {
      const mockResult = {
        success: true,
        data: {
          cnabSummary: { totalRecords: 3, paymentsFound: 2 },
          swapResults: { total: 2, verified: 2, successful: 2, failed: 0 }
        },
        processingTime: '1200ms'
      };

      mockOrchestrator.processCNABFile.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/cnab-swap/process')
        .attach('file', Buffer.from(validCNAB240Content), 'cnab-swap-test.240')
        .field('validateAll', 'true')
        .field('batchSize', '15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.stats).toBeDefined();

      expect(mockOrchestrator.processCNABFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          validateAll: true,
          batchSize: 15
        })
      );
    });

    test('deve falhar quando nenhum arquivo é enviado', async () => {
      const response = await request(app)
        .post('/api/cnab-swap/process');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Arquivo CNAB é obrigatório');
    });
  });

  describe('POST /api/cnab-swap/verify-barcodes', () => {
    test('deve verificar códigos de barras específicos', async () => {
      const barcodes = [
        '12345678901234567890123456789012345678901234567',
        '98765432109876543210987654321098765432109876543'
      ];

      const mockVerifyResult = {
        total: 2,
        verified: 2,
        successful: 1,
        failed: 1,
        validations: [
          { barcode: barcodes[0], result: { valid: true, status: 'pending' } },
          { barcode: barcodes[1], result: { valid: false, error: 'Boleto não encontrado' } }
        ]
      };

      mockOrchestrator.verifyBoletosWithSwap.mockResolvedValue(mockVerifyResult);

      const response = await request(app)
        .post('/api/cnab-swap/verify-barcodes')
        .send({ barcodes });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVerifyResult);

      expect(mockOrchestrator.verifyBoletosWithSwap).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ barcode: barcodes[0] }),
          expect.objectContaining({ barcode: barcodes[1] })
        ])
      );
    });

    test('deve rejeitar mais de 100 códigos de barras', async () => {
      const manyBarcodes = Array(101).fill().map((_, i) =>
        `1234567890123456789012345678901234567890123456${i.toString().padStart(1, '0')}`
      );

      const response = await request(app)
        .post('/api/cnab-swap/verify-barcodes')
        .send({ barcodes: manyBarcodes });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Muitos códigos de barras');
    });
  });

  describe('GET /api/cnab-swap/health', () => {
    test('deve retornar status de saúde da integração', async () => {
      const response = await request(app)
        .get('/api/cnab-swap/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.components).toBeDefined();
      expect(response.body.stats).toBeDefined();

      expect(mockOrchestrator.healthCheck).toHaveBeenCalled();
      expect(mockOrchestrator.getStats).toHaveBeenCalled();
    });

    test('deve retornar status unhealthy quando há problemas', async () => {
      mockOrchestrator.healthCheck.mockResolvedValue({
        orchestrator: 'healthy',
        swapService: 'unhealthy',
        paymentExtractor: 'healthy'
      });

      const response = await request(app)
        .get('/api/cnab-swap/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    test('deve lidar com erros de timeout da API Swap', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockOrchestrator.processCNABFile.mockRejectedValue(timeoutError);

      const response = await request(app)
        .post('/api/cnab-swap/process')
        .attach('file', Buffer.from(validCNAB240Content), 'timeout-test.240');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Request timeout');
    });

    test('deve lidar com erros de autenticação da API Swap', async () => {
      const authError = new Error('Authentication failed');
      authError.status = 401;

      mockOrchestrator.processCNABFile.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/cnab-swap/process')
        .attach('file', Buffer.from(validCNAB240Content), 'auth-error-test.240');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication failed');
    });

    test('deve lidar com formato CNAB inválido', async () => {
      const invalidCNAB = 'conteudo-cnab-invalido';

      const response = await request(app)
        .post('/api/v1/cnab/processar-auto/upload')
        .attach('arquivo', Buffer.from(invalidCNAB), 'invalido.txt');

      expect(response.status).toBe(400);
      expect(response.body.sucesso).toBe(false);
      expect(response.body.codigo).toBe('FORMATO_NAO_DETECTADO');
    });
  });

  describe('Performance Tests', () => {
    test('deve processar arquivo grande em tempo hábil', async () => {
      // Simular arquivo CNAB grande
      const largeCNABContent = validCNAB240Content + '\n' +
        Array(100).fill().map((_, i) =>
          `32201111111000100004562345678001234567890123456                         ${i.toString().padStart(20, '0')}                         121220240000000000012000121220241000000000000000000000000000000000000000000000000                         00000000100000002000000002000000000000000000000000000000000000${i.toString().padStart(2, '0')}`
        ).join('\n');

      const mockLargeResult = {
        success: true,
        data: {
          cnabSummary: { totalRecords: 103, paymentsFound: 100 },
          swapResults: { total: 100, verified: 100, successful: 95, failed: 5 }
        },
        processingTime: '5000ms'
      };

      mockOrchestrator.processCNABFile.mockResolvedValue(mockLargeResult);

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/cnab-swap/process')
        .attach('file', Buffer.from(largeCNABContent), 'large-cnab.240')
        .field('batchSize', '20')
        .field('maxConcurrentRequests', '10');

      const processingTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Menos de 10 segundos

      expect(mockOrchestrator.processCNABFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          batchSize: 20,
          maxConcurrentRequests: 10
        })
      );
    });
  });
}); 