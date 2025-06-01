/**
 * Modelo para Header de Arquivo CNAB 240
 * 
 * Representa o registro tipo 0 - Header de Arquivo
 * Contém informações gerais sobre o arquivo e a empresa remetente
 */

/**
 * @typedef {Object} HeaderArquivo240
 * @property {string} codigoBanco - Código do banco (posições 1-3)
 * @property {string} lote - Lote de serviço - sempre '0000' para header de arquivo (posições 4-7)
 * @property {string} tipoRegistro - Tipo de registro - sempre '0' (posição 8)
 * @property {string} usoFebraban1 - Uso exclusivo FEBRABAN (posições 9-17)
 * @property {string} tipoInscricao - Tipo de inscrição da empresa (posição 18)
 * @property {string} numeroInscricao - Número de inscrição da empresa (posições 19-32)
 * @property {string} convenio - Código do convênio no banco (posições 33-52)
 * @property {string} agencia - Agência mantenedora da conta (posições 53-57)
 * @property {string} digitoAgencia - Dígito verificador da agência (posição 58)
 * @property {string} numeroConta - Número da conta corrente (posições 59-70)
 * @property {string} digitoConta - Dígito verificador da conta (posição 71)
 * @property {string} digitoAgenciaConta - Dígito verificador da ag/conta (posição 72)
 * @property {string} nomeEmpresa - Nome da empresa (posições 73-102)
 * @property {string} nomeBanco - Nome do banco (posições 103-132)
 * @property {string} usoFebraban2 - Uso exclusivo FEBRABAN (posições 133-142)
 * @property {string} codigoArquivo - Código remessa/retorno (posição 143)
 * @property {string} dataGeracao - Data de geração do arquivo DDMMAAAA (posições 144-151)
 * @property {string} horaGeracao - Hora de geração HHMMSS (posições 152-157)
 * @property {string} numeroSequencialArquivo - Número sequencial do arquivo (posições 158-163)
 * @property {string} versaoLayoutArquivo - Versão do layout (posições 164-166)
 * @property {string} densidadeGravacao - Densidade de gravação (posições 167-171)
 * @property {string} reservadoBanco - Para uso do banco (posições 172-191)
 * @property {string} reservadoEmpresa - Para uso da empresa (posições 192-211)
 * @property {string} usoFebraban3 - Uso exclusivo FEBRABAN (posições 212-240)
 */

class HeaderArquivo240 {
  /**
   * Cria uma instância do HeaderArquivo240
   * @param {Object} dados - Dados para construir o header
   */
  constructor(dados = {}) {
    this.codigoBanco = dados.codigoBanco || '';
    this.lote = '0000'; // Sempre 0000 para header de arquivo
    this.tipoRegistro = '0'; // Sempre 0 para header de arquivo
    this.usoFebraban1 = dados.usoFebraban1 || ' '.repeat(9);
    this.tipoInscricao = dados.tipoInscricao || '2'; // 1=CPF, 2=CNPJ
    this.numeroInscricao = dados.numeroInscricao || '';
    this.convenio = dados.convenio || '';
    this.agencia = dados.agencia || '';
    this.digitoAgencia = dados.digitoAgencia || '';
    this.numeroConta = dados.numeroConta || '';
    this.digitoConta = dados.digitoConta || '';
    this.digitoAgenciaConta = dados.digitoAgenciaConta || '';
    this.nomeEmpresa = dados.nomeEmpresa || '';
    this.nomeBanco = dados.nomeBanco || '';
    this.usoFebraban2 = dados.usoFebraban2 || ' '.repeat(10);
    this.codigoArquivo = dados.codigoArquivo || '1'; // 1=Remessa, 2=Retorno
    this.dataGeracao = dados.dataGeracao || '';
    this.horaGeracao = dados.horaGeracao || '';
    this.numeroSequencialArquivo = dados.numeroSequencialArquivo || '';
    this.versaoLayoutArquivo = dados.versaoLayoutArquivo || '087';
    this.densidadeGravacao = dados.densidadeGravacao || '00000';
    this.reservadoBanco = dados.reservadoBanco || ' '.repeat(20);
    this.reservadoEmpresa = dados.reservadoEmpresa || ' '.repeat(20);
    this.usoFebraban3 = dados.usoFebraban3 || ' '.repeat(29);
  }

