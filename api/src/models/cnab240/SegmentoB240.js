/**
 * Modelo para Segmento B CNAB 240
 * 
 * Representa registros de detalhe tipo 3 com segmento B
 * Contém dados complementares do pagamento (especialmente para PIX)
 */

/**
 * @typedef {Object} SegmentoB240
 * @property {string} codigoBanco - Código do banco (posições 1-3)
 * @property {string} lote - Lote de serviço (posições 4-7)
 * @property {string} tipoRegistro - Tipo de registro - sempre '3' (posição 8)
 * @property {string} numeroSequencial - Número sequencial do registro (posições 9-13)
 * @property {string} segmento - Segmento - sempre 'B' (posição 14)
 * @property {string} subtipo - Subtipo do segmento B (B01, B02, B03, B04) (posições 15-17)
 * @property {string} tipoInscricao - Tipo de inscrição (posição 18)
 * @property {string} numeroInscricao - Número de inscrição (posições 19-32)
 * @property {string} logradouro - Logradouro (posições 33-62)
 * @property {string} numeroLocal - Número do local (posições 63-67)
 * @property {string} complemento - Complemento (posições 68-82)
 * @property {string} bairro - Bairro (posições 83-97)
 * @property {string} cidade - Cidade (posições 98-117)
 * @property {string} cep - CEP (posições 118-122)
 * @property {string} complementoCep - Complemento do CEP (posições 123-125)
 * @property {string} estado - Estado (posições 126-127)
 * @property {string} dataVencimento - Data de vencimento DDMMAAAA (posições 128-135)
 * @property {string} valorDocumento - Valor do documento (posições 136-150)
 * @property {string} valorAbatimento - Valor do abatimento (posições 151-165)
 * @property {string} valorDesconto - Valor do desconto (posições 166-180)
 * @property {string} valorMora - Valor da mora (posições 181-195)
 * @property {string} valorMulta - Valor da multa (posições 196-210)
 * @property {string} codigoDocumento - Código do documento (posições 211-225)
 * @property {string} avisoFavorecido - Aviso ao favorecido (posições 226-227)
 * @property {string} codigoIspb - Código ISPB (posições 228-235)
 * @property {string} usoFebraban - Uso exclusivo FEBRABAN (posições 236-240)
 */

class SegmentoB240 {
  /**
   * Cria uma instância do SegmentoB240
   * @param {Object} dados - Dados para construir o segmento B
   */
  constructor(dados = {}) {
    this.codigoBanco = dados.codigoBanco || '';
    this.lote = dados.lote || '';
    this.tipoRegistro = '3'; // Sempre 3 para detalhes
    this.numeroSequencial = dados.numeroSequencial || '';
    this.segmento = 'B'; // Sempre B
    this.subtipo = dados.subtipo || 'B03'; // B01-B04
    this.tipoInscricao = dados.tipoInscricao || '';
    this.numeroInscricao = dados.numeroInscricao || '';
    this.logradouro = dados.logradouro || '';
    this.numeroLocal = dados.numeroLocal || '';
    this.complemento = dados.complemento || '';
    this.bairro = dados.bairro || '';
    this.cidade = dados.cidade || '';
    this.cep = dados.cep || '';
    this.complementoCep = dados.complementoCep || '';
    this.estado = dados.estado || '';
    this.dataVencimento = dados.dataVencimento || '';
    this.valorDocumento = dados.valorDocumento || '';
    this.valorAbatimento = dados.valorAbatimento || '';
    this.valorDesconto = dados.valorDesconto || '';
    this.valorMora = dados.valorMora || '';
    this.valorMulta = dados.valorMulta || '';
    this.codigoDocumento = dados.codigoDocumento || '';
    this.avisoFavorecido = dados.avisoFavorecido || '';
    this.codigoIspb = dados.codigoIspb || '';
    this.usoFebraban = dados.usoFebraban || ' '.repeat(5);

    // Dados específicos por subtipo
    this.dadosSubtipo = dados.dadosSubtipo || '';
  }

  /**
   * Cria um SegmentoB240 a partir de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {SegmentoB240} Instância do segmento B
   */
  static fromLinha(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter exatamente 240 caracteres');
    }

    // Extrair subtipo primeiro
    const subtipo = linha.substring(14, 17);

    const dados = {
      codigoBanco: linha.substring(0, 3),
      lote: linha.substring(3, 7).trim(),
      numeroSequencial: linha.substring(8, 13).trim(),
      subtipo: subtipo,
      tipoInscricao: linha.substring(17, 18),
      numeroInscricao: linha.substring(18, 32).trim(),
      logradouro: linha.substring(32, 62).trim(),
      numeroLocal: linha.substring(62, 67).trim(),
      complemento: linha.substring(67, 82).trim(),
      bairro: linha.substring(82, 97).trim(),
      cidade: linha.substring(97, 117).trim(),
      cep: linha.substring(117, 122).trim(),
      complementoCep: linha.substring(122, 125).trim(),
      estado: linha.substring(125, 127).trim(),
      dataVencimento: linha.substring(127, 135),
      valorDocumento: linha.substring(135, 150).trim(),
      valorAbatimento: linha.substring(150, 165).trim(),
      valorDesconto: linha.substring(165, 180).trim(),
      valorMora: linha.substring(180, 195).trim(),
      valorMulta: linha.substring(195, 210).trim(),
      codigoDocumento: linha.substring(210, 225).trim(),
      avisoFavorecido: linha.substring(225, 227),
      codigoIspb: linha.substring(227, 235).trim(),
      usoFebraban: linha.substring(235, 240)
    };

