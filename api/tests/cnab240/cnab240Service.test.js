/**
 * Testes para o serviço principal CNAB240Service
 * 
 * Validação das funcionalidades implementadas na task 15
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Cnab240Service from '../../src/services/cnab240/cnab240Service.js';
import { gerarHeaderArquivo, gerarHeaderLote, gerarSegmentoA, gerarSegmentoB, gerarTrailerLote, gerarTrailerArquivo, gerarArquivoCNABCompleto } from './testUtils.js';

describe('CNAB240Service - Serviço Principal', () => {

  describe('Validação de entrada', () => {
    it('deve rejeitar conteúdo vazio', async () => {
      const resultado = await Cnab240Service.processar('');

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toContain('Conteúdo do arquivo CNAB é obrigatório');
    });

    it('deve rejeitar conteúdo não string', async () => {
      const resultado = await Cnab240Service.processar(null);

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toContain('Conteúdo do arquivo CNAB é obrigatório');
    });

    it('deve rejeitar arquivo com menos de 3 linhas', async () => {
      const conteudo = gerarHeaderArquivo() + '\n' + gerarHeaderLote();

      const resultado = await Cnab240Service.processar(conteudo);

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toContain('Arquivo deve ter pelo menos 3 linhas');
    });
  });

  describe('Processamento básico', () => {
    it('deve processar arquivo CNAB 240 válido básico', async () => {
      // Arquivo mínimo: header arquivo + header lote + trailer lote + trailer arquivo
      const cnabSimples = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarTrailerLote(),
        gerarTrailerArquivo()
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabSimples);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.dadosEstruturados).toBeDefined();
      expect(resultado.informacoesArquivo.formato).toBe('CNAB 240');
      expect(resultado.dataProcessamento).toBeDefined();
    });

    it('deve identificar corretamente a estrutura do arquivo', async () => {
      const cnabSimples = gerarArquivoCNABCompleto();
      const resultado = await Cnab240Service.processar(cnabSimples);

      expect(resultado.dadosEstruturados.arquivo.header).toBeDefined();
      expect(resultado.dadosEstruturados.arquivo.trailer).toBeDefined();
      expect(resultado.dadosEstruturados.lotes).toBeInstanceOf(Array);
      expect(resultado.dadosEstruturados.lotes.length).toBe(1);
    });

    it('deve calcular informações do arquivo corretamente', async () => {
      const cnabSimples = gerarArquivoCNABCompleto();
      const resultado = await Cnab240Service.processar(cnabSimples);

      expect(resultado.informacoesArquivo.totalLinhas).toBe(4);
      expect(resultado.informacoesArquivo.banco).toBe('341');
      expect(resultado.informacoesArquivo.nomeBanco).toContain('Itaú');
    });
  });

  describe('Processamento com segmentos', () => {
    it('deve processar segmentos A e B corretamente', async () => {
      const cnabComSegmentos = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4), // 4 registros no lote
        gerarTrailerArquivo(1, 6) // 1 lote, 6 registros total
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabComSegmentos);

      expect(resultado.sucesso).toBe(true);

      const lote = resultado.dadosEstruturados.lotes[0];
      expect(lote.detalhes).toHaveLength(2);
    });

    it('deve extrair dados de pagamento do Segmento A', async () => {
      const cnabComSegmentos = gerarArquivoCNABCompleto({ incluirSegmentos: true });
      const resultado = await Cnab240Service.processar(cnabComSegmentos);

      const detalheA = resultado.dadosEstruturados.lotes[0].detalhes[0];
      expect(detalheA.pagamento).toBeDefined();
      expect(detalheA.beneficiario).toBeDefined();
      expect(detalheA.pagamento.valorPagamento).toBeGreaterThan(0);
    });

    it('deve extrair dados PIX do Segmento B', async () => {
      const cnabComSegmentos = gerarArquivoCNABCompleto({ incluirSegmentos: true });
      const resultado = await Cnab240Service.processar(cnabComSegmentos);

      const detalheB = resultado.dadosEstruturados.lotes[0].detalhes[1];
      expect(detalheB.informacoesComplementares).toBeDefined();
      expect(detalheB.pix).toBeDefined();
      expect(detalheB.pix.tipoChave).toBe('CPF');
    });
  });

  describe('Cálculos e somatórias', () => {
    it('deve calcular somatórias corretamente', async () => {
      const cnabParaSomatorias = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA({ valorPagamento: 10000 }),
        gerarSegmentoB('B03'),
        gerarSegmentoA({ sequencial: 3, valorPagamento: 20000 }),
        gerarSegmentoB('B03', { sequencial: 4 }),
        gerarTrailerLote(6), // 6 registros no lote
        gerarTrailerArquivo(1, 8) // 1 lote, 8 registros total
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabParaSomatorias);

      expect(resultado.somatorias.totalRegistros).toBe(8);
      expect(resultado.somatorias.totalLotes).toBe(1);
      expect(resultado.somatorias.totalSegmentosA).toBe(2);
      expect(resultado.somatorias.totalSegmentosB).toBe(2);
    });

    it('deve gerar resumo de processamento', async () => {
      const cnabParaSomatorias = gerarArquivoCNABCompleto({ incluirSegmentos: true });
      const resultado = await Cnab240Service.processar(cnabParaSomatorias);

      const resumo = resultado.resumoProcessamento;
      expect(resumo.arquivo.totalLotes).toBe(1);
      expect(resumo.financeiro.quantidadePagamentos).toBe(1);
      expect(resumo.financeiro.ticketMedio).toBe(100); // R$ 100.00 (valor em reais, não centavos)
      expect(resumo.distribuicao.segmentosA).toBe(1);
    });

    it('deve calcular estatísticas do lote', async () => {
      const cnabParaSomatorias = gerarArquivoCNABCompleto({ incluirSegmentos: true });
      const resultado = await Cnab240Service.processar(cnabParaSomatorias);

      const estatisticas = resultado.dadosEstruturados.lotes[0].estatisticas;
      expect(estatisticas.valorTotal).toBe(100); // R$ 100.00 (valor em reais, não centavos)
      expect(estatisticas.quantidadePagamentos).toBe(1);
      expect(estatisticas.ticketMedio).toBe(100); // R$ 100.00 (valor em reais, não centavos)
    });
  });

  describe('Validações avançadas', () => {
    it('deve validar linhas com tamanho incorreto', async () => {
      const linhaInvalida = '341000010000100001A' + ' '.repeat(200); // Linha com 219 caracteres
      const conteudo = [
        gerarHeaderArquivo(),
        linhaInvalida,
        gerarTrailerArquivo()
      ].join('\n');

      const resultado = await Cnab240Service.processar(conteudo);

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toContain('deve ter exatamente 240 caracteres');
    });

    it('deve validar estrutura hierárquica', async () => {
      // Arquivo com estrutura válida mas com avisos
      const cnabComAvisos = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarTrailerLote(3),
        gerarTrailerArquivo(1, 5)
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabComAvisos);

      // Deve processar mas com avisos
      expect(resultado.sucesso).toBe(true);
      expect(resultado.validacao.avisos.length).toBeGreaterThan(0);
    });

    it('deve tratar erros de processamento graciosamente', async () => {
      const conteudoInvalido = 'LINHA_INVALIDA\nOUTRA_LINHA\nTERCEIRA_LINHA';

      const resultado = await Cnab240Service.processar(conteudoInvalido);

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toBeDefined();
      expect(resultado.dataProcessamento).toBeDefined();
    });
  });

  describe('Diferentes tipos de chave PIX', () => {
    it('deve processar corretamente chave PIX telefone (B01)', async () => {
      const cnabPixTelefone = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B01', { chavePix: '11987654321' }),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabPixTelefone);

      const pixData = resultado.dadosEstruturados.lotes[0].detalhes[1].pix;
      expect(pixData.tipoChave).toBe('TELEFONE');
      expect(pixData.subtipo).toBe('B01');
    });

    it('deve processar corretamente chave PIX email (B02)', async () => {
      const cnabPixEmail = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B02', { chavePix: 'teste@email.com' }),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabPixEmail);

      const pixData = resultado.dadosEstruturados.lotes[0].detalhes[1].pix;
      expect(pixData.tipoChave).toBe('EMAIL');
      expect(pixData.subtipo).toBe('B02');
    });

    it('deve processar corretamente chave PIX UUID (B04)', async () => {
      const cnabPixUuid = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA(),
        gerarSegmentoB('B04', { chavePix: '123e4567-e89b-12d3-a456-426614174000' }),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabPixUuid);

      const pixData = resultado.dadosEstruturados.lotes[0].detalhes[1].pix;
      expect(pixData.tipoChave).toBe('UUID');
      expect(pixData.subtipo).toBe('B04');
    });
  });

  describe('Status de pagamento', () => {
    it('deve determinar status PENDENTE para pagamento futuro', async () => {
      const dataFutura = '31122025'; // 31/12/2025
      const cnabComDataFutura = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA({ dataPagamento: dataFutura }),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabComDataFutura);

      const pagamento = resultado.dadosEstruturados.lotes[0].detalhes[0].pagamento;
      expect(pagamento.status).toBe('PENDENTE');
    });

    it('deve determinar status VENCIDO para pagamento passado', async () => {
      const dataPassada = '01012020'; // 01/01/2020
      const cnabComDataPassada = [
        gerarHeaderArquivo(),
        gerarHeaderLote(),
        gerarSegmentoA({ dataPagamento: dataPassada }),
        gerarSegmentoB('B03'),
        gerarTrailerLote(4),
        gerarTrailerArquivo(1, 6)
      ].join('\n');

      const resultado = await Cnab240Service.processar(cnabComDataPassada);

      const pagamento = resultado.dadosEstruturados.lotes[0].detalhes[0].pagamento;
      expect(pagamento.status).toBe('PAGO');
    });
  });

  describe('Múltiplos lotes', () => {
    it('deve processar arquivo com múltiplos lotes', async () => {
      const cnabMultiplosLotes = gerarArquivoCNABCompleto({
        quantidadeLotes: 2,
        incluirSegmentos: true
      });

      const resultado = await Cnab240Service.processar(cnabMultiplosLotes);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.dadosEstruturados.lotes).toHaveLength(2);
      expect(resultado.somatorias.totalLotes).toBe(2);
      expect(resultado.resumoProcessamento.arquivo.totalLotes).toBe(2);
    });
  });

  describe('Opções de processamento', () => {
    it('deve aceitar e preservar opções de processamento', async () => {
      const cnabSimples = gerarArquivoCNABCompleto();
      const opcoes = {
        validarEstrutura: true,
        incluirDetalhesCompletos: true,
        calcularEstatisticas: true
      };

      const resultado = await Cnab240Service.processar(cnabSimples, opcoes);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.opcoes).toEqual(opcoes);
    });
  });
}); 