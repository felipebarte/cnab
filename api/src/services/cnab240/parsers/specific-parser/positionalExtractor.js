/**
 * Extractor Posicional Específico CNAB240 - Versão Otimizada
 * 
 * Sistema de extração baseado em posições fixas conforme layout CNAB240
 * Implementa extração precisa com otimizações de performance:
 * - Cache de validações
 * - Batch processing para múltiplas linhas
 * - Lazy loading de regex patterns
 * - Validações otimizadas
 */

/**
 * Sistema de extração posicional específica para CNAB240 com otimizações de performance
 */
export class PositionalExtractor {
  constructor(options = {}) {
    this.options = {
      debug: false,
      strictValidation: true,
      trimStrings: true,
      validateDates: true,
      formatCurrency: true,
      enableCache: true,
      batchSize: 1000,
      ...options
    };

    // Cache para melhorar performance
    this.cache = new Map();
    this.validationCache = new Map();

    // Lazy loading de regex patterns
    this._regexPatterns = null;

    // Estatísticas de performance
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalExtractions: 0,
      batchProcessed: 0
    };

    // Mapeamentos de posições conforme especificação CNAB240
    this.fieldMappings = {
      // Posições para Segmento J
      segmentJ: {
        banco: { start: 0, end: 3 },
        lote: { start: 3, end: 7 },
        tipoRegistro: { start: 7, end: 8 },
        numeroSequencial: { start: 8, end: 13 },
        segmento: { start: 12, end: 13 },
        usoExclusivo: { start: 13, end: 15 },
        codigoMovimento: { start: 15, end: 17 },
        codigoBarras: { start: 17, end: 61 },
        nomeBeneficiario: { start: 61, end: 91 },
        dataVencimento: { start: 91, end: 99 },
        valorTitulo: { start: 99, end: 114 },
        valorPago: { start: 114, end: 129 },
        dataPagamento: { start: 129, end: 137 },
        valorEfetivo: { start: 137, end: 152 },
        descontoAbatimento: { start: 152, end: 167 },
        acrescimoMora: { start: 167, end: 182 },
        informacoesComplementares: { start: 182, end: 222 },
        usoBanco: { start: 222, end: 240 }
      },

      // Posições para Segmento B (se necessário)
      segmentB: {
        logradouro: { start: 16, end: 46 },
        numeroEndereco: { start: 46, end: 56 },
        complemento: { start: 56, end: 71 },
        bairro: { start: 71, end: 86 },
        cidade: { start: 86, end: 106 },
        cep: { start: 106, end: 114 },
        uf: { start: 114, end: 116 },
        cnpjFavorecido: { start: 116, end: 130 }
      }
    };

