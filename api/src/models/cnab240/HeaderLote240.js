/**
 * Modelo para Header de Lote CNAB 240
 * 
 * Representa o registro tipo 1 - Header de Lote
 * Contém informações específicas sobre o lote de operações
 */

/**
 * @typedef {Object} HeaderLote240
 * @property {string} codigoBanco - Código do banco (posições 1-3)
 * @property {string} lote - Lote de serviço (posições 4-7)
 * @property {string} tipoRegistro - Tipo de registro - sempre '1' (posição 8)
 * @property {string} tipoOperacao - Tipo de operação (posição 9)
 * @property {string} tipoServico - Tipo de serviço (posições 10-11)
 * @property {string} formaLancamento - Forma de lançamento (posições 12-13)
 * @property {string} versaoLayoutLote - Versão do layout do lote (posições 14-16)
 * @property {string} usoFebraban1 - Uso exclusivo FEBRABAN (posição 17)
 * @property {string} tipoInscricao - Tipo de inscrição da empresa (posição 18)
 * @property {string} numeroInscricao - Número de inscrição da empresa (posições 19-33)
 * @property {string} convenio - Código do convênio no banco (posições 34-53)
 * @property {string} agencia - Agência mantenedora da conta (posições 54-58)
 * @property {string} digitoAgencia - Dígito verificador da agência (posição 59)
 * @property {string} numeroConta - Número da conta corrente (posições 60-71)
 * @property {string} digitoConta - Dígito verificador da conta (posição 72)
 * @property {string} digitoAgenciaConta - Dígito verificador da ag/conta (posição 73)
 * @property {string} nomeEmpresa - Nome da empresa (posições 74-103)
 * @property {string} finalidadeLote - Finalidade do lote (posições 104-143)
 * @property {string} historicoCC - Histórico de C/C (posições 144-183)
 * @property {string} enderecoEmpresa1 - Endereço da empresa linha 1 (posições 184-223)
 * @property {string} numeroLogradouro - Número + complemento (posições 224-228)
 * @property {string} complemento - Complemento do endereço (posições 229-243)
 * @property {string} cidade - Cidade da empresa (posições 244-263)
 * @property {string} cep - CEP da empresa (posições 264-268)
 * @property {string} complementoCep - Complemento do CEP (posições 269-271)
 * @property {string} estado - Estado da empresa (posições 272-273)
 * @property {string} usoFebraban2 - Uso exclusivo FEBRABAN (posições 274-283)
 * @property {string} ocorrencias - Códigos das ocorrências (posições 284-293)
 */

class HeaderLote240 {
  /**
   * Cria uma instância do HeaderLote240
   * @param {Object} dados - Dados para construir o header de lote
   */
  constructor(dados = {}) {
    this.codigoBanco = dados.codigoBanco || '';
    this.lote = dados.lote || '';
    this.tipoRegistro = '1'; // Sempre 1 para header de lote
    this.tipoOperacao = dados.tipoOperacao || 'C'; // C=Crédito, D=Débito
    this.tipoServico = dados.tipoServico || '20'; // Código do serviço
    this.formaLancamento = dados.formaLancamento || '01';
    this.versaoLayoutLote = dados.versaoLayoutLote || '040';
    this.usoFebraban1 = dados.usoFebraban1 || ' ';
    this.tipoInscricao = dados.tipoInscricao || '2'; // 1=CPF, 2=CNPJ
    this.numeroInscricao = dados.numeroInscricao || '';
    this.convenio = dados.convenio || '';
    this.agencia = dados.agencia || '';
    this.digitoAgencia = dados.digitoAgencia || '';
    this.numeroConta = dados.numeroConta || '';
    this.digitoConta = dados.digitoConta || '';
    this.digitoAgenciaConta = dados.digitoAgenciaConta || '';
    this.nomeEmpresa = dados.nomeEmpresa || '';
    this.finalidadeLote = dados.finalidadeLote || '';
    this.historicoCC = dados.historicoCC || '';
    this.enderecoEmpresa1 = dados.enderecoEmpresa1 || '';
    this.numeroLogradouro = dados.numeroLogradouro || '';
    this.complemento = dados.complemento || '';
    this.cidade = dados.cidade || '';
    this.cep = dados.cep || '';
    this.complementoCep = dados.complementoCep || '';
    this.estado = dados.estado || '';
    this.usoFebraban2 = dados.usoFebraban2 || ' '.repeat(10);
    this.ocorrencias = dados.ocorrencias || ' '.repeat(10);
  }

