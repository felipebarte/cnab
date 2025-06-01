/**
 * Modelo para Trailer de Arquivo CNAB 240
 * 
 * Representa o registro tipo 9 - Trailer de Arquivo
 * Contém totalizadores gerais do arquivo completo
 */

/**
 * @typedef {Object} TrailerArquivo240
 * @property {string} codigoBanco - Código do banco (posições 1-3)
 * @property {string} lote - Lote de serviço - sempre '9999' para trailer de arquivo (posições 4-7)
 * @property {string} tipoRegistro - Tipo de registro - sempre '9' (posição 8)
 * @property {string} usoFebraban1 - Uso exclusivo FEBRABAN (posições 9-17)
 * @property {string} quantidadeLotes - Quantidade de lotes do arquivo (posições 18-23)
 * @property {string} quantidadeRegistros - Quantidade total de registros (posições 24-29)
 * @property {string} quantidadeContas - Quantidade de contas para conciliação (posições 30-35)
 * @property {string} usoFebraban2 - Uso exclusivo FEBRABAN (posições 36-240)
 */

class TrailerArquivo240 {
  /**
   * Cria uma instância do TrailerArquivo240
   * @param {Object} dados - Dados para construir o trailer de arquivo
   */
  constructor(dados = {}) {
    this.codigoBanco = dados.codigoBanco || '';
    this.lote = '9999'; // Sempre 9999 para trailer de arquivo
    this.tipoRegistro = '9'; // Sempre 9 para trailer de arquivo
    this.usoFebraban1 = dados.usoFebraban1 || ' '.repeat(9);
    this.quantidadeLotes = dados.quantidadeLotes || '';
    this.quantidadeRegistros = dados.quantidadeRegistros || '';
    this.quantidadeContas = dados.quantidadeContas || '';
    this.usoFebraban2 = dados.usoFebraban2 || ' '.repeat(205);
  }

  /**
   * Cria um TrailerArquivo240 a partir de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {TrailerArquivo240} Instância do trailer de arquivo
   */
  static fromLinha(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter exatamente 240 caracteres');
    }

    const dados = {
      codigoBanco: linha.substring(0, 3),
      usoFebraban1: linha.substring(8, 17),
      quantidadeLotes: linha.substring(17, 23).trim(),
      quantidadeRegistros: linha.substring(23, 29).trim(),
      quantidadeContas: linha.substring(29, 35).trim(),
      usoFebraban2: linha.substring(35, 240)
    };

    return new TrailerArquivo240(dados);
  }

  /**
   * Obtém a quantidade de lotes como número
   * @returns {number} Quantidade de lotes
   */
  getQuantidadeLotesNumerico() {
    return parseInt(this.quantidadeLotes) || 0;
  }

  /**
   * Obtém a quantidade de registros como número
   * @returns {number} Quantidade total de registros
   */
  getQuantidadeRegistrosNumerico() {
    return parseInt(this.quantidadeRegistros) || 0;
  }

  /**
   * Obtém a quantidade de contas como número
   * @returns {number} Quantidade de contas
   */
  getQuantidadeContasNumerico() {
    return parseInt(this.quantidadeContas) || 0;
  }

  /**
   * Converte para objeto simples
   * @returns {Object} Dados do trailer de arquivo como objeto
   */
  toObject() {
    return {
      codigoBanco: this.codigoBanco,
      lote: this.lote,
      tipoRegistro: this.tipoRegistro,
      quantidadeLotes: this.getQuantidadeLotesNumerico(),
      quantidadeRegistros: this.getQuantidadeRegistrosNumerico(),
      quantidadeContas: this.getQuantidadeContasNumerico(),
      totalizadores: {
        totalLotes: this.getQuantidadeLotesNumerico(),
        totalRegistros: this.getQuantidadeRegistrosNumerico(),
        totalContas: this.getQuantidadeContasNumerico()
      }
    };
  }

  /**
   * Calcula totalizadores baseado na estrutura completa do arquivo
   * @param {Object} arquivo - Estrutura completa do arquivo processado
   * @returns {Object} Totalizadores calculados
   */
  static calcularTotalizadores(arquivo) {
    const quantidadeLotes = arquivo.lotes.length;

    let quantidadeRegistros = 2; // Header e trailer de arquivo
    let quantidadeContas = 0;

    arquivo.lotes.forEach(lote => {
      quantidadeRegistros += 2; // Header e trailer de lote
      quantidadeRegistros += lote.detalhes.length; // Registros de detalhe

      // Contar contas únicas (simplificado)
      const contasUnicas = new Set();
      lote.detalhes.forEach(detalhe => {
        if (detalhe.segmento === 'A' && detalhe.contaFavorecido) {
          contasUnicas.add(detalhe.contaFavorecido);
        }
      });
      quantidadeContas += contasUnicas.size;
    });

    return {
      quantidadeLotes,
      quantidadeRegistros,
      quantidadeContas
    };
  }

  /**
   * Valida os dados do trailer de arquivo
   * @returns {Array<string>} Array de erros encontrados
   */
  validar() {
    const erros = [];

    if (!this.codigoBanco || this.codigoBanco.length !== 3) {
      erros.push('Código do banco deve ter 3 dígitos');
    }

    if (this.tipoRegistro !== '9') {
      erros.push('Tipo de registro deve ser "9" para trailer de arquivo');
    }

    if (this.lote !== '9999') {
      erros.push('Lote deve ser "9999" para trailer de arquivo');
    }

    if (!this.quantidadeLotes || !/^\d+$/.test(this.quantidadeLotes)) {
      erros.push('Quantidade de lotes deve ser numérica');
    }

    if (!this.quantidadeRegistros || !/^\d+$/.test(this.quantidadeRegistros)) {
      erros.push('Quantidade de registros deve ser numérica');
    }

    if (this.getQuantidadeLotesNumerico() < 1) {
      erros.push('Deve haver pelo menos 1 lote no arquivo');
    }

    if (this.getQuantidadeRegistrosNumerico() < 4) {
      erros.push('Deve haver pelo menos 4 registros (header arquivo + header lote + trailer lote + trailer arquivo)');
    }

    return erros;
  }
}

export default TrailerArquivo240; 