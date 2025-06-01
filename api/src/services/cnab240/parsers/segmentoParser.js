/**
 * Parser específico para Segmentos A, J e O CNAB 240 (Tipo de Registro 3)
 * 
 * Especificação FEBRABAN - posições exatas dos campos
 */

import { SegmentoA240 } from '../../../models/cnab240/index.js';

/**
 * Parser para Segmentos A, J e O CNAB 240
 */
export class SegmentoParser {
  /**
   * Processa uma linha de segmento A CNAB 240 (pagamentos/créditos PIX)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento A parseados
   */
  static parseSegmentoA(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de segmento A deve ter 240 caracteres');
    }

    // Verificar se é realmente segmento A
    const segmento = linha[13];
    if (segmento !== 'A') {
      throw new Error(`Segmento esperado: A, encontrado: ${segmento}`);
    }

    // Extrair campos conforme posições FEBRABAN
    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço
      lote: linha.substring(3, 7).trim(),

      // Posição 008: Tipo de registro (3)
      tipoRegistro: linha[7],

      // Posições 009-013: Número sequencial do registro
      numeroSequencial: linha.substring(8, 13).trim(),

      // Posição 014: Código do segmento (A)
      segmento: linha[13],

      // Posição 015: Tipo de movimento
      tipoMovimento: linha[14],

      // Posições 016-017: Código da instrução para movimento
      codigoInstrucao: linha.substring(15, 17).trim(),

      // Posições 018-020: Câmara centralizadora de compensação
      camaraCompensacao: linha.substring(17, 20).trim(),

      // Posições 021-023: Banco favorecido
      bancoFavorecido: linha.substring(20, 23).trim(),

      // Posições 024-028: Agência mantenedora da conta do favorecido
      agenciaFavorecido: linha.substring(23, 28).trim(),

      // Posição 029: Dígito verificador da agência
      dvAgenciaFavorecido: linha[28].trim(),

      // Posições 030-041: Número da conta corrente do favorecido
      contaFavorecido: linha.substring(29, 41).trim(),

      // Posição 042: Dígito verificador da conta
      dvContaFavorecido: linha[41].trim(),

      // Posição 043: Dígito verificador da agência/conta
      dvAgenciaContaFavorecido: linha[42].trim(),

      // Posições 044-073: Nome do favorecido
      nomeFavorecido: linha.substring(43, 73).trim(),

      // Posições 074-093: Número de documento atribuído pela empresa
      numeroDocumentoEmpresa: linha.substring(73, 93).trim(),

      // Posições 094-101: Data do pagamento (DDMMAAAA)
      dataPagamento: linha.substring(93, 101),

      // Posições 102-104: Tipo da moeda
      tipoMoeda: linha.substring(101, 104).trim(),

      // Posições 105-119: Quantidade da moeda ou valor do pagamento
      valorPagamento: linha.substring(104, 119).trim(),

      // Posições 120-134: Número de documento atribuído pelo banco
      numeroDocumentoBanco: linha.substring(119, 134).trim(),

      // Posições 135-142: Data real da efetivação do pagamento (DDMMAAAA)
      dataEfetivacao: linha.substring(134, 142),

      // Posições 143-157: Valor real da efetivação do pagamento
      valorEfetivacao: linha.substring(142, 157).trim(),

      // Posições 158-177: Outras informações
      outrasInformacoes: linha.substring(157, 177).trim(),

      // Posições 178-179: Complemento de registro
      complementoRegistro: linha.substring(177, 179).trim(),

      // Posições 180-184: Código da ocorrência para retorno
      codigoOcorrencia: linha.substring(179, 184).trim(),

      // Posições 185-194: Código do banco na compensação
      codigoBancoCompensacao: linha.substring(184, 194).trim(),

      // Posições 195-199: Nosso número
      nossoNumero: linha.substring(194, 199).trim(),

      // Posições 200-209: Código DV do nosso número
      dvNossoNumero: linha.substring(199, 209).trim(),

