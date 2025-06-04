/**
 * Parser Segmento J Multi-State
 * 
 * Implementa a lógica para processar corretamente duas linhas consecutivas
 * do Segmento J conforme especificado no PRD:
 * - Primeira linha J: dados principais do pagamento
 * - Segunda linha J: dados específicos do pagador
 * - Controle de iteração para não processar linha duas vezes
 */

import { PositionalExtractor } from './positionalExtractor.js';
import { MonetaryConverter } from './monetaryConverter.js';

export class SegmentJMultiStateParser {
  constructor() {
    this.extractor = new PositionalExtractor();
    this.converter = new MonetaryConverter();
    this.processedIndices = new Set(); // Controle para não reprocessar linhas

    this.stats = {
      pairsProcessed: 0,
      singleLinesProcessed: 0,
      errors: 0,
      skippedLines: 0
    };
  }

  /**
   * Processa Segmento J com lógica multi-state
   * @param {Array<string>} lines - Array com todas as linhas do arquivo
   * @param {number} currentIndex - Índice atual da linha sendo processada
   * @returns {Object|null} Dados do pagamento processado ou null
   */
  async process(lines, currentIndex) {
    try {
      // Verificar se esta linha já foi processada
      if (this.processedIndices.has(currentIndex)) {
        this.stats.skippedLines++;
        return null;
      }

      const currentLine = lines[currentIndex];

      // Validar se é Segmento J
      if (!this._isSegmentJ(currentLine)) {
        return null;
      }

      // Marcar linha atual como processada
      this.processedIndices.add(currentIndex);

      // Processar primeira linha (dados do pagamento)
      const paymentData = this.extractor.extractSegmentJPayment(currentLine);
      if (!paymentData) {
        this.stats.errors++;
        return null;
      }

      // Verificar se existe próxima linha e se também é Segmento J
      const nextIndex = currentIndex + 1;
      let payerData = null;

      if (nextIndex < lines.length) {
        const nextLine = lines[nextIndex];

        if (this._isSegmentJ(nextLine) && this._isPairSegmentJ(currentLine, nextLine)) {
          // Processar segunda linha (dados do pagador)
          payerData = this.extractor.extractSegmentJPayer(nextLine);

          // Marcar próxima linha como processada para não reprocessar
          this.processedIndices.add(nextIndex);
          this.stats.pairsProcessed++;
        } else {
          this.stats.singleLinesProcessed++;
        }
      } else {
        this.stats.singleLinesProcessed++;
      }

      // Combinar dados e processar
      const combinedPayment = await this._combinePaymentData(paymentData, payerData);

      return combinedPayment;

    } catch (error) {
      this.stats.errors++;
      console.error(`Erro ao processar Segmento J na linha ${currentIndex}:`, error);
      return null;
    }
  }

  /**
   * Verifica se a linha é um Segmento J
   * @private
   */
  _isSegmentJ(line) {
    if (!line || line.length < 14) {
      return false;
    }

    return line.substring(13, 14) === 'J';
  }

  /**
   * Verifica se duas linhas J consecutivas formam um par lógico
   * @private
   */
  _isPairSegmentJ(firstLine, secondLine) {
    // Verificar se pertencem ao mesmo lote e sequência
    const firstLote = firstLine.substring(3, 7);
    const secondLote = secondLine.substring(3, 7);

    const firstSeq = parseInt(firstLine.substring(8, 13));
    const secondSeq = parseInt(secondLine.substring(8, 13));

    // Devem ser do mesmo lote e sequenciais
    return firstLote === secondLote && (secondSeq === firstSeq + 1);
  }

