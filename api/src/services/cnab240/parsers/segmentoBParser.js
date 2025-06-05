/**
 * Parser específico para Segmento B CNAB 240 (Tipo de Registro 3, Segmento B)
 * 
 * Especificação FEBRABAN - posições exatas dos campos
 * Subtipos B01 (Telefone), B02 (Email), B03 (CNPJ/CPF), B04 (UUID)
 * + Segmento B Tradicional (endereço complementar)
 */

import { SegmentoB240 } from '../../../models/cnab240/index.js';

/**
 * Parser para Segmento B CNAB 240 - Dados complementares PIX ou endereço tradicional
 */
export class SegmentoBParser {
  /**
   * Identifica o subtipo do Segmento B baseado no conteúdo
   * @param {string} linha - Linha de 240 caracteres
   * @returns {string} Subtipo identificado (B01, B02, B03, B04, TRADICIONAL)
   */
  static identifySubtype(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de segmento B deve ter 240 caracteres');
    }

    // Verificar se é realmente segmento B
    const segmento = linha[13];
    if (segmento !== 'B') {
      throw new Error(`Segmento esperado: B, encontrado: ${segmento}`);
    }

    // Posições 015-017: Subtipo explícito (quando presente)
    const subtipoExplicito = linha.substring(14, 17).trim();

    // Se há subtipo explícito PIX
    if (['B01', 'B02', 'B03', 'B04'].includes(subtipoExplicito)) {
      return subtipoExplicito;
    }

    // Se posições 15-17 estão em branco ou com espaços, é segmento B tradicional (endereço)
    if (!subtipoExplicito || subtipoExplicito === '' || subtipoExplicito === '   ') {
      return 'TRADICIONAL';
    }

    // Inferir subtipo baseado no conteúdo da chave PIX
    // Posições 018-099: Informações da chave PIX
    const conteudoChave = linha.substring(17, 99).trim();

    if (!conteudoChave) {
      // Verificar em outra posição comum para chave PIX
      const chavePix = linha.substring(99, 198).trim();
      return this.inferSubtypeFromContent(chavePix);
    }