      // Posições 210-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(209, 240).trim()
    };

    return dados;
  }

  /**
   * Processa uma linha de segmento J CNAB 240 (títulos de cobrança)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J parseados
   */
  static parseSegmentoJ(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de segmento J deve ter 240 caracteres');
    }

    // Verificar se é realmente segmento J
    const segmento = linha[13];
    if (segmento !== 'J') {
      throw new Error(`Segmento esperado: J, encontrado: ${segmento}`);
    }

    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço
      lote: linha.substring(3, 7).trim(),

      // Posição 008: Tipo de registro (3)
      tipoRegistro: linha[7],

      // Posições 009-013: Número sequencial do registro
      numeroSequencial: linha.substring(8, 13).trim(),

      // Posição 014: Código do segmento (J)
      segmento: linha[13],

      // Posições 015-059: Código de barras
      codigoBarras: linha.substring(14, 59).trim(),

      // Posições 060-089: Nome do beneficiário/favorecido
      nomeFavorecido: linha.substring(59, 89).trim(),

      // Posições 090-097: Data do vencimento (DDMMAAAA)
      dataVencimento: linha.substring(89, 97),

      // Posições 098-112: Valor do título
      valorTitulo: linha.substring(97, 112).trim(),

      // Posições 113-127: Desconto/abatimento
      valorDesconto: linha.substring(112, 127).trim(),

      // Posições 128-142: Acréscimo/mora
      valorAcrescimo: linha.substring(127, 142).trim(),

      // Posições 143-150: Data do pagamento (DDMMAAAA)
      dataPagamento: linha.substring(142, 150),

      // Posições 151-165: Valor pago
      valorPago: linha.substring(150, 165).trim(),

      // Posições 166-180: Quantidade da moeda
      quantidadeMoeda: linha.substring(165, 180).trim(),

      // Posições 181-200: Referência do sacado
      referenciaSacado: linha.substring(180, 200).trim(),

      // Posições 201-240: Nosso número/controle
      nossoNumero: linha.substring(200, 240).trim()
    };

    return dados;
  }

  /**
   * Processa uma linha de segmento O CNAB 240 (pagamento de tributos)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento O parseados
   */
  static parseSegmentoO(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de segmento O deve ter 240 caracteres');
    }

    // Verificar se é realmente segmento O
    const segmento = linha[13];
    if (segmento !== 'O') {
      throw new Error(`Segmento esperado: O, encontrado: ${segmento}`);
    }

    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço
      lote: linha.substring(3, 7).trim(),

      // Posição 008: Tipo de registro (3)
      tipoRegistro: linha[7],

      // Posições 009-013: Número sequencial do registro
      numeroSequencial: linha.substring(8, 13).trim(),

      // Posição 014: Código do segmento (O)
      segmento: linha[13],

      // Posições 015-062: Código de barras do tributo
      codigoBarras: linha.substring(14, 62).trim(),

      // Posições 063-092: Nome da concessionária/órgão
      nomeConcessionaria: linha.substring(62, 92).trim(),

      // Posições 093-100: Data de vencimento (DDMMAAAA)
      dataVencimento: linha.substring(92, 100),

      // Posições 101-115: Valor do documento
      valorDocumento: linha.substring(100, 115).trim(),

      // Posições 116-130: Desconto/abatimento
      valorDesconto: linha.substring(115, 130).trim(),

      // Posições 131-145: Multa/juros
      valorMulta: linha.substring(130, 145).trim(),

      // Posições 146-153: Data do pagamento (DDMMAAAA)
      dataPagamento: linha.substring(145, 153),

      // Posições 154-168: Valor pago
      valorPago: linha.substring(153, 168).trim(),

      // Posições 169-188: Referência/identificação
      referencia: linha.substring(168, 188).trim(),

      // Posições 189-228: Informações complementares
      informacoesComplementares: linha.substring(188, 228).trim(),

      // Posições 229-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(228, 240).trim()
    };

    return dados;
  }

  /**
   * Parser genérico que detecta automaticamente o tipo de segmento
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados parseados conforme o segmento
   */
  static parse(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter 240 caracteres');
    }

    const tipoRegistro = linha[7];
    if (tipoRegistro !== '3') {
      throw new Error(`Tipo de registro esperado: 3, encontrado: ${tipoRegistro}`);
    }

    const segmento = linha[13];

    switch (segmento) {
      case 'A':
        return this.parseSegmentoA(linha);
      case 'J':
        return this.parseSegmentoJ(linha);
      case 'O':
        return this.parseSegmentoO(linha);
      default:
        throw new Error(`Segmento "${segmento}" não suportado por este parser`);
    }
  }

  /**
   * Cria uma instância do modelo apropriado baseado no segmento
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Instância do modelo apropriado
   */
  static parseToModel(linha) {
    const segmento = linha[13];

    switch (segmento) {
      case 'A':
        const dadosA = this.parseSegmentoA(linha);
        return new SegmentoA240(dadosA);
      case 'J':
        // Para segmento J, usar estrutura genérica por ora
        const dadosJ = this.parseSegmentoJ(linha);
        return { tipo: 'SegmentoJ', ...dadosJ };
      case 'O':
        // Para segmento O, usar estrutura genérica por ora
        const dadosO = this.parseSegmentoO(linha);
        return { tipo: 'SegmentoO', ...dadosO };
      default:
        throw new Error(`Segmento "${segmento}" não suportado para criação de modelo`);
    }
  }

  /**
   * Valida um segmento específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validate(linha) {
    const erros = [];

    try {
      const segmento = linha[13];

      switch (segmento) {
        case 'A':
          return this.validateSegmentoA(linha);
        case 'J':
          return this.validateSegmentoJ(linha);
        case 'O':
          return this.validateSegmentoO(linha);
        default:
          erros.push(`Segmento "${segmento}" não reconhecido`);
          return { valido: false, erros };
      }
    } catch (error) {
      erros.push(error.message);
      return { valido: false, erros };
    }
  }

  /**
   * Valida segmento A específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validateSegmentoA(linha) {
    const erros = [];

    try {
      const dados = this.parseSegmentoA(linha);

      if (!dados.codigoBanco || dados.codigoBanco.length !== 3) {
        erros.push('Código do banco deve ter 3 dígitos');
      }

      if (!dados.nomeFavorecido.trim()) {
        erros.push('Nome do favorecido é obrigatório');
      }

      // Validar valor do pagamento
      const valor = parseFloat(dados.valorPagamento) / 100; // Centavos para reais
      if (valor <= 0) {
        erros.push('Valor do pagamento deve ser maior que zero');
      }

      // Validar data de pagamento
      if (dados.dataPagamento.length === 8) {
        const dia = parseInt(dados.dataPagamento.substring(0, 2));
        const mes = parseInt(dados.dataPagamento.substring(2, 4));
        const ano = parseInt(dados.dataPagamento.substring(4, 8));

        if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000) {
          erros.push('Data de pagamento inválida');
        }
      }

    } catch (error) {
      erros.push(error.message);
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Valida segmento J específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validateSegmentoJ(linha) {
    const erros = [];

    try {
      const dados = this.parseSegmentoJ(linha);

      if (!dados.codigoBarras.trim()) {
        erros.push('Código de barras é obrigatório para títulos');
      }

      if (!dados.nomeFavorecido.trim()) {
        erros.push('Nome do favorecido é obrigatório');
      }

      // Validar valor do título
      const valor = parseFloat(dados.valorTitulo) / 100;
      if (valor <= 0) {
        erros.push('Valor do título deve ser maior que zero');
      }

    } catch (error) {
      erros.push(error.message);
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Valida segmento O específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validateSegmentoO(linha) {
    const erros = [];

    try {
      const dados = this.parseSegmentoO(linha);

      if (!dados.codigoBarras.trim()) {
        erros.push('Código de barras é obrigatório para tributos');
      }

      if (!dados.nomeConcessionaria.trim()) {
        erros.push('Nome da concessionária é obrigatório');
      }

      // Validar valor do documento
      const valor = parseFloat(dados.valorDocumento) / 100;
      if (valor <= 0) {
        erros.push('Valor do documento deve ser maior que zero');
      }

    } catch (error) {
      erros.push(error.message);
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }
}

export default SegmentoParser; 