    this.debug('PositionalExtractor otimizado inicializado', this.options);
  }

  /**
   * Lazy loading para patterns regex
   */
  get regexPatterns() {
    if (!this._regexPatterns) {
      this._regexPatterns = {
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        numeric: /^\d+$/,
        dateFormat: /^\d{8}$/,
        controlChars: /[\x00-\x1F\x7F]/g,
        multipleSpaces: /\s+/g
      };
    }
    return this._regexPatterns;
  }

  /**
   * Método de debug condicional otimizado
   */
  debug(message, data = null) {
    if (this.options.debug) {
      console.log(`[PositionalExtractor] ${message}`, data || '');
    }
  }

  /**
   * Validação otimizada de posições com cache
   */
  validatePositions(startPos, endPos, linha) {
    if (!linha) return false;

    // Cache key para validação
    const cacheKey = `${startPos}-${endPos}-${linha.length}`;

    if (this.options.enableCache && this.validationCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.validationCache.get(cacheKey);
    }

    const isValid = startPos >= 0 &&
      endPos > startPos &&
      endPos <= linha.length;

    if (this.options.enableCache) {
      this.validationCache.set(cacheKey, isValid);
      this.stats.cacheMisses++;
    }

    return isValid;
  }

  /**
   * Sanitização otimizada de strings
   */
  sanitizeString(str) {
    if (!str) return '';

    // Cache para strings já sanitizadas
    if (this.options.enableCache && this.cache.has(str)) {
      this.stats.cacheHits++;
      return this.cache.get(str);
    }

    const sanitized = str
      .replace(this.regexPatterns.controlChars, '') // Remove caracteres de controle
      .replace(this.regexPatterns.multipleSpaces, ' ') // Normaliza espaços
      .trim(); // Remove espaços das extremidades

    if (this.options.enableCache) {
      this.cache.set(str, sanitized);
      this.stats.cacheMisses++;
    }

    return sanitized;
  }

  /**
   * Extração otimizada de código de barras
   */
  extractBarcodeFromLine(linha) {
    try {
      this.stats.totalExtractions++;

      if (!linha || linha.length < 240) {
        return {
          success: false,
          error: 'Linha deve ter pelo menos 240 caracteres',
          barcode: '',
          position: { start: 17, end: 61 }
        };
      }

      const mapping = this.fieldMappings.segmentJ.codigoBarras;

      // Extração direta otimizada - sem substring desnecessário
      const barcode = linha.slice(mapping.start, mapping.end);
      const cleanBarcode = this.options.trimStrings ? barcode.trim() : barcode;

      this.debug('Código de barras extraído', { barcode: cleanBarcode, position: mapping });

      return {
        success: true,
        barcode: cleanBarcode,
        position: mapping
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro ao extrair código de barras: ${error.message}`,
        barcode: '',
        position: { start: 17, end: 61 }
      };
    }
  }

  /**
   * Extração otimizada de nome do beneficiário
   */
  extractBeneficiaryName(linha) {
    try {
      this.stats.totalExtractions++;

      if (!linha || linha.length < 240) {
        return {
          success: false,
          error: 'Linha deve ter pelo menos 240 caracteres',
          name: '',
          position: { start: 61, end: 91 }
        };
      }

      const mapping = this.fieldMappings.segmentJ.nomeBeneficiario;
      const name = linha.slice(mapping.start, mapping.end);
      const cleanName = this.sanitizeString(name);

      this.debug('Nome do beneficiário extraído', { name: cleanName, position: mapping });

      return {
        success: true,
        name: cleanName,
        position: mapping
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro ao extrair nome do beneficiário: ${error.message}`,
        name: '',
        position: { start: 61, end: 91 }
      };
    }
  }

  /**
   * Extração otimizada de valores monetários
   */
  extractMonetaryValue(linha, startPos, endPos) {
    try {
      this.stats.totalExtractions++;

      if (!this.validatePositions(startPos, endPos, linha)) {
        return {
          success: false,
          error: 'Posições inválidas para extração de valor monetário',
          value: 0,
          centavos: 0,
          formatted: 'R$ 0,00'
        };
      }

      const valorStr = linha.slice(startPos, endPos);

      // Otimização: verificar se é numérico antes de parseInt
      if (!this.regexPatterns.numeric.test(valorStr)) {
        return {
          success: false,
          error: 'Valor não é numérico',
          value: 0,
          centavos: 0,
          formatted: 'R$ 0,00'
        };
      }

      const centavos = parseInt(valorStr, 10);
      const value = centavos / 100;
      const formatted = this.formatCurrency(value);

      this.debug('Valor monetário extraído', { valorStr, centavos, value, formatted });

      return {
        success: true,
        value,
        centavos,
        formatted
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro ao extrair valor monetário: ${error.message}`,
        value: 0,
        centavos: 0,
        formatted: 'R$ 0,00'
      };
    }
  }

  /**
   * Extração otimizada de datas
   */
  extractDate(linha, startPos, endPos) {
    try {
      this.stats.totalExtractions++;

      if (!this.validatePositions(startPos, endPos, linha)) {
        return {
          success: false,
          error: 'Posições inválidas para extração de data',
          date: '',
          iso: '',
          dateObject: null
        };
      }

      const dateStr = linha.slice(startPos, endPos);

      // Verificação otimizada de formato
      if (!this.regexPatterns.dateFormat.test(dateStr)) {
        return {
          success: false,
          error: 'Data deve ter 8 caracteres numéricos (DDMMAAAA)',
          date: '',
          iso: '',
          dateObject: null
        };
      }

      // Verificar se é data zerada (otimizado)
      if (dateStr === '00000000') {
        return {
          success: true,
          date: '',
          iso: '',
          dateObject: null
        };
      }

      // Extração direta otimizada
      const day = dateStr.slice(0, 2);
      const month = dateStr.slice(2, 4);
      const year = dateStr.slice(4, 8);

      // Validação rápida de componentes
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
        return {
          success: false,
          error: 'Data inválida - componentes fora dos limites',
          date: '',
          iso: '',
          dateObject: null
        };
      }

      // Criação otimizada de data
      const dateObject = new Date(yearNum, monthNum - 1, dayNum);

      // Validação rápida de data
      if (dateObject.getDate() !== dayNum ||
        dateObject.getMonth() !== monthNum - 1 ||
        dateObject.getFullYear() !== yearNum) {
        return {
          success: false,
          error: 'Data inválida',
          date: '',
          iso: '',
          dateObject: null
        };
      }

      const formatted = `${day}/${month}/${year}`;
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      this.debug('Data extraída', { dateStr, formatted, iso });

      return {
        success: true,
        date: formatted,
        iso,
        dateObject
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro ao extrair data: ${error.message}`,
        date: '',
        iso: '',
        dateObject: null
      };
    }
  }

  /**
   * ✨ NOVO: Processamento em batch para múltiplas linhas
   */
  extractBatchSegmentJFields(linhas) {
    try {
      const results = [];
      const batchSize = this.options.batchSize;

      this.debug(`Processando ${linhas.length} linhas em batches de ${batchSize}`);

      for (let i = 0; i < linhas.length; i += batchSize) {
        const batch = linhas.slice(i, i + batchSize);
        const batchResults = batch.map(linha => this.extractSegmentJFields(linha));
        results.push(...batchResults);

        this.stats.batchProcessed++;
        this.debug(`Batch ${this.stats.batchProcessed} processado (${batch.length} linhas)`);
      }

      return {
        success: true,
        results,
        totalProcessed: linhas.length,
        batchesProcessed: this.stats.batchProcessed
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro no processamento em batch: ${error.message}`,
        results: []
      };
    }
  }

  /**
   * Extração otimizada de todos os campos do Segmento J
   */
  extractSegmentJFields(linha) {
    try {
      this.stats.totalExtractions++;

      // Verificação rápida de tamanho
      if (!linha || linha.length < 240) {
        return {
          success: false,
          error: 'Linha deve ter pelo menos 240 caracteres',
          fields: {}
        };
      }

      // Verificação rápida de segmento
      const segmento = linha[12]; // Corrigido: acesso direto ao índice 12
      if (segmento !== 'J') {
        return {
          success: false,
          error: 'Linha não é um Segmento J',
          fields: {}
        };
      }

      const mappings = this.fieldMappings.segmentJ;
      const fields = {};

      // Extração direta otimizada (slice é mais rápido que substring)
      fields.banco = linha.slice(mappings.banco.start, mappings.banco.end);
      fields.lote = linha.slice(mappings.lote.start, mappings.lote.end);
      fields.tipoRegistro = linha.slice(mappings.tipoRegistro.start, mappings.tipoRegistro.end);
      fields.numeroSequencial = linha.slice(mappings.numeroSequencial.start, mappings.numeroSequencial.end);
      fields.segmento = segmento;
      fields.codigoMovimento = linha.slice(mappings.codigoMovimento.start, mappings.codigoMovimento.end);

      // Extração direta de código de barras (otimizada)
      fields.codigoBarras = linha.slice(mappings.codigoBarras.start, mappings.codigoBarras.end).trim();

      // Extração direta de nome (otimizada)
      fields.nomeBeneficiario = this.sanitizeString(linha.slice(mappings.nomeBeneficiario.start, mappings.nomeBeneficiario.end));

      // Extração otimizada de datas
      const dataVencimentoResult = this.extractDate(linha, mappings.dataVencimento.start, mappings.dataVencimento.end);
      fields.dataVencimento = dataVencimentoResult.success ? dataVencimentoResult.date : '';

      const dataPagamentoResult = this.extractDate(linha, mappings.dataPagamento.start, mappings.dataPagamento.end);
      fields.dataPagamento = dataPagamentoResult.success ? dataPagamentoResult.date : '';

      // Extração otimizada de valores monetários
      const valorTituloResult = this.extractMonetaryValue(linha, mappings.valorTitulo.start, mappings.valorTitulo.end);
      fields.valorTitulo = valorTituloResult.success ? valorTituloResult.value : 0;

      const valorPagoResult = this.extractMonetaryValue(linha, mappings.valorPago.start, mappings.valorPago.end);
      fields.valorPago = valorPagoResult.success ? valorPagoResult.value : 0;

      const valorEfetivoResult = this.extractMonetaryValue(linha, mappings.valorEfetivo.start, mappings.valorEfetivo.end);
      fields.valorEfetivo = valorEfetivoResult.success ? valorEfetivoResult.value : 0;

      const descontoResult = this.extractMonetaryValue(linha, mappings.descontoAbatimento.start, mappings.descontoAbatimento.end);
      fields.descontoAbatimento = descontoResult.success ? descontoResult.value : 0;

      const acrescimoResult = this.extractMonetaryValue(linha, mappings.acrescimoMora.start, mappings.acrescimoMora.end);
      fields.acrescimoMora = acrescimoResult.success ? acrescimoResult.value : 0;

      // Extração direta de informações complementares
      fields.informacoesComplementares = this.sanitizeString(linha.slice(mappings.informacoesComplementares.start, mappings.informacoesComplementares.end));

      this.debug('Campos do Segmento J extraídos', fields);

      return {
        success: true,
        fields
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro ao extrair campos do Segmento J: ${error.message}`,
        fields: {}
      };
    }
  }

  /**
   * Formatação otimizada de moeda com cache
   */
  formatCurrency(value) {
    if (typeof value !== 'number') return 'R$ 0,00';

    // Cache para formatação de moeda
    const cacheKey = `currency_${value}`;
    if (this.options.enableCache && this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);

    if (this.options.enableCache) {
      this.cache.set(cacheKey, formatted);
      this.stats.cacheMisses++;
    }

    return formatted;
  }

  /**
   * Extração genérica otimizada de campo
   */
  extractField(linha, startPos, endPos, type = 'string') {
    try {
      this.stats.totalExtractions++;

      if (!this.validatePositions(startPos, endPos, linha)) {
        return {
          success: false,
          error: 'Posições inválidas',
          value: null
        };
      }

      const rawValue = linha.slice(startPos, endPos);
      let processedValue;

      switch (type) {
        case 'monetary':
          const monetaryResult = this.extractMonetaryValue(linha, startPos, endPos);
          return monetaryResult;

        case 'date':
          const dateResult = this.extractDate(linha, startPos, endPos);
          return dateResult;

        case 'numeric':
          processedValue = parseInt(rawValue, 10) || 0;
          break;

        case 'string':
        default:
          processedValue = this.sanitizeString(rawValue);
          break;
      }

      return {
        success: true,
        value: processedValue,
        position: { start: startPos, end: endPos }
      };

    } catch (error) {
      return {
        success: false,
        error: `Erro ao extrair campo: ${error.message}`,
        value: null
      };
    }
  }

  /**
   * ✨ NOVO: Obter estatísticas de performance
   */
  getPerformanceStats() {
    const cacheEfficiency = this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100;

    return {
      totalExtractions: this.stats.totalExtractions,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheEfficiency: `${cacheEfficiency.toFixed(2)}%`,
      batchesProcessed: this.stats.batchProcessed,
      cacheSize: this.cache.size,
      validationCacheSize: this.validationCache.size
    };
  }

  /**
   * ✨ NOVO: Limpar cache (útil para liberar memória)
   */
  clearCache() {
    this.cache.clear();
    this.validationCache.clear();
    this.debug('Cache limpo');
  }

  /**
   * ✨ NOVO: Resetar estatísticas
   */
  resetStats() {
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalExtractions: 0,
      batchProcessed: 0
    };
    this.debug('Estatísticas resetadas');
  }
}

export default PositionalExtractor; 