    return this.inferSubtypeFromContent(conteudoChave);
  }

  /**
   * Infere o subtipo baseado no conteúdo da chave PIX
   * @param {string} conteudo - Conteúdo da chave PIX
   * @returns {string} Subtipo inferido (B01, B02, B03, B04, TRADICIONAL)
   */
  static inferSubtypeFromContent(conteudo) {
    if (!conteudo || conteudo.trim() === '') {
      return 'TRADICIONAL'; // Sem chave PIX = endereço tradicional
    }

    const chaveLimpa = conteudo.trim();

    // Verificar se é telefone (+55...)
    if (/^\+55\d{10,11}$/.test(chaveLimpa) || /^55\d{10,11}$/.test(chaveLimpa)) {
      return 'B01'; // Telefone
    }

    // Verificar se é email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chaveLimpa)) {
      return 'B02'; // Email
    }

    // Verificar se é CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (/^\d{11}$/.test(chaveLimpa) || /^\d{14}$/.test(chaveLimpa)) {
      return 'B03'; // CPF/CNPJ
    }

    // Verificar se é UUID (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chaveLimpa)) {
      return 'B04'; // UUID
    }

    // Se não se encaixa em padrão PIX, assumir que é endereço tradicional
    return 'TRADICIONAL';
  }

  /**
   * Processa uma linha de segmento B CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do segmento B parseados
   */
  static parse(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de segmento B deve ter 240 caracteres');
    }

    // Verificar se é realmente segmento B
    const segmento = linha[13];
    if (segmento !== 'B') {
      throw new Error(`Segmento esperado: B, encontrado: ${segmento}`);
    }

    // Identificar subtipo
    const subtipo = this.identifySubtype(linha);

    // Extrair campos básicos comuns
    const dadosComuns = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço
      lote: linha.substring(3, 7).trim(),

      // Posição 008: Tipo de registro (3)
      tipoRegistro: linha[7],

      // Posições 009-013: Número sequencial do registro
      numeroSequencial: linha.substring(8, 13).trim(),

      // Posição 014: Código do segmento (B)
      segmento: linha[13],

      // Subtipo identificado
      subtipo
    };

    // Parsing específico por subtipo
    switch (subtipo) {
      case 'B01':
        return this.parseB01(linha, dadosComuns);
      case 'B02':
        return this.parseB02(linha, dadosComuns);
      case 'B03':
        return this.parseB03(linha, dadosComuns);
      case 'B04':
        return this.parseB04(linha, dadosComuns);
      case 'TRADICIONAL':
        return this.parseTradicional(linha, dadosComuns);
      default:
        return this.parseGenerico(linha, dadosComuns);
    }
  }

  /**
   * Parser específico para B01 - Telefone
   * @param {string} linha - Linha de 240 caracteres
   * @param {Object} dadosComuns - Dados básicos já extraídos
   * @returns {Object} Dados específicos do B01
   */
  static parseB01(linha, dadosComuns) {
    return {
      ...dadosComuns,
      // Posições 015-017: Indicador do subtipo
      indicadorSubtipo: linha.substring(14, 17).trim(),

      // Posições 018-032: Código do país + código da área + número do telefone
      telefone: {
        codigoPais: linha.substring(17, 20).trim(),
        codigoArea: linha.substring(20, 23).trim(),
        numero: linha.substring(23, 32).trim(),
        completo: linha.substring(17, 32).trim()
      },

      // Posições 033-099: Informações complementares do telefone
      informacoesComplementares: linha.substring(32, 99).trim(),

      // Posições 100-198: Chave PIX extraída
      chavePix: linha.substring(99, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo de chave identificado
      tipoChave: 'telefone'
    };
  }

  /**
   * Parser específico para B02 - Email
   * @param {string} linha - Linha de 240 caracteres
   * @param {Object} dadosComuns - Dados básicos já extraídos
   * @returns {Object} Dados específicos do B02
   */
  static parseB02(linha, dadosComuns) {
    return {
      ...dadosComuns,
      // Posições 015-017: Indicador do subtipo
      indicadorSubtipo: linha.substring(14, 17).trim(),

      // Posições 018-099: Endereço de email completo
      email: linha.substring(17, 99).trim(),

      // Posições 100-198: Chave PIX extraída
      chavePix: linha.substring(99, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo de chave identificado
      tipoChave: 'email'
    };
  }

  /**
   * Parser específico para B03 - CNPJ/CPF
   * @param {string} linha - Linha de 240 caracteres
   * @param {Object} dadosComuns - Dados básicos já extraídos
   * @returns {Object} Dados específicos do B03
   */
  static parseB03(linha, dadosComuns) {
    return {
      ...dadosComuns,
      // Posições 015-017: Indicador do subtipo
      indicadorSubtipo: linha.substring(14, 17).trim(),

      // Posições 018-032: Tipo de inscrição (1=CPF, 2=CNPJ)
      tipoInscricao: linha[17],

      // Posições 019-032: Número da inscrição (CPF ou CNPJ)
      numeroInscricao: linha.substring(18, 32).trim(),

      // Posições 033-099: Informações complementares
      informacoesComplementares: linha.substring(32, 99).trim(),

      // Posições 100-198: Chave PIX extraída
      chavePix: linha.substring(99, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo de chave identificado
      tipoChave: linha[17] === '1' ? 'cpf' : 'cnpj'
    };
  }

  /**
   * Parser específico para B04 - UUID
   * @param {string} linha - Linha de 240 caracteres
   * @param {Object} dadosComuns - Dados básicos já extraídos
   * @returns {Object} Dados específicos do B04
   */
  static parseB04(linha, dadosComuns) {
    return {
      ...dadosComuns,
      // Posições 015-017: Indicador do subtipo
      indicadorSubtipo: linha.substring(14, 17).trim(),

      // Posições 018-099: UUID da chave PIX
      uuidChave: linha.substring(17, 99).trim(),

      // Posições 100-198: Chave PIX extraída
      chavePix: linha.substring(99, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo de chave identificado
      tipoChave: 'uuid'
    };
  }

  /**
   * Parser específico para Segmento B Tradicional - Endereço/Dados Complementares
   * Incorpora lógica do script Python para extração de endereços
   * @param {string} linha - Linha de 240 caracteres
   * @param {Object} dadosComuns - Dados básicos já extraídos
   * @returns {Object} Dados específicos do segmento B tradicional
   */
  static parseTradicional(linha, dadosComuns) {
    // ✅ PYTHON LOGIC: Extração baseada no script Python (linha 99-131)
    // Python: cnpj_favorecido = proxima_linha[18:32].strip()
    // Python: logradouro = proxima_linha[32:62].strip()
    // Python: numero_endereco = proxima_linha[62:67].strip()
    // Python: complemento = proxima_linha[67:82].strip()
    // Python: bairro = proxima_linha[82:97].strip()
    // Python: cidade = proxima_linha[97:117].strip()
    // Python: cep = proxima_linha[117:125].strip()
    // Python: uf = proxima_linha[125:127].strip()

    const cnpjFavorecido = linha.substring(18, 32).trim(); // Python: linha[18:32]
    const logradouro = linha.substring(32, 62).trim(); // Python: linha[32:62]
    const numeroEndereco = linha.substring(62, 67).trim(); // Python: linha[62:67]
    const complemento = linha.substring(67, 82).trim(); // Python: linha[67:82]
    const bairro = linha.substring(82, 97).trim(); // Python: linha[82:97]
    const cidade = linha.substring(97, 117).trim(); // Python: linha[97:117]
    const cep = linha.substring(117, 125).trim(); // Python: linha[117:125]
    const uf = linha.substring(125, 127).trim(); // Python: linha[125:127]

    // ✅ PYTHON LOGIC: Extração de email (linha 109-118)
    // Python: resto_linha = proxima_linha[127:].strip()
    const restoLinha = linha.substring(127).trim(); // Python: linha[127:]
    let email = '';
    if (restoLinha.includes('@')) {
      // Procurar por padrão de email
      const partes = restoLinha.split(/\s+/);
      for (const parte of partes) {
        if (parte.includes('@') && parte.includes('.') && parte.length > 5) {
          email = parte.trim();
          break;
        }
      }
    }

    // ✅ PYTHON LOGIC: Endereço completo formatado (linha 123)
    // Python: endereco_completo = f"{logradouro.strip()}, {numero_endereco.strip()} {complemento.strip()} - {bairro.strip()} - {cidade.strip()}/{uf} - CEP: {cep.strip()}"
    const enderecoCompleto = `${logradouro}, ${numeroEndereco} ${complemento} - ${bairro} - ${cidade}/${uf} - CEP: ${cep}`.replace(/\s+/g, ' ').trim();

    return {
      ...dadosComuns,
      // Posições tradicionais
      indicadorSubtipo: linha.substring(14, 17).trim(),
      tipoInscricao: linha[17],
      numeroInscricao: linha.substring(18, 32).trim(),

      // ✅ PYTHON EXTRACTED FIELDS: Campos extraídos com lógica do Python
      cnpjFavorecido,
      logradouro,
      numeroEndereco,
      complemento,
      bairro,
      cidade,
      cep,
      uf,
      email,
      enderecoCompleto,

      // Endereço estruturado (compatibilidade)
      endereco: {
        logradouro,
        numero: numeroEndereco,
        complemento,
        bairro,
        cidade,
        cep,
        complementoCep: '', // Não usado no Python
        estado: uf
      },

      // ✅ PYTHON COMPATIBILITY: Estrutura similar ao objeto Python
      cnpj_favorecido: cnpjFavorecido,
      endereco_completo: enderecoCompleto,
      numero_endereco: numeroEndereco,

      // Posições 128-198: Informações complementares ou dados adicionais
      informacoesComplementares: linha.substring(127, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo: endereço tradicional
      tipo: 'endereco_tradicional',

      // Metadados
      _metadata: {
        tipo: '3',
        descricao: 'Segmento B - Dados complementares (Python Enhanced)',
        categoria: 'endereco',
        segmento: 'B',
        subtipo: 'TRADICIONAL',
        parser: 'SegmentoBParser.parseTradicional',
        pythonCompatible: true,
        linhaOriginal: linha
      },

      tipoSegmentoB: 'endereco_tradicional',

      // Não é PIX
      chavePix: null,
      tipoChave: null
    };
  }

  /**
   * Parser genérico para subtipos não identificados
   * @param {string} linha - Linha de 240 caracteres
   * @param {Object} dadosComuns - Dados básicos já extraídos
   * @returns {Object} Dados genéricos do segmento B
   */
  static parseGenerico(linha, dadosComuns) {
    return {
      ...dadosComuns,
      // Posições 015-099: Dados complementares genéricos
      dadosComplementares: linha.substring(14, 99).trim(),

      // Posições 100-198: Informações específicas
      informacoesEspecificas: linha.substring(99, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo de chave não identificado
      tipoChave: 'desconhecido'
    };
  }

  /**
   * Cria uma instância do modelo SegmentoB240 a partir de uma linha
   * @param {string} linha - Linha de 240 caracteres
   * @returns {SegmentoB240} Instância do modelo
   */
  static parseToModel(linha) {
    const dados = this.parse(linha);
    return new SegmentoB240(dados);
  }

  /**
   * Valida se uma linha é um segmento B válido
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validate(linha) {
    const erros = [];

    try {
      const dados = this.parse(linha);

      // Validações básicas
      if (!dados.codigoBanco || dados.codigoBanco.length !== 3) {
        erros.push('Código do banco deve ter 3 dígitos');
      }

      // Validações específicas por subtipo
      switch (dados.subtipo) {
        case 'B01':
          this.validateB01(dados, erros);
          break;
        case 'B02':
          this.validateB02(dados, erros);
          break;
        case 'B03':
          this.validateB03(dados, erros);
          break;
        case 'B04':
          this.validateB04(dados, erros);
          break;
        case 'TRADICIONAL':
          this.validateTradicional(dados, erros);
          break;
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
   * Validações específicas para B01 - Telefone
   * @param {Object} dados - Dados parseados
   * @param {Array} erros - Array de erros
   */
  static validateB01(dados, erros) {
    if (!dados.telefone || !dados.telefone.completo) {
      erros.push('Telefone é obrigatório para subtipo B01');
      return;
    }

    const telefone = dados.telefone.completo.replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 13) {
      erros.push('Formato de telefone inválido');
    }
  }

  /**
   * Validações específicas para B02 - Email
   * @param {Object} dados - Dados parseados
   * @param {Array} erros - Array de erros
   */
  static validateB02(dados, erros) {
    if (!dados.email) {
      erros.push('Email é obrigatório para subtipo B02');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dados.email)) {
      erros.push('Formato de email inválido');
    }
  }

  /**
   * Validações específicas para B03 - CNPJ/CPF
   * @param {Object} dados - Dados parseados
   * @param {Array} erros - Array de erros
   */
  static validateB03(dados, erros) {
    if (!dados.numeroInscricao) {
      erros.push('Número de inscrição é obrigatório para subtipo B03');
      return;
    }

    const numero = dados.numeroInscricao.replace(/\D/g, '');

    if (dados.tipoInscricao === '1') {
      // CPF deve ter 11 dígitos
      if (numero.length !== 11) {
        erros.push('CPF deve ter 11 dígitos');
      }
    } else if (dados.tipoInscricao === '2') {
      // CNPJ deve ter 14 dígitos
      if (numero.length !== 14) {
        erros.push('CNPJ deve ter 14 dígitos');
      }
    } else {
      erros.push('Tipo de inscrição deve ser 1 (CPF) ou 2 (CNPJ)');
    }
  }

  /**
   * Validações específicas para B04 - UUID
   * @param {Object} dados - Dados parseados
   * @param {Array} erros - Array de erros
   */
  static validateB04(dados, erros) {
    if (!dados.uuidChave) {
      erros.push('UUID é obrigatório para subtipo B04');
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dados.uuidChave)) {
      erros.push('Formato de UUID inválido');
    }
  }

  /**
   * Validações específicas para Segmento B Tradicional
   * @param {Object} dados - Dados parseados
   * @param {Array} erros - Array de erros
   */
  static validateTradicional(dados, erros) {
    if (!dados.endereco || !dados.endereco.logradouro) {
      erros.push('Endereço é obrigatório para subtipo TRADICIONAL');
      return;
    }

    if (dados.endereco.logradouro.length < 33 || dados.endereco.logradouro.length > 62) {
      erros.push('Logradouro deve ter entre 33 e 62 caracteres');
    }

    if (dados.endereco.numero.length < 1 || dados.endereco.numero.length > 5) {
      erros.push('Número deve ter entre 1 e 5 dígitos');
    }

    if (dados.endereco.complemento.length > 15) {
      erros.push('Complemento deve ter no máximo 15 caracteres');
    }

    if (dados.endereco.bairro.length < 1 || dados.endereco.bairro.length > 15) {
      erros.push('Bairro deve ter entre 1 e 15 caracteres');
    }

    if (dados.endereco.cidade.length < 1 || dados.endereco.cidade.length > 20) {
      erros.push('Cidade deve ter entre 1 e 20 caracteres');
    }

    if (dados.endereco.cep.length !== 5) {
      erros.push('CEP deve ter 5 dígitos');
    }

    if (dados.endereco.complementoCep.length > 3) {
      erros.push('Complemento do CEP deve ter no máximo 3 caracteres');
    }

    if (dados.endereco.estado.length !== 2) {
      erros.push('Estado deve ter 2 dígitos');
    }
  }

  /**
   * Extrai informações resumidas do segmento B
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Informações resumidas
   */
  static extractSummary(linha) {
    const dados = this.parse(linha);

    const resumo = {
      banco: dados.codigoBanco,
      lote: dados.lote,
      segmento: dados.segmento,
      subtipo: dados.subtipo,
      tipoChave: dados.tipoChave
    };

    // Adicionar chave específica baseada no subtipo
    switch (dados.subtipo) {
      case 'B01':
        resumo.chave = dados.telefone ? dados.telefone.completo : '';
        break;
      case 'B02':
        resumo.chave = dados.email || '';
        break;
      case 'B03':
        resumo.chave = dados.numeroInscricao || '';
        break;
      case 'B04':
        resumo.chave = dados.uuidChave || '';
        break;
      case 'TRADICIONAL':
        resumo.chave = dados.endereco ? `${dados.endereco.logradouro}, ${dados.endereco.numero} - ${dados.endereco.cidade}, ${dados.endereco.estado} - ${dados.endereco.cep}` : '';
        break;
      default:
        resumo.chave = dados.chavePix || '';
    }

    return resumo;
  }
}

export default SegmentoBParser; 