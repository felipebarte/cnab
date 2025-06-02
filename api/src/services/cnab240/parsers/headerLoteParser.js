/**
 * Parser específico para Header de Lote CNAB 240 (Tipo de Registro 1)
 * 
 * Especificação FEBRABAN - posições exatas dos campos
 */

import { HeaderLote240 } from '../../../models/cnab240/index.js';

/**
 * Parser para Header de Lote CNAB 240
 */
export class HeaderLoteParser {
  /**
   * Processa uma linha de header de lote CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do header de lote parseados
   */
  static parse(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de header de lote deve ter 240 caracteres');
    }

    // Verificar se é realmente um header de lote (tipo 1)
    const tipoRegistro = linha[7];
    if (tipoRegistro !== '1') {
      throw new Error(`Tipo de registro esperado: 1, encontrado: ${tipoRegistro}`);
    }

    // Extrair campos conforme posições FEBRABAN
    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço
      lote: linha.substring(3, 7).trim(),

      // Posição 008: Tipo de registro (1)
      tipoRegistro: linha[7],

      // Posição 009: Tipo de operação
      tipoOperacao: linha[8],

      // Posições 010-011: Tipo de serviço
      tipoServico: linha.substring(9, 11).trim(),

      // Posições 012-013: Forma de lançamento
      formaLancamento: linha.substring(11, 13).trim(),

      // Posições 014-016: Número da versão do layout do lote
      versaoLayoutLote: linha.substring(13, 16).trim(),

      // Posição 017: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN1: linha[16],

      // Posição 018: Tipo de inscrição da empresa
      tipoInscricaoEmpresa: linha[17],

      // Posições 019-032: Número de inscrição da empresa
      numeroInscricaoEmpresa: linha.substring(18, 32).trim(),

      // Posições 033-052: Código do convênio no banco
      codigoConvenio: linha.substring(32, 52).trim(),

      // Posições 053-057: Agência mantenedora da conta
      agencia: linha.substring(52, 57).trim(),

      // Posição 058: Dígito verificador da agência
      dvAgencia: linha[57].trim(),

      // Posições 059-070: Número da conta corrente
      conta: linha.substring(58, 70).trim(),

      // Posição 071: Dígito verificador da conta
      dvConta: linha[70].trim(),

      // Posição 072: Dígito verificador da agência/conta
      dvAgenciaConta: linha[71].trim(),

      // Posições 073-102: Nome da empresa
      nomeEmpresa: linha.substring(72, 102).trim(),

      // Posições 103-142: Finalidade do lote (mensagem livre)
      finalidadeLote: linha.substring(102, 142).trim(),

      // Posições 143-148: Histórico C/C (corrigir para uma posição anterior se existir)
      historicoConta: linha.substring(102, 108).trim(), // Corrigir posição

      // Posições 143-230: Endereço da empresa (correção baseada em análise real)
      enderecoEmpresa: {
        // Posições 143-172: Logradouro (30 caracteres)
        logradouro: linha.substring(142, 172).trim(),

        // Posições 173-177: Número (5 caracteres)
        numero: linha.substring(172, 177).trim(),

        // Posições 178-192: Complemento (15 caracteres)
        complemento: linha.substring(177, 192).trim(),

        // Posições 193-212: Cidade (20 caracteres)
        cidade: linha.substring(192, 212).trim(),

        // Posições 213-220: CEP (8 caracteres)
        cep: linha.substring(212, 220).trim(),

        // Posições 221-222: Estado (2 caracteres)
        estado: linha.substring(220, 222).trim()
      },