  /**
   * Cria um HeaderArquivo240 a partir de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {HeaderArquivo240} Instância do header
   */
  static fromLinha(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter exatamente 240 caracteres');
    }

    const dados = {
      codigoBanco: linha.substring(0, 3),
      usoFebraban1: linha.substring(8, 17),
      tipoInscricao: linha.substring(17, 18),
      numeroInscricao: linha.substring(18, 32).trim(),
      convenio: linha.substring(32, 52).trim(),
      agencia: linha.substring(52, 57).trim(),
      digitoAgencia: linha.substring(57, 58),
      numeroConta: linha.substring(58, 70).trim(),
      digitoConta: linha.substring(70, 71),
      digitoAgenciaConta: linha.substring(71, 72),
      nomeEmpresa: linha.substring(72, 102).trim(),
      nomeBanco: linha.substring(102, 132).trim(),
      usoFebraban2: linha.substring(132, 142),
      codigoArquivo: linha.substring(142, 143),
      dataGeracao: linha.substring(143, 151),
      horaGeracao: linha.substring(151, 157),
      numeroSequencialArquivo: linha.substring(157, 163).trim(),
      versaoLayoutArquivo: linha.substring(163, 166),
      densidadeGravacao: linha.substring(166, 171),
      reservadoBanco: linha.substring(171, 191),
      reservadoEmpresa: linha.substring(191, 211),
      usoFebraban3: linha.substring(211, 240)
    };

    return new HeaderArquivo240(dados);
  }

  /**
   * Converte para objeto simples
   * @returns {Object} Dados do header como objeto
   */
  toObject() {
    return {
      codigoBanco: this.codigoBanco,
      lote: this.lote,
      tipoRegistro: this.tipoRegistro,
      tipoInscricao: this.tipoInscricao,
      numeroInscricao: this.numeroInscricao,
      convenio: this.convenio,
      agencia: this.agencia,
      digitoAgencia: this.digitoAgencia,
      numeroConta: this.numeroConta,
      digitoConta: this.digitoConta,
      digitoAgenciaConta: this.digitoAgenciaConta,
      nomeEmpresa: this.nomeEmpresa,
      nomeBanco: this.nomeBanco,
      codigoArquivo: this.codigoArquivo,
      dataGeracao: this.dataGeracao,
      horaGeracao: this.horaGeracao,
      numeroSequencialArquivo: this.numeroSequencialArquivo,
      versaoLayoutArquivo: this.versaoLayoutArquivo,
      densidadeGravacao: this.densidadeGravacao
    };
  }

  /**
   * Valida os dados do header
   * @returns {Array<string>} Array de erros encontrados
   */
  validar() {
    const erros = [];

    if (!this.codigoBanco || this.codigoBanco.length !== 3) {
      erros.push('Código do banco deve ter 3 dígitos');
    }

    if (this.tipoRegistro !== '0') {
      erros.push('Tipo de registro deve ser "0" para header de arquivo');
    }

    if (this.lote !== '0000') {
      erros.push('Lote deve ser "0000" para header de arquivo');
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

    if (!this.nomeBanco.trim()) {
      erros.push('Nome do banco é obrigatório');
    }

    if (!['1', '2'].includes(this.codigoArquivo)) {
      erros.push('Código do arquivo deve ser "1" (Remessa) ou "2" (Retorno)');
    }

    if (!/^\d{8}$/.test(this.dataGeracao)) {
      erros.push('Data de geração deve estar no formato DDMMAAAA');
    }

    if (!/^\d{6}$/.test(this.horaGeracao)) {
      erros.push('Hora de geração deve estar no formato HHMMSS');
    }

    return erros;
  }
}

export default HeaderArquivo240; 