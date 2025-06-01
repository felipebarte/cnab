/**
 * Modelo para Trailer de Lote CNAB 240
 * 
 * Representa o registro tipo 5 - Trailer de Lote
 * Contém totalizadores e informações de fechamento do lote
 */

/**
 * @typedef {Object} TrailerLote240
 * @property {string} codigoBanco - Código do banco (posições 1-3)
 * @property {string} lote - Lote de serviço (posições 4-7)
 * @property {string} tipoRegistro - Tipo de registro - sempre '5' (posição 8)
 * @property {string} usoFebraban1 - Uso exclusivo FEBRABAN (posições 9-17)
 * @property {string} quantidadeRegistros - Quantidade de registros do lote (posições 18-23)
 * @property {string} quantidadeCreditos - Quantidade de lançamentos de crédito (posições 24-29)
 * @property {string} valorTotalCreditos - Valor total dos créditos (posições 30-46)
 * @property {string} quantidadeDebitos - Quantidade de lançamentos de débito (posições 47-52)
 * @property {string} valorTotalDebitos - Valor total dos débitos (posições 53-69)
 * @property {string} quantidadeCreditos2 - Quantidade de créditos - cópia (posições 70-75)
 * @property {string} valorTotalCreditos2 - Valor total créditos - cópia (posições 76-92)
 * @property {string} quantidadeDebitos2 - Quantidade de débitos - cópia (posições 93-98)
 * @property {string} valorTotalDebitos2 - Valor total débitos - cópia (posições 99-115)
 * @property {string} usoFebraban2 - Uso exclusivo FEBRABAN (posições 116-240)
 */

class TrailerLote240 {
  /**
   * Cria uma instância do TrailerLote240
   * @param {Object} dados - Dados para construir o trailer de lote
   */
  constructor(dados = {}) {
    this.codigoBanco = dados.codigoBanco || '';
    this.lote = dados.lote || '';
    this.tipoRegistro = '5'; // Sempre 5 para trailer de lote
    this.usoFebraban1 = dados.usoFebraban1 || ' '.repeat(9);
    this.quantidadeRegistros = dados.quantidadeRegistros || '';
    this.quantidadeCreditos = dados.quantidadeCreditos || '';
    this.valorTotalCreditos = dados.valorTotalCreditos || '';
    this.quantidadeDebitos = dados.quantidadeDebitos || '';
    this.valorTotalDebitos = dados.valorTotalDebitos || '';
    this.quantidadeCreditos2 = dados.quantidadeCreditos2 || '';
    this.valorTotalCreditos2 = dados.valorTotalCreditos2 || '';
    this.quantidadeDebitos2 = dados.quantidadeDebitos2 || '';
    this.valorTotalDebitos2 = dados.valorTotalDebitos2 || '';
    this.usoFebraban2 = dados.usoFebraban2 || ' '.repeat(125);
  }

  /**
   * Cria um TrailerLote240 a partir de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {TrailerLote240} Instância do trailer de lote
   */
  static fromLinha(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter exatamente 240 caracteres');
    }

    const dados = {
      codigoBanco: linha.substring(0, 3),
      lote: linha.substring(3, 7).trim(),
      usoFebraban1: linha.substring(8, 17),
      quantidadeRegistros: linha.substring(17, 23).trim(),
      quantidadeCreditos: linha.substring(23, 29).trim(),
      valorTotalCreditos: linha.substring(29, 46).trim(),
      quantidadeDebitos: linha.substring(46, 52).trim(),
      valorTotalDebitos: linha.substring(52, 69).trim(),
      quantidadeCreditos2: linha.substring(69, 75).trim(),
      valorTotalCreditos2: linha.substring(75, 92).trim(),
      quantidadeDebitos2: linha.substring(92, 98).trim(),
      valorTotalDebitos2: linha.substring(98, 115).trim(),
      usoFebraban2: linha.substring(115, 240)
    };

