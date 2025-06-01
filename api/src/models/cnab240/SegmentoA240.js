/**
 * Modelo para Segmento A CNAB 240
 * 
 * Representa registros de detalhe tipo 3 com segmento A
 * Contém dados principais do pagamento ou crédito
 */

/**
 * @typedef {Object} SegmentoA240
 * @property {string} codigoBanco - Código do banco (posições 1-3)
 * @property {string} lote - Lote de serviço (posições 4-7)
 * @property {string} tipoRegistro - Tipo de registro - sempre '3' (posição 8)
 * @property {string} numeroSequencial - Número sequencial do registro (posições 9-13)
 * @property {string} segmento - Segmento - sempre 'A' (posição 14)
 * @property {string} tipoMovimento - Tipo de movimento (posição 15)
 * @property {string} codigoInstrucao - Código de instrução (posições 16-17)
 * @property {string} camaraCentralizadora - Câmara centralizadora (posições 18-20)
 * @property {string} bancoFavorecido - Banco do favorecido (posições 21-23)
 * @property {string} agenciaFavorecido - Agência do favorecido (posições 24-28)
 * @property {string} digitoAgenciaFavorecido - Dígito da agência favorecido (posição 29)
 * @property {string} contaFavorecido - Conta do favorecido (posições 30-41)
 * @property {string} digitoContaFavorecido - Dígito da conta favorecido (posição 42)
 * @property {string} digitoVerificadorAgConta - DV ag/conta favorecido (posição 43)
 * @property {string} nomeFavorecido - Nome do favorecido (posições 44-73)
 * @property {string} numeroDocumentoAtribuido - Nº documento empresa (posições 74-93)
 * @property {string} dataVencimento - Data de vencimento/pagamento DDMMAAAA (posições 94-101)
 * @property {string} tipoMoeda - Tipo da moeda (posições 102-104)
 * @property {string} quantidadeMoeda - Quantidade da moeda (posições 105-119)
 * @property {string} valorPagamento - Valor do pagamento (posições 120-134)
 * @property {string} numeroDocumentoBanco - Nº documento banco (posições 135-154)
 * @property {string} dataEfetivacao - Data efetiva do pagamento DDMMAAAA (posições 155-162)
 * @property {string} valorEfetivacao - Valor efetivo do pagamento (posições 163-177)
 * @property {string} usoFebraban1 - Uso exclusivo FEBRABAN (posições 178-195)
 * @property {string} numeroDocumento - Número do documento (posições 196-201)
 * @property {string} usoFebraban2 - Uso exclusivo FEBRABAN (posições 202-216)
 * @property {string} codigoFinalidadeDOC - Finalidade do DOC (posições 217-218)
 * @property {string} usoFebraban3 - Uso exclusivo FEBRABAN (posições 219-220)
 * @property {string} tipoServico - Tipo de serviço (posições 221-222)
 * @property {string} usoFebraban4 - Uso exclusivo FEBRABAN (posições 223-225)
 * @property {string} formaLancamento - Forma de lançamento (posições 226-227)
 * @property {string} usoFebraban5 - Uso exclusivo FEBRABAN (posições 228-229)
 * @property {string} codigoOcorrencia - Código de ocorrência (posições 230-239)
 */

class SegmentoA240 {
  /**
   * Cria uma instância do SegmentoA240
   * @param {Object} dados - Dados para construir o segmento A
   */
  constructor(dados = {}) {
    this.codigoBanco = dados.codigoBanco || '';
    this.lote = dados.lote || '';
    this.tipoRegistro = '3'; // Sempre 3 para detalhes
    this.numeroSequencial = dados.numeroSequencial || '';
    this.segmento = 'A'; // Sempre A
    this.tipoMovimento = dados.tipoMovimento || '0'; // 0=Inclusão
    this.codigoInstrucao = dados.codigoInstrucao || '00';
    this.camaraCentralizadora = dados.camaraCentralizadora || '000';
    this.bancoFavorecido = dados.bancoFavorecido || '';
    this.agenciaFavorecido = dados.agenciaFavorecido || '';
    this.digitoAgenciaFavorecido = dados.digitoAgenciaFavorecido || '';
    this.contaFavorecido = dados.contaFavorecido || '';
    this.digitoContaFavorecido = dados.digitoContaFavorecido || '';
    this.digitoVerificadorAgConta = dados.digitoVerificadorAgConta || '';
    this.nomeFavorecido = dados.nomeFavorecido || '';
    this.numeroDocumentoAtribuido = dados.numeroDocumentoAtribuido || '';
    this.dataVencimento = dados.dataVencimento || '';
    this.tipoMoeda = dados.tipoMoeda || 'BRL';
    this.quantidadeMoeda = dados.quantidadeMoeda || '000000000000000';
    this.valorPagamento = dados.valorPagamento || '';
    this.numeroDocumentoBanco = dados.numeroDocumentoBanco || '';
    this.dataEfetivacao = dados.dataEfetivacao || '';
    this.valorEfetivacao = dados.valorEfetivacao || '';
    this.usoFebraban1 = dados.usoFebraban1 || ' '.repeat(18);
    this.numeroDocumento = dados.numeroDocumento || '';
    this.usoFebraban2 = dados.usoFebraban2 || ' '.repeat(15);
    this.codigoFinalidadeDOC = dados.codigoFinalidadeDOC || '';
    this.usoFebraban3 = dados.usoFebraban3 || ' '.repeat(2);
    this.tipoServico = dados.tipoServico || '';
    this.usoFebraban4 = dados.usoFebraban4 || ' '.repeat(3);
    this.formaLancamento = dados.formaLancamento || '';
    this.usoFebraban5 = dados.usoFebraban5 || ' '.repeat(2);
    this.codigoOcorrencia = dados.codigoOcorrencia || ' '.repeat(10);
  }