  /**
   * Cria um HeaderLote240 a partir de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {HeaderLote240} Instância do header de lote
   */
  static fromLinha(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter exatamente 240 caracteres');
    }

    const dados = {
      codigoBanco: linha.substring(0, 3),
      lote: linha.substring(3, 7).trim(),
      tipoOperacao: linha.substring(8, 9),
      tipoServico: linha.substring(9, 11),
      formaLancamento: linha.substring(11, 13),
      versaoLayoutLote: linha.substring(13, 16),
      usoFebraban1: linha.substring(16, 17),
      tipoInscricao: linha.substring(17, 18),
      numeroInscricao: linha.substring(18, 33).trim(),
      convenio: linha.substring(33, 53).trim(),
      agencia: linha.substring(53, 58).trim(),
      digitoAgencia: linha.substring(58, 59),
      numeroConta: linha.substring(59, 71).trim(),
      digitoConta: linha.substring(71, 72),
      digitoAgenciaConta: linha.substring(72, 73),
      nomeEmpresa: linha.substring(73, 103).trim(),
      finalidadeLote: linha.substring(103, 143).trim(),
      historicoCC: linha.substring(143, 183).trim(),
      enderecoEmpresa1: linha.substring(183, 223).trim(),
      numeroLogradouro: linha.substring(223, 228).trim(),
      complemento: linha.substring(228, 243).trim(),
      cidade: linha.substring(243, 263).trim(),
      cep: linha.substring(263, 268).trim(),
      complementoCep: linha.substring(268, 271).trim(),
      estado: linha.substring(271, 273).trim(),
      usoFebraban2: linha.substring(273, 283),
      ocorrencias: linha.substring(283, 293)
    };

    return new HeaderLote240(dados);
  }

  /**
   * Converte para objeto simples
   * @returns {Object} Dados do header de lote como objeto
   */
  toObject() {
    return {
      codigoBanco: this.codigoBanco,
      lote: this.lote,
      tipoRegistro: this.tipoRegistro,
      tipoOperacao: this.tipoOperacao,
      tipoServico: this.tipoServico,
      formaLancamento: this.formaLancamento,
      versaoLayoutLote: this.versaoLayoutLote,
      tipoInscricao: this.tipoInscricao,
      numeroInscricao: this.numeroInscricao,
      convenio: this.convenio,
      agencia: this.agencia,
      digitoAgencia: this.digitoAgencia,
      numeroConta: this.numeroConta,
      digitoConta: this.digitoConta,
      digitoAgenciaConta: this.digitoAgenciaConta,
      nomeEmpresa: this.nomeEmpresa,
      finalidadeLote: this.finalidadeLote,
      historicoCC: this.historicoCC,
      enderecoEmpresa1: this.enderecoEmpresa1,
      numeroLogradouro: this.numeroLogradouro,
      complemento: this.complemento,
      cidade: this.cidade,
      cep: this.cep,
      complementoCep: this.complementoCep,
      estado: this.estado
    };
  }

  /**
   * Obtém o código de operação completo (tipo de serviço + forma de lançamento)
   * @returns {string} Código de operação de 6 dígitos
   */
  getCodigoOperacao() {
    return this.tipoServico + this.formaLancamento + '00'; // Completar para 6 dígitos conforme exemplos
  }

  /**
   * Valida os dados do header de lote
   * @returns {Array<string>} Array de erros encontrados
   */
  validar() {
    const erros = [];

    if (!this.codigoBanco || this.codigoBanco.length !== 3) {
      erros.push('Código do banco deve ter 3 dígitos');
    }

    if (this.tipoRegistro !== '1') {
      erros.push('Tipo de registro deve ser "1" para header de lote');
    }

    if (!this.lote || !/^\d{4}$/.test(this.lote)) {
      erros.push('Lote deve ter 4 dígitos numéricos');
    }

    if (!['C', 'D'].includes(this.tipoOperacao)) {
      erros.push('Tipo de operação deve ser "C" (Crédito) ou "D" (Débito)');
    }

    if (!['1', '2'].includes(this.tipoInscricao)) {
      erros.push('Tipo de inscrição deve ser "1" (CPF) ou "2" (CNPJ)');
    }

    if (!this.numeroInscricao.trim()) {
      erros.push('Número de inscrição é obrigatório');
    }

    if (!this.nomeEmpresa.trim()) {
      erros.push('Nome da empresa é obrigatório');
    }

    if (!/^\d{3}$/.test(this.versaoLayoutLote)) {
      erros.push('Versão do layout do lote deve ter 3 dígitos');
    }

    return erros;
  }
}

export default HeaderLote240; 