  /**
   * Combina dados das duas linhas J em um objeto de pagamento
   * @private
   */
  async _combinePaymentData(paymentData, payerData) {
    const combined = {
      // Dados do pagamento (primeira linha)
      favorecido_nome: paymentData.nomeFavorecido || '',
      banco_favorecido: paymentData.codigoBanco || '',
      codigo_barras: paymentData.codigoBarras || '',
      data_pagamento: this._formatDate(paymentData.dataPagamento),
      agencia_favorecido: paymentData.agenciaFavorecido || '',
      conta_favorecido: paymentData.contaFavorecido || '',
      dv_conta_favorecido: paymentData.dvContaFavorecido || '',

      // Conversão monetária
      valor: await this.converter.convertValue(paymentData.valor),
      valor_original: paymentData.valor,

      // Dados técnicos
      lote_servico: paymentData.loteServico || '',
      numero_sequencial: paymentData.numeroSequencial || '',
      tipo_movimento: paymentData.tipoMovimento || '',

      // Dados do pagador (segunda linha, se disponível)
      pagador_nome: payerData?.nomePagador || '',
      cnpj_pagador: payerData?.cnpjPagador || '',

      // Metadados de processamento
      processamento: {
        multiState: !!payerData,
        timestamp: new Date().toISOString(),
        linha_pagamento: paymentData.numeroSequencial,
        linha_pagador: payerData?.numeroSequencial || null
      }
    };

    return this._enrichPaymentData(combined);
  }

  /**
   * Enriquece dados do pagamento com validações e formatações
   * @private
   */
  _enrichPaymentData(payment) {
    return {
      ...payment,

      // Validações
      validacoes: {
        codigo_barras_valido: this._validateBarcode(payment.codigo_barras),
        cnpj_pagador_valido: this._validateCnpj(payment.cnpj_pagador),
        valor_valido: payment.valor > 0,
        data_valida: !!payment.data_pagamento
      },

      // Formatações
      valor_formatado: this._formatCurrency(payment.valor),
      cnpj_pagador_formatado: this._formatCnpj(payment.cnpj_pagador),
      data_pagamento_formatada: this._formatDateBR(payment.data_pagamento)
    };
  }

  /**
   * Formata data do formato CNAB (DDMMAAAA) para ISO
   * @private
   */
  _formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) {
      return null;
    }

    const day = dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 8);

    try {
      const date = new Date(`${year}-${month}-${day}`);
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Formata data para padrão brasileiro
   * @private
   */
  _formatDateBR(isoDate) {
    if (!isoDate) return '';

    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  }

  /**
   * Valida código de barras básico
   * @private
   */
  _validateBarcode(barcode) {
    if (!barcode) return false;

    const cleaned = barcode.replace(/\D/g, '');
    return cleaned.length === 44 || cleaned.length === 47 || cleaned.length === 48;
  }

  /**
   * Valida CNPJ
   * @private
   */
  _validateCnpj(cnpj) {
    if (!cnpj) return false;

    const cleaned = cnpj.replace(/\D/g, '');
    return cleaned.length === 14 && !/^(\d)\1*$/.test(cleaned);
  }

  /**
   * Formata CNPJ
   * @private
   */
  _formatCnpj(cnpj) {
    if (!cnpj) return '';

    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj;

    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}.${cleaned.substring(5, 8)}/${cleaned.substring(8, 12)}-${cleaned.substring(12)}`;
  }

  /**
   * Formata valor monetário
   * @private
   */
  _formatCurrency(value) {
    if (typeof value !== 'number') return 'R$ 0,00';

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Processa múltiplos segmentos J em batch
   */
  async processBatch(lines) {
    const results = [];

    for (let i = 0; i < lines.length; i++) {
      if (this.processedIndices.has(i)) {
        continue;
      }

      const result = await this.process(lines, i);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Reseta estado do parser para novo arquivo
   */
  reset() {
    this.processedIndices.clear();
    this.stats = {
      pairsProcessed: 0,
      singleLinesProcessed: 0,
      errors: 0,
      skippedLines: 0
    };
  }

  /**
   * Obtém estatísticas de processamento
   */
  getStats() {
    return {
      ...this.stats,
      totalProcessed: this.stats.pairsProcessed + this.stats.singleLinesProcessed,
      successRate: this.stats.pairsProcessed + this.stats.singleLinesProcessed > 0
        ? ((this.stats.pairsProcessed + this.stats.singleLinesProcessed) /
          (this.stats.pairsProcessed + this.stats.singleLinesProcessed + this.stats.errors)) * 100
        : 0
    };
  }
}

export default SegmentJMultiStateParser; 