  /**
   * Cria um SegmentoA240 a partir de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {SegmentoA240} Instância do segmento A
   */
  static fromLinha(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter exatamente 240 caracteres');
    }

    const dados = {
      codigoBanco: linha.substring(0, 3),
      lote: linha.substring(3, 7).trim(),
      numeroSequencial: linha.substring(8, 13).trim(),
      tipoMovimento: linha.substring(14, 15),
      codigoInstrucao: linha.substring(15, 17),
      camaraCentralizadora: linha.substring(17, 20),
      bancoFavorecido: linha.substring(20, 23),
      agenciaFavorecido: linha.substring(23, 28).trim(),
      digitoAgenciaFavorecido: linha.substring(28, 29),
      contaFavorecido: linha.substring(29, 41).trim(),
      digitoContaFavorecido: linha.substring(41, 42),
      digitoVerificadorAgConta: linha.substring(42, 43),
      nomeFavorecido: linha.substring(43, 73).trim(),
      numeroDocumentoAtribuido: linha.substring(73, 93).trim(),
      dataVencimento: linha.substring(93, 101),
      tipoMoeda: linha.substring(101, 104),
      quantidadeMoeda: linha.substring(104, 119),
      valorPagamento: linha.substring(119, 134).trim(),
      numeroDocumentoBanco: linha.substring(134, 154).trim(),
      dataEfetivacao: linha.substring(154, 162),
      valorEfetivacao: linha.substring(162, 177).trim(),
      usoFebraban1: linha.substring(177, 195),
      numeroDocumento: linha.substring(195, 201).trim(),
      usoFebraban2: linha.substring(201, 216),
      codigoFinalidadeDOC: linha.substring(216, 218),
      usoFebraban3: linha.substring(218, 220),
      tipoServico: linha.substring(220, 222),
      usoFebraban4: linha.substring(222, 225),
      formaLancamento: linha.substring(225, 227),
      usoFebraban5: linha.substring(227, 229),
      codigoOcorrencia: linha.substring(229, 239)
    };

    return new SegmentoA240(dados);
  }

  /**
   * Converte valor numérico para string formatada para CNAB
   * @param {number} valor - Valor numérico
   * @param {number} tamanho - Tamanho total da string
   * @returns {string} Valor formatado com zeros à esquerda
   */
  static formatarValor(valor, tamanho = 15) {
    const valorCentavos = Math.round(valor * 100);
    return valorCentavos.toString().padStart(tamanho, '0');
  }

  /**
   * Converte string formatada CNAB para valor numérico
   * @param {string} valorString - String formatada do CNAB
   * @returns {number} Valor numérico em reais
   */
  static parseValor(valorString) {
    const valor = parseInt(valorString) || 0;
    return valor / 100;
  }

  /**
   * Obtém o valor do pagamento como número
   * @returns {number} Valor em reais
   */
  getValorPagamentoNumerico() {
    return SegmentoA240.parseValor(this.valorPagamento);
  }

  /**
   * Obtém o valor de efetivação como número
   * @returns {number} Valor em reais
   */
  getValorEfetivacaoNumerico() {
    return SegmentoA240.parseValor(this.valorEfetivacao);
  }

  /**
   * Converte para objeto simples
   * @returns {Object} Dados do segmento A como objeto
   */
  toObject() {
    return {
      codigoBanco: this.codigoBanco,
      lote: this.lote,
      tipoRegistro: this.tipoRegistro,
      numeroSequencial: this.numeroSequencial,
      segmento: this.segmento,
      tipoMovimento: this.tipoMovimento,
      codigoInstrucao: this.codigoInstrucao,
      bancoFavorecido: this.bancoFavorecido,
      agenciaFavorecido: this.agenciaFavorecido,
      digitoAgenciaFavorecido: this.digitoAgenciaFavorecido,
      contaFavorecido: this.contaFavorecido,
      digitoContaFavorecido: this.digitoContaFavorecido,
      nomeFavorecido: this.nomeFavorecido,
      numeroDocumentoAtribuido: this.numeroDocumentoAtribuido,
      dataVencimento: this.dataVencimento,
      tipoMoeda: this.tipoMoeda,
      valorPagamento: this.getValorPagamentoNumerico(),
      numeroDocumentoBanco: this.numeroDocumentoBanco,
      dataEfetivacao: this.dataEfetivacao,
      valorEfetivacao: this.getValorEfetivacaoNumerico(),
      numeroDocumento: this.numeroDocumento,
      codigoFinalidadeDOC: this.codigoFinalidadeDOC,
      tipoServico: this.tipoServico,
      formaLancamento: this.formaLancamento
    };
  }

  /**
   * Valida os dados do segmento A
   * @returns {Array<string>} Array de erros encontrados
   */
  validar() {
    const erros = [];

    if (!this.codigoBanco || this.codigoBanco.length !== 3) {
      erros.push('Código do banco deve ter 3 dígitos');
    }

    if (this.tipoRegistro !== '3') {
      erros.push('Tipo de registro deve ser "3" para detalhe');
    }

    if (this.segmento !== 'A') {
      erros.push('Segmento deve ser "A"');
    }

    if (!this.nomeFavorecido.trim()) {
      erros.push('Nome do favorecido é obrigatório');
    }

    if (!this.valorPagamento || this.valorPagamento === '000000000000000') {
      erros.push('Valor do pagamento deve ser maior que zero');
    }

    if (this.dataVencimento && !/^\d{8}$/.test(this.dataVencimento)) {
      erros.push('Data de vencimento deve estar no formato DDMMAAAA');
    }

    return erros;
  }
}

export default SegmentoA240; 