/**
 * Testes Abrangentes para PositionalExtractor
 * 
 * Validação completa da extração posicional específica implementada
 * na Task #4 - Testes do sistema de extração baseado em posições CNAB240
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PositionalExtractor } from '../../src/services/cnab240/parsers/specific-parser/positionalExtractor.js';

describe('PositionalExtractor - Testes Abrangentes', () => {

  let extractor;

  beforeEach(() => {
    extractor = new PositionalExtractor({
      debug: false,
      strictValidation: true
    });
  });

  describe('Inicialização e Configuração', () => {
    it('deve inicializar com configurações padrão', () => {
      const defaultExtractor = new PositionalExtractor();

      expect(defaultExtractor).toBeDefined();
      expect(defaultExtractor.options).toBeDefined();
      expect(defaultExtractor.fieldMappings).toBeDefined();
    });

    it('deve aceitar opções customizadas', () => {
      const customExtractor = new PositionalExtractor({
        debug: true,
        strictValidation: false,
        customOption: 'test'
      });

      expect(customExtractor.options.debug).toBe(true);
      expect(customExtractor.options.strictValidation).toBe(false);
      expect(customExtractor.options.customOption).toBe('test');
    });
  });

  describe('Extração de Código de Barras', () => {
    it('deve extrair código de barras da posição 17-61 corretamente', () => {
      // Linha simulada com código de barras nas posições 17-61
      const linha = '0000000000000000012345678901234567890123456789012345' + // posições 0-54 (código nas 17-61)
        'NOME BENEFICIARIO          ' + // posições 55-85
        '0'.repeat(155); // resto da linha até 240

      const resultado = extractor.extractBarcodeFromLine(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.barcode).toBe('12345678901234567890123456789012345');
      expect(resultado.position).toEqual({ start: 17, end: 61 });
    });

    it('deve lidar com código de barras com espaços', () => {
      const linha = '0'.repeat(17) +
        '12345 67890 12345 67890 1234' + // código com espaços
        '0'.repeat(195);

      const resultado = extractor.extractBarcodeFromLine(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.barcode).toBe('12345 67890 12345 67890 1234'); // Preserva espaços
    });

    it('deve retornar erro para linha muito curta', () => {
      const linhaCorta = '0'.repeat(50); // Linha menor que 240

      const resultado = extractor.extractBarcodeFromLine(linhaCorta);

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('Linha deve ter pelo menos 240 caracteres');
    });

    it('deve extrair código vazio sem erro', () => {
      const linha = '0'.repeat(17) +
        ' '.repeat(44) + // espaços nas posições 17-61
        '0'.repeat(179);

      const resultado = extractor.extractBarcodeFromLine(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.barcode).toBe('');
    });
  });

  describe('Extração de Nome do Beneficiário', () => {
    it('deve extrair nome da posição 61-91', () => {
      const linha = '0'.repeat(61) +
        'NOME DO BENEFICIARIO TESTE  ' + // posições 61-91
        '0'.repeat(149);

      const resultado = extractor.extractBeneficiaryName(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.name).toBe('NOME DO BENEFICIARIO TESTE');
      expect(resultado.position).toEqual({ start: 61, end: 91 });
    });

    it('deve remover espaços extras do nome', () => {
      const linha = '0'.repeat(61) +
        '  NOME   COM   ESPACOS    ' + // nome com espaços extras
        '0'.repeat(151);

      const resultado = extractor.extractBeneficiaryName(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.name).toBe('NOME COM ESPACOS');
    });

    it('deve lidar com nome vazio', () => {
      const linha = '0'.repeat(61) +
        ' '.repeat(30) + // espaços
        '0'.repeat(149);

      const resultado = extractor.extractBeneficiaryName(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.name).toBe('');
    });
  });

  describe('Extração de Valores Monetários', () => {
    it('deve extrair e converter valor corretamente', () => {
      // Simular valor de R$ 1.234,56 = 123456 centavos
      const linha = '0'.repeat(100) +
        '000000000123456' + // 15 dígitos para valor
        '0'.repeat(125);

      const resultado = extractor.extractMonetaryValue(linha, 100, 115);

      expect(resultado.success).toBe(true);
      expect(resultado.value).toBe(1234.56);
      expect(resultado.centavos).toBe(123456);
      expect(resultado.formatted).toBe('R$ 1.234,56');
    });

    it('deve lidar com valor zero', () => {
      const linha = '0'.repeat(100) +
        '000000000000000' + // valor zero
        '0'.repeat(125);

      const resultado = extractor.extractMonetaryValue(linha, 100, 115);

      expect(resultado.success).toBe(true);
      expect(resultado.value).toBe(0);
      expect(resultado.centavos).toBe(0);
      expect(resultado.formatted).toBe('R$ 0,00');
    });

    it('deve lidar com valores grandes', () => {
      // R$ 99.999.999,99 = 9999999999 centavos
      const linha = '0'.repeat(100) +
        '000009999999999' +
        '0'.repeat(125);

      const resultado = extractor.extractMonetaryValue(linha, 100, 115);

      expect(resultado.success).toBe(true);
      expect(resultado.value).toBe(99999999.99);
      expect(resultado.formatted).toBe('R$ 99.999.999,99');
    });

    it('deve retornar erro para posições inválidas', () => {
      const linha = '0'.repeat(240);

      const resultado = extractor.extractMonetaryValue(linha, 250, 260); // posições fora da linha

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('posições inválidas');
    });
  });

  describe('Extração de Datas', () => {
    it('deve extrair e formatar data DDMMAAAA corretamente', () => {
      const linha = '0'.repeat(50) +
        '19052025' + // 19/05/2025
        '0'.repeat(182);

      const resultado = extractor.extractDate(linha, 50, 58);

      expect(resultado.success).toBe(true);
      expect(resultado.date).toBe('19/05/2025');
      expect(resultado.iso).toBe('2025-05-19');
      expect(resultado.dateObject).toBeInstanceOf(Date);
    });

    it('deve lidar com data inválida', () => {
      const linha = '0'.repeat(50) +
        '32135678' + // data inválida (dia 32)
        '0'.repeat(182);

      const resultado = extractor.extractDate(linha, 50, 58);

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('inválida');
    });

    it('deve lidar com data zerada', () => {
      const linha = '0'.repeat(50) +
        '00000000' + // data zerada
        '0'.repeat(182);

      const resultado = extractor.extractDate(linha, 50, 58);

      expect(resultado.success).toBe(true);
      expect(resultado.date).toBe('');
      expect(resultado.iso).toBe('');
      expect(resultado.dateObject).toBeNull();
    });

    it('deve validar formato de data', () => {
      const linha = '0'.repeat(50) +
        '1905202' + // 7 dígitos apenas
        '0'.repeat(183);

      const resultado = extractor.extractDate(linha, 50, 57);

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('deve ter 8 caracteres');
    });
  });

  describe('Extração de Campos Específicos do Segmento J', () => {
    it('deve extrair todos os campos do Segmento J corretamente', () => {
      // Simular linha de Segmento J com todos os campos
      const linha =
        '341' +                                           // banco (0-3)
        '0001' +                                          // lote (3-7)
        '3' +                                             // tipo registro (7-8)
        '00001' +                                         // número sequencial (8-13)
        'J' +                                             // segmento (13-14)
        ' ' +                                             // uso exclusivo (14-15)
        '02' +                                            // código movimento (15-17)
        '12345678901234567890123456789012345678901234' +  // código de barras (17-61)
        'NOME DO BENEFICIARIO TESTE   ' +                // nome beneficiário (61-91)
        '19052025' +                                      // data vencimento (91-99)
        '000000000123456' +                               // valor título (99-114)
        '000000000120000' +                               // valor pago (114-129)
        '20052025' +                                      // data pagamento (129-137)
        '000000000120000' +                               // valor efetivo (137-152)
        '000000000003456' +                               // desconto/abatimento (152-167)
        '000000000000000' +                               // acréscimos/mora (167-182)
        'INFORMACOES COMPLEMENTARES TITULO    ' +        // informações complementares (182-222)
        '000000000000000000' +                            // uso banco (222-240)
        '';

      const resultado = extractor.extractSegmentJFields(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.fields).toBeDefined();
      expect(resultado.fields.codigoBarras).toBe('12345678901234567890123456789012345678901234');
      expect(resultado.fields.nomeBeneficiario).toBe('NOME DO BENEFICIARIO TESTE');
      expect(resultado.fields.dataVencimento).toBe('19/05/2025');
      expect(resultado.fields.valorTitulo).toBe(1234.56);
      expect(resultado.fields.valorPago).toBe(1200.00);
      expect(resultado.fields.dataPagamento).toBe('20/05/2025');
      expect(resultado.fields.valorEfetivo).toBe(1200.00);
      expect(resultado.fields.descontoAbatimento).toBe(34.56);
      expect(resultado.fields.acrescimoMora).toBe(0);
      expect(resultado.fields.informacoesComplementares).toBe('INFORMACOES COMPLEMENTARES TITULO');
    });

    it('deve retornar erro para linha que não é Segmento J', () => {
      const linha = '0'.repeat(13) + 'A' + '0'.repeat(226); // Segmento A

      const resultado = extractor.extractSegmentJFields(linha);

      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('não é um Segmento J');
    });
  });

  describe('Validação e Sanitização', () => {
    it('deve sanitizar string removendo caracteres especiais', () => {
      const textoSujo = 'TEXTO\x00COM\x01CARACTERES\x02ESPECIAIS\x03';

      const resultado = extractor.sanitizeString(textoSujo);

      expect(resultado).toBe('TEXTOCOMCARACTERESESPECIAIS');
    });

    it('deve validar posições dentro dos limites', () => {
      const linhaValida = '0'.repeat(240);

      expect(extractor.validatePositions(0, 10, linhaValida)).toBe(true);
      expect(extractor.validatePositions(100, 150, linhaValida)).toBe(true);
      expect(extractor.validatePositions(200, 240, linhaValida)).toBe(true);
    });

    it('deve rejeitar posições inválidas', () => {
      const linhaValida = '0'.repeat(240);

      expect(extractor.validatePositions(-1, 10, linhaValida)).toBe(false);
      expect(extractor.validatePositions(10, 250, linhaValida)).toBe(false);
      expect(extractor.validatePositions(50, 40, linhaValida)).toBe(false); // start > end
    });

    it('deve formatar valores monetários corretamente', () => {
      expect(extractor.formatCurrency(0)).toBe('R$ 0,00');
      expect(extractor.formatCurrency(1234.56)).toBe('R$ 1.234,56');
      expect(extractor.formatCurrency(1000000.99)).toBe('R$ 1.000.000,99');
    });
  });

  describe('Performance e Casos Extremos', () => {
    it('deve processar linha mínima (240 caracteres)', () => {
      const linha = '0'.repeat(240);

      const inicio = performance.now();
      const resultado = extractor.extractBarcodeFromLine(linha);
      const duracao = performance.now() - inicio;

      expect(resultado.success).toBe(true);
      expect(duracao).toBeLessThan(10); // deve processar em menos de 10ms
    });

    it('deve lidar com linha contendo apenas espaços', () => {
      const linha = ' '.repeat(240);

      const resultado = extractor.extractBarcodeFromLine(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.barcode).toBe('');
    });

    it('deve processar múltiplas extrações na mesma linha', () => {
      const linha = '0'.repeat(17) +
        '12345678901234567890123456789012345' + // código barras (17-61)
        'NOME BENEFICIARIO     ' +              // nome (61-91)
        '19052025' +                            // data (91-99)
        '000000000123456' +                     // valor (99-114)
        '0'.repeat(126);

      const codigoBarras = extractor.extractBarcodeFromLine(linha);
      const nome = extractor.extractBeneficiaryName(linha);
      const data = extractor.extractDate(linha, 91, 99);
      const valor = extractor.extractMonetaryValue(linha, 99, 114);

      expect(codigoBarras.success).toBe(true);
      expect(nome.success).toBe(true);
      expect(data.success).toBe(true);
      expect(valor.success).toBe(true);

      expect(codigoBarras.barcode).toBe('12345678901234567890123456789012345');
      expect(nome.name).toBe('NOME BENEFICIARIO');
      expect(data.date).toBe('19/05/2025');
      expect(valor.value).toBe(1234.56);
    });
  });

  describe('Integração com Casos Reais', () => {
    it('deve extrair dados de uma linha real do Bradesco', () => {
      // Simular linha real do Bradesco (simplificada para teste)
      const linha =
        '237' +                                           // Bradesco
        '0001' +                                          // lote
        '3' +                                             // tipo registro
        '00001' +                                         // sequencial
        'J' +                                             // segmento
        ' ' +                                             // exclusivo
        '02' +                                            // movimento
        '23790000090000000012345678901234567890000' +     // código de barras Bradesco
        'EMPRESA FORNECEDORA LTDA     ' +                // beneficiário
        '15122024' +                                      // vencimento 15/12/2024
        '000000000095000' +                               // valor R$ 950,00
        '000000000095000' +                               // valor pago R$ 950,00
        '16122024' +                                      // data pagamento 16/12/2024
        '000000000095000' +                               // valor efetivo
        '0'.repeat(73);                                   // resto

      const resultado = extractor.extractSegmentJFields(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.codigoBarras).toBe('23790000090000000012345678901234567890000');
      expect(resultado.fields.nomeBeneficiario).toBe('EMPRESA FORNECEDORA LTDA');
      expect(resultado.fields.dataVencimento).toBe('15/12/2024');
      expect(resultado.fields.valorTitulo).toBe(950.00);
      expect(resultado.fields.valorPago).toBe(950.00);
      expect(resultado.fields.dataPagamento).toBe('16/12/2024');
    });

    it('deve extrair dados de boleto com desconto', () => {
      const linha =
        '341' +                                           // Itaú
        '0001' +
        '3' +
        '00002' +
        'J' +
        ' ' +
        '02' +
        '34191234567890123456789012345678901234567' +     // código de barras
        'LOJA DE DEPARTAMENTOS SA      ' +                // beneficiário
        '30112024' +                                      // vencimento 30/11/2024
        '000000000250000' +                               // valor original R$ 2.500,00
        '000000000245000' +                               // valor pago R$ 2.450,00 (com desconto)
        '29112024' +                                      // pagamento antecipado
        '000000000245000' +                               // valor efetivo
        '000000000005000' +                               // desconto R$ 50,00
        '000000000000000' +                               // sem mora
        '0'.repeat(58);

      const resultado = extractor.extractSegmentJFields(linha);

      expect(resultado.success).toBe(true);
      expect(resultado.fields.valorTitulo).toBe(2500.00);
      expect(resultado.fields.valorPago).toBe(2450.00);
      expect(resultado.fields.descontoAbatimento).toBe(50.00);
      expect(resultado.fields.acrescimoMora).toBe(0);

      // Verificar lógica de desconto
      const desconto = resultado.fields.valorTitulo - resultado.fields.valorPago;
      expect(desconto).toBe(50.00);
      expect(desconto).toBe(resultado.fields.descontoAbatimento);
    });
  });
}); 