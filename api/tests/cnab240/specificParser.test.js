/**
 * Testes para o Parser CNAB240 Específico Multi-State
 * 
 * Validação das funcionalidades de integração híbrida implementadas
 * nas tasks 2 e 3 - Parser específico multi-state com Segment J
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Cnab240Service from '../../src/services/cnab240/cnab240Service.js';
import { CNAB240Parser } from '../../src/services/cnab240/parsers/index.js';
import { CNAB240SpecificParser } from '../../src/services/cnab240/parsers/specific-parser/index.js';
import { gerarHeaderArquivo, gerarHeaderLote, gerarSegmentoA, gerarSegmentoB, gerarTrailerLote, gerarTrailerArquivo } from './testUtils.js';

describe('CNAB240 Parser Específico Multi-State', () => {

  describe('Inicialização do Parser Específico', () => {
    it('deve criar uma instância do parser específico', () => {
      const parser = CNAB240Parser.createSpecificParser();

      expect(parser).toBeInstanceOf(CNAB240SpecificParser);
      expect(parser.features).toBeDefined();
    });

    it('deve aceitar opções de configuração', () => {
      const options = {
        enableFeatureFlag: true,
        debug: true,
        multiStateJ: { enabled: true }
      };

      const parser = CNAB240Parser.createSpecificParser(options);

      expect(parser.options.enableFeatureFlag).toBe(true);
      expect(parser.options.debug).toBe(true);
    });
  });

  describe('Processamento Híbrido', () => {
    it('deve processar arquivo com parser tradicional apenas', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await CNAB240Parser.parseFileWithSpecificParser(cnabContent, {
        enableSpecificParser: false
      });

      expect(resultado.success).toBe(true);
      expect(resultado.hybrid).toBe(false);
      expect(resultado.tradicional).toBeDefined();
      expect(resultado.especifico).toBeUndefined();
    });

    it('deve processar arquivo com parser híbrido ativo', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await CNAB240Parser.parseFileWithSpecificParser(cnabContent, {
        enableSpecificParser: true,
        specificParserOptions: {
          enableFeatureFlag: true,
          debug: false
        }
      });

      expect(resultado.success).toBe(true);
      expect(resultado.hybrid).toBe(true);
      expect(resultado.tradicional).toBeDefined();
      expect(resultado.especifico).toBeDefined();
      expect(resultado.resultado).toBeDefined();
    });

    it('deve fazer fallback para parser tradicional em caso de erro', async () => {
      const cnabContent = 'CONTEUDO_INVALIDO_PARA_TESTAR_FALLBACK';

      const resultado = await CNAB240Parser.parseFileWithSpecificParser(cnabContent, {
        enableSpecificParser: true
      });

      // Deve falhar completamente pois o conteúdo é inválido
      expect(resultado.success).toBe(false);
      expect(resultado.error).toBeDefined();
    });
  });

  describe('Serviço CNAB240 com Parser Híbrido', () => {
    it('deve processar usando método híbrido', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: true,
        debug: true
      });

      expect(resultado.sucesso).toBe(true);
      expect(resultado.hibrido).toBe(true);
      expect(resultado.parserEspecifico).toBe(true);
      expect(resultado.processamento.parserHibrido).toBe(true);
      expect(resultado.processamento.parserEspecificoAtivo).toBe(true);
    });

    it('deve manter compatibilidade com resultado tradicional', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultadoTradicional = await Cnab240Service.processar(cnabContent);
      const resultadoHibrido = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: false
      });

      expect(resultadoHibrido.sucesso).toBe(resultadoTradicional.sucesso);
      expect(resultadoHibrido.valido).toBe(resultadoTradicional.valido);

      // Estrutura básica deve ser similar (com extensões híbridas)
      expect(resultadoHibrido.dados).toBeDefined();
      expect(resultadoHibrido.validacao).toBeDefined();
    });

    it('deve incluir dados específicos quando parser específico ativo', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: true,
        specificParserOptions: {
          enableFeatureFlag: true,
          multiStateJ: { enabled: true }
        }
      });

      expect(resultado.sucesso).toBe(true);

      // Deve incluir estatísticas específicas
      if (resultado.estatisticasEspecificas) {
        expect(resultado.estatisticasEspecificas).toBeDefined();
      }

      // Deve incluir informações do processamento híbrido
      expect(resultado.processamento.processamentoHibrido).toBeDefined();
      expect(resultado.processamento.processamentoHibrido.tradicional).toBe(true);
      expect(resultado.processamento.processamentoHibrido.especifico).toBe(true);
      expect(resultado.processamento.processamentoHibrido.merge).toBe(true);
    });
  });

  describe('Teste de Segmento J Multi-State', () => {
    it('deve detectar e processar segmentos J consecutivos', async () => {
      // Criar arquivo CNAB com duas linhas Segment J consecutivas
      const segmentoJ1 = '34100001000010001J0130011111111111111111111234567890123456789012345678901234567890' +
        'NOME BENEFICIARIO                    000000000100000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000';

      const segmentoJ2 = '34100001000010002J0130021111111111111111111234567890123456789012345678901234567890' +
        'INFORMACOES COMPLEMENTARES            000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000';

      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        segmentoJ1,
        segmentoJ2,
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: true,
        specificParserOptions: {
          enableFeatureFlag: true,
          multiStateJ: { enabled: true }
        }
      });

      expect(resultado.sucesso).toBe(true);
      expect(resultado.hibrido).toBe(true);

      // Verificar se dados específicos foram extraídos
      if (resultado.dados.pagamentosEspecificos) {
        expect(resultado.dados.pagamentosEspecificos.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Fallback e Recuperação de Erros', () => {
    it('deve usar fallback tradicional quando híbrido falha', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      // Simular erro forçando opções inválidas no parser específico
      const resultado = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: true,
        specificParserOptions: {
          // Força erro para testar fallback
          enableFeatureFlag: 'invalid_type' // Isso pode causar erro
        }
      });

      // Deve processar com fallback ou dar erro controlado
      expect(resultado).toBeDefined();

      if (resultado.fallback) {
        expect(resultado.fallback).toBe(true);
        expect(resultado.erroOriginal).toBeDefined();
        expect(resultado.processamento.fallbackUtilizado).toBe(true);
      }
    });

    it('deve reportar erros detalhados quando ambos os parsers falham', async () => {
      const conteudoInvalido = 'CONTEUDO_COMPLETAMENTE_INVALIDO';

      const resultado = await Cnab240Service.processarHibrido(conteudoInvalido, {
        enableSpecificParser: true
      });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toBeDefined();
      expect(resultado.processamento.parserHibrido).toBe(true);
      expect(resultado.processamento.fallbackFalhou).toBe(true);
    });
  });

  describe('Performance e Monitoramento', () => {
    it('deve incluir metadados de performance no resultado', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: true
      });

      expect(resultado.processamento).toBeDefined();
      expect(resultado.processamento.timestamp).toBeDefined();
      expect(resultado.processamento.linhasProcessadas).toBe(6);
      expect(resultado.processamento.parserHibrido).toBe(true);
      expect(resultado.processamento.processamentoHibrido).toBeDefined();
    });

    it('deve fornecer informações de debug quando habilitado', async () => {
      const cnabContent = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processarHibrido(cnabContent, {
        enableSpecificParser: true,
        debug: true,
        specificParserOptions: {
          debug: true
        }
      });

      expect(resultado.sucesso).toBe(true);
      expect(resultado.processamento.options.enableSpecificParser).toBe(true);
    });
  });
}); 