    // Extrair dados específicos do subtipo
    dados.dadosSubtipo = this.extrairDadosSubtipo(linha, subtipo);

    return new SegmentoB240(dados);
  }

  /**
   * Extrai dados específicos baseado no subtipo do Segmento B
   * @param {string} linha - Linha completa
   * @param {string} subtipo - Subtipo (B01, B02, B03, B04)
   * @returns {Object} Dados específicos do subtipo
   */
  static extrairDadosSubtipo(linha, subtipo) {
    // Área de dados livres geralmente nas posições 18-200 para subtipos
    const dadosLivres = linha.substring(18, 200).trim();

    switch (subtipo) {
      case 'B01': // Telefone
        return {
          tipo: 'TELEFONE',
          dadosPix: dadosLivres,
          formato: 'Telefone celular (+55XXXXXXXXXXX)'
        };

      case 'B02': // Email
        return {
          tipo: 'EMAIL',
          dadosPix: dadosLivres,
          formato: 'Endereço de email'
        };

      case 'B03': // CPF/CNPJ
        return {
          tipo: 'DOCUMENTO',
          dadosPix: dadosLivres,
          formato: 'CPF (11 dígitos) ou CNPJ (14 dígitos)'
        };

      case 'B04': // UUID
        return {
          tipo: 'UUID',
          dadosPix: dadosLivres,
          formato: 'Chave aleatória UUID'
        };

      default:
        return {
          tipo: 'DESCONHECIDO',
          dadosPix: dadosLivres,
          formato: 'Formato não identificado'
        };
    }
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
   * Obtém informações sobre o tipo de chave PIX
   * @returns {Object} Informações da chave PIX
   */
  getInfoChavePix() {
    if (!this.dadosSubtipo) return null;

    return {
      subtipo: this.subtipo,
      tipo: this.dadosSubtipo.tipo,
      dados: this.dadosSubtipo.dadosPix,
      formato: this.dadosSubtipo.formato
    };
  }

  /**
   * Converte para objeto simples
   * @returns {Object} Dados do segmento B como objeto
   */
  toObject() {
    return {
      codigoBanco: this.codigoBanco,
      lote: this.lote,
      tipoRegistro: this.tipoRegistro,
      numeroSequencial: this.numeroSequencial,
      segmento: this.segmento,
      subtipo: this.subtipo,
      tipoInscricao: this.tipoInscricao,
      numeroInscricao: this.numeroInscricao,
      logradouro: this.logradouro,
      numeroLocal: this.numeroLocal,
      complemento: this.complemento,
      bairro: this.bairro,
      cidade: this.cidade,
      cep: this.cep,
      complementoCep: this.complementoCep,
      estado: this.estado,
      dataVencimento: this.dataVencimento,
      valorDocumento: this.parseValor(this.valorDocumento),
      valorAbatimento: this.parseValor(this.valorAbatimento),
      valorDesconto: this.parseValor(this.valorDesconto),
      valorMora: this.parseValor(this.valorMora),
      valorMulta: this.parseValor(this.valorMulta),
      codigoDocumento: this.codigoDocumento,
      avisoFavorecido: this.avisoFavorecido,
      codigoIspb: this.codigoIspb,
      chavePix: this.getInfoChavePix()
    };
  }

  /**
   * Parse valores monetários
   * @param {string} valorString - String do valor
   * @returns {number} Valor numérico
   */
  parseValor(valorString) {
    return SegmentoB240.parseValor(valorString);
  }

  /**
   * Valida os dados do segmento B
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

    if (this.segmento !== 'B') {
      erros.push('Segmento deve ser "B"');
    }

    if (!['B01', 'B02', 'B03', 'B04'].includes(this.subtipo)) {
      erros.push('Subtipo deve ser B01, B02, B03 ou B04');
    }

    // Validações específicas por subtipo
    if (this.dadosSubtipo && this.dadosSubtipo.tipo === 'EMAIL' && this.dadosSubtipo.dadosPix) {
      if (!this.dadosSubtipo.dadosPix.includes('@')) {
        erros.push('Email inválido para subtipo B02');
      }
    }

    if (this.dadosSubtipo && this.dadosSubtipo.tipo === 'TELEFONE' && this.dadosSubtipo.dadosPix) {
      if (!/^\+?55\d{10,11}$/.test(this.dadosSubtipo.dadosPix.replace(/\D/g, ''))) {
        erros.push('Telefone inválido para subtipo B01');
      }
    }

    return erros;
  }
}

export default SegmentoB240; 