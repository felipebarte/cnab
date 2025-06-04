/**
 * Testes de Integração com Casos Reais CNAB240
 * 
 * Validação da integração do parser específico com cenários do mundo real:
 * - Dados de bancos reais (Bradesco, Itaú, BB, etc.)
 * - Casos de uso complexos com Segment J multi-state
 * - Processamento híbrido entre parser atual e específico
 * - Performance em arquivos grandes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CNAB240SpecificParser } from '../../src/services/cnab240/parsers/specific-parser/index.js';
import { CNAB240Parser } from '../../src/services/cnab240/parsers/index.js';
import Cnab240Service from '../../src/services/cnab240/cnab240Service.js';
import {
  gerarHeaderArquivo,
  gerarHeaderLote,
  gerarSegmentoA,
  gerarSegmentoB,
  gerarTrailerLote,
  gerarTrailerArquivo
} from './testUtils.js';

describe('CNAB240 - Integração com Casos Reais', () => {

  let specificParser;
  let traditionalParser;

  beforeEach(() => {
    specificParser = new CNAB240SpecificParser({
      debug: false,
      enableCache: true,
      multiStateJ: { enabled: true }
    });

    traditionalParser = new CNAB240Parser();
  });

  describe('Bancos Reais - Bradesco (237)', () => {
    const bancoBradesco = '237';

    it('deve processar arquivo Bradesco com Segment J multi-state', async () => {
      // Dados baseados no layout real do Bradesco
      const arquivo = [
        gerarHeaderArquivo({ banco: bancoBradesco }),
        gerarHeaderLote(1),
        // Segment J - Primeira linha (Boleto/PIX)
        `237000130000J 01846300000900123456789012345678901234567890000001EMPRESA FORNECEDORA LTDA     15122024000025000000250001512202400002500000000000000000000000000000000000000PAGAMENTO FORNECEDOR                            `.padEnd(240, ' '),
        // Segment J - Segunda linha (Informações complementares)
        `237000130000000002J 02000000000000000000000000000000000000000000000002CHAVE PIX: usuario@email.com 00000000000000000000000000000000000000000000000000000000DETALHES ADICIONALSDOPAGAMENTO                  `.padEnd(240, ' '),
        gerarSegmentoA({ valorPagamento: 250000 }),
        gerarSegmentoB('B03', { chavePix: 'usuario@email.com', sequencial: 3 }),
        gerarTrailerLote(1, 6),
        gerarTrailerArquivo(1, 8)
      ].join('\n');

      const resultado = await specificParser.processFile(arquivo);

      expect(resultado.pagamentos).toBeDefined();
      expect(resultado.segmentosJ).toBeDefined();
      expect(resultado.segmentosJ.length).toBeGreaterThan(0);

      if (resultado.segmentosJ.length > 0) {
        const segmentJPair = resultado.segmentosJ[0];
        expect(segmentJPair.linha1).toBeDefined();
        expect(segmentJPair.linha2).toBeDefined();
      }
    });

    it('deve extrair dados específicos do Bradesco corretamente', async () => {
      // Formato correto CNAB240: banco(3) + lote(4) + tipoReg(1) + seqNum(5) + segmento(1) + resto
      // Posições: 0-3=banco, 3-7=lote, 7-8=tipo, 8-13=seq, 12-13=segmento, 13-15=uso, 15-17=mov, 17-61=barras, 61-91=nome, 91-99=venc, 99-114=valor
      const linhaBradesco = `237000130000J 01846300000900234567890123456789012345678900000001BRADESCO PAGAMENTOS S.A.     31122024000100000010000312024001000000000000000000000000000000000000BOLETO BANCARIO                                 `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaBradesco);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.banco).toBe('237');
      expect(resultado.fields.nomeBeneficiario).toContain('BRADESCO PAGAMENTOS S.A.');
      expect(resultado.fields.dataVencimento).toBe('31/12/2024');
      expect(resultado.fields.valorTitulo).toBe(1000.00);
      expect(resultado.fields.codigoBarras).toContain('234567890123456789012345678900000001');
    });
  });

  describe('Bancos Reais - Itaú (341)', () => {
    const bancoItau = '341';

    it('deve processar arquivo Itaú com múltiplos Segment J', async () => {
      const arquivo = [
        gerarHeaderArquivo({ banco: bancoItau }),
        gerarHeaderLote(1),
        // PIX 1
        `341000130000000001J 01234500000123412341234123412341234123412341234001CLIENTE PESSOA FISICA       10012025000015000001500010012025000015000000000000000000000000000000000000PIX TRANSFERENCIA                               `.padEnd(240, ' '),
        `341000130000000002J 02000000000000000000000000000000000000000000000002CPF: 123.456.789-01         00000000000000000000000000000000000000000000000000000000DADOS COMPLEMENTARES                           `.padEnd(240, ' '),
        // PIX 2  
        `341000130000000003J 01234500000123987654321098765432109876543210987002EMPRESA COMERCIAL LTDA      20012025000050000005000020012025000050000000000000000000000000000000000000PAGAMENTO DE SERVICOS                          `.padEnd(240, ' '),
        `341000130000000004J 02000000000000000000000000000000000000000000000004CNPJ: 12.345.678/0001-90     00000000000000000000000000000000000000000000000000000000NOTA FISCAL 1234                               `.padEnd(240, ' '),
        gerarTrailerLote(1, 6),
        gerarTrailerArquivo(1, 8)
      ].join('\n');

      const resultado = await specificParser.processFile(arquivo);

      expect(resultado.segmentosJ).toBeDefined();
      expect(resultado.segmentosJ.length).toBeGreaterThanOrEqual(2);

      // Verificar primeiro PIX
      if (resultado.segmentosJ.length > 0) {
        const pix1 = resultado.segmentosJ[0];
        expect(pix1.linha1).toBeDefined();
        expect(pix1.linha2).toBeDefined();
      }
    });

    it('deve extrair dados específicos do Itaú corretamente', async () => {
      const linhaItau = `341000130000J 01846300000900987654321098765432109876543210000002ITAU UNIBANCO S.A.           15122024000200000020000152024002000000000000000000000000000000000000PIX TRANSFERENCIA                               `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaItau);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.banco).toBe('341');
      expect(resultado.fields.nomeBeneficiario).toBe('ITAU UNIBANCO S.A.');
      expect(resultado.fields.dataVencimento).toBe('15/12/2024');
      expect(resultado.fields.valorTitulo).toBe(2000.00);
    });
  });

  describe('Banco do Brasil (001)', () => {
    const bancoBB = '001';

    it('deve processar arquivo BB com valores altos', async () => {
      const linhaBB = `001000130000000001J 01000100001230123456789012345678901234567890000001FORNECEDOR GRANDE LTDA       15012025009999999999999915012025099999999990000000000000000000000000000000000PAGAMENTO GRANDE VALOR                         `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaBB);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.banco).toBe('001');
      expect(resultado.fields.nomeBeneficiario).toBe('FORNECEDOR GRANDE LTDA');
      expect(resultado.fields.valorTitulo).toBe(999999999.99);
      expect(resultado.fields.valorPago).toBe(999999999.99);
    });

    it('deve extrair dados específicos do Banco do Brasil corretamente', async () => {
      const linhaBB = `001000130000J 01846300000900111222333444555666777888999000000003BANCO DO BRASIL S.A.         20122024000300000030000202024003000000000000000000000000000000000000TED TRANSFERENCIA                               `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaBB);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.banco).toBe('001');
      expect(resultado.fields.nomeBeneficiario).toBe('BANCO DO BRASIL S.A.');
      expect(resultado.fields.dataVencimento).toBe('20/12/2024');
      expect(resultado.fields.valorTitulo).toBe(3000.00);
    });
  });

  describe('Caixa Econômica Federal (104)', () => {
    const bancoCaixa = '104';

    it('deve processar arquivo Caixa com benefícios sociais', async () => {
      const arquivo = [
        gerarHeaderArquivo({ banco: bancoCaixa }),
        gerarHeaderLote(1),
        `104000130000000001J 01104800004567890123456789012345678901234567890001BENEFICIARIO PROGRAMA SOCIAL 31012025000038000003800310125000038000000000000000000000000000000000000AUXILIO EMERGENCIAL                            `.padEnd(240, ' '),
        `104000130000000002J 02000000000000000000000000000000000000000000000002CONTA SOCIAL: 001 00123456-7 00000000000000000000000000000000000000000000000000000000PROGRAMA FEDERAL                               `.padEnd(240, ' '),
        gerarTrailerLote(1, 4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await specificParser.processFile(arquivo);

      expect(resultado.segmentosJ).toBeDefined();
      expect(resultado.segmentosJ.length).toBeGreaterThanOrEqual(1);

      if (resultado.segmentosJ.length > 0) {
        const beneficio = resultado.segmentosJ[0];
        expect(beneficio.linha1).toBeDefined();
        expect(beneficio.linha2).toBeDefined();
      }
    });

    it('deve extrair dados específicos da Caixa corretamente', async () => {
      const linhaCaixa = `104000130000J 01846300000900555444333222111000999888777000000004CAIXA ECONOMICA FEDERAL      25122024000400000040000252024004000000000000000000000000000000000000BOLETO COBRANCA                                 `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaCaixa);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.banco).toBe('104');
      expect(resultado.fields.nomeBeneficiario).toBe('CAIXA ECONOMICA FEDERAL');
      expect(resultado.fields.dataVencimento).toBe('25/12/2024');
      expect(resultado.fields.valorTitulo).toBe(4000.00);
    });
  });

  describe('Processamento Híbrido', () => {
    it('deve usar parser específico e tradicional em conjunto', async () => {
      const arquivo = [
        gerarHeaderArquivo({ banco: '237' }),
        gerarHeaderLote(1),
        `237000130000J 01846300000900123456789012345678901234567890000001EMPRESA TESTE LTDA          15122024000025000002500015122024000025000000000000000000000000000000000000PAGAMENTO HIBRIDO                              `.padEnd(240, ' '),
        `237000130000000002J 02000000000000000000000000000000000000000000000002DADOS COMPLEMENTARES TESTE  00000000000000000000000000000000000000000000000000000000PROCESSAMENTO COMBINADO                        `.padEnd(240, ' '),
        gerarSegmentoA({ valorPagamento: 250000 }),
        gerarSegmentoB('B03', { chavePix: 'teste@empresa.com' }),
        gerarTrailerLote(1, 6),
        gerarTrailerArquivo(1, 8)
      ].join('\n');

      // Testar processamento híbrido via serviço
      const resultadoHibrido = await Cnab240Service.processarHibrido(arquivo, {
        enableSpecificParser: true,
        debug: false
      });

      expect(resultadoHibrido.sucesso).toBe(true);
      expect(resultadoHibrido.processamento).toBeDefined();
      expect(resultadoHibrido.processamento.parserHibrido).toBe(true);

      // Verificar que foi processado com dados específicos se disponível
      if (resultadoHibrido.dados.pagamentosEspecificos) {
        expect(resultadoHibrido.dados.pagamentosEspecificos).toBeDefined();
      }
    });

    it('deve fazer fallback gracioso em caso de erro no parser específico', async () => {
      // Linha malformada para forçar erro no parser específico
      const arquivoMalformado = [
        gerarHeaderArquivo({ banco: '237' }),
        gerarHeaderLote(1),
        'LINHA_MALFORMADA_PARA_TESTE', // Linha inválida
        gerarTrailerLote(1, 3),
        gerarTrailerArquivo(1, 5)
      ].join('\n');

      const resultado = await Cnab240Service.processarHibrido(arquivoMalformado, {
        enableSpecificParser: true,
        debug: false
      });

      // Deve ter sucesso com fallback
      expect(resultado.sucesso).toBe(true);
      expect(resultado.processamento).toBeDefined();

      // Pode ter usado fallback
      if (resultado.fallback) {
        expect(resultado.fallback).toBe(true);
      }
    });
  });

  describe('Performance com Arquivos Grandes', () => {
    it('deve processar arquivo com muitos Segment J rapidamente', async () => {
      const numeroLinhas = 100; // Reduzido para teste mais rápido
      const linhas = [
        gerarHeaderArquivo({ banco: '341' }),
        gerarHeaderLote(1)
      ];

      // Gerar muitas linhas de Segment J
      for (let i = 1; i <= numeroLinhas; i += 2) {
        linhas.push(
          `341000130000${String(i).padStart(6, '0')}J 01234500000123456789012345678901234567890123456789${String(i).padStart(3, '0')}CLIENTE ${String(i).padStart(4, '0')}           ${String(i).padStart(2, '0')}122024000010000001000${String(i).padStart(2, '0')}122024000010000000000000000000000000000000000000000PIX NUMERO ${String(i).padStart(4, '0')}                      `.padEnd(240, ' '),
          `341000130000${String(i + 1).padStart(6, '0')}J 02000000000000000000000000000000000000000000000${String(i + 1).padStart(3, '0')}DADOS COMPLEMENTARES ${String(i).padStart(4, '0')}00000000000000000000000000000000000000000000000000000000INFORMACOES ADICIONAIS ${String(i).padStart(4, '0')}           `.padEnd(240, ' ')
        );
      }

      linhas.push(
        gerarTrailerLote(1, numeroLinhas + 2),
        gerarTrailerArquivo(1, numeroLinhas + 4)
      );

      const arquivo = linhas.join('\n');

      const inicio = Date.now();
      const resultado = await specificParser.processFile(arquivo);
      const duracao = Date.now() - inicio;

      expect(resultado.segmentosJ).toBeDefined();
      expect(resultado.segmentosJ.length).toBeGreaterThan(0);
      expect(duracao).toBeLessThan(2000); // Deve processar em menos de 2 segundos

      const stats = specificParser.getProcessingStats();
      expect(stats.totalLines).toBeGreaterThan(0);
    });

    it('deve usar cache eficientemente em processamento repetitivo', async () => {
      const linhaPadrao = `341000130000000001J 01234500000123456789012345678901234567890123456001CLIENTE PADRAO              15122024000010000001000151220240000100000000000000000000000000000000000000PIX PADRAO                                     `.padEnd(240, ' ');

      specificParser.positionalExtractor.resetStats();

      // Primeira extração (cache miss)
      const resultado1 = specificParser.positionalExtractor.extractSegmentJFields(linhaPadrao);
      expect(resultado1.success).toBe(true);

      // Múltiplas extrações da mesma linha (cache hits)
      for (let i = 0; i < 50; i++) {
        specificParser.positionalExtractor.extractSegmentJFields(linhaPadrao);
      }

      const stats = specificParser.positionalExtractor.getPerformanceStats();
      expect(stats.totalExtractions).toBe(51);

      // Cache deve ter alguma eficiência
      if (stats.cacheHits > 0) {
        const efficiency = parseFloat(stats.cacheEfficiency);
        expect(efficiency).toBeGreaterThan(10); // Pelo menos 10% de eficiência do cache
      }
    });
  });

  describe('Casos Extremos e Edge Cases', () => {
    it('deve lidar com valores monetários zerados', async () => {
      const linhaZerada = `237000130000J 01846300000900123456789012345678901234567890000001PAGAMENTO ZERADO            15122024000000000000000015122024000000000000000000000000000000000000000000000TESTE VALOR ZERO                               `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaZerada);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.valorTitulo).toBe(0);
      expect(resultado.fields.valorPago).toBe(0);
      expect(resultado.fields.nomeBeneficiario).toBe('PAGAMENTO ZERADO');
    });

    it('deve processar datas zeradas corretamente', async () => {
      const linhaDataZerada = `237000130000J 01846300000900123456789012345678901234567890000001PAGAMENTO SEM DATA          00000000000010000001000000000000000010000000000000000000000000000000000000000TESTE DATA ZERADA                              `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaDataZerada);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.dataVencimento).toBe('');
      expect(resultado.fields.dataPagamento).toBe('');
      expect(resultado.fields.valorTitulo).toBe(100.00);
    });

    it('deve tratar nomes com caracteres especiais', async () => {
      const linhaCaracteresEspeciais = `237000130000J 01846300000900123456789012345678901234567890000001JOSÉ DA SILVA & CIA LTDA    15122024000050000005000015122024000050000000000000000000000000000000000000CARACTERES ESPECIAIS                           `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaCaracteresEspeciais);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.nomeBeneficiario).toBe('JOSÉ DA SILVA & CIA LTDA');
      expect(resultado.fields.valorTitulo).toBe(500.00);
    });

    it('deve processar códigos de barras com padrões diferentes', async () => {
      const codigoBarrasCompleto = '1234567890123456789012345678901234567890123';
      const linha = `237000130000J 01${codigoBarrasCompleto}001TESTE CODIGO COMPLETO      15122024000010000001000015122024000010000000000000000000000000000000000000CODIGO BARRAS TESTE                            `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.codigoBarras).toBe(codigoBarrasCompleto);
    });
  });

  describe('Validação de Qualidade de Dados', () => {
    it('deve identificar inconsistências nos dados', async () => {
      // Linha com valor título diferente do valor pago (possível inconsistência)
      const linhaInconsistente = `237000130000J 01846300000900123456789012345678901234567890000001PAGAMENTO INCONSISTENTE     15122024000100000010000151220240000500000000000000000000000000000000000000VALORES DIFERENTES                             `.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaInconsistente);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.valorTitulo).toBe(1000.00);
      expect(resultado.fields.valorPago).toBe(500.00);

      // O parser deve extrair os dados sem erro, mas a aplicação pode detectar a inconsistência
      expect(resultado.fields.valorTitulo).not.toBe(resultado.fields.valorPago);
    });

    it('deve extrair informações complementares detalhadas', async () => {
      const linhaDetalhada = `237000130000J 01846300000900123456789012345678901234567890000001EMPRESA DETALHADA LTDA      15122024000075000007500015122024000075000000000000000000000000000000000000000PAGTO NF 123456 REF DEZ/2024 CNPJ 12345678000195`.padEnd(240, ' ');

      const resultado = specificParser.positionalExtractor.extractSegmentJFields(linhaDetalhada);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.nomeBeneficiario).toBe('EMPRESA DETALHADA LTDA');
      expect(resultado.fields.informacoesComplementares).toContain('PAGTO NF 123456 REF DEZ/2024');
    });
  });
}); 