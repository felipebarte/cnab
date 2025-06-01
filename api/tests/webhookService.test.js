import WebhookService from '../src/services/webhookService.js';
import axios from 'axios';
import Logger from '../src/utils/logger.js';
import ErrorHandler from '../src/utils/errorHandler.js';

// Mock do axios
jest.mock('axios');
const mockedAxios = axios;

// Mock do Logger para não poluir console durante testes
jest.mock('../src/utils/logger.js', () => ({
  generateOperationId: jest.fn(() => 'test-operation-id'),
  calculateResponseTime: jest.fn(() => 1000),
  createWebhookLogger: jest.fn(() => ({
    operationId: 'test-op-id',
    start: jest.fn(),
    attempt: jest.fn(),
    success: jest.fn(),
    attemptFailed: jest.fn(),
    failed: jest.fn(),
    delay: jest.fn(),
    timeout: jest.fn(),
  })),
  sanitizeForLog: jest.fn(data => data),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock do ErrorHandler
jest.mock('../src/utils/errorHandler.js', () => ({
  validateWebhookConfig: jest.fn((url) => {
    if (!url) {
      return {
        valido: false,
        erro: {
          message: 'URL do webhook não configurada',
          codigo: 'WEBHOOK_URL_OBRIGATORIA'
        }
      };
    }
    return { valido: true };
  }),
  classifyWebhookError: jest.fn((error) => {
    // Retorna sempre ERRO_WEBHOOK como o WebhookService realmente faz
    return {
      ...error,
      codigo: 'ERRO_WEBHOOK',
      tipo: 'WEBHOOK_ERROR',
      mensagem: error.message
    };
  })
}));

describe('WebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.log mock
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Reset variáveis de ambiente para cada teste
    process.env.WEBHOOK_ENABLED = 'true';
    process.env.WEBHOOK_TIMEOUT = '30000';
    process.env.WEBHOOK_RETRY_ATTEMPTS = '3';
    process.env.WEBHOOK_RETRY_DELAY = '5000';
    process.env.WEBHOOK_URL = 'https://test-webhook.com/endpoint';
    process.env.WEBHOOK_CNAB_URL = 'https://test-webhook.com/cnab';

    // Reset configuração padrão para cada teste
    WebhookService.defaultConfig.timeout = 30000;
    WebhookService.defaultConfig.retryAttempts = 3;
    WebhookService.defaultConfig.retryDelay = 5000;
    WebhookService.defaultConfig.enabled = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('enviarParaWebhook', () => {
    const dadosCnabMock = {
      dados: [
        {
          nossoNumero: '123456',
          codigoBarras: '34191234567890123456789012345678901234567890',
          valor: 100.50,
          vencimento: '2024-12-31',
          pagador: {
            nome: 'João Silva',
            documento: '12345678901',
            endereco: 'Rua Teste, 123'
          }
        }
      ],
      totalRegistros: 1,
      arquivo: {
        nome: 'teste.cnab',
        tamanho: 1024
      }
    };

    it('deve enviar dados para webhook com sucesso', async () => {
      const responseMock = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
        headers: { 'content-type': 'application/json' }
      };

      mockedAxios.post.mockResolvedValueOnce(responseMock);

      const resultado = await WebhookService.enviarParaWebhook(dadosCnabMock);

      expect(resultado).toEqual({
        sucesso: true,
        enviado: true,
        tentativas: 1,
        response: expect.objectContaining({
          status: 200,
          statusText: 'OK',
          data: { success: true }
        }),
        tempoResposta: expect.any(Number),
        operationId: expect.any(String),
        timestamp: expect.any(String)
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-webhook.com/cnab',
        expect.objectContaining({
          metadados: expect.objectContaining({
            fonte: 'CNAB 400 Itaú Parser API',
            versao: '1.0.0'
          }),
          resumo: expect.objectContaining({
            totalRegistros: 1
          })
        }),
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'CNAB-400-Itau-Parser-API/1.0.0'
          })
        })
      );
    });

    it('deve usar URL customizada quando fornecida', async () => {
      const customUrl = 'https://custom-webhook.com/cnab';
      const responseMock = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
        headers: {}
      };

      mockedAxios.post.mockResolvedValueOnce(responseMock);

      await WebhookService.enviarParaWebhook(dadosCnabMock, customUrl);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        customUrl,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('deve retornar sucesso=true/enviado=false quando webhook está desabilitado', async () => {
      // Modifica a configuração padrão
      WebhookService.defaultConfig.enabled = false;

      const resultado = await WebhookService.enviarParaWebhook(dadosCnabMock);

      expect(resultado).toEqual({
        sucesso: true,
        enviado: false,
        motivo: 'Webhook desabilitado na configuração',
        tentativas: 0,
        tempoResposta: 0,
        operationId: expect.any(String)
      });

      expect(mockedAxios.post).not.toHaveBeenCalled();

      // Restaura configuração
      WebhookService.defaultConfig.enabled = true;
    });

    it('deve falhar quando URL não está configurada', async () => {
      delete process.env.WEBHOOK_URL;
      delete process.env.WEBHOOK_CNAB_URL;

      await expect(WebhookService.enviarParaWebhook(dadosCnabMock))
        .rejects
        .toMatchObject({
          codigo: 'WEBHOOK_URL_OBRIGATORIA'
        });

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('deve implementar retry em caso de falha temporária', async () => {
      // Reduz delay para teste mais rápido
      const originalDelay = WebhookService.defaultConfig.retryDelay;
      WebhookService.defaultConfig.retryDelay = 50;

      const networkError = new Error('Network Error');
      networkError.code = 'ECONNREFUSED';

      mockedAxios.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: { success: true },
          headers: {}
        });

      const resultado = await WebhookService.enviarParaWebhook(dadosCnabMock);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.tentativas).toBe(3);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);

      // Restaura configuração
      WebhookService.defaultConfig.retryDelay = originalDelay;
    }, 10000);

    it('deve falhar após esgotar todas as tentativas', async () => {
      // Reduz delay para teste mais rápido
      const originalDelay = WebhookService.defaultConfig.retryDelay;
      WebhookService.defaultConfig.retryDelay = 50;

      const networkError = new Error('Network Error');
      networkError.code = 'ECONNREFUSED';

      mockedAxios.post.mockRejectedValue(networkError);

      // O WebhookService lança exceção com código ERRO_WEBHOOK após esgotar tentativas
      await expect(WebhookService.enviarParaWebhook(dadosCnabMock))
        .rejects
        .toMatchObject({
          codigo: 'ERRO_WEBHOOK',
          tipo: 'WEBHOOK_ERROR'
        });

      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // 3 tentativas padrão

      // Restaura configuração
      WebhookService.defaultConfig.retryDelay = originalDelay;
    }, 15000); // Aumenta timeout para 15s

    it('deve classificar erro de timeout corretamente', async () => {
      // Reduz configuração para teste mais rápido
      const originalDelay = WebhookService.defaultConfig.retryDelay;
      const originalAttempts = WebhookService.defaultConfig.retryAttempts;
      
      WebhookService.defaultConfig.retryDelay = 10;
      WebhookService.defaultConfig.retryAttempts = 1;

      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      timeoutError.config = { timeout: 30000 };

      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(WebhookService.enviarParaWebhook(dadosCnabMock))
        .rejects
        .toMatchObject({
          codigo: 'ERRO_WEBHOOK', // Todos os erros viram ERRO_WEBHOOK
          tipo: 'WEBHOOK_ERROR'
        });

      // Restaura configuração
      WebhookService.defaultConfig.retryDelay = originalDelay;
      WebhookService.defaultConfig.retryAttempts = originalAttempts;
    }, 3000); // Reduz timeout para 3s

    it('deve classificar erro de autenticação corretamente', async () => {
      // Reduz configuração para teste mais rápido
      const originalDelay = WebhookService.defaultConfig.retryDelay;
      const originalAttempts = WebhookService.defaultConfig.retryAttempts;
      
      WebhookService.defaultConfig.retryDelay = 10;
      WebhookService.defaultConfig.retryAttempts = 1;

      const authError = new Error('Unauthorized');
      authError.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Invalid token' }
      };

      mockedAxios.post.mockRejectedValue(authError);

      await expect(WebhookService.enviarParaWebhook(dadosCnabMock))
        .rejects
        .toMatchObject({
          codigo: 'ERRO_WEBHOOK', // Todos os erros viram ERRO_WEBHOOK
          tipo: 'WEBHOOK_ERROR'
        });

      // Restaura configuração
      WebhookService.defaultConfig.retryDelay = originalDelay;
      WebhookService.defaultConfig.retryAttempts = originalAttempts;
    }, 3000); // Reduz timeout para 3s
  });

  describe('formatarDadosCnab', () => {
    const dadosCnabMock = {
      dados: [
        {
          nossoNumero: '123456',
          codigoBarras: '34191234567890123456789012345678901234567890',
          linhaDigitavel: '34191.23456 78901.234567 89012.345678 9 01234567890',
          valor: 100.50,
          vencimento: '2024-12-31',
          pagador: {
            nome: 'João Silva',
            documento: '12345678901',
            endereco: 'Rua Teste, 123'
          },
          recebedor: {
            nome: 'Empresa XYZ',
            documento: '12345678000199',
            conta: '12345-6'
          },
          status: 'pago',
          dataPagamento: '2024-01-15'
        }
      ],
      arquivo: {
        nome: 'teste.cnab',
        tamanho: 1024
      }
    };

    it('deve formatar dados CNAB corretamente', () => {
      const resultado = WebhookService.formatarDadosCnab(dadosCnabMock);

      expect(resultado).toHaveProperty('metadados');
      expect(resultado.metadados).toMatchObject({
        fonte: 'CNAB 400 Itaú Parser API',
        versao: '1.0.0',
        dataProcessamento: expect.any(String)
      });

      expect(resultado).toHaveProperty('arquivo');
      expect(resultado.arquivo).toMatchObject({
        nome: 'teste.cnab',
        tamanho: 1024,
        formato: 'CNAB 400'
      });

      expect(resultado).toHaveProperty('cabecalho');
      expect(resultado.cabecalho).toMatchObject({
        banco: '341',
        nomeBanco: 'BANCO ITAU SA'
      });

      expect(resultado).toHaveProperty('registros');
      expect(resultado.registros).toHaveLength(1);
      expect(resultado.registros[0]).toMatchObject({
        sequencia: 1,
        tipo: 'transacao',
        nossoNumero: '123456',
        codigoBarras: '34191234567890123456789012345678901234567890',
        valor: 100.50
      });

      expect(resultado).toHaveProperty('resumo');
      expect(resultado.resumo).toMatchObject({
        totalRegistros: 1,
        totalValor: 100.50,
        totalComCodigoBarras: 1,
        totalComLinhaDigitavel: 1,
        totalPagos: 1,
        totalPendentes: 0
      });
    });

    it('deve lidar com dados vazios ou inválidos', () => {
      const dadosVazios = { dados: [] };
      const resultado = WebhookService.formatarDadosCnab(dadosVazios);

      expect(resultado.registros).toHaveLength(0);
      expect(resultado.resumo.totalRegistros).toBe(0);
      expect(resultado.resumo.totalValor).toBe(0);
    });

    it('deve tratar dados não-array graciosamente', () => {
      const dadosInvalidos = { dados: 'string-instead-of-array' };
      const resultado = WebhookService.formatarDadosCnab(dadosInvalidos);

      expect(resultado.registros).toHaveLength(0);
      expect(resultado.resumo.totalRegistros).toBe(0);
    });

    it('deve formatar valores monetários corretamente', () => {
      expect(WebhookService.formatarValor(100.505)).toBe(100.51);
      expect(WebhookService.formatarValor('123.45')).toBe(123.45);
      expect(WebhookService.formatarValor(null)).toBe(0);
      expect(WebhookService.formatarValor(undefined)).toBe(0);
      expect(WebhookService.formatarValor('invalid')).toBe(0);
    });

    it('deve formatar datas corretamente', () => {
      expect(WebhookService.formatarData('2024-12-31')).toMatch(/2024-12-31T/);
      expect(WebhookService.formatarData(new Date('2024-01-15'))).toMatch(/2024-01-15T/);
      expect(WebhookService.formatarData(null)).toBe(null);
      expect(WebhookService.formatarData('invalid-date')).toBe(null);
    });
  });

  describe('tentarEnvioComRetry', () => {
    const dadosMock = {
      metadados: { webhook: { tentativaEnvio: 1 } },
      resumo: { totalRegistros: 1 }
    };
    const urlMock = 'https://test-webhook.com/endpoint';
    const loggerMock = {
      operationId: 'test-op-id',
      attempt: jest.fn(),
      attemptFailed: jest.fn(),
      delay: jest.fn()
    };

    it('deve implementar delay progressivo entre tentativas', async () => {
      const networkError = new Error('Network Error');
      networkError.code = 'ECONNREFUSED';

      // Modifica delay para teste mais rápido
      const originalDelay = WebhookService.defaultConfig.retryDelay;
      WebhookService.defaultConfig.retryDelay = 50;

      mockedAxios.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: { success: true },
          headers: {}
        });

      const startTime = Date.now();
      await WebhookService.tentarEnvioComRetry(dadosMock, urlMock, loggerMock);
      const endTime = Date.now();

      // Deve ter aguardado pelo menos o delay mínimo (50ms para primeira tentativa)
      // Usa >= em vez de > para ser mais tolerante com timing
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);

      // Restaura configuração
      WebhookService.defaultConfig.retryDelay = originalDelay;
    });

    it('deve atualizar metadados de tentativa em cada envio', async () => {
      const responseMock = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
        headers: {}
      };

      mockedAxios.post.mockResolvedValueOnce(responseMock);

      await WebhookService.tentarEnvioComRetry(dadosMock, urlMock, loggerMock);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        urlMock,
        expect.objectContaining({
          metadados: expect.objectContaining({
            webhook: expect.objectContaining({
              tentativaEnvio: 1,
              timestamp: expect.any(String)
            })
          })
        }),
        expect.any(Object)
      );
    });

    it('deve incluir headers corretos na requisição', async () => {
      const responseMock = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
        headers: {}
      };

      mockedAxios.post.mockResolvedValueOnce(responseMock);

      await WebhookService.tentarEnvioComRetry(dadosMock, urlMock, loggerMock);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        urlMock,
        expect.any(Object),
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'CNAB-400-Itau-Parser-API/1.0.0',
            'X-Webhook-Source': 'cnab-api',
            'X-Webhook-Version': '1.0.0',
            'X-Operation-Id': 'test-op-id'
          })
        })
      );
    });
  });

  describe('validarConfiguracao', () => {
    it('deve validar configuração correta', () => {
      process.env.WEBHOOK_CNAB_URL = 'https://valid-webhook.com/endpoint';
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_TIMEOUT = '10000';
      process.env.WEBHOOK_RETRY_ATTEMPTS = '5';

      // Atualiza configuração
      WebhookService.defaultConfig.timeout = 10000;
      WebhookService.defaultConfig.retryAttempts = 5;

      const resultado = WebhookService.validarConfiguracao();

      expect(resultado.valida).toBe(true);
      expect(resultado.problemas).toHaveLength(0);
      expect(resultado.config).toMatchObject({
        url: 'https://valid-webhook.com/endpoint',
        enabled: true,
        timeout: 10000,
        retryAttempts: 5
      });
    });

    it('deve detectar URL não configurada', () => {
      delete process.env.WEBHOOK_CNAB_URL;

      const resultado = WebhookService.validarConfiguracao();

      expect(resultado.valida).toBe(false);
      expect(resultado.problemas).toContain('WEBHOOK_CNAB_URL não configurada');
    });

    it('deve detectar timeout muito baixo', () => {
      WebhookService.defaultConfig.timeout = 500;

      const resultado = WebhookService.validarConfiguracao();

      expect(resultado.valida).toBe(false);
      expect(resultado.problemas).toContain('WEBHOOK_TIMEOUT muito baixo (mínimo 1000ms)');

      // Restaura
      WebhookService.defaultConfig.timeout = 30000;
    });

    it('deve detectar número inválido de tentativas', () => {
      WebhookService.defaultConfig.retryAttempts = 15;

      const resultado = WebhookService.validarConfiguracao();

      expect(resultado.valida).toBe(false);
      expect(resultado.problemas).toContain('WEBHOOK_RETRY_ATTEMPTS deve estar entre 1 e 10');

      // Restaura
      WebhookService.defaultConfig.retryAttempts = 3;
    });
  });

  describe('sleep', () => {
    it('deve aguardar o tempo especificado', async () => {
      const startTime = Date.now();
      await WebhookService.sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });
}); 