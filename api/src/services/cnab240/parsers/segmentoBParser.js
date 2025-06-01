/**
 * Parser específico para Segmento B CNAB 240 (Tipo de Registro 3, Segmento B)
 * 
 * Especificação FEBRABAN - posições exatas dos campos
 * Subtipos B01 (Telefone), B02 (Email), B03 (CNPJ/CPF), B04 (UUID)
 */

import { SegmentoB240 } from '../../../models/cnab240/index.js';

/**
 * Parser para Segmento B CNAB 240 - Dados complementares PIX
 */
export class SegmentoBParser {
  /**
   * Identifica o subtipo do Segmento B baseado no conteúdo
   * @param {string} linha - Linha de 240 caracteres
   * @returns {string} Subtipo identificado (B01, B02, B03, B04)
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
    if (['B01', 'B02', 'B03', 'B04'].includes(subtipoExplicito)) {
      return subtipoExplicito;
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
   * @param {string} content - Conteúdo da chave
   * @returns {string} Subtipo inferido
   */
  static inferSubtypeFromContent(content) {
    if (!content) return 'B03'; // Default para CNPJ/CPF

    // UUID pattern (formato: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)
    if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(content)) {
      return 'B04';
    }

    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content)) {
      return 'B02';
    }

    // Telefone pattern (formato: +5511999999999 ou 11999999999)
    if (/^(\+55)?[1-9][0-9]{10}$/.test(content.replace(/\D/g, ''))) {
      return 'B01';
    }

    // CNPJ (14 dígitos) ou CPF (11 dígitos)
    const numeros = content.replace(/\D/g, '');
    if (numeros.length === 11 || numeros.length === 14) {
      return 'B03';
    }

    // Default
    return 'B03';
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
      subtipo: subtipo
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
   * Parser específico para B04 - UUID (Chave Aleatória)
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
      uuid: linha.substring(17, 99).trim(),

      // Posições 100-198: Chave PIX extraída (pode ser o mesmo UUID)
      chavePix: linha.substring(99, 198).trim(),

      // Posições 199-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN: linha.substring(198, 240).trim(),

      // Tipo de chave identificado
      tipoChave: 'uuid'
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
    if (!dados.uuid) {
      erros.push('UUID é obrigatório para subtipo B04');
      return;
    }

    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
    if (!uuidRegex.test(dados.uuid)) {
      erros.push('Formato de UUID inválido');
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
        resumo.chave = dados.uuid || '';
        break;
      default:
        resumo.chave = dados.chavePix || '';
    }

    return resumo;
  }
}

export default SegmentoBParser; 