/**
 * Testes de Performance para PositionalExtractor Otimizado
 * 
 * Validação das otimizações implementadas na Task 4.6:
 * - Cache de validações e strings
 * - Batch processing
 * - Lazy loading de regex
 * - Performance stats
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PositionalExtractor } from '../../src/services/cnab240/parsers/specific-parser/positionalExtractor.js';

describe('PositionalExtractor - Testes de Performance', () => {

  let extractor;
  const linhaSegmentoJ = '237000130000000001J 01123456789012345678901234567890123456789012345NOME DO BENEFICIARIO TESTE           151220240000012345000001234515122024000001234500000000000000000000000000000000INFORMACOES COMPLEMENTARES                     '.padEnd(240, ' ');

  beforeEach(() => {
    extractor = new PositionalExtractor({
      debug: false,
      enableCache: true,
      batchSize: 100
    });
  });

  describe('Sistema de Cache', () => {
    it('deve usar cache para validações repetidas', () => {
      // Primeira chamada - cache miss
      const result1 = extractor.validatePositions(17, 61, linhaSegmentoJ);
      const stats1 = extractor.getPerformanceStats();

      expect(result1).toBe(true);
      expect(stats1.cacheMisses).toBeGreaterThan(0);

      // Segunda chamada - cache hit
      const result2 = extractor.validatePositions(17, 61, linhaSegmentoJ);
      const stats2 = extractor.getPerformanceStats();

      expect(result2).toBe(true);
      expect(stats2.cacheHits).toBeGreaterThan(stats1.cacheHits);
    });

    it('deve usar cache para sanitização de strings', () => {
      const testString = '   NOME COM ESPACOS   ';

      // Primeira sanitização
      const result1 = extractor.sanitizeString(testString);
      const stats1 = extractor.getPerformanceStats();

      // Segunda sanitização da mesma string
      const result2 = extractor.sanitizeString(testString);
      const stats2 = extractor.getPerformanceStats();

      expect(result1).toBe(result2);
      expect(stats2.cacheHits).toBeGreaterThan(stats1.cacheHits);
    });

    it('deve usar cache para formatação de moeda', () => {
      const valor = 1234.56;

      // Primeira formatação
      const result1 = extractor.formatCurrency(valor);
      const stats1 = extractor.getPerformanceStats();

      // Segunda formatação do mesmo valor
      const result2 = extractor.formatCurrency(valor);
      const stats2 = extractor.getPerformanceStats();

      expect(result1).toBe(result2);
      expect(stats2.cacheHits).toBeGreaterThan(stats1.cacheHits);
    });

    it('deve limpar cache corretamente', () => {
      // Adicionar dados ao cache
      extractor.sanitizeString('test');
      extractor.formatCurrency(100);

      let stats = extractor.getPerformanceStats();
      expect(stats.cacheSize).toBeGreaterThan(0);

      // Limpar cache
      extractor.clearCache();

      stats = extractor.getPerformanceStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.validationCacheSize).toBe(0);
    });
  });

  describe('Lazy Loading de Regex', () => {
    it('deve carregar regex patterns apenas quando necessário', () => {
      // Antes de usar patterns, não devem estar carregados
      expect(extractor._regexPatterns).toBeNull();

      // Usar um método que acessa regex
      extractor.sanitizeString('test string with   spaces');

      // Agora patterns devem estar carregados
      expect(extractor.regexPatterns).toBeDefined();
      expect(extractor.regexPatterns.multipleSpaces).toBeInstanceOf(RegExp);
      expect(extractor.regexPatterns.controlChars).toBeInstanceOf(RegExp);
    });

    it('deve reutilizar regex patterns carregados', () => {
      const patterns1 = extractor.regexPatterns;
      const patterns2 = extractor.regexPatterns;

      // Deve ser a mesma instância
      expect(patterns1).toBe(patterns2);
    });
  });

  describe('Processamento em Batch', () => {
    it('deve processar múltiplas linhas em batches', () => {
      const linhas = Array(250).fill(linhaSegmentoJ); // Mais que o batchSize padrão

      const resultado = extractor.extractBatchSegmentJFields(linhas);
      const stats = extractor.getPerformanceStats();

      expect(resultado.success).toBe(true);
      expect(resultado.results).toHaveLength(250);
      expect(resultado.totalProcessed).toBe(250);
      expect(stats.batchesProcessed).toBeGreaterThan(1); // Deve ter processado em múltiplos batches
    });

    it('deve processar batch pequeno em um único batch', () => {
      const linhas = Array(50).fill(linhaSegmentoJ); // Menor que batchSize

      extractor.resetStats(); // Reset para ter medições limpas

      const resultado = extractor.extractBatchSegmentJFields(linhas);
      const stats = extractor.getPerformanceStats();

      expect(resultado.success).toBe(true);
      expect(resultado.results).toHaveLength(50);
      expect(stats.batchesProcessed).toBe(1);
    });

    it('deve retornar erro para batch inválido', () => {
      const resultado = extractor.extractBatchSegmentJFields(null);

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('Erro no processamento em batch');
    });
  });

  describe('Otimizações de Extração', () => {
    it('deve usar slice ao invés de substring para melhor performance', () => {
      // Teste indireto verificando que a extração funciona corretamente
      const resultado = extractor.extractBarcodeFromLine(linhaSegmentoJ);

      expect(resultado.success).toBe(true);
      expect(resultado.barcode).toBeTruthy();
    });

    it('deve validar numéricamente antes de parseInt', () => {
      const linhaNaoNumerica = linhaSegmentoJ.substring(0, 99) + 'ABC123DEF12345' + linhaSegmentoJ.substring(114);

      const resultado = extractor.extractMonetaryValue(linhaNaoNumerica, 99, 114);

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('não é numérico');
    });

    it('deve usar acesso direto por índice para verificações rápidas', () => {
      // Teste que o segmento é verificado rapidamente
      const resultado = extractor.extractSegmentJFields(linhaSegmentoJ);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.segmento).toBe('J');
    });
  });

  describe('Estatísticas de Performance', () => {
    it('deve retornar estatísticas completas', () => {
      // Executar algumas operações
      extractor.extractBarcodeFromLine(linhaSegmentoJ);
      extractor.extractSegmentJFields(linhaSegmentoJ);
      extractor.sanitizeString('test');

      const stats = extractor.getPerformanceStats();

      expect(stats).toHaveProperty('totalExtractions');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('cacheEfficiency');
      expect(stats).toHaveProperty('batchesProcessed');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('validationCacheSize');

      expect(typeof stats.cacheEfficiency).toBe('string');
      expect(stats.cacheEfficiency).toMatch(/\d+\.\d+%/);
    });

    it('deve calcular eficiência do cache corretamente', () => {
      // Reset stats
      extractor.resetStats();

      // Primeira execução (cache miss)
      extractor.sanitizeString('test');

      // Segunda execução (cache hit)
      extractor.sanitizeString('test');

      const stats = extractor.getPerformanceStats();

      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheEfficiency).toBe('50.00%');
    });

    it('deve resetar estatísticas corretamente', () => {
      // Executar operações
      extractor.extractBarcodeFromLine(linhaSegmentoJ);
      extractor.sanitizeString('test');

      let stats = extractor.getPerformanceStats();
      expect(stats.totalExtractions).toBeGreaterThan(0);

      // Reset
      extractor.resetStats();

      stats = extractor.getPerformanceStats();
      expect(stats.totalExtractions).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.batchesProcessed).toBe(0);
    });
  });

  describe('Configurações de Performance', () => {
    it('deve respeitar configuração de cache desabilitado', () => {
      const extractorSemCache = new PositionalExtractor({
        enableCache: false
      });

      // Múltiplas execuções da mesma operação
      extractorSemCache.sanitizeString('test');
      extractorSemCache.sanitizeString('test');

      const stats = extractorSemCache.getPerformanceStats();

      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });

    it('deve respeitar configuração de batch size customizado', () => {
      const extractorCustomBatch = new PositionalExtractor({
        batchSize: 10
      });

      const linhas = Array(25).fill(linhaSegmentoJ);
      const resultado = extractorCustomBatch.extractBatchSegmentJFields(linhas);
      const stats = extractorCustomBatch.getPerformanceStats();

      expect(resultado.success).toBe(true);
      expect(stats.batchesProcessed).toBe(3); // 25 linhas / 10 per batch = 3 batches
    });
  });

  describe('Performance Benchmark Básico', () => {
    it('deve processar extração simples rapidamente', () => {
      const start = Date.now();

      // 100 extrações
      for (let i = 0; i < 100; i++) {
        extractor.extractBarcodeFromLine(linhaSegmentoJ);
      }

      const end = Date.now();
      const duration = end - start;

      // Deve processar 100 extrações em menos de 100ms (muito conservador)
      expect(duration).toBeLessThan(100);

      const stats = extractor.getPerformanceStats();
      expect(stats.totalExtractions).toBe(100);
    });

    it('deve se beneficiar do cache em operações repetidas', () => {
      const testString = 'STRING PARA TESTE DE CACHE';

      // Primeira execução (sem cache)
      const start1 = Date.now();
      for (let i = 0; i < 50; i++) {
        extractor.sanitizeString(`${testString}_${i}`);
      }
      const duration1 = Date.now() - start1;

      // Segunda execução (com cache - mesmas strings)
      const start2 = Date.now();
      for (let i = 0; i < 50; i++) {
        extractor.sanitizeString(`${testString}_${i}`);
      }
      const duration2 = Date.now() - start2;

      // Segunda execução deve ser mais rápida (com cache)
      expect(duration2).toBeLessThanOrEqual(duration1);

      const stats = extractor.getPerformanceStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });
  });
}); 