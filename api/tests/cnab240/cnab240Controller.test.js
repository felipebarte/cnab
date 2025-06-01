/**
 * Testes para o controller CNAB 240
 * 
 * Validação dos endpoints implementados na task 16
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cnab240Routes from '../../src/routes/cnab240Routes.js';
import { gerarArquivoCNABCompleto } from './testUtils.js';

// Mock do Logger para evitar logs durante testes
jest.mock('../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    generateOperationId: () => 'test-op-123',
    createCnabLogger: () => ({
      start: jest.fn(),
      processed: jest.fn(),
      error: jest.fn(),
      validation: jest.fn(),
      webhook: jest.fn()
    })
  }
}));

// Mock do WebhookService
jest.mock('../../src/services/webhookService.js', () => ({
  __esModule: true,
  default: {
    enviarParaWebhook: jest.fn().mockResolvedValue({ sucesso: true, status: 200 })
  }
}));

describe('CNAB240Controller - Endpoints da API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use('/api/v1/cnab240', cnab240Routes);
  });

  describe('GET /api/v1/cnab240/info', () => {
    it('deve retornar informações sobre a API CNAB 240', async () => {
      const response = await request(app)
        .get('/api/v1/cnab240/info')
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.informacoes).toBeDefined();
      expect(response.body.informacoes.nome).toContain('CNAB 240');
      expect(response.body.informacoes.formato).toBe('CNAB 240');
      expect(response.body.informacoes.endpoints).toBeInstanceOf(Array);
      expect(response.body.informacoes.recursos).toBeDefined();
    });
  });

  describe('GET /api/v1/cnab240/formatos', () => {
    it('deve listar todos os bancos suportados', async () => {
      const response = await request(app)
        .get('/api/v1/cnab240/formatos')
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.dados).toBeDefined();
      expect(response.body.dados.totalBancos).toBeGreaterThan(0);
      expect(response.body.dados.bancosSuportados).toBeInstanceOf(Array);
      expect(response.body.dados.estatisticas).toBeDefined();
    });
  });

  describe('GET /api/v1/cnab240/formatos/:banco', () => {
    it('deve retornar formato para banco válido (341 - Itaú)', async () => {
      const response = await request(app)
        .get('/api/v1/cnab240/formatos/341')
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.banco).toBe('341');
      expect(response.body.formato).toBeDefined();
      expect(response.body.formato.banco.codigo).toBe('341');
      expect(response.body.formato.operacoesSuportadas).toBeDefined();
      expect(response.body.formato.caracteristicas).toBeDefined();
    });

    it('deve retornar erro para banco não suportado', async () => {
      const response = await request(app)
        .get('/api/v1/cnab240/formatos/999')
        .expect(400);

      expect(response.body.sucesso).toBe(false);
      expect(response.body.erro).toContain('não está configurado');
      expect(response.body.codigo).toBe('BANCO_NAO_SUPORTADO');
    });
  });

  describe('POST /api/v1/cnab240/processar', () => {
    it('deve processar arquivo CNAB 240 válido', async () => {
      const arquivoCompleto = gerarArquivoCNABCompleto({
        quantidadeLotes: 1,
        incluirSegmentos: true
      });

      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({ conteudo: arquivoCompleto })
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.mensagem).toContain('processado com sucesso');
      expect(response.body.dados).toBeDefined();
      expect(response.body.validacao).toBeDefined();
      expect(response.body.somatorias).toBeDefined();
      expect(response.body.resumoProcessamento).toBeDefined();
      expect(response.body.informacoesArquivo).toBeDefined();
    });

    it('deve retornar erro quando conteúdo não é fornecido', async () => {
      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({})
        .expect(400);

      expect(response.body.sucesso).toBe(false);
      expect(response.body.erro).toContain('obrigatório');
      expect(response.body.codigo).toBe('CONTEUDO_OBRIGATORIO');
    });

    it('deve retornar erro para conteúdo vazio', async () => {
      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({ conteudo: '' })
        .expect(400);

      expect(response.body.sucesso).toBe(false);
      expect(response.body.erro).toContain('vazio');
      expect(response.body.codigo).toBe('CNAB_VAZIO');
    });
  });

  describe('POST /api/v1/cnab240/validar', () => {
    it('deve validar arquivo CNAB 240 válido', async () => {
      const arquivoCompleto = gerarArquivoCNABCompleto({
        quantidadeLotes: 1,
        incluirSegmentos: true
      });

      const response = await request(app)
        .post('/api/v1/cnab240/validar')
        .send({ conteudo: arquivoCompleto })
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.valido).toBe(true);
      expect(response.body.informacoesBasicas).toBeDefined();
      expect(response.body.informacoesBasicas.formato).toBe('CNAB 240');
      expect(response.body.informacoesBasicas.totalLinhas).toBeGreaterThan(0);
    });

    it('deve identificar arquivo CNAB 240 inválido', async () => {
      const arquivoInvalido = 'linha muito curta\n';

      const response = await request(app)
        .post('/api/v1/cnab240/validar')
        .send({ conteudo: arquivoInvalido })
        .expect(400);

      expect(response.body.sucesso).toBe(false);
      expect(response.body.valido).toBe(false);
      expect(response.body.erros).toBeDefined();
      expect(response.body.erros.length).toBeGreaterThan(0);
    });

    it('deve retornar erro quando conteúdo não é fornecido', async () => {
      const response = await request(app)
        .post('/api/v1/cnab240/validar')
        .send({})
        .expect(400);

      expect(response.body.sucesso).toBe(false);
      expect(response.body.erro).toContain('obrigatório');
    });
  });

  describe('POST /api/v1/cnab240/processar-webhook', () => {
    it('deve processar arquivo e enviar para webhook quando URL fornecida', async () => {
      const arquivoCompleto = gerarArquivoCNABCompleto({
        quantidadeLotes: 1,
        incluirSegmentos: true
      });

      const response = await request(app)
        .post('/api/v1/cnab240/processar-webhook')
        .send({
          conteudo: arquivoCompleto,
          webhookUrl: 'https://exemplo.com/webhook'
        })
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.webhook.enviado).toBe(true);
      expect(response.body.webhook.url).toBe('https://exemplo.com/webhook');
      expect(response.body.dados).toBeDefined();
    });

    it('deve processar arquivo sem webhook quando URL não fornecida', async () => {
      const arquivoCompleto = gerarArquivoCNABCompleto({
        quantidadeLotes: 1,
        incluirSegmentos: true
      });

      const response = await request(app)
        .post('/api/v1/cnab240/processar-webhook')
        .send({ conteudo: arquivoCompleto })
        .expect(200);

      expect(response.body.sucesso).toBe(true);
      expect(response.body.webhook.enviado).toBe(false);
      expect(response.body.dados).toBeDefined();
    });

    it('deve retornar erro quando conteúdo não é fornecido', async () => {
      const response = await request(app)
        .post('/api/v1/cnab240/processar-webhook')
        .send({})
        .expect(400);

      expect(response.body.sucesso).toBe(false);
      expect(response.body.erro).toContain('obrigatório');
    });
  });

  describe('Validação de entrada comum', () => {
    it('deve incluir operationId em todas as respostas', async () => {
      const response = await request(app)
        .get('/api/v1/cnab240/info')
        .expect(200);

      expect(response.body.informacoes.operationId).toBeDefined();
    });

    it('deve incluir formato CNAB 240 em respostas de erro', async () => {
      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({})
        .expect(400);

      expect(response.body.formato).toBe('CNAB 240');
    });

    it('deve incluir timestamp em respostas de erro', async () => {
      const response = await request(app)
        .get('/api/v1/cnab240/formatos/999')
        .expect(400);

      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Tratamento de erros', () => {
    it('deve tratar erros internos adequadamente', async () => {
      // Simula um erro interno usando conteúdo que causa problemas no processamento
      const conteudoProblematico = 'x'.repeat(240) + '\n' + 'y'.repeat(240);

      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({ conteudo: conteudoProblematico });

      // Deve retornar erro mas não quebrar a aplicação
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.sucesso).toBe(false);
      expect(response.body.codigo).toBeDefined();
      expect(response.body.operationId).toBeDefined();
    });
  });

  describe('Estrutura de resposta', () => {
    it('deve ter estrutura consistente nas respostas de sucesso', async () => {
      const arquivoCompleto = gerarArquivoCNABCompleto();

      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({ conteudo: arquivoCompleto })
        .expect(200);

      // Verificar estrutura base
      expect(response.body).toHaveProperty('sucesso');
      expect(response.body).toHaveProperty('operationId');
      expect(response.body).toHaveProperty('dataProcessamento');

      // Verificar estrutura específica do processamento
      expect(response.body).toHaveProperty('dados');
      expect(response.body).toHaveProperty('validacao');
      expect(response.body).toHaveProperty('somatorias');
      expect(response.body).toHaveProperty('resumoProcessamento');
      expect(response.body).toHaveProperty('informacoesArquivo');
    });

    it('deve ter estrutura consistente nas respostas de erro', async () => {
      const response = await request(app)
        .post('/api/v1/cnab240/processar')
        .send({});

      // Verificar estrutura base de erro
      expect(response.body).toHaveProperty('sucesso', false);
      expect(response.body).toHaveProperty('erro');
      expect(response.body).toHaveProperty('codigo');
      expect(response.body).toHaveProperty('operationId');
      expect(response.body).toHaveProperty('formato', 'CNAB 240');
    });
  });
}); 