      // Posições 231-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN2: linha.substring(230, 240).trim()
    };

    return dados;
  }

  /**
   * Cria uma instância do modelo HeaderLote240 a partir de uma linha
   * @param {string} linha - Linha de 240 caracteres
   * @returns {HeaderLote240} Instância do modelo
   */
  static parseToModel(linha) {
    const dados = this.parse(linha);
    return new HeaderLote240(dados);
  }

  /**
   * Valida se uma linha é um header de lote válido
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validate(linha) {
    const erros = [];

    try {
      const dados = this.parse(linha);

      // Validações específicas
      if (!dados.codigoBanco || dados.codigoBanco.length !== 3) {
        erros.push('Código do banco deve ter 3 dígitos');
      }

      if (!dados.lote || dados.lote === '0000') {
        erros.push('Número do lote deve ser diferente de 0000');
      }

      // Validar tipo de operação
      if (!['C', 'D', 'E', 'G', 'I', 'O', 'P', 'R'].includes(dados.tipoOperacao)) {
        erros.push('Tipo de operação inválido');
      }

      // Validar tipo de serviço (códigos comuns)
      const tiposServico = ['01', '03', '05', '20', '25', '30', '40', '50', '60', '70', '75', '80', '90', '98'];
      if (!tiposServico.includes(dados.tipoServico)) {
        erros.push('Tipo de serviço não reconhecido');
      }

      // Validar forma de lançamento (códigos comuns)
      const formasLancamento = ['01', '02', '03', '05', '41', '43', '45'];
      if (!formasLancamento.includes(dados.formaLancamento)) {
        erros.push('Forma de lançamento não reconhecida');
      }

      if (!dados.nomeEmpresa.trim()) {
        erros.push('Nome da empresa é obrigatório');
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
   * Extrai informações resumidas do header de lote
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Informações resumidas
   */
  static extractSummary(linha) {
    const dados = this.parse(linha);

    // Mapear tipos de operação
    const tiposOperacao = {
      'C': 'Lançamento a Crédito',
      'D': 'Lançamento a Débito',
      'E': 'Extrato de Conciliação',
      'G': 'Lançamento Genérico',
      'I': 'Informações de Títulos Capturados',
      'O': 'Ordem de Pagamento',
      'P': 'Pagamento de Dividendos',
      'R': 'Remuneração'
    };

    // Mapear tipos de serviço
    const tiposServico = {
      '01': 'Cobrança',
      '03': 'Boleto de Pagamento Eletrônico',
      '05': 'Débitos Diversos',
      '20': 'Pagamento Fornecedor',
      '25': 'Pagamento de Contas e Tributos',
      '30': 'Pagamento de Salários',
      '40': 'Vendor Finance',
      '50': 'Pagamento de Sinistros',
      '60': 'Pagamento de Despesas Viagem',
      '70': 'Pagamento de Honorários',
      '75': 'Pagamento de Boletos',
      '80': 'Pagamentos PIX',
      '90': 'Transferências Diversas',
      '98': 'Pagamentos Diversos'
    };

    return {
      banco: {
        codigo: dados.codigoBanco
      },
      lote: {
        numero: dados.lote,
        tipoOperacao: tiposOperacao[dados.tipoOperacao] || dados.tipoOperacao,
        tipoServico: tiposServico[dados.tipoServico] || dados.tipoServico,
        formaLancamento: dados.formaLancamento,
        versaoLayout: dados.versaoLayoutLote
      },
      empresa: {
        nome: dados.nomeEmpresa,
        inscricao: dados.numeroInscricaoEmpresa,
        tipoInscricao: dados.tipoInscricaoEmpresa === '1' ? 'CPF' : 'CNPJ',
        agencia: dados.agencia,
        conta: dados.conta,
        endereco: dados.enderecoEmpresa
      },
      finalidade: dados.finalidadeLote
    };
  }

  /**
   * Identifica o tipo específico de lote baseado no tipo de serviço
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Informações sobre o tipo de lote
   */
  static identifyLoteType(linha) {
    const dados = this.parse(linha);

    const loteTypes = {
      '01': { nome: 'Cobrança', categoria: 'recebimentos' },
      '03': { nome: 'Boleto Eletrônico', categoria: 'recebimentos' },
      '20': { nome: 'Pagamento Fornecedor', categoria: 'pagamentos' },
      '25': { nome: 'Pagamento Tributos', categoria: 'pagamentos' },
      '30': { nome: 'Pagamento Salários', categoria: 'pagamentos' },
      '40': { nome: 'Vendor Finance', categoria: 'financiamentos' },
      '50': { nome: 'Pagamento Sinistros', categoria: 'seguros' },
      '75': { nome: 'Pagamento Boletos', categoria: 'pagamentos' },
      '80': { nome: 'Pagamentos PIX', categoria: 'transferencias' },
      '90': { nome: 'Transferências Diversas', categoria: 'transferencias' }
    };

    const tipoInfo = loteTypes[dados.tipoServico] || {
      nome: 'Serviço Não Identificado',
      categoria: 'outros'
    };

    return {
      codigoServico: dados.tipoServico,
      nomeServico: tipoInfo.nome,
      categoria: tipoInfo.categoria,
      tipoOperacao: dados.tipoOperacao,
      formaLancamento: dados.formaLancamento
    };
  }
}

export default HeaderLoteParser; 