    return new TrailerLote240(dados);
  }

  /**
   * Converte valor numérico para string formatada para CNAB
   * @param {number} valor - Valor numérico
   * @param {number} tamanho - Tamanho total da string
   * @returns {string} Valor formatado com zeros à esquerda
   */
  static formatarValor(valor, tamanho = 17) {
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
   * Obtém a quantidade de registros como número
   * @returns {number} Quantidade de registros
   */
  getQuantidadeRegistrosNumerico() {
    return parseInt(this.quantidadeRegistros) || 0;
  }

  /**
   * Obtém a quantidade de créditos como número
   * @returns {number} Quantidade de créditos
   */
  getQuantidadeCreditosNumerico() {
    return parseInt(this.quantidadeCreditos) || 0;
  }

  /**
   * Obtém a quantidade de débitos como número
   * @returns {number} Quantidade de débitos
   */
  getQuantidadeDebitosNumerico() {
    return parseInt(this.quantidadeDebitos) || 0;
  }

  /**
   * Obtém o valor total dos créditos como número
   * @returns {number} Valor total em reais
   */
  getValorTotalCreditosNumerico() {
    return TrailerLote240.parseValor(this.valorTotalCreditos);
  }

  /**
   * Obtém o valor total dos débitos como número
   * @returns {number} Valor total em reais
   */
  getValorTotalDebitosNumerico() {
    return TrailerLote240.parseValor(this.valorTotalDebitos);
  }

  /**
   * Converte para objeto simples
   * @returns {Object} Dados do trailer de lote como objeto
   */
  toObject() {
    return {
      codigoBanco: this.codigoBanco,
      lote: this.lote,
      tipoRegistro: this.tipoRegistro,
      quantidadeRegistros: this.getQuantidadeRegistrosNumerico(),
      quantidadeCreditos: this.getQuantidadeCreditosNumerico(),
      valorTotalCreditos: this.getValorTotalCreditosNumerico(),
      quantidadeDebitos: this.getQuantidadeDebitosNumerico(),
      valorTotalDebitos: this.getValorTotalDebitosNumerico(),
      totalizadores: {
        totalRegistros: this.getQuantidadeRegistrosNumerico(),
        totalCreditos: this.getQuantidadeCreditosNumerico(),
        totalDebitos: this.getQuantidadeDebitosNumerico(),
        valorCreditos: this.getValorTotalCreditosNumerico(),
        valorDebitos: this.getValorTotalDebitosNumerico()
      }
    };
  }

  /**
   * Calcula totalizadores baseado em um array de detalhes
   * @param {Array} detalhes - Array de registros de detalhe do lote
   * @returns {Object} Totalizadores calculados
   */
  static calcularTotalizadores(detalhes) {
    const totalizadores = {
      quantidadeRegistros: detalhes.length + 2, // +2 para header e trailer do lote
      quantidadeCreditos: 0,
      valorTotalCreditos: 0,
      quantidadeDebitos: 0,
      valorTotalDebitos: 0
    };

    detalhes.forEach(detalhe => {
      if (detalhe.segmento === 'A' && detalhe.valorPagamento) {
        const valor = typeof detalhe.valorPagamento === 'string'
          ? TrailerLote240.parseValor(detalhe.valorPagamento)
          : detalhe.valorPagamento;

        // Por simplificação, consideramos todos como créditos
        // Em um sistema real, isso dependeria do tipo de operação
        totalizadores.quantidadeCreditos++;
        totalizadores.valorTotalCreditos += valor;
      }
    });

    return totalizadores;
  }

  /**
   * Valida os dados do trailer de lote
   * @returns {Array<string>} Array de erros encontrados
   */
  validar() {
    const erros = [];

    if (!this.codigoBanco || this.codigoBanco.length !== 3) {
      erros.push('Código do banco deve ter 3 dígitos');
    }

    if (this.tipoRegistro !== '5') {
      erros.push('Tipo de registro deve ser "5" para trailer de lote');
    }

    if (!this.lote || !/^\d{4}$/.test(this.lote)) {
      erros.push('Lote deve ter 4 dígitos numéricos');
    }

    if (!this.quantidadeRegistros || !/^\d+$/.test(this.quantidadeRegistros)) {
      erros.push('Quantidade de registros deve ser numérica');
    }

    if (this.getQuantidadeRegistrosNumerico() < 2) {
      erros.push('Quantidade de registros deve ser pelo menos 2 (header + trailer)');
    }

    return erros;
  }
}

export default TrailerLote240; 