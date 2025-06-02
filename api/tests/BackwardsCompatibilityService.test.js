/**
 * Testes para BackwardsCompatibilityService
 * 
 * Testa todas as funcionalidades do sistema de compatibilidade
 * com versões anteriores da API CNAB.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import BackwardsCompatibilityService from '../src/services/BackwardsCompatibilityService.js';

describe('BackwardsCompatibilityService', () => {
  let compatibilityService;

  beforeEach(() => {
    compatibilityService = new BackwardsCompatibilityService();
  });

  describe('Inicialização', () => {
    it('deve inicializar com configurações padrão', () => {
      const service = new BackwardsCompatibilityService();
      expect(service.config.preserveLegacyFormat).toBe(true);
      expect(service.config.enableVersionDetection).toBe(true);
      expect(service.config.strictCompatibility).toBe(true);
    });

    it('deve aceitar configurações customizadas', () => {
      const config = {
        preserveLegacyFormat: false,
        enableVersionDetection: false
      };
      const service = new BackwardsCompatibilityService(config);
      expect(service.config.preserveLegacyFormat).toBe(false);
      expect(service.config.enableVersionDetection).toBe(false);
    });

    it('deve inicializar mapeamentos de endpoints legacy', () => {
      const stats = compatibilityService.getUsageStats();
      expect(stats.totalLegacyEndpoints).toBeGreaterThan(0);
      expect(stats.adaptersMapped).toBeGreaterThan(0);
    });
  });

  describe('Detecção de Endpoints Legacy', () => {
    it('deve identificar endpoints CNAB 400 legacy', () => {
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/info')).toBe(true);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/processar')).toBe(true);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/upload')).toBe(true);
    });

    it('deve identificar endpoints CNAB 240 legacy', () => {
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab240/info')).toBe(true);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab240/processar')).toBe(true);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab240/validar')).toBe(true);
    });

    it('deve identificar endpoints Unified legacy', () => {
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/info-auto')).toBe(true);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/processar-auto')).toBe(true);
    });

    it('deve retornar false para endpoints modernos', () => {
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/universal/processar')).toBe(false);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/cnab/universal/validar')).toBe(false);
      expect(compatibilityService.isLegacyEndpoint('/api/v1/compatibility/info')).toBe(false);
    });
  });

  describe('Informações de Endpoints Legacy', () => {
    it('deve retornar informações corretas para endpoints CNAB 400', () => {
      const info = compatibilityService.getLegacyEndpointInfo('/api/v1/cnab/info');
      expect(info).toBeDefined();
      expect(info.type).toBe('cnab400');
      expect(info.operation).toBe('info');
      expect(info.newEndpoint).toBe('/api/v1/cnab/universal/info');
      expect(info.adapter).toBe('cnab400InfoAdapter');
    });

    it('deve retornar informações corretas para endpoints CNAB 240', () => {
      const info = compatibilityService.getLegacyEndpointInfo('/api/v1/cnab240/processar');
      expect(info).toBeDefined();
      expect(info.type).toBe('cnab240');
      expect(info.operation).toBe('process');
      expect(info.newEndpoint).toBe('/api/v1/cnab/universal/processar');
    });

    it('deve retornar undefined para endpoints não legacy', () => {
      const info = compatibilityService.getLegacyEndpointInfo('/api/v1/cnab/universal/processar');
      expect(info).toBeUndefined();
    });
  });

  describe('Adaptação de Parâmetros', () => {
    it('deve mapear parâmetros CNAB 400 corretamente', () => {
      const legacyParams = {
        conteudo: 'arquivo cnab content',
        opcoes: { validate: true }
      };

      const adapted = compatibilityService.adaptRequestParams('/api/v1/cnab/processar', legacyParams);
      expect(adapted.content).toBe('arquivo cnab content');
      expect(adapted.options).toEqual({ validate: true });
      expect(adapted.conteudo).toBe('arquivo cnab content'); // Preservar original
    });

    it('deve mapear parâmetros de arquivo corretamente', () => {
      const legacyParams = {
        arquivo: 'file.txt',
        conteudo: 'file content'
      };

      const adapted = compatibilityService.adaptRequestParams('/api/v1/cnab/upload', legacyParams);
      expect(adapted.file).toBe('file.txt');
      expect(adapted.content).toBe('file content');
    });

    it('deve preservar parâmetros para endpoints não legacy', () => {
      const params = { content: 'test', options: { validate: true } };
      const adapted = compatibilityService.adaptRequestParams('/api/v1/cnab/universal/processar', params);
      expect(adapted).toEqual(params);
    });
  });

  describe('Adaptação de Respostas', () => {
    const mockModernResponse = {
      success: true,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: {
        version: '2.0.0',
        file: { name: 'test.txt', size: 1024 },
        parsing: {
          metadata: { totalLines: 100, validLines: 95, errorLines: 5 },
          data: { payments: [{ id: 1, amount: 100 }] },
          errors: [],
          warnings: []
        },
        validation: {
          isValid: true,
          score: 95,
          errors: [],
          warnings: [],
          structure: { valid: true },
          metadata: { totalLines: 100 }
        }
      },
      metadata: {
        timing: { total: '150ms' }
      }
    };

    it('deve adaptar resposta de info CNAB 400', () => {
      const adapted = compatibilityService.adaptResponse('/api/v1/cnab/info', mockModernResponse);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.api).toBe('CNAB 400 API');
      expect(adapted.versao).toBe('2.0.0');
      expect(adapted.recursos).toContain('Processamento de arquivos CNAB 400');
      expect(adapted._deprecationWarning).toBeDefined();
    });

    it('deve adaptar resposta de processamento CNAB 400', () => {
      const adapted = compatibilityService.adaptResponse('/api/v1/cnab/processar', mockModernResponse);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.arquivo.nome).toBe('test.txt');
      expect(adapted.arquivo.formato).toBe('CNAB 400');
      expect(adapted.processamento.registrosProcessados).toBe(100);
      expect(adapted.processamento.tempoProcessamento).toBe('150ms');
      expect(adapted.dados).toEqual({ payments: [{ id: 1, amount: 100 }] });
    });

    it('deve adaptar resposta de validação CNAB 400', () => {
      const adapted = compatibilityService.adaptResponse('/api/v1/cnab/validar', mockModernResponse);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.valido).toBe(true);
      expect(adapted.score).toBe(95);
      expect(adapted.detalhes.formato).toBe('CNAB 400');
      expect(adapted.detalhes.estruturaValida).toBe(true);
    });

    it('deve adaptar resposta de info CNAB 240', () => {
      const responseWith240Data = {
        ...mockModernResponse,
        data: {
          ...mockModernResponse.data,
          detection: { bankCode: '341' },
          supportedBanks: ['341', '001', '237']
        }
      };

      const adapted = compatibilityService.adaptResponse('/api/v1/cnab240/info', responseWith240Data);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.api).toBe('CNAB 240 API');
      expect(adapted.bancos).toEqual(['341', '001', '237']);
      expect(adapted.recursos).toContain('Suporte a múltiplos bancos');
    });

    it('deve adaptar resposta de processamento CNAB 240', () => {
      const responseWith240Data = {
        ...mockModernResponse,
        data: {
          ...mockModernResponse.data,
          detection: { bankCode: '341' },
          parsing: {
            ...mockModernResponse.data.parsing,
            metadata: {
              ...mockModernResponse.data.parsing.metadata,
              batches: 5,
              segments: { A: 10, B: 15, C: 20 }
            }
          }
        }
      };

      const adapted = compatibilityService.adaptResponse('/api/v1/cnab240/processar', responseWith240Data);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.arquivo.formato).toBe('CNAB 240');
      expect(adapted.arquivo.banco).toBe('341');
      expect(adapted.processamento.lotes).toBe(5);
      expect(adapted.processamento.segmentos).toEqual({ A: 10, B: 15, C: 20 });
    });

    it('deve adaptar resposta de códigos de barras', () => {
      const responseWithBarcodes = {
        ...mockModernResponse,
        data: {
          ...mockModernResponse.data,
          parsing: {
            ...mockModernResponse.data.parsing,
            data: {
              payments: [
                { barcode: '12345678901234567890123456789012345678901234' },
                { barcode: '98765432109876543210987654321098765432109876' }
              ]
            }
          }
        }
      };

      const adapted = compatibilityService.adaptResponse('/api/v1/cnab/codigos-barras', responseWithBarcodes);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.codigosBarras).toHaveLength(2);
      expect(adapted.codigosBarras[0]).toBe('12345678901234567890123456789012345678901234');
      expect(adapted.total).toBe(2);
    });

    it('deve adaptar resposta de linhas digitáveis', () => {
      const responseWithDigitable = {
        ...mockModernResponse,
        data: {
          ...mockModernResponse.data,
          parsing: {
            ...mockModernResponse.data.parsing,
            data: {
              payments: [
                { digitableLine: '12345.67890 12345.678901 12345.678901 1 234567890123456' },
                { digitableLine: '98765.43210 98765.432109 98765.432109 9 876543210987654' }
              ]
            }
          }
        }
      };

      const adapted = compatibilityService.adaptResponse('/api/v1/cnab/linhas-digitaveis', responseWithDigitable);

      expect(adapted.sucesso).toBe(true);
      expect(adapted.linhasDigitaveis).toHaveLength(2);
      expect(adapted.linhasDigitaveis[0]).toBe('12345.67890 12345.678901 12345.678901 1 234567890123456');
      expect(adapted.total).toBe(2);
    });

    it('deve adaptar resposta de erro corretamente', () => {
      const errorResponse = {
        success: false,
        error: {
          message: 'Erro de processamento',
          details: { code: 'PROCESSING_ERROR' }
        }
      };

      const adapted = compatibilityService.adaptResponse('/api/v1/cnab/processar', errorResponse);

      expect(adapted.sucesso).toBe(false);
      expect(adapted.erro).toBe('Erro de processamento');
      expect(adapted.detalhes).toEqual({ code: 'PROCESSING_ERROR' });
    });

    it('deve retornar resposta original se adaptador não existe', () => {
      // Criar endpoint sem adaptador configurado
      const service = new BackwardsCompatibilityService();
      service.legacyEndpoints.set('/test/endpoint', { adapter: 'nonExistentAdapter' });

      const adapted = service.adaptResponse('/test/endpoint', mockModernResponse);
      expect(adapted).toEqual(mockModernResponse);
    });
  });

  describe('Estatísticas de Uso', () => {
    it('deve retornar estatísticas corretas', () => {
      const stats = compatibilityService.getUsageStats();

      expect(stats).toHaveProperty('totalLegacyEndpoints');
      expect(stats).toHaveProperty('adaptersMapped');
      expect(stats).toHaveProperty('deprecationWarnings');
      expect(stats).toHaveProperty('configEnabled');

      expect(stats.totalLegacyEndpoints).toBeGreaterThan(0);
      expect(stats.adaptersMapped).toBeGreaterThan(0);
      expect(stats.configEnabled).toBe(true);
    });
  });

  describe('Lista de Endpoints Legacy', () => {
    it('deve listar todos os endpoints legacy', () => {
      const endpoints = compatibilityService.listLegacyEndpoints();

      expect(Array.isArray(endpoints)).toBe(true);
      expect(endpoints.length).toBeGreaterThan(0);

      endpoints.forEach(endpoint => {
        expect(endpoint).toHaveProperty('legacyPath');
        expect(endpoint).toHaveProperty('newPath');
        expect(endpoint).toHaveProperty('type');
        expect(endpoint).toHaveProperty('operation');
        expect(endpoint).toHaveProperty('deprecatedSince');
        expect(endpoint).toHaveProperty('removeIn');
        expect(endpoint).toHaveProperty('hasAdapter');
      });
    });

    it('deve incluir diferentes tipos de endpoints', () => {
      const endpoints = compatibilityService.listLegacyEndpoints();
      const types = [...new Set(endpoints.map(e => e.type))];

      expect(types).toContain('cnab400');
      expect(types).toContain('cnab240');
      expect(types).toContain('unified');
    });
  });

  describe('Middleware de Headers', () => {
    it('deve adicionar headers de compatibilidade para endpoints legacy', () => {
      const req = { path: '/api/v1/cnab/info' };
      const res = {
        headers: {},
        set: function (key, value) { this.headers[key] = value; }
      };
      const next = jest.fn();

      compatibilityService.addCompatibilityHeaders(req, res, next);

      expect(res.headers['X-API-Deprecated']).toBe('true');
      expect(res.headers['X-API-Deprecated-Since']).toBe('2.0.0');
      expect(res.headers['X-API-Remove-In']).toBe('3.0.0');
      expect(res.headers['X-API-New-Endpoint']).toBe('/api/v1/cnab/universal/info');
      expect(res.headers['X-API-Compatibility-Mode']).toBe('legacy');
      expect(next).toHaveBeenCalled();
    });

    it('deve adicionar headers modernos para endpoints não legacy', () => {
      const req = { path: '/api/v1/cnab/universal/processar' };
      const res = {
        headers: {},
        set: function (key, value) { this.headers[key] = value; }
      };
      const next = jest.fn();

      compatibilityService.addCompatibilityHeaders(req, res, next);

      expect(res.headers['X-API-Compatibility-Mode']).toBe('modern');
      expect(res.headers['X-API-Deprecated']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Avisos de Deprecação', () => {
    it('deve incluir avisos de deprecação quando habilitado', () => {
      const service = new BackwardsCompatibilityService({
        enableVersionDetection: true
      });

      const mockResponse = { success: true, data: {} };
      const adapted = service.adaptResponse('/api/v1/cnab/info', mockResponse);

      expect(adapted._deprecationWarning).toBeDefined();
      expect(adapted._newEndpoint).toBe('/api/v1/cnab/universal/info');
    });

    it('não deve incluir avisos quando desabilitado', () => {
      const service = new BackwardsCompatibilityService({
        enableVersionDetection: false
      });

      const mockResponse = { success: true, data: {} };
      const adapted = service.adaptResponse('/api/v1/cnab/info', mockResponse);

      expect(adapted._deprecationWarning).toBeUndefined();
      expect(adapted._newEndpoint).toBeUndefined();
    });
  });
}); 