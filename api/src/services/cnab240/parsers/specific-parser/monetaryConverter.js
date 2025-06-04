/**
 * Conversor Monetário Robusto CNAB240
 * 
 * Sistema avançado de conversão monetária que lida com:
 * - Valores em centavos (formato padrão CNAB)
 * - Diferentes formatos de entrada
 * - Validações e tratamento de erros
 * - Formatação específica para o padrão brasileiro
 */

export class MonetaryConverter {
  constructor() {
    this.options = {
      // Configurações padrão
      inputFormat: 'centavos', // 'centavos' | 'decimal' | 'auto'
      outputFormat: 'decimal',  // 'decimal' | 'centavos' | 'formatted'
      precision: 2,
      validateRange: true,
      maxValue: 99999999.99, // Valor máximo permitido em reais
      minValue: 0.01         // Valor mínimo permitido em reais
    };

    this.stats = {
      conversionsCount: 0,
      errorsCount: 0,
      invalidValues: 0,
      zeroValues: 0
    };
  }

  /**
   * Converte valor do formato CNAB para decimal
   * @param {string|number} value - Valor de entrada
   * @param {Object} options - Opções específicas de conversão
   * @returns {number} Valor convertido em decimal
   */
  async convertValue(value, options = {}) {
    try {
      this.stats.conversionsCount++;

      // Combinar opções
      const config = { ...this.options, ...options };

      // Detectar e limpar valor
      const cleanedValue = this._cleanValue(value);

      if (cleanedValue === null) {
        this.stats.invalidValues++;
        return 0;
      }

      // Detectar formato automaticamente se necessário
      const format = config.inputFormat === 'auto'
        ? this._detectFormat(cleanedValue, value)
        : config.inputFormat;

      // Converter baseado no formato detectado
      let decimalValue;

      switch (format) {
        case 'centavos':
          decimalValue = this._fromCentavos(cleanedValue);
          break;
        case 'decimal':
          decimalValue = this._fromDecimal(cleanedValue);
          break;
        default:
          decimalValue = this._fromCentavos(cleanedValue); // Padrão CNAB
      }

      // Aplicar precisão
      decimalValue = this._applyPrecision(decimalValue, config.precision);

      // Validar valor
      if (config.validateRange && !this._isValueInRange(decimalValue, config)) {
        console.warn(`Valor fora do range permitido: ${decimalValue}`);
        this.stats.invalidValues++;
      }

      // Registrar valores zero
      if (decimalValue === 0) {
        this.stats.zeroValues++;
      }

      return decimalValue;

    } catch (error) {
      this.stats.errorsCount++;
      console.error('Erro na conversão monetária:', error);
      return 0;
    }
  }

  /**
   * Converte múltiplos valores em lote
   * @param {Array} values - Array de valores para converter
   * @returns {Array} Array de valores convertidos
   */
  async convertBatch(values, options = {}) {
    const results = [];

    for (const value of values) {
      const converted = await this.convertValue(value, options);
      results.push(converted);
    }

    return results;
  }

  /**
   * Formata valor para display
   * @param {number} value - Valor decimal
   * @param {string} format - Formato de saída ('currency' | 'decimal' | 'centavos')
   * @returns {string} Valor formatado
   */
  formatValue(value, format = 'currency') {
    if (typeof value !== 'number' || isNaN(value)) {
      return 'R$ 0,00';
    }

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);

      case 'decimal':
        return value.toFixed(2).replace('.', ',');

      case 'centavos':
        return Math.round(value * 100).toString();

      default:
        return value.toString();
    }
  }

  /**
   * Limpa e valida valor de entrada
   * @private
   */
  _cleanValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Se já é número
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    // Limpar string
    const cleaned = value.toString()
      .trim()
      .replace(/[^\d,.-]/g, '') // Remove caracteres não numéricos exceto vírgula, ponto e hífen
      .replace(/^-/, '');        // Remove sinal negativo (valores CNAB são sempre positivos)

    if (cleaned === '') {
      return null;
    }

    // Converter para número
    const numericValue = parseFloat(cleaned.replace(',', '.'));

    return isNaN(numericValue) ? null : numericValue;
  }

  /**
   * Detecta formato do valor automaticamente
   * @private
   */
  _detectFormat(cleanedValue, originalValue) {
    // Se o valor original é string e tem mais de 2 dígitos sem separador decimal
    if (typeof originalValue === 'string' &&
      cleanedValue >= 100 &&
      !originalValue.includes('.') &&
      !originalValue.includes(',')) {
      return 'centavos';
    }

    // Se valor é muito grande (provavelmente centavos)
    if (cleanedValue >= 1000) {
      return 'centavos';
    }

    // Caso contrário, assumir decimal
    return 'decimal';
  }

  /**
   * Converte de centavos para decimal
   * @private
   */
  _fromCentavos(value) {
    return value / 100;
  }

  /**
   * Mantém valor decimal
   * @private
   */
  _fromDecimal(value) {
    return value;
  }

  /**
   * Aplica precisão ao valor
   * @private
   */
  _applyPrecision(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Valida se valor está dentro do range permitido
   * @private
   */
  _isValueInRange(value, config) {
    return value >= config.minValue && value <= config.maxValue;
  }

  /**
   * Converte valor decimal para centavos
   */
  toCentavos(decimalValue) {
    if (typeof decimalValue !== 'number' || isNaN(decimalValue)) {
      return 0;
    }

    return Math.round(decimalValue * 100);
  }

  /**
   * Valida se valor monetário é válido
   */
  isValidValue(value) {
    const converted = this._cleanValue(value);
    return converted !== null &&
      converted >= this.options.minValue &&
      converted <= this.options.maxValue;
  }

  /**
   * Compara dois valores monetários com tolerância
   */
  compareValues(value1, value2, tolerance = 0.01) {
    const diff = Math.abs(value1 - value2);
    return diff <= tolerance;
  }

  /**
   * Soma array de valores monetários
   */
  sumValues(values) {
    return values.reduce((sum, value) => {
      const converted = typeof value === 'number' ? value : this._cleanValue(value) || 0;
      return sum + converted;
    }, 0);
  }

  /**
   * Calcula estatísticas de um array de valores
   */
  calculateStats(values) {
    const validValues = values
      .map(v => this._cleanValue(v))
      .filter(v => v !== null);

    if (validValues.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0
      };
    }

    return {
      count: validValues.length,
      sum: this.sumValues(validValues),
      average: this.sumValues(validValues) / validValues.length,
      min: Math.min(...validValues),
      max: Math.max(...validValues)
    };
  }

  /**
   * Obtém estatísticas de conversão
   */
  getConversionStats() {
    return {
      ...this.stats,
      successRate: this.stats.conversionsCount > 0
        ? ((this.stats.conversionsCount - this.stats.errorsCount) / this.stats.conversionsCount) * 100
        : 0
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      conversionsCount: 0,
      errorsCount: 0,
      invalidValues: 0,
      zeroValues: 0
    };
  }

  /**
   * Atualiza configurações do conversor
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Obtém configurações atuais
   */
  getOptions() {
    return { ...this.options };
  }
}

export default MonetaryConverter; 