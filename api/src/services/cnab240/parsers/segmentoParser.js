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
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento A deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

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
   * Identifica o subtipo do Segmento J baseado no conteúdo
   * @param {string} linha - Linha de 240 caracteres
   * @returns {string} Subtipo identificado (J01, J02, etc.)
   */
  static identifyJSubtype(linha) {
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento J deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

    // Verificar se é realmente segmento J
    const segmento = linha[13];
    if (segmento !== 'J') {
      throw new Error(`Segmento esperado: J, encontrado: ${segmento}`);
    }

    // Analisar o conteúdo para determinar o tipo:
    // Posições 15-19: Se começar com "0003" seguido de números = J01 (dados de cobrança)
    // Posições 15-19: Se começar com "0005" seguido de CNPJ = J02 (dados da empresa)
    const inicioSegmento = linha.substring(14, 19);

    if (inicioSegmento.startsWith('0003')) {
      // Tipo J01: Dados principais de cobrança/título
      return 'J01';
    } else if (inicioSegmento.startsWith('0005')) {
      // Tipo J02: Dados complementares da empresa pagadora
      return 'J02';
    }

    // Fallback: tentar detectar pela presença de código de barras vs CNPJ
    const primeiros20Chars = linha.substring(14, 34);

    // Se contém apenas dígitos nos primeiros 20 caracteres, provavelmente é J01 (código de barras)
    if (/^\d{20}$/.test(primeiros20Chars)) {
      return 'J01';
    }

    // Se contém caracteres alfanuméricos misturados, provavelmente é J02 (CNPJ + nome)
    if (/\d{14}/.test(primeiros20Chars)) {
      return 'J02';
    }

    // Padrão: assumir J01 se não conseguir determinar
    return 'J01';
  }

  /**
   * Processa uma linha de segmento J01 CNAB 240 (dados principais de títulos de cobrança)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J01 parseados
   */
  static parseSegmentoJ01(linha) {
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento J01 deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

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

      // Posições 015-017: Tipo de movimento
      tipoMovimento: linha.substring(14, 17).trim(),

      // Posições 018-019: Código da instrução para movimento
      codigoInstrucaoMovimento: linha.substring(17, 19).trim(),

      // Posições 020-044: Código de barras
      codigoBarras: linha.substring(19, 44).trim(),

      // Posições 045-104: Nome do favorecido
      nomeFavorecido: linha.substring(44, 104).trim(),

      // Posições 105-112: Data de vencimento (DDMMAAAA)
      dataVencimento: linha.substring(104, 112).trim(),

      // ✅ CORREÇÃO FINAL: Posições 107-115 (9 caracteres) - Valor do título/pagamento
      // Análise confirmou: primeira ocorrência de 002234040 está na posição 106 (107-115)
      valorTitulo: linha.substring(106, 115).trim(),
      valorPago: linha.substring(106, 115).trim(), // Usar o mesmo campo como fallback

      // Posições 122-136: Desconto + abatimento
      descontoAbatimento: linha.substring(121, 136).trim(),

      // Posições 137-151: Acréscimo + mora
      acrescimoMora: linha.substring(136, 151).trim(),

      // Posições 152-159: Data do pagamento (DDMMAAAA)
      dataPagamento: linha.substring(151, 159).trim(),

      // Posições 160-174: Valor efetivamente pago
      valorEfetivamentePago: linha.substring(159, 174).trim(),

      // Posições 175-189: Outros valores
      outrosValores: linha.substring(174, 189).trim(),

      // Posições 190-199: Indicadores de float
      indicadoresFloat: linha.substring(189, 199).trim(),

      // Posições 200-240: Brancos/reservado
      brancos: linha.substring(199, 240).trim()
    };

    return dados;
  }

  /**
   * Processa uma linha de segmento J02 CNAB 240 (dados complementares da empresa)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J02 parseados
   */
  static parseSegmentoJ02(linha) {
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento J02 deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

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

      // Posições 015-018: Indicador de subtipo (ex: "0005")
      indicadorSubtipo: linha.substring(14, 18),

      // Posições 019-032: CNPJ/CPF da empresa pagadora (14 dígitos para CNPJ)
      cnpjEmpresa: linha.substring(18, 32).trim(),

      // Posições 033-035: Campo intermediário/código adicional
      codigoIntermediario: linha.substring(32, 35).trim(),

      // Posições 036-075: Nome da empresa pagadora (40 posições, excluindo "20" do próximo campo)
      nomeEmpresa: linha.substring(35, 75).trim(),

      // Posições 076-077: Campo adicional (parece ser tipo de inscrição "20" = CNPJ)
      tipoInscricaoFavorecido: linha.substring(75, 77).trim(),

      // Posições 078-091: CNPJ/CPF do favorecido (14 dígitos)
      cnpjFavorecido: linha.substring(77, 91).trim(),

      // Posições 092-147: Nome do favorecido/beneficiário (aproximadamente 55 posições)
      nomeFavorecido: linha.substring(91, 147).trim(),

      // Posições 148-167: Informações adicionais/complementares (20 posições)
      informacoesAdicionais: linha.substring(147, 167).trim(),

      // Posições 168-240: Dados livres/uso específico (restante da linha)
      dadosLivres: linha.substring(167, 240).trim(),

      // Metadados do subtipo
      subtipoJ: 'J02',
      descricaoSubtipo: 'Dados complementares da empresa pagadora'
    };

    return dados;
  }

  /**
   * Processa uma linha de segmento J CNAB 240 (títulos de cobrança) - VERSÃO ORIGINAL
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J parseados
   */
  static parseSegmentoJ(linha) {
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento J deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

    // Verificar se é realmente segmento J
    const segmento = linha[13];
    if (segmento !== 'J') {
      throw new Error(`Segmento esperado: J, encontrado: ${segmento}`);
    }

    // Detectar o subtipo e usar o parser apropriado
    const subtipo = this.identifyJSubtype(linha);

    switch (subtipo) {
      case 'J01':
        return this.parseSegmentoJ01(linha);
      case 'J02':
        return this.parseSegmentoJ02(linha);
      default:
        // Fallback: usar parser J01 como padrão
        return this.parseSegmentoJ01(linha);
    }
  }

  /**
   * Parser específico para Segmento O CNAB 240 (Pagamento de tributos)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento O parseados
   */
  static parseSegmentoO(linha) {
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento O deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

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

      // Posições 015-017: Código de movimento
      codigoMovimento: linha.substring(14, 17).trim(),

      // Posições 018-062: Código de barras (45 posições)
      codigoBarras: linha.substring(17, 62).trim(),

      // Posições 063-065: Identificação adicional (ex: "991")
      identificacaoComplementar: linha.substring(62, 65).trim(),

      // Posições 066-095: Nome da concessionária/órgão/favorecido (30 posições)
      nomeConcessionaria: linha.substring(65, 95).trim(),

      // Posições 096-103: Data de vencimento (DDMMAAAA)
      dataVencimento: linha.substring(95, 103).trim(),

      // ✅ CORREÇÃO CRÍTICA: Posições 130-136 (7 caracteres) - Valor do tributo/documento
      // Análise confirmou: valores estão na posição 129 (130-136)
      // SANEAMENTO: 12926 (5 dígitos), BARTE: 2450004 (7 dígitos)
      valorDocumento: linha.substring(129, 136).trim(),
      valorPago: linha.substring(129, 136).trim(), // Campo duplicado para compatibilidade

      // Posições 136-148: Desconto/abatimento (ajustado após correção)
      valorDesconto: linha.substring(135, 148).trim(),

      // Posições 149-156: Data do pagamento (DDMMAAAA)
      dataPagamento: linha.substring(148, 156).trim(),

      // Posições 157-171: Valor real efetivado (15 posições, com 2 decimais)
      valorEfetivado: linha.substring(156, 171).trim(),

      // Posições 172-191: Referência/nosso número (20 posições)
      referencia: linha.substring(171, 191).trim(),

      // Posições 192-228: Informações complementares (37 posições)
      informacoesComplementares: linha.substring(191, 228).trim(),

      // Posições 229-240: Uso exclusivo FEBRABAN/CNAB (12 posições)
      usoFEBRABAN: linha.substring(228, 240).trim(),

      // Metadados
      _metadata: {
        tipo: '3',
        descricao: 'Segmento O - Pagamento de Tributos/Concessionárias',
        categoria: 'pagamento',
        segmento: 'O',
        parser: 'SegmentoParser.parseSegmentoO',
        linhaOriginal: linha
      }
    };

    return dados;
  }

  /**
   * Parser genérico que detecta automaticamente o tipo de segmento
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados parseados conforme o segmento
   */
  static parse(linha) {
    // Normalizar linha removendo caracteres extras (como \r\n)
    linha = linha.trim();

    if (!linha || linha.length < 240) {
      throw new Error(`Linha deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

    const tipoRegistro = linha[7];
    if (tipoRegistro !== '3') {
      throw new Error(`Tipo de registro esperado: 3, encontrado: ${tipoRegistro}`);
    }

    const segmento = linha[13];

    switch (segmento) {
      case 'J': {
        // Para segmentos J (cobranças), usar o parser específico
        return this.parseSegmentoJ(linha);
      }

      case 'O': {
        // Para segmentos O (tributos), usar o parser específico
        return this.parseSegmentoO(linha);
      }

      case 'A': {
        // Para segmentos A (PIX/TED), usar o parser específico
        return this.parseSegmentoA(linha);
      }

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