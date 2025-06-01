/**
 * Testes para os modelos CNAB 240
 */

import { describe, it, expect } from '@jest/globals';
import {
  HeaderArquivo240,
  HeaderLote240,
  SegmentoA240,
  SegmentoB240,
  TrailerLote240,
  TrailerArquivo240,
  criarModelo,
  validarModelo,
  modeloParaObjeto
} from '../../src/models/cnab240/index.js';

describe('Modelos CNAB 240', () => {

  // Linha helper para gerar linhas de 240 caracteres
  const gerarLinha = (inicio) => {
    return inicio.padEnd(240, '0');
  };

  // Helper para gerar linha CNAB 240 no formato correto
  const gerarLinhaCNAB = (banco = '341', lote = '0001', tipo = '3', sequencial = '00001', segmento = '') => {
    let linha = banco.padStart(3, '0') + lote.padStart(4, '0') + tipo + sequencial.padStart(5, '0') + segmento;
    return linha.padEnd(240, ' ');
  };

  describe('HeaderArquivo240', () => {
    it('deve criar instância com dados padrão', () => {
      const header = new HeaderArquivo240();
      expect(header.tipoRegistro).toBe('0');
      expect(header.lote).toBe('0000');
    });

    it('deve validar dados obrigatórios', () => {
      const header = new HeaderArquivo240();
      const erros = header.validar();
      expect(erros.length).toBeGreaterThan(0);
    });

    it('deve converter para objeto', () => {
      const header = new HeaderArquivo240({
        codigoBanco: '341',
        nomeEmpresa: 'TESTE'
      });
      const objeto = header.toObject();
      expect(objeto.codigoBanco).toBe('341');
      expect(objeto.nomeEmpresa).toBe('TESTE');
    });
  });

  describe('SegmentoA240', () => {
    it('deve criar instância com dados padrão', () => {
      const segmento = new SegmentoA240();
      expect(segmento.tipoRegistro).toBe('3');
      expect(segmento.segmento).toBe('A');
    });

    it('deve parsear valores monetários', () => {
      const valor = SegmentoA240.parseValor('000000000012345');
      expect(valor).toBe(123.45);
    });

    it('deve formatar valores monetários', () => {
      const valorFormatado = SegmentoA240.formatarValor(123.45);
      expect(valorFormatado).toBe('000000000012345');
    });

    it('deve validar dados obrigatórios', () => {
      const segmento = new SegmentoA240();
      const erros = segmento.validar();
      expect(erros).toContain('Nome do favorecido é obrigatório');
      expect(erros).toContain('Valor do pagamento deve ser maior que zero');
    });
  });

  describe('SegmentoB240', () => {
    it('deve criar instância com dados padrão', () => {
      const segmento = new SegmentoB240();
      expect(segmento.tipoRegistro).toBe('3');
      expect(segmento.segmento).toBe('B');
      expect(segmento.subtipo).toBe('B03');
    });

    it('deve extrair dados específicos de subtipo', () => {
      const dados = SegmentoB240.extrairDadosSubtipo('test@email.com' + ' '.repeat(200), 'B02');
      expect(dados.tipo).toBe('EMAIL');
      expect(dados.formato).toBe('Endereço de email');
    });

    it('deve validar email para subtipo B02', () => {
      const segmento = new SegmentoB240({
        subtipo: 'B02',
        dadosSubtipo: {
          tipo: 'EMAIL',
          dadosPix: 'email_invalido'
        }
      });
      const erros = segmento.validar();
      expect(erros).toContain('Email inválido para subtipo B02');
    });
  });

  describe('TrailerLote240', () => {
    it('deve criar instância com dados padrão', () => {
      const trailer = new TrailerLote240();
      expect(trailer.tipoRegistro).toBe('5');
    });

    it('deve calcular totalizadores', () => {
      const detalhes = [
        { segmento: 'A', valorPagamento: '000000000010000' }, // R$ 100,00
        { segmento: 'A', valorPagamento: '000000000020000' }, // R$ 200,00
        { segmento: 'B' } // Não conta
      ];

      const totalizadores = TrailerLote240.calcularTotalizadores(detalhes);
      expect(totalizadores.quantidadeRegistros).toBe(5); // 3 detalhes + header + trailer
      expect(totalizadores.quantidadeCreditos).toBe(2);
      expect(totalizadores.valorTotalCreditos).toBe(300);
    });
  });

  describe('TrailerArquivo240', () => {
    it('deve criar instância com dados padrão', () => {
      const trailer = new TrailerArquivo240();
      expect(trailer.tipoRegistro).toBe('9');
      expect(trailer.lote).toBe('9999');
    });

    it('deve calcular totalizadores do arquivo', () => {
      const arquivo = {
        lotes: [
          { detalhes: [{ segmento: 'A', contaFavorecido: '12345' }] },
          { detalhes: [{ segmento: 'A', contaFavorecido: '67890' }] }
        ]
      };

      const totalizadores = TrailerArquivo240.calcularTotalizadores(arquivo);
      expect(totalizadores.quantidadeLotes).toBe(2);
      expect(totalizadores.quantidadeRegistros).toBe(8); // 2 header arquivo + 4 lote + 2 detalhes
    });
  });

  describe('Factory criarModelo', () => {
    it('deve criar HeaderArquivo240 para tipo 0', () => {
      const linha = gerarLinhaCNAB('341', '0000', '0');
      const modelo = criarModelo(linha);
      expect(modelo).toBeInstanceOf(HeaderArquivo240);
    });

    it('deve criar SegmentoA240 para tipo 3 segmento A', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'A');
      const modelo = criarModelo(linha);
      expect(modelo).toBeInstanceOf(SegmentoA240);
    });

    it('deve criar SegmentoB240 para tipo 3 segmento B', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'B');
      const modelo = criarModelo(linha);
      expect(modelo).toBeInstanceOf(SegmentoB240);
    });

    it('deve criar TrailerLote240 para tipo 5', () => {
      const linha = gerarLinhaCNAB('341', '0001', '5');
      const modelo = criarModelo(linha);
      expect(modelo).toBeInstanceOf(TrailerLote240);
    });

    it('deve criar TrailerArquivo240 para tipo 9', () => {
      const linha = gerarLinhaCNAB('341', '9999', '9');
      const modelo = criarModelo(linha);
      expect(modelo).toBeInstanceOf(TrailerArquivo240);
    });

    it('deve lançar erro para tipo não suportado', () => {
      const linha = gerarLinhaCNAB('341', '0001', '7');
      expect(() => criarModelo(linha)).toThrow('Tipo de registro "7" não suportado');
    });

    it('deve lançar erro para segmento não suportado', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'X');
      expect(() => criarModelo(linha)).toThrow('Segmento "X" não suportado');
    });
  });

  describe('Utilitários', () => {
    it('validarModelo deve retornar resultado da validação', () => {
      const segmento = new SegmentoA240();
      const resultado = validarModelo(segmento);
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.length).toBeGreaterThan(0);
    });

    it('modeloParaObjeto deve converter modelo', () => {
      const segmento = new SegmentoA240({ codigoBanco: '341' });
      const objeto = modeloParaObjeto(segmento);
      expect(objeto.codigoBanco).toBe('341');
      expect(objeto.segmento).toBe('A');
    });

    it('deve lançar erro para modelo inválido', () => {
      expect(() => modeloParaObjeto({})).toThrow('Modelo inválido ou sem método toObject');
    });
  });
}); 