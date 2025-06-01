/**
 * Testes unitários para o Cnab240BaseParser
 */

import { describe, it, expect } from '@jest/globals';
import Cnab240BaseParser from '../../src/services/cnab240/cnab240BaseParser.js';

describe('Cnab240BaseParser', () => {
  describe('processarLinha', () => {
    it('deve processar uma linha de header de arquivo válida', () => {
      const linha = '34100000      080244522660000108                    02926 000000032068 6BARTE BRASIL LTDA.            BANCO ITAU SA                           128042025124902000000000000000000                                     ' + ' '.repeat(28);

      const resultado = Cnab240BaseParser.processarLinha(linha, 1);

      expect(resultado.codigoBanco).toBe('341');
      expect(resultado.nomeBanco).toBe('Itaú Unibanco');
      expect(resultado.tipoRegistro).toBe('0');
      expect(resultado.tipoRegistroDescricao).toBe('Header de Arquivo');
      expect(resultado.lote).toBe('0000');
    });

    it('deve processar uma linha de header de lote válida', () => {
      const linha = '34100031C2045040 244522660000108                    02926 000000032068 6BARTE BRASIL LTDA.            BANCO ITAU SA                           128042025124902000000000000000000                                     ' + ' '.repeat(28);

      const resultado = Cnab240BaseParser.processarLinha(linha, 1);

      expect(resultado.codigoBanco).toBe('341');
      expect(resultado.tipoRegistro).toBe('1');
      expect(resultado.tipoRegistroDescricao).toBe('Header de Lote');
      expect(resultado.lote).toBe('0003');
      expect(resultado.codigoOperacao).toBe('45040 ');
    });

    it('deve processar uma linha de detalhe segmento A válida', () => {
      const linha = '3410003300001A000009000                    CELIN TEIXEIRA DA SILVA         000000000000000000900          0000000000000000000000000                              00000000000000                                          ' + ' '.repeat(23);

      const resultado = Cnab240BaseParser.processarLinha(linha, 1);

      expect(resultado.codigoBanco).toBe('341');
      expect(resultado.tipoRegistro).toBe('3');
      expect(resultado.tipoRegistroDescricao).toBe('Detalhe');
      expect(resultado.segmento).toBe('A');
      expect(resultado.segmentoDescricao).toBe('Dados principais do pagamento/crédito');
    });

    it('deve processar uma linha de detalhe segmento B válida', () => {
      const linha = '3410003300002B03 247599872000181                                                                                                                                                                                                     ' + ' '.repeat(11);

      const resultado = Cnab240BaseParser.processarLinha(linha, 1);

      expect(resultado.codigoBanco).toBe('341');
      expect(resultado.tipoRegistro).toBe('3');
      expect(resultado.segmento).toBe('B');
      expect(resultado.subtipoSegmentoB).toBe('B03');
    });

    it('deve remover caracteres de quebra de linha', () => {
      const linhaComQuebraLinha = '34100000      080244522660000108                    02926 000000032068 6BARTE BRASIL LTDA.            BANCO ITAU SA                           128042025124902000000000000000000                                     ' + ' '.repeat(28) + '\n';

      const resultado = Cnab240BaseParser.processarLinha(linhaComQuebraLinha, 1);

      expect(resultado.codigoBanco).toBe('341');
      expect(resultado.tipoRegistro).toBe('0');
    });

    it('deve lançar erro para linha com tamanho inválido', () => {
      const linhaInvalida = '341000001';

      expect(() => {
        Cnab240BaseParser.processarLinha(linhaInvalida, 1);
      }).toThrow('Registro deve ter 240 caracteres');
    });

    it('deve lançar erro para tipo de registro inválido', () => {
      const linha = '341000X' + ' '.repeat(233); // Tipo X inválido

      expect(() => {
        Cnab240BaseParser.processarLinha(linha, 1);
      }).toThrow('Tipo de registro inválido');
    });
  });

  describe('identificarSubtipoSegmentoB', () => {
    it('deve identificar subtipo B03 para CNPJ', () => {
      const linha = '3410003300002B03 247599872000181' + ' '.repeat(200);

      const subtipo = Cnab240BaseParser.identificarSubtipoSegmentoB(linha);

      expect(subtipo).toBe('B03');
    });
  });

  describe('obterEstatisticas', () => {
    it('deve calcular estatísticas corretamente', () => {
      const arquivoProcessado = {
        headerArquivo: { nomeBanco: 'Itaú Unibanco' },
        lotes: [
          {
            headerLote: { codigoOperacao: '45040 ' },
            detalhes: [
              { segmento: 'A' },
              { segmento: 'B' },
              { segmento: 'A' }
            ]
          }
        ]
      };

      const stats = Cnab240BaseParser.obterEstatisticas(arquivoProcessado);

      expect(stats.totalLotes).toBe(1);
      expect(stats.totalDetalhes).toBe(3);
      expect(stats.tiposSegmento.A).toBe(2);
      expect(stats.tiposSegmento.B).toBe(1);
      expect(stats.codigosOperacao['45040 ']).toBe(1);
      expect(stats.banco).toBe('Itaú Unibanco');
    });
  });
}); 