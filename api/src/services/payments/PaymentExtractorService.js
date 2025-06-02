/**
 * PaymentExtractorService - Serviço para extração de dados de pagamento dos arquivos CNAB
 * 
 * Responsável por:
 * - Extrair códigos de barras dos registros CNAB
 * - Extrair linhas digitáveis
 * - Estruturar dados para APIs externas
 * - Identificar tipos de pagamento
 * - Validar códigos extraídos
 */

import { CnabUniversalService } from '../cnab/CnabUniversalService.js';

export class PaymentExtractorService {
  constructor(config = {}) {
    this.config = {
      validateBarcodes: true,
      includeMetadata: true,
      groupByType: true,
      ...config
    };

    this.cnabService = new CnabUniversalService();
    this.stats = {
      processed: 0,
      extracted: 0,
      validated: 0,
      errors: 0
    };
  }

  /**
   * Extrai dados de pagamento de um arquivo CNAB
   * @param {string|Buffer} cnabContent - Conteúdo do arquivo CNAB
   * @param {Object} options - Opções de extração
   * @returns {Object} Dados de pagamento extraídos
   */
  async extractPaymentData(cnabContent, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.processed++;

      // 1. Processar arquivo CNAB usando o serviço universal
      const cnabData = await this.cnabService.processFile(cnabContent, options);

      if (!cnabData.success) {
        throw new Error(`Erro no processamento CNAB: ${cnabData.error?.message}`);
      }

      // 2. Extrair dados de pagamento
      const paymentData = await this._extractFromCnabData(cnabData.data);

      // 3. Estruturar resultado
      const result = {
        success: true,
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          sourceFormat: cnabData.detection?.format,
          sourceBank: cnabData.detection?.bankName,
          confidence: cnabData.detection?.confidence,
          timestamp: new Date().toISOString()
        },
        summary: {
          totalRecords: paymentData.totalRecords,
          paymentsFound: paymentData.payments.length,
          typesFound: Object.keys(paymentData.byType || {}).length,
          validBarcodes: paymentData.validationSummary?.validBarcodes || 0,
          validDigitableLlines: paymentData.validationSummary?.validDigitableLines || 0
        },
        data: paymentData
      };

