/**
 * Testes básicos para os Parsers CNAB 240
 * 
 * Validação das funcionalidades implementadas na task 23
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import CNAB240Parser, {
  HeaderArquivoParser,
  HeaderLoteParser,
  SegmentoParser,
  SegmentoBParser,
  TrailerParser
} from '../../src/services/cnab240/parsers/index.js';

describe('CNAB 240 Parsers', () => {
  // Helper para gerar linha CNAB 240 no formato correto
  const gerarLinhaCNAB = (banco = '341', lote = '0001', tipo = '3', sequencial = '00001', segmento = '') => {
    let linha = banco.padStart(3, '0') + lote.padStart(4, '0') + tipo + sequencial.padStart(5, '0') + segmento;
    return linha.padEnd(240, ' ');
  };

  // Helper para gerar linha CNAB 240 válida com dados mínimos necessários
  const gerarLinhaCNABValida = (tipo) => {
    // Usar data e hora fixa e válida para testes
    const dataStr = '28122024'; // 28/12/2024
    const horaStr = '143000'; // 14:30:00

    switch (tipo) {
      case '0': // Header de arquivo
        let linhaHeader = '341' + // banco
          '0000' + // lote
          '0' + // tipo
          '00001' + // sequencial
          ' ' + // espaço reservado
          '2' + // tipo inscrição empresa (CNPJ)
          '12345678000199'.padEnd(14, ' ') + // CNPJ
          ''.padEnd(20, ' ') + // uso FEBRABAN
          '00001' + // agência
          '0' + // DV agência
          '123456789000' + // conta
          '1' + // DV conta
          '0' + // DV agência/conta
          'EMPRESA TESTE'.padEnd(30, ' ') + // nome empresa
          'BANCO ITAU UNIBANCO S.A.'.padEnd(30, ' ') + // nome banco
          ''.padEnd(10, ' ') + // uso FEBRABAN
          '1' + // código remessa (1 = remessa)
          dataStr + // data geração
          horaStr + // hora geração
          '000001' + // número sequencial arquivo
          '103' + // versão layout
          '00000' + // densidade
          ''.padEnd(20, ' ') + // uso banco
          ''.padEnd(20, ' '); // uso empresa
        return linhaHeader.padEnd(240, ' ');

      case '1': // Header de lote
        let linhaLote = '341' + // banco
          '0001' + // lote
          '1' + // tipo
          'C' + // tipo operação (C = crédito)
          '80' + // tipo serviço (PIX)
          '45' + // forma lançamento
          '103' + // versão layout lote
          ' ' + // uso FEBRABAN
          '2' + // tipo inscrição empresa
          '12345678000199'.padEnd(14, ' ') + // CNPJ
          ''.padEnd(20, ' ') + // convenio
          '00001' + // agência
          '0' + // DV agência
          '123456789000' + // conta
          '1' + // DV conta
          '0' + // DV agência/conta
          'EMPRESA TESTE'.padEnd(30, ' ') + // nome empresa
          'FINALIDADE LOTE TESTE'.padEnd(40, ' ') + // finalidade
          '000001' + // histórico
          'RUA TESTE 123'.padEnd(30, ' ') + // logradouro
          '00123' + // número
          'SALA 456'.padEnd(15, ' ') + // complemento
          'SAO PAULO'.padEnd(15, ' ') + // cidade
          '01310' + // CEP
          '100' + // complemento CEP
          'SP'; // estado
        return linhaLote.padEnd(240, ' ');

      case '3': // Detalhe (será usado para segmentos)
        let linhaSegmento = '341' + // banco (3)
          '0001' + // lote (4)
          '3' + // tipo (1)
          '00001' + // sequencial (5)
          'A' + // segmento (1)
          '0' + // tipo movimento (1)
          '00' + // código instrução (2)
          '000' + // câmara compensação (3)
          '341' + // banco favorecido (3)
          '00001' + // agência favorecido (5)
          '0' + // DV agência (1)
          '123456789000' + // conta favorecido (12)
          '1' + // DV conta (1)
          '0' + // DV agência/conta (1)
          'FAVORECIDO TESTE'.padEnd(30, ' ') + // nome favorecido (30)
          'DOC123456789'.padEnd(20, ' ') + // número documento empresa (20)
          dataStr + // data pagamento (8)
          'REA' + // tipo moeda (3)
          '000000000010000' + // valor pagamento (15) - 100,00
          'BANCO123456789'.padEnd(15, ' ') + // número documento banco (15)
          dataStr + // data efetivação (8)
          '000000000010000' + // valor efetivação (15) - 100,00
          'INFO TESTE'.padEnd(20, ' ') + // outras informações (20)
          '00' + // complemento registro (2)
          '00000' + // código ocorrência (5)
          '0000000000' + // código banco compensação (10)
          '00000' + // nosso número (5)
          '0000000000'; // DV nosso número (10)
        // Total até aqui: 3+4+1+5+1+1+2+3+3+5+1+12+1+1+30+20+8+3+15+15+8+15+20+2+5+10+5+10 = 209
        // Precisamos de mais 31 caracteres para chegar a 240
        linhaSegmento += ''.padEnd(31, ' '); // Preencher os 31 caracteres restantes
        return linhaSegmento;

      case '3B': // Detalhe Segmento B (PIX)
        let linhaSegmentoB = '341' + // banco (3)
          '0001' + // lote (4)
          '3' + // tipo (1)
          '00002' + // sequencial (5)
          'B' + // segmento (1)
          '03' + // subtipo (2)
          ' ' + // espaço reservado (1) - posição 16
          '1' + // tipo inscrição (1) - CPF na posição 17
          '12345678901   ' + // CPF (11) + espaços (3) = 14 caracteres - posições 18-31
          ''.padEnd(63, ' ') + // informações complementares (63)
          '12345678901'.padEnd(99, ' ') + // chave PIX - CPF (99)
          ''.padEnd(42, ' '); // uso FEBRABAN (42)
        // Total: 3+4+1+5+1+2+1+1+14+63+99+42 = 236
        // Precisamos de mais 4 caracteres
        linhaSegmentoB += ''.padEnd(4, ' ');
        return linhaSegmentoB;

      case '5': // Trailer de lote
        let linhaTrailerLote = '341' + // banco
          '0001' + // lote
          '5' + // tipo
          '000003' + // quantidade registros
          '000001000000000010000' + // somatória débitos (100,00)
          '000001000000000010000' + // somatória créditos (100,00)
          '000000000000000020000' + // somatória valores (200,00)
          '000001' + // quantidade débitos
          '000001' + // quantidade créditos
          '000000' + // quantidade avisos débito
          '000000' + // quantidade avisos crédito
          ''.padEnd(16, ' ') + // número arquivo retorno
          ''.padEnd(123, ' '); // uso FEBRABAN
        return linhaTrailerLote.padEnd(240, ' ');

      case '9': // Trailer de arquivo
        let linhaTrailerArquivo = '341' + // banco (3)
          '9999' + // lote (4)
          '9' + // tipo (1)
          ''.padEnd(9, ' ') + // uso FEBRABAN (9) - posições 9-17
          '000001' + // quantidade lotes (6) - posições 18-23
          '000006' + // quantidade registros (6) - posições 24-29
          '000000' + // quantidade contas débito (6) - posições 30-35
          '000000' + // quantidade contas crédito (6) - posições 36-41
          '000000000000000010000' + // somatória débitos (18) - posições 42-59
          '000000000000000010000' + // somatória créditos (18) - posições 60-77
          '000000000000000020000' + // somatória geral (18) - posições 78-95
          '000000' + // quantidade avisos débito (6) - posições 96-101
          '000000' + // quantidade avisos crédito (6) - posições 102-107
          ''.padEnd(124, ' '); // uso FEBRABAN (124) - posições 108-240
        return linhaTrailerArquivo;

      default:
        return gerarLinhaCNAB('341', '0001', tipo, '00001', '');
    }
  };

  describe('CNAB240Parser - Parser principal', () => {
    it('deve detectar tipo de registro corretamente', () => {
      const linhaHeader = gerarLinhaCNAB('341', '0000', '0');
      const linhaLote = gerarLinhaCNAB('341', '0001', '1');
      const linhaSegmentoA = gerarLinhaCNAB('341', '0001', '3', '00001', 'A');
      const linhaSegmentoB = gerarLinhaCNAB('341', '0001', '3', '00002', 'B');
      const linhaTrailerLote = gerarLinhaCNAB('341', '0001', '5');
      const linhaTrailerArquivo = gerarLinhaCNAB('341', '9999', '9');

      expect(CNAB240Parser.detectType(linhaHeader).tipoRegistro).toBe('0');
      expect(CNAB240Parser.detectType(linhaLote).tipoRegistro).toBe('1');
      expect(CNAB240Parser.detectType(linhaSegmentoA).tipoRegistro).toBe('3');
      expect(CNAB240Parser.detectType(linhaSegmentoA).segmento).toBe('A');
      expect(CNAB240Parser.detectType(linhaSegmentoB).segmento).toBe('B');
      expect(CNAB240Parser.detectType(linhaTrailerLote).tipoRegistro).toBe('5');
      expect(CNAB240Parser.detectType(linhaTrailerArquivo).tipoRegistro).toBe('9');
    });

    it('deve extrair resumo rápido corretamente', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'A');
      const resumo = CNAB240Parser.extractQuickSummary(linha);

      expect(resumo.valido).toBe(true);
      expect(resumo.tipo).toBe('3');
      expect(resumo.categoria).toBe('detalhe');
      expect(resumo.banco).toBe('341');
      expect(resumo.lote).toBe('0001');
      expect(resumo.segmento).toBe('A');
    });

    it('deve validar arquivo CNAB 240', () => {
      const linhasValidas = [
        gerarLinhaCNAB('341', '0000', '0'),
        gerarLinhaCNAB('341', '0001', '1'),
        gerarLinhaCNAB('341', '0001', '3', '00001', 'A'),
        gerarLinhaCNAB('341', '0001', '5'),
        gerarLinhaCNAB('341', '9999', '9')
      ];

      const resultado = CNAB240Parser.isCNAB240File(linhasValidas);
      expect(resultado.isCNAB240).toBe(true);
    });

    it('deve rejeitar arquivo inválido', () => {
      const linhasInvalidas = [
        gerarLinhaCNAB('341', '0001', '1'), // Não começa com header de arquivo
        gerarLinhaCNAB('341', '0001', '3', '00001', 'A'),
        gerarLinhaCNAB('341', '0001', '5')
      ];

      const resultado = CNAB240Parser.isCNAB240File(linhasInvalidas);
      expect(resultado.isCNAB240).toBe(false);
      expect(resultado.motivo).toContain('header de arquivo');
    });
  });

  describe('HeaderArquivoParser', () => {
    it('deve fazer parse de header de arquivo', () => {
      const linha = gerarLinhaCNAB('341', '0000', '0');
      const dados = HeaderArquivoParser.parse(linha);

      expect(dados.codigoBanco).toBe('341');
      expect(dados.lote).toBe('0000');
      expect(dados.tipoRegistro).toBe('0');
    });

    it('deve validar header de arquivo', () => {
      const linha = gerarLinhaCNABValida('0');
      const resultado = HeaderArquivoParser.validate(linha);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('deve rejeitar tipo de registro incorreto', () => {
      const linha = gerarLinhaCNAB('341', '0001', '1'); // Tipo 1 em vez de 0

      expect(() => {
        HeaderArquivoParser.parse(linha);
      }).toThrow('Tipo de registro esperado: 0');
    });
  });

  describe('HeaderLoteParser', () => {
    it('deve fazer parse de header de lote', () => {
      const linha = gerarLinhaCNAB('341', '0001', '1');
      const dados = HeaderLoteParser.parse(linha);

      expect(dados.codigoBanco).toBe('341');
      expect(dados.lote).toBe('0001');
      expect(dados.tipoRegistro).toBe('1');
    });

    it('deve validar header de lote', () => {
      const linha = gerarLinhaCNABValida('1');
      const resultado = HeaderLoteParser.validate(linha);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });
  });

  describe('SegmentoParser', () => {
    it('deve fazer parse de segmento A', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'A');
      const dados = SegmentoParser.parseSegmentoA(linha);

      expect(dados.codigoBanco).toBe('341');
      expect(dados.lote).toBe('0001');
      expect(dados.tipoRegistro).toBe('3');
      expect(dados.segmento).toBe('A');
    });

    it('deve validar segmento A', () => {
      const linha = gerarLinhaCNABValida('3');
      const resultado = SegmentoParser.validate(linha);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });
  });

  describe('SegmentoBParser', () => {
    it('deve identificar subtipo B baseado no conteúdo', () => {
      // Teste com CPF
      const cpf = '12345678901'.padEnd(82, ' '); // Preencher espaço para chave PIX
      const linhaB03 = '3410001300001B01' + '1' + cpf;
      const linha = linhaB03.padEnd(240, ' ');

      const subtipo = SegmentoBParser.identifySubtype(linha);
      expect(['B01', 'B03']).toContain(subtipo); // Pode ser identificado como telefone ou CPF
    });

    it('deve fazer parse de segmento B genérico', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'B');
      const dados = SegmentoBParser.parse(linha);

      expect(dados.codigoBanco).toBe('341');
      expect(dados.lote).toBe('0001');
      expect(dados.tipoRegistro).toBe('3');
      expect(dados.segmento).toBe('B');
      expect(dados.subtipo).toBeDefined();
    });

    it('deve validar segmento B', () => {
      const linha = gerarLinhaCNABValida('3B');
      const resultado = SegmentoBParser.validate(linha);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('deve extrair resumo de segmento B', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'B');
      const resumo = SegmentoBParser.extractSummary(linha);

      expect(resumo.banco).toBe('341');
      expect(resumo.lote).toBe('0001');
      expect(resumo.segmento).toBe('B');
      expect(resumo.subtipo).toBeDefined();
      expect(resumo.tipoChave).toBeDefined();
    });
  });

  describe('TrailerParser', () => {
    it('deve fazer parse de trailer de lote', () => {
      const linha = gerarLinhaCNAB('341', '0001', '5');
      const dados = TrailerParser.parseTrailerLote(linha);

      expect(dados.codigoBanco).toBe('341');
      expect(dados.lote).toBe('0001');
      expect(dados.tipoRegistro).toBe('5');
    });

    it('deve fazer parse de trailer de arquivo', () => {
      const linha = gerarLinhaCNAB('341', '9999', '9');
      const dados = TrailerParser.parseTrailerArquivo(linha);

      expect(dados.codigoBanco).toBe('341');
      expect(dados.lote).toBe('9999');
      expect(dados.tipoRegistro).toBe('9');
    });

    it('deve validar trailer de lote', () => {
      const linha = gerarLinhaCNABValida('5');
      const resultado = TrailerParser.validateTrailerLote(linha);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('deve validar trailer de arquivo', () => {
      const linha = gerarLinhaCNABValida('9');
      const resultado = TrailerParser.validateTrailerArquivo(linha);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('deve extrair resumo de trailer', () => {
      const linha = gerarLinhaCNAB('341', '0001', '5');
      const resumo = TrailerParser.extractSummary(linha);

      expect(resumo.tipo).toBe('TrailerLote');
      expect(resumo.banco).toBe('341');
      expect(resumo.lote).toBe('0001');
      expect(resumo.totalizacao).toBeDefined();
    });

    it('deve verificar integridade de trailer', () => {
      const linha = gerarLinhaCNAB('341', '0001', '5');
      const integridade = TrailerParser.checkIntegrity(linha);

      expect(integridade.integro).toBe(true);
      expect(Array.isArray(integridade.alertas)).toBe(true);
      expect(Array.isArray(integridade.observacoes)).toBe(true);
    });
  });

  describe('Integração com arquivos reais', () => {
    it('deve processar arquivo de exemplo se existir', () => {
      const caminhoExemplo = path.join(process.cwd(), 'examples', 'pix85015.txt');

      if (fs.existsSync(caminhoExemplo)) {
        const conteudo = fs.readFileSync(caminhoExemplo, 'utf8');
        const linhas = conteudo.split('\n').filter(linha => linha.length === 240);

        if (linhas.length > 0) {
          const stats = CNAB240Parser.getFileStats(linhas);

          expect(stats.totalLinhas).toBeGreaterThan(0);
          expect(stats.validas).toBeGreaterThan(0);
          expect(Array.isArray(stats.bancos)).toBe(true);
          expect(Array.isArray(stats.lotes)).toBe(true);
        }
      } else {
        console.log('Arquivo de exemplo não encontrado, pulando teste de integração');
      }
    });

    it('deve detectar arquivo CNAB 240 real se existir', () => {
      const caminhoExemplo = path.join(process.cwd(), 'examples', 'pix85015.txt');

      if (fs.existsSync(caminhoExemplo)) {
        const conteudo = fs.readFileSync(caminhoExemplo, 'utf8');
        const linhas = conteudo.split('\n').filter(linha => linha.length === 240);

        if (linhas.length > 0) {
          const resultado = CNAB240Parser.isCNAB240File(linhas);
          expect(resultado.isCNAB240).toBe(true);
        }
      }
    });
  });

  describe('Casos de erro', () => {
    it('deve tratar linha com tamanho incorreto', () => {
      const linhaIncorreta = '341000130001A'; // Muito curta

      expect(() => {
        CNAB240Parser.detectType(linhaIncorreta);
      }).toThrow('240 caracteres');
    });

    it('deve tratar tipo de registro não reconhecido', () => {
      const linha = gerarLinhaCNAB('341', '0001', 'X'); // Tipo X não existe

      expect(() => {
        CNAB240Parser.detectType(linha);
      }).toThrow('não reconhecido');
    });

    it('deve tratar segmento não reconhecido', () => {
      const linha = gerarLinhaCNAB('341', '0001', '3', '00001', 'Z'); // Segmento Z não existe
      const tipoInfo = CNAB240Parser.detectType(linha);

      expect(tipoInfo.metodo).toBe('parseGenerico');
      expect(tipoInfo.descricao).toContain('Genérico');
    });
  });

  describe('Processamento de arquivo completo', () => {
    it('deve processar arquivo simples', () => {
      const linhas = [
        gerarLinhaCNAB('341', '0000', '0'),
        gerarLinhaCNAB('341', '0001', '1'),
        gerarLinhaCNAB('341', '0001', '3', '00001', 'A'),
        gerarLinhaCNAB('341', '0001', '3', '00002', 'B'),
        gerarLinhaCNAB('341', '0001', '5'),
        gerarLinhaCNAB('341', '9999', '9')
      ];

      const resultado = CNAB240Parser.parseFile(linhas);

      expect(resultado.headerArquivo).toBeDefined();
      expect(resultado.lotes).toHaveLength(1);
      expect(resultado.lotes[0].detalhes).toHaveLength(2);
      expect(resultado.trailerArquivo).toBeDefined();
      expect(resultado.erros).toHaveLength(0);
      expect(resultado.linhasProcessadas).toBe(6);
    });

    it('deve gerar estatísticas de arquivo', () => {
      const linhas = [
        gerarLinhaCNAB('341', '0000', '0'),
        gerarLinhaCNAB('341', '0001', '1'),
        gerarLinhaCNAB('341', '0001', '3', '00001', 'A'),
        gerarLinhaCNAB('341', '0001', '3', '00002', 'B'),
        gerarLinhaCNAB('341', '0001', '5'),
        gerarLinhaCNAB('341', '9999', '9')
      ];

      const stats = CNAB240Parser.getFileStats(linhas);

      expect(stats.totalLinhas).toBe(6);
      expect(stats.validas).toBe(6);
      expect(stats.invalidas).toBe(0);
      expect(stats.tipos['0']).toBe(1); // 1 header de arquivo
      expect(stats.tipos['1']).toBe(1); // 1 header de lote
      expect(stats.tipos['3']).toBe(2); // 2 detalhes
      expect(stats.tipos['5']).toBe(1); // 1 trailer de lote
      expect(stats.tipos['9']).toBe(1); // 1 trailer de arquivo
      expect(stats.bancos).toContain('341');
      expect(stats.lotes).toContain('0001');
    });
  });
}); 