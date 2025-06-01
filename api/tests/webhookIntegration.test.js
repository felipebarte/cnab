import request from 'supertest';
import app from '../src/index.js';
import WebhookMockServer from './mocks/webhookMockServer.js';

// Mock dos loggers para não poluir output dos testes
jest.mock('../src/utils/logger.js', () => ({
  generateOperationId: jest.fn(() => 'test-operation-id'),
  calculateResponseTime: jest.fn(() => 1000),
  createWebhookLogger: jest.fn(() => ({
    start: jest.fn(),
    attempt: jest.fn(),
    success: jest.fn(),
    attemptFailed: jest.fn(),
    failed: jest.fn(),
    delay: jest.fn(),
    timeout: jest.fn(),
  })),
  createCnabLogger: jest.fn(() => ({
    start: jest.fn(),
    validation: jest.fn(),
    processed: jest.fn(),
    error: jest.fn(),
  })),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Webhook Integration Tests', () => {
  let mockServer;
  let mockServerUrl;

  // Dados CNAB válidos para testes
  const conteudoCnabValido = `34100000001234567890BANCO ITAU SA       123456789012345    240125000001400000
34100001001234567890001JOAO SILVA              00000123456R$ 000000010050240131000000001000
34100001001234567890002MARIA SANTOS            00000654321R$ 000000020075240228000000002000
341000000030000000000300000003007500000000000000000000000000000000000000000000000000000`;

  const arquivoCnabBuffer = Buffer.from(conteudoCnabValido, 'utf8');

  beforeAll(async () => {
    // Inicia o mock server
    mockServer = new WebhookMockServer();
    const port = await mockServer.start();
    mockServerUrl = mockServer.getBaseUrl();
    console.log(`🎯 Mock server iniciado em ${mockServerUrl}`);
  });

  afterAll(async () => {
    // Para o mock server
    await mockServer.stop();
  });

  beforeEach(() => {
    // Reset do mock server antes de cada teste
    mockServer.reset();

    // Configuração padrão das variáveis de ambiente
    process.env.WEBHOOK_ENABLED = 'true';
    process.env.WEBHOOK_TIMEOUT = '5000';
    process.env.WEBHOOK_RETRY_ATTEMPTS = '3';
    process.env.WEBHOOK_RETRY_DELAY = '1000'; // Delay reduzido para testes
  });

  describe('POST /api/v1/cnab/processar-webhook', () => {
    it('deve processar CNAB via texto e enviar para webhook com sucesso', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(200);

      // Verifica resposta da API
      expect(response.body).toMatchObject({
        sucesso: true,
        mensagem: 'CNAB processado e enviado para webhook com sucesso',
        dados: expect.objectContaining({
          totalRegistros: expect.any(Number),
          dataProcessamento: expect.any(String)
        }),
        webhook: expect.objectContaining({
          enviado: true,
          url: webhookUrl,
          status: 'sucesso',
          tentativas: 1
        })
      });

      // Aguarda o webhook ser chamado
      const receivedRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
      expect(receivedRequest).toBeTruthy();

      // Verifica dados enviados para o webhook
      expect(receivedRequest.body).toMatchObject({
        metadados: expect.objectContaining({
          fonte: 'CNAB 400 Itaú Parser API',
          versao: '1.0.0'
        }),
        arquivo: expect.objectContaining({
          formato: 'CNAB 400'
        }),
        registros: expect.any(Array),
        resumo: expect.objectContaining({
          totalRegistros: expect.any(Number),
          totalValor: expect.any(Number)
        })
      });

      // Verifica headers da requisição webhook
      expect(receivedRequest.headers).toMatchObject({
        'content-type': 'application/json',
        'user-agent': 'CNAB-400-Itau-Parser-API/1.0.0',
        'x-webhook-source': 'cnab-api',
        'x-webhook-version': '1.0.0'
      });
    });

    it('deve retornar erro quando conteúdo CNAB está vazio', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: '',
          webhookUrl: webhookUrl
        })
        .expect(400);

      expect(response.body).toMatchObject({
        sucesso: false,
        erro: 'Conteúdo CNAB está vazio',
        codigo: 'CNAB_VAZIO'
      });

      // Verifica que webhook não foi chamado
      expect(mockServer.countRequestsForPath('/webhook/cnab')).toBe(0);
    });

    it('deve retornar erro quando URL do webhook não é fornecida', async () => {
      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido
        })
        .expect(400);

      expect(response.body).toMatchObject({
        sucesso: false,
        codigo: 'WEBHOOK_URL_OBRIGATORIA'
      });
    });

    it('deve implementar retry quando webhook falha temporariamente', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/retry');

      // Configura para falhar 2 vezes e depois funcionar
      mockServer.setResponse('/webhook/retry', { successAfter: 3, delay: 100 });

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(200);

      // Verifica que foi bem-sucedido após retries
      expect(response.body.webhook.enviado).toBe(true);
      expect(response.body.webhook.tentativas).toBe(3);

      // Verifica que foram feitas 3 tentativas
      await mockServer.waitForRequests(3);
      expect(mockServer.countRequestsForPath('/webhook/retry')).toBe(3);
    });

    it('deve falhar após esgotar todas as tentativas de retry', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/error');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(500);

      expect(response.body).toMatchObject({
        sucesso: false,
        webhook: expect.objectContaining({
          enviado: false,
          tentativas: 0
        }),
        cnab: expect.objectContaining({
          processado: true
        })
      });

      // Verifica que foram feitas 3 tentativas
      await mockServer.waitForRequests(3);
      expect(mockServer.countRequestsForPath('/webhook/error')).toBe(3);
    });

    it('deve tratar erro de timeout do webhook', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/timeout');

      // Reduz timeout para teste mais rápido
      process.env.WEBHOOK_TIMEOUT = '1000';

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(504);

      expect(response.body).toMatchObject({
        sucesso: false,
        codigo: 'WEBHOOK_TIMEOUT'
      });
    });

    it('deve usar variável de ambiente WEBHOOK_URL quando não fornecida no body', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');
      process.env.WEBHOOK_URL = webhookUrl;

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido
        })
        .expect(200);

      expect(response.body.webhook.url).toBe(webhookUrl);

      const receivedRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
      expect(receivedRequest).toBeTruthy();
    });
  });

  describe('POST /api/v1/cnab/processar-webhook-upload', () => {
    it('deve processar arquivo CNAB via upload e enviar para webhook', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook-upload')
        .field('webhookUrl', webhookUrl)
        .attach('arquivo', arquivoCnabBuffer, 'teste.cnab')
        .expect(200);

      expect(response.body).toMatchObject({
        sucesso: true,
        webhook: expect.objectContaining({
          enviado: true,
          url: webhookUrl
        }),
        processamento: expect.objectContaining({
          tipo: 'upload',
          arquivo: expect.objectContaining({
            nome: 'teste.cnab'
          })
        })
      });

      const receivedRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
      expect(receivedRequest.body.arquivo.nome).toBe('teste.cnab');
    });

    it('deve retornar erro quando nenhum arquivo é enviado', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook-upload')
        .field('webhookUrl', webhookUrl)
        .expect(400);

      expect(response.body).toMatchObject({
        sucesso: false,
        erro: 'É necessário enviar um arquivo via upload ou conteúdo via campo "conteudo"',
        codigo: 'CONTEUDO_OBRIGATORIO'
      });
    });

    it('deve processar arquivo mesmo com problemas de validação CNAB', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');
      const conteudoInvalido = 'conteudo-cnab-com-problemas-de-formatacao';

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook-upload')
        .field('webhookUrl', webhookUrl)
        .attach('arquivo', Buffer.from(conteudoInvalido), 'invalido.cnab')
        .expect(200);

      // Deve processar mesmo com problemas de validação
      expect(response.body.sucesso).toBe(true);
      expect(response.body.validacao.valido).toBe(false);
      expect(response.body.webhook.enviado).toBe(true);

      const receivedRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
      expect(receivedRequest).toBeTruthy();
    });
  });

  describe('Cenários de erro específicos', () => {
    it('deve tratar erro 401 (Unauthorized) do webhook', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/unauthorized');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(401);

      expect(response.body).toMatchObject({
        sucesso: false,
        codigo: 'WEBHOOK_AUTH_ERROR'
      });
    });

    it('deve incluir informações de debugging em ambiente de desenvolvimento', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const webhookUrl = mockServer.getUrl('/webhook/error');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(500);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.webhook).toHaveProperty('detalhesErro');

      process.env.NODE_ENV = originalEnv;
    });

    it('deve respeitar configuração de webhook desabilitado', async () => {
      process.env.WEBHOOK_ENABLED = 'false';
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(200);

      expect(response.body.webhook.enviado).toBe(false);
      expect(response.body.webhook.detalhes).toContain('desabilitado');

      // Verifica que webhook não foi chamado
      expect(mockServer.countRequestsForPath('/webhook/cnab')).toBe(0);
    });
  });

  describe('Validação de dados enviados para webhook', () => {
    it('deve incluir todos os campos obrigatórios na estrutura de dados', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(200);

      const receivedRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
      const dados = receivedRequest.body;

      // Verifica estrutura completa
      expect(dados).toHaveProperty('metadados');
      expect(dados).toHaveProperty('arquivo');
      expect(dados).toHaveProperty('cabecalho');
      expect(dados).toHaveProperty('registros');
      expect(dados).toHaveProperty('resumo');

      // Verifica metadados
      expect(dados.metadados).toMatchObject({
        fonte: 'CNAB 400 Itaú Parser API',
        versao: '1.0.0',
        dataProcessamento: expect.any(String),
        webhook: expect.objectContaining({
          tentativaEnvio: expect.any(Number),
          timestamp: expect.any(String)
        })
      });

      // Verifica resumo
      expect(dados.resumo).toMatchObject({
        totalRegistros: expect.any(Number),
        totalValor: expect.any(Number),
        totalComCodigoBarras: expect.any(Number),
        totalComLinhaDigitavel: expect.any(Number),
        totalPagos: expect.any(Number),
        totalPendentes: expect.any(Number),
        dataProcessamento: expect.any(String)
      });

      // Verifica se registros têm estrutura correta
      if (dados.registros.length > 0) {
        expect(dados.registros[0]).toMatchObject({
          sequencia: expect.any(Number),
          tipo: 'transacao',
          nossoNumero: expect.any(String),
          valor: expect.any(Number),
          pagador: expect.objectContaining({
            nome: expect.any(String)
          }),
          recebedor: expect.objectContaining({
            nome: expect.any(String)
          })
        });
      }
    });

    it('deve atualizar metadados de tentativa a cada retry', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/retry');
      mockServer.setResponse('/webhook/retry', { successAfter: 2, delay: 50 });

      await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(200);

      await mockServer.waitForRequests(2);
      const requests = mockServer.getRequestsForPath('/webhook/retry');

      // Primeira tentativa
      expect(requests[0].body.metadados.webhook.tentativaEnvio).toBe(1);
      expect(requests[0].headers['x-tentativa']).toBe('1');

      // Segunda tentativa
      expect(requests[1].body.metadados.webhook.tentativaEnvio).toBe(2);
      expect(requests[1].headers['x-tentativa']).toBe('2');
    });
  });

  describe('Performance e limites', () => {
    it('deve processar arquivo grande dentro do limite de timeout', async () => {
      // Cria um conteúdo CNAB maior
      const linhasExtras = Array(100).fill().map((_, i) =>
        `34100001001234567890${String(i).padStart(3, '0')}CLIENTE ${i}              00000${String(i).padStart(6, '0')}R$ 000000010050240131000000001000`
      ).join('\n');

      const conteudoGrande = conteudoCnabValido + '\n' + linhasExtras;
      const webhookUrl = mockServer.getUrl('/webhook/cnab');

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoGrande,
          webhookUrl: webhookUrl
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.webhook.enviado).toBe(true);
      expect(responseTime).toBeLessThan(10000); // Menos de 10 segundos

      const receivedRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
      expect(receivedRequest.body.resumo.totalRegistros).toBeGreaterThan(100);
    });

    it('deve respeitar timeout configurado', async () => {
      const webhookUrl = mockServer.getUrl('/webhook/timeout');
      process.env.WEBHOOK_TIMEOUT = '2000'; // 2 segundos

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/cnab/processar-webhook')
        .send({
          conteudo: conteudoCnabValido,
          webhookUrl: webhookUrl
        })
        .expect(504);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.codigo).toBe('WEBHOOK_TIMEOUT');
      expect(responseTime).toBeGreaterThan(2000); // Pelo menos o timeout
      expect(responseTime).toBeLessThan(8000); // Não muito mais que o timeout + retries
    });
  });
}); 