      this.stats.extracted++;
      return result;

    } catch (error) {
      this.stats.errors++;

      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString()
        },
        metadata: {
          processingTime: `${Date.now() - startTime}ms`
        }
      };
    }
  }

  /**
   * Extrai apenas códigos de barras de um arquivo CNAB
   * @param {string|Buffer} cnabContent - Conteúdo do arquivo CNAB
   * @returns {Object} Códigos de barras extraídos
   */
  async extractBarcodes(cnabContent) {
    try {
      const result = await this.extractPaymentData(cnabContent);

      if (!result.success) {
        return result;
      }

      const barcodes = result.data.payments
        .filter(payment => payment.barcode)
        .map(payment => ({
          barcode: payment.barcode,
          value: payment.value,
          dueDate: payment.dueDate,
          paymentDate: payment.paymentDate,
          type: payment.type,
          status: payment.status,
          metadata: payment.metadata
        }));

      return {
        success: true,
        barcodes,
        total: barcodes.length,
        metadata: result.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extrai apenas linhas digitáveis de um arquivo CNAB
   * @param {string|Buffer} cnabContent - Conteúdo do arquivo CNAB
   * @returns {Object} Linhas digitáveis extraídas
   */
  async extractDigitableLines(cnabContent) {
    try {
      const result = await this.extractPaymentData(cnabContent);

      if (!result.success) {
        return result;
      }

      const digitableLines = result.data.payments
        .filter(payment => payment.digitableLine)
        .map(payment => ({
          digitableLine: payment.digitableLine,
          value: payment.value,
          dueDate: payment.dueDate,
          paymentDate: payment.paymentDate,
          type: payment.type,
          status: payment.status,
          metadata: payment.metadata
        }));

      return {
        success: true,
        digitableLines,
        total: digitableLines.length,
        metadata: result.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extrai dados de pagamento estruturados para APIs externas
   * @param {string|Buffer} cnabContent - Conteúdo do arquivo CNAB
   * @param {string} apiFormat - Formato da API externa ('swap', 'generic')
   * @returns {Object} Dados estruturados para API externa
   */
  async extractForExternalAPI(cnabContent, apiFormat = 'generic') {
    try {
      const result = await this.extractPaymentData(cnabContent);

      if (!result.success) {
        return result;
      }

      const structuredData = this._structureForAPI(result.data, apiFormat);

      return {
        success: true,
        format: apiFormat,
        data: structuredData,
        metadata: result.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Obtém estatísticas do serviço
   * @returns {Object} Estatísticas de uso
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.processed > 0 ?
        ((this.stats.extracted / this.stats.processed) * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      processed: 0,
      extracted: 0,
      validated: 0,
      errors: 0
    };
  }

  // === MÉTODOS PRIVADOS ===

  /**
   * Extrai dados de pagamento dos dados CNAB processados
   * @param {Object} cnabData - Dados CNAB processados
   * @returns {Object} Dados de pagamento extraídos
   */
  async _extractFromCnabData(cnabData) {
    const payments = [];
    const byType = {};
    let totalRecords = 0;
    const validationSummary = {
      validBarcodes: 0,
      validDigitableLines: 0,
      invalidBarcodes: 0,
      invalidDigitableLines: 0
    };

    // Processar registros de detalhe
    if (cnabData.details && Array.isArray(cnabData.details)) {
      totalRecords = cnabData.details.length;

      for (const detail of cnabData.details) {
        const payment = await this._extractPaymentFromDetail(detail, cnabData.format);

        if (payment) {
          payments.push(payment);

          // Agrupar por tipo
          if (this.config.groupByType) {
            if (!byType[payment.type]) {
              byType[payment.type] = [];
            }
            byType[payment.type].push(payment);
          }

          // Validar códigos
          if (this.config.validateBarcodes) {
            if (payment.barcode) {
              if (this._validateBarcode(payment.barcode)) {
                validationSummary.validBarcodes++;
              } else {
                validationSummary.invalidBarcodes++;
              }
            }

            if (payment.digitableLine) {
              if (this._validateDigitableLine(payment.digitableLine)) {
                validationSummary.validDigitableLines++;
              } else {
                validationSummary.invalidDigitableLines++;
              }
            }
          }
        }
      }
    }

    // Processar lotes CNAB240 se existirem
    if (cnabData.lotes && Array.isArray(cnabData.lotes)) {
      for (const lote of cnabData.lotes) {
        if (lote.segmentos) {
          for (const segmento of lote.segmentos) {
            const payment = await this._extractPaymentFromSegment(segmento);

            if (payment) {
              payments.push(payment);
              totalRecords++;

              // Agrupar por tipo
              if (this.config.groupByType) {
                if (!byType[payment.type]) {
                  byType[payment.type] = [];
                }
                byType[payment.type].push(payment);
              }
            }
          }
        }
      }
    }

    return {
      payments,
      byType: this.config.groupByType ? byType : undefined,
      totalRecords,
      validationSummary: this.config.validateBarcodes ? validationSummary : undefined
    };
  }

  /**
   * Extrai dados de pagamento de um registro de detalhe
   * @param {Object} detail - Registro de detalhe
   * @param {string} format - Formato CNAB (cnab240, cnab400)
   * @returns {Object|null} Dados de pagamento ou null
   */
  async _extractPaymentFromDetail(detail, format) {
    if (!detail) return null;

    // Extrair código de barras e linha digitável dependendo do formato
    const barcode = this._extractBarcodeFromDetail(detail, format);
    const digitableLine = this._extractDigitableLineFromDetail(detail, format);

    if (!barcode && !digitableLine) {
      return null; // Sem dados de pagamento válidos
    }

    const payment = {
      id: detail.nossoNumero || detail.numeroSequencial || null,
      barcode: barcode,
      digitableLine: digitableLine,
      value: this._parseValue(detail.valor || detail.valorTitulo || detail.valorPago),
      dueDate: this._parseDate(detail.vencimento || detail.dataVencimento),
      paymentDate: this._parseDate(detail.dataPagamento),
      type: this._identifyPaymentType(detail, barcode, digitableLine),
      status: this._determinePaymentStatus(detail),
      beneficiary: this._extractBeneficiary(detail),
      payer: this._extractPayer(detail),
      metadata: this.config.includeMetadata ? {
        sourceFormat: format,
        sequentialNumber: detail.numeroSequencial,
        batch: detail.lote,
        originalData: detail
      } : undefined
    };

    return payment;
  }

  /**
   * Extrai dados de pagamento de um segmento CNAB240
   * @param {Object} segmento - Segmento CNAB240
   * @returns {Object|null} Dados de pagamento ou null
   */
  async _extractPaymentFromSegment(segmento) {
    if (!segmento || !segmento.codigoBarras) return null;

    const payment = {
      id: segmento.nossoNumero || segmento.numeroSequencial || null,
      barcode: segmento.codigoBarras,
      digitableLine: segmento.linhaDigitavel || null,
      value: this._parseValue(segmento.valorTitulo || segmento.valorPago || segmento.valorDocumento),
      dueDate: this._parseDate(segmento.dataVencimento),
      paymentDate: this._parseDate(segmento.dataPagamento),
      type: this._identifyPaymentTypeFromSegment(segmento),
      status: this._determineStatusFromSegment(segmento),
      beneficiary: {
        name: segmento.nomeFavorecido || segmento.nomeConcessionaria,
        document: segmento.documentoFavorecido
      },
      metadata: this.config.includeMetadata ? {
        sourceFormat: 'cnab240',
        segment: segmento.segmento,
        batch: segmento.lote,
        originalData: segmento
      } : undefined
    };

    return payment;
  }

  /**
   * Extrai código de barras de um registro de detalhe
   * @param {Object} detail - Registro de detalhe
   * @param {string} format - Formato CNAB
   * @returns {string|null} Código de barras ou null
   */
  _extractBarcodeFromDetail(detail, format) {
    // Procurar código de barras em diferentes campos possíveis
    return detail.codigoBarras ||
      detail.codigo_barras ||
      detail.barcode ||
      null;
  }

  /**
   * Extrai linha digitável de um registro de detalhe
   * @param {Object} detail - Registro de detalhe
   * @param {string} format - Formato CNAB
   * @returns {string|null} Linha digitável ou null
   */
  _extractDigitableLineFromDetail(detail, format) {
    return detail.linhaDigitavel ||
      detail.linha_digitavel ||
      detail.digitableLine ||
      null;
  }

  /**
   * Identifica o tipo de pagamento baseado nos dados
   * @param {Object} detail - Dados do registro
   * @param {string} barcode - Código de barras
   * @param {string} digitableLine - Linha digitável
   * @returns {string} Tipo de pagamento
   */
  _identifyPaymentType(detail, barcode, digitableLine) {
    // Identificar por código de barras
    if (barcode) {
      const firstDigit = barcode.charAt(0);

      switch (firstDigit) {
        case '8':
          return 'tributo'; // Tributos municipais, estaduais e federais
        case '9':
          return 'concessionaria'; // Concessionárias de serviços públicos
        default:
          if (barcode.length === 44) {
            return 'boleto'; // Boletos bancários
          }
          return 'other';
      }
    }

    // Identificar por linha digitável
    if (digitableLine) {
      const firstDigit = digitableLine.charAt(0);
      if (['0', '1', '2', '3', '4', '5', '6', '7'].includes(firstDigit)) {
        return 'boleto';
      }
      if (firstDigit === '8') {
        return 'tributo';
      }
      if (firstDigit === '9') {
        return 'concessionaria';
      }
    }

    // Identificar por outros campos
    if (detail.tipoDocumento || detail.tipo_documento) {
      return detail.tipoDocumento || detail.tipo_documento;
    }

    return 'unknown';
  }

  /**
   * Identifica tipo de pagamento de segmento CNAB240
   * @param {Object} segmento - Dados do segmento
   * @returns {string} Tipo de pagamento
   */
  _identifyPaymentTypeFromSegment(segmento) {
    if (segmento.segmento === 'J') {
      return 'boleto';
    }
    if (segmento.segmento === 'O') {
      return 'tributo';
    }
    if (segmento.segmento === 'N') {
      return 'concessionaria';
    }

    return this._identifyPaymentType(segmento, segmento.codigoBarras, segmento.linhaDigitavel);
  }

  /**
   * Determina status do pagamento
   * @param {Object} detail - Dados do registro
   * @returns {string} Status do pagamento
   */
  _determinePaymentStatus(detail) {
    if (detail.dataPagamento && detail.dataPagamento !== '00000000') {
      return 'paid';
    }

    if (detail.status) {
      return detail.status;
    }

    const today = new Date();
    const dueDate = this._parseDate(detail.vencimento || detail.dataVencimento);

    if (dueDate && dueDate < today) {
      return 'overdue';
    }

    return 'pending';
  }

  /**
   * Determina status do segmento
   * @param {Object} segmento - Dados do segmento
   * @returns {string} Status do pagamento
   */
  _determineStatusFromSegment(segmento) {
    if (segmento.dataPagamento && segmento.dataPagamento !== '00000000') {
      return 'paid';
    }
    return 'pending';
  }

  /**
   * Extrai dados do beneficiário
   * @param {Object} detail - Dados do registro
   * @returns {Object} Dados do beneficiário
   */
  _extractBeneficiary(detail) {
    return {
      name: detail.nomeFavorecido || detail.nome_favorecido || detail.beneficiario,
      document: detail.documentoFavorecido || detail.cpf_cnpj_favorecido,
      bank: detail.bancoFavorecido || detail.banco_favorecido,
      agency: detail.agenciaFavorecido || detail.agencia_favorecida,
      account: detail.contaFavorecido || detail.conta_favorecida
    };
  }

  /**
   * Extrai dados do pagador
   * @param {Object} detail - Dados do registro
   * @returns {Object} Dados do pagador
   */
  _extractPayer(detail) {
    return {
      name: detail.nomePagador || detail.nome_pagador || detail.sacado,
      document: detail.documentoPagador || detail.cpf_cnpj_pagador,
      address: detail.enderecoPagador || detail.endereco_pagador
    };
  }

  /**
   * Estrutura dados para API externa
   * @param {Object} paymentData - Dados de pagamento
   * @param {string} apiFormat - Formato da API
   * @returns {Object} Dados estruturados
   */
  _structureForAPI(paymentData, apiFormat) {
    switch (apiFormat) {
      case 'swap':
        return this._structureForSwapAPI(paymentData);
      case 'generic':
      default:
        return this._structureForGenericAPI(paymentData);
    }
  }

  /**
   * Estrutura dados para SWAP Financial API
   * @param {Object} paymentData - Dados de pagamento
   * @returns {Object} Dados estruturados para SWAP
   */
  _structureForSwapAPI(paymentData) {
    return {
      batch: {
        id: `batch_${Date.now()}`,
        created_at: new Date().toISOString(),
        total_amount: paymentData.payments.reduce((sum, p) => sum + (p.value || 0), 0),
        total_count: paymentData.payments.length
      },
      payments: paymentData.payments.map(payment => ({
        external_id: payment.id,
        barcode: payment.barcode,
        amount: payment.value,
        due_date: payment.dueDate,
        description: `Payment ${payment.type}`,
        beneficiary: payment.beneficiary?.name,
        payer: payment.payer?.name
      }))
    };
  }

  /**
   * Estrutura dados para API genérica
   * @param {Object} paymentData - Dados de pagamento
   * @returns {Object} Dados estruturados genericamente
   */
  _structureForGenericAPI(paymentData) {
    return {
      metadata: {
        total_payments: paymentData.payments.length,
        total_amount: paymentData.payments.reduce((sum, p) => sum + (p.value || 0), 0),
        types_summary: paymentData.byType ? Object.keys(paymentData.byType).map(type => ({
          type,
          count: paymentData.byType[type].length,
          amount: paymentData.byType[type].reduce((sum, p) => sum + (p.value || 0), 0)
        })) : [],
        created_at: new Date().toISOString()
      },
      payments: paymentData.payments
    };
  }

  /**
   * Valida código de barras
   * @param {string} barcode - Código de barras
   * @returns {boolean} True se válido
   */
  _validateBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') {
      return false;
    }

    // Remover espaços e caracteres especiais
    const cleanBarcode = barcode.replace(/\D/g, '');

    // Verificar tamanho
    if (![44, 47, 48].includes(cleanBarcode.length)) {
      return false;
    }

    // Validação básica de dígito verificador pode ser implementada aqui
    // Por enquanto, validação simples de formato
    return /^\d+$/.test(cleanBarcode);
  }

  /**
   * Valida linha digitável
   * @param {string} digitableLine - Linha digitável
   * @returns {boolean} True se válido
   */
  _validateDigitableLine(digitableLine) {
    if (!digitableLine || typeof digitableLine !== 'string') {
      return false;
    }

    // Padrão básico de linha digitável (boleto)
    const boletoPattern = /^\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}$/;

    // Padrão de tributos/concessionárias
    const tributoPattern = /^\d{11,12}-\d\s\d{11,12}-\d\s\d{11,12}-\d\s\d{11,12}-\d$/;

    return boletoPattern.test(digitableLine) || tributoPattern.test(digitableLine);
  }

  /**
   * Converte valor CNAB para número
   * @param {string} valueStr - Valor em formato CNAB
   * @returns {number} Valor numérico
   */
  _parseValue(valueStr) {
    if (!valueStr) return 0;

    // Remover caracteres não numéricos
    const cleanValue = valueStr.toString().replace(/[^\d]/g, '');

    if (!cleanValue) return 0;

    // Converter considerando 2 casas decimais
    return parseInt(cleanValue, 10) / 100;
  }

  /**
   * Converte data CNAB para Date
   * @param {string} dateStr - Data em formato CNAB (DDMMAAAA ou DDMMAA)
   * @returns {Date|null} Data convertida ou null
   */
  _parseDate(dateStr) {
    if (!dateStr || dateStr === '00000000' || dateStr === '000000') {
      return null;
    }

    try {
      let day, month, year;

      if (dateStr.length === 8) {
        // DDMMAAAA
        day = parseInt(dateStr.substring(0, 2), 10);
        month = parseInt(dateStr.substring(2, 4), 10);
        year = parseInt(dateStr.substring(4, 8), 10);
      } else if (dateStr.length === 6) {
        // DDMMAA
        day = parseInt(dateStr.substring(0, 2), 10);
        month = parseInt(dateStr.substring(2, 4), 10);
        year = parseInt(dateStr.substring(4, 6), 10);
        year = year > 50 ? 1900 + year : 2000 + year;
      } else {
        return null;
      }

      const date = new Date(year, month - 1, day);

      // Verificar se a data é válida
      if (date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day) {
        return date;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

export default PaymentExtractorService; 