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
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

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
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

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
   * Incorpora lógica do script Python para maior precisão na extração
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J01 parseados
   */
  static parseSegmentoJ01(linha) {
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento J01 deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

    // ✅ INTEGRAÇÃO PYTHON: Usar posições específicas do script Python que funcionam
    // Baseado na lógica do teste.py linha 20-38
    const codigoBanco = linha.substring(0, 3).trim();
    const codigoLote = linha.substring(3, 7).trim();
    const tipoRegistro = linha[7];
    const numeroRegistro = linha.substring(8, 13).trim();
    const segmento = linha[13];

    // ✅ PYTHON LOGIC: Posições específicas do script Python (linha 25, 28-38)
    const codigoBarras = linha.substring(17, 61).trim(); // Python: linha[17:61]
    const codigoMovimento = linha.substring(14, 20).trim(); // Python: linha[14:20]
    const codigoBancoFavorecido = linha.substring(20, 23).trim(); // Python: linha[20:23]
    const codigoCamara = linha.substring(23, 26).trim(); // Python: linha[23:26]
    const valorStr = linha.substring(26, 36).trim(); // Python: linha[26:36]
    const documento = linha.substring(41, 61).trim(); // Python: linha[41:61]
    const nomeFavorecido = linha.substring(61, 91).trim(); // Python: linha[61:91]
    const dataPagamento = linha.substring(91, 99).trim(); // Python: linha[91:99]
    const valorPagamentoStr = linha.substring(110, 125).trim(); // Python: linha[110:125]
    const descontos = linha.substring(114, 129).trim(); // Python: linha[114:129]
    const acrescimos = linha.substring(129, 143).trim(); // Python: linha[129:143]
    const informacoes = linha.substring(200, 220).trim(); // Python: linha[200:220]

    // ✅ PYTHON LOGIC: Conversão segura de valores (linha 40-48 do Python)
    let valorReais = 0.0;
    try {
      const valorPagamentoLimpo = valorStr.replace(/\D/g, ''); // Remove não-dígitos
      if (valorPagamentoLimpo) {
        valorReais = parseInt(valorPagamentoLimpo) / 100; // Centavos para reais
      }
    } catch (error) {
      console.warn('Erro na conversão de valor:', error.message);
      valorReais = 0.0;
    }

    const dados = {
      // Campos básicos do CNAB
      codigoBanco,
      lote: codigoLote,
      tipoRegistro,
      numeroSequencial: numeroRegistro,
      segmento,

      // ✅ PYTHON EXTRACTED FIELDS: Campos extraídos com lógica do Python
      codigoBarras,
      codigoMovimento,
      codigoBancoFavorecido,
      codigoCamara,
      documento,
      nomeFavorecido,
      dataPagamento,
      descontos,
      acrescimos,
      informacoes,

      // ✅ PYTHON VALUE CONVERSION: Valor convertido usando lógica Python
      valorTitulo: valorStr,
      valorPago: valorStr,
      valor: valorReais, // Valor em reais (conversão Python)
      valorReais, // Campo explícito para compatibilidade

      // Campos adicionais para compatibilidade com estrutura existente
      tipoMovimento: codigoMovimento,
      bancoFavorecido: codigoBancoFavorecido,
      camaraCompensacao: codigoCamara,
      outrasInformacoes: informacoes,

      // ✅ PYTHON COMPATIBILITY: Estrutura similar ao objeto Python
      favorecido_nome: nomeFavorecido.trim(),
      banco_favorecido: codigoBancoFavorecido,
      data_pagamento: dataPagamento,
      codigo_banco: codigoBanco,
      codigo_lote: codigoLote,
      tipo_registro: tipoRegistro,
      numero_registro: numeroRegistro,
      codigo_movimento: codigoMovimento,
      codigo_camara: codigoCamara,
      codigo_barras: codigoBarras,

      // Campos complementares para estrutura completa
      dataVencimento: '', // Será preenchido se disponível
      valorEfetivo: valorPagamentoStr,
      endereco_completo: '', // Será preenchido pelo segmento B

      // Metadados
      _metadata: {
        tipo: '3',
        descricao: 'Segmento J01 - Dados principais de títulos/cobrança (Python Enhanced)',
        categoria: 'pagamento',
        segmento: 'J',
        subtipo: 'J01',
        parser: 'SegmentoParser.parseSegmentoJ01',
        pythonCompatible: true,
        linhaOriginal: linha
      }
    };

    return dados;
  }

  /**
   * Processa uma linha de segmento J02 CNAB 240 (dados complementares da empresa)
   * Incorpora lógica do script Python para extração de dados do pagador
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J02 parseados
   */
  static parseSegmentoJ02(linha) {
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

    if (!linha || linha.length < 240) {
      throw new Error(`Linha de segmento J02 deve ter pelo menos 240 caracteres, encontrado: ${linha.length}`);
    }

    // Garantir exatamente 240 caracteres
    linha = linha.substring(0, 240);

    // ✅ PYTHON LOGIC: Extração baseada no script Python (linha 55-58)
    // Python: cnpj_pagador = segunda_linha_j[21:35].strip()
    // Python: pagador_nome = segunda_linha_j[35:58].strip()
    const cnpjPagador = linha.substring(21, 35).trim(); // Python: linha[21:35]
    const pagadorNome = linha.substring(35, 58).trim(); // Python: linha[35:58]

    const dados = {
      // Campos básicos do CNAB
      codigoBanco: linha.substring(0, 3).trim(),
      lote: linha.substring(3, 7).trim(),
      tipoRegistro: linha[7],
      numeroSequencial: linha.substring(8, 13).trim(),
      segmento: linha[13],

      // ✅ PYTHON EXTRACTED FIELDS: Campos extraídos com lógica do Python
      cnpjPagador, // Posição exata do Python
      pagadorNome, // Posição exata do Python

      // Campos tradicionais para compatibilidade
      indicadorSubtipo: linha.substring(14, 18),
      cnpjEmpresa: linha.substring(18, 32).trim(),
      codigoIntermediario: linha.substring(32, 35).trim(),
      nomeEmpresa: linha.substring(35, 75).trim(),
      tipoInscricaoFavorecido: linha.substring(75, 77).trim(),
      cnpjFavorecido: linha.substring(77, 91).trim(),
      nomeFavorecido: linha.substring(91, 147).trim(),
      informacoesAdicionais: linha.substring(147, 167).trim(),
      dadosLivres: linha.substring(167, 240).trim(),

      // ✅ PYTHON COMPATIBILITY: Estrutura similar ao objeto Python
      cnpj_pagador: cnpjPagador,
      pagador_nome: pagadorNome.trim(),

      // Metadados do subtipo
      subtipoJ: 'J02',
      descricaoSubtipo: 'Dados complementares da empresa pagadora (Python Enhanced)',

      // Metadados
      _metadata: {
        tipo: '3',
        descricao: 'Segmento J02 - Dados da empresa pagadora (Python Enhanced)',
        categoria: 'pagamento',
        segmento: 'J',
        subtipo: 'J02',
        parser: 'SegmentoParser.parseSegmentoJ02',
        pythonCompatible: true,
        linhaOriginal: linha
      }
    };

    return dados;
  }

  /**
   * Processa uma linha de segmento J CNAB 240 (títulos de cobrança) - VERSÃO ORIGINAL
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento J parseados
   */
  static parseSegmentoJ(linha) {
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

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
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

    console.log(`[DEBUG] parseSegmentoO recebeu linha com tamanho: ${linha.length}`);

    if (!linha || linha.length < 240) {
      console.log(`[DEBUG] parseSegmentoO ERRO: linha muito curta - ${linha.length} chars`);
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

      // ✅ CORREÇÃO CRÍTICA: Baseado na análise do arquivo, códigos de barras de tributos
      // geralmente estão em posições diferentes dos títulos de cobrança
      codigoBarras: linha.substring(17, 65).trim(), // Posições 18-65 (48 caracteres)

      // Nome da concessionária/órgão após o código de barras
      nomeConcessionaria: linha.substring(65, 105).trim(), // Posições 66-105 (40 caracteres)

      // Data de vencimento
      dataVencimento: linha.substring(105, 113).trim(), // Posições 106-113 (8 caracteres)

      // ✅ CORREÇÃO CRÍTICA: Valor do documento/tributo
      // Para tributos, o valor pode estar em posições específicas
      valorDocumento: linha.substring(113, 128).trim(), // Posições 114-128 (15 caracteres)
      valorPago: linha.substring(113, 128).trim(), // Campo duplicado para compatibilidade

      // Valor de desconto/abatimento
      valorDesconto: linha.substring(128, 143).trim(), // Posições 129-143 (15 caracteres)

      // Data do pagamento
      dataPagamento: linha.substring(143, 151).trim(), // Posições 144-151 (8 caracteres)

      // Valor real efetivado
      valorEfetivado: linha.substring(151, 166).trim(), // Posições 152-166 (15 caracteres)

      // Referência/nosso número
      referencia: linha.substring(166, 186).trim(), // Posições 167-186 (20 caracteres)

      // Informações complementares
      informacoesComplementares: linha.substring(186, 223).trim(), // Posições 187-223 (37 caracteres)

      // Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(223, 240).trim(), // Posições 224-240 (17 caracteres)

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
    // ✅ CORRIGIDO: Normalizar linha removendo apenas quebras de linha
    linha = linha.replace(/\r?\n?$/g, '');

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
        {
          const dadosA = this.parseSegmentoA(linha);
          return new SegmentoA240(dadosA); // ✅ CORREÇÃO: Usando o modelo correto
        }
      case 'J':
        // Para segmento J, usar estrutura genérica por ora
        {
          const dadosJ = this.parseSegmentoJ(linha);
          return { tipo: 'SegmentoJ', ...dadosJ }; // ✅ CORREÇÃO: Usando o modelo correto
        }
      case 'O':
        // Para segmento O, usar estrutura genérica por ora
        {
          const dadosO = this.parseSegmentoO(linha);
          return { tipo: 'SegmentoO', ...dadosO }; // ✅ CORREÇÃO: Usando o modelo correto
        }
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