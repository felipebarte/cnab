/**
 * FieldExtractor - Extrator de Campos CNAB
 * 
 * Extrai e converte campos de registros CNAB baseado em schemas YAML.
 * Características:
 * - Conversão automática de tipos (numérico, data, texto)
 * - Aplicação de Picture formats (9, X, V)
 * - Processamento de valores padrão
 * - Validação de posições e tamanhos
 * - Tratamento de valores decimais implícitos
 */

export class FieldExtractor {
  constructor(config = {}) {
    this.config = {
      enableTypeConversion: true,
      trimFields: true,
      applyDefaults: true,
      validatePositions: true,
      strictMode: false,
      ...config
    };
  }

  /**
   * Extrai todos os campos de uma linha baseado no schema
   * @param {string} line - Linha do arquivo CNAB
   * @param {Object} schema - Schema YAML do registro
   * @param {Object} config - Configurações específicas
   * @returns {Object} Campos extraídos e convertidos
   */
  async extractFields(line, schema, config = {}) {
    const extractConfig = { ...this.config, ...config };
    const extractedFields = {};

    if (!schema || typeof schema !== 'object') {
      return extractedFields;
    }

    // Extrair cada campo definido no schema
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      try {
        const value = await this._extractField(
          line,
          fieldName,
          fieldSchema,
          extractConfig
        );

        if (value !== null && value !== undefined) {
          extractedFields[fieldName] = value;
        }

      } catch (error) {
        if (extractConfig.strictMode) {
          throw new Error(`Erro ao extrair campo '${fieldName}': ${error.message}`);
        } else {
          // Em modo não-estrito, apenas registra o erro e continua
          console.warn(`⚠️  Erro ao extrair campo '${fieldName}': ${error.message}`);
          extractedFields[fieldName] = null;
        }
      }
    }

    return extractedFields;
  }

  /**
   * Extrai um campo específico
   * @param {string} line - Linha do arquivo
   * @param {string} fieldName - Nome do campo
   * @param {Object} fieldSchema - Schema do campo
   * @param {Object} config - Configurações
   * @returns {*} Valor extraído e convertido
   */
  async _extractField(line, fieldName, fieldSchema, config) {
    // Verificar se o schema é válido
    if (!fieldSchema || !fieldSchema.pos) {
      if (config.applyDefaults && fieldSchema.default !== undefined) {
        return this._convertValue(fieldSchema.default, fieldSchema, config);
      }
      return null;
    }

    // Extrair posições [início, fim]
    const [startPos, endPos] = fieldSchema.pos;

    // Converter para índices baseados em zero
    const startIndex = startPos - 1;
    const endIndex = endPos;

    // Validar posições
    if (config.validatePositions) {
      if (startIndex < 0 || endIndex > line.length) {
        throw new Error(
          `Posições inválidas para campo '${fieldName}': [${startPos}, ${endPos}] em linha de ${line.length} caracteres`
        );
      }
    }

    // Extrair valor bruto
    let rawValue = '';
    if (startIndex < line.length && endIndex <= line.length) {
      rawValue = line.substring(startIndex, endIndex);
    }

    // Aplicar trim se configurado
    if (config.trimFields) {
      rawValue = rawValue.trim();
    }

    // Se valor está vazio, aplicar valor padrão
    if (!rawValue && config.applyDefaults && fieldSchema.default !== undefined) {
      rawValue = fieldSchema.default;
    }

    // Converter valor baseado no tipo/picture
    return this._convertValue(rawValue, fieldSchema, config);
  }

  /**
   * Converte valor baseado no picture format e tipo
   * @param {string} rawValue - Valor bruto extraído
   * @param {Object} fieldSchema - Schema do campo
   * @param {Object} config - Configurações
   * @returns {*} Valor convertido
   */
  _convertValue(rawValue, fieldSchema, config) {
    if (!config.enableTypeConversion) {
      return rawValue;
    }

    const picture = fieldSchema.picture;

    if (!picture) {
      return rawValue;
    }

    try {
      // Parsear picture format
      const pictureInfo = this._parsePictureFormat(picture);

      switch (pictureInfo.type) {
      case 'numeric':
        return this._convertNumericValue(rawValue, pictureInfo, fieldSchema);

      case 'alphanumeric':
        return this._convertAlphanumericValue(rawValue, pictureInfo, fieldSchema);

      case 'decimal':
        return this._convertDecimalValue(rawValue, pictureInfo, fieldSchema);

      default:
        return rawValue;
      }

    } catch (error) {
      if (config.strictMode) {
        throw error;
      }
      return rawValue;
    }
  }

  /**
   * Parseia formato Picture (ex: 9(5), X(40), 9(11)V9(2))
   * @param {string} picture - String do picture format
   * @returns {Object} Informações do picture parseado
   */
  _parsePictureFormat(picture) {
    const result = {
      type: 'alphanumeric',
      length: 0,
      decimals: 0,
      originalFormat: picture
    };

    // Padrões de picture
    const patterns = {
      // 9(5) - Numérico
      numeric: /^9\((\d+)\)$/,
      // X(40) - Alfanumérico  
      alphanumeric: /^X\((\d+)\)$/,
      // 9(11)V9(2) - Decimal com casas implícitas
      decimal: /^9\((\d+)\)V9\((\d+)\)$/,
      // 9V9(2) - Decimal simples
      decimalSimple: /^9V9\((\d+)\)$/
    };

    if (patterns.numeric.test(picture)) {
      const match = picture.match(patterns.numeric);
      result.type = 'numeric';
      result.length = parseInt(match[1]);

    } else if (patterns.alphanumeric.test(picture)) {
      const match = picture.match(patterns.alphanumeric);
      result.type = 'alphanumeric';
      result.length = parseInt(match[1]);

    } else if (patterns.decimal.test(picture)) {
      const match = picture.match(patterns.decimal);
      result.type = 'decimal';
      result.length = parseInt(match[1]);
      result.decimals = parseInt(match[2]);

    } else if (patterns.decimalSimple.test(picture)) {
      const match = picture.match(patterns.decimalSimple);
      result.type = 'decimal';
      result.length = 1;
      result.decimals = parseInt(match[1]);

    } else {
      // Fallback para formatos não reconhecidos
      result.type = 'alphanumeric';
      result.length = picture.length;
    }

    return result;
  }

  /**
   * Converte valor numérico
   */
  _convertNumericValue(rawValue, pictureInfo, fieldSchema) {
    if (!rawValue || rawValue.trim() === '') {
      return 0;
    }

    // Remover leading zeros e converter para número
    const numericValue = parseInt(rawValue.replace(/^0+/, '') || '0', 10);

    if (isNaN(numericValue)) {
      throw new Error(`Valor numérico inválido: '${rawValue}' para picture ${pictureInfo.originalFormat}`);
    }

    return numericValue;
  }

  /**
   * Converte valor alfanumérico
   */
  _convertAlphanumericValue(rawValue, pictureInfo, fieldSchema) {
    // Para campos alfanuméricos, apenas retornar a string
    return rawValue || '';
  }

  /**
   * Converte valor decimal com casas implícitas
   */
  _convertDecimalValue(rawValue, pictureInfo, fieldSchema) {
    if (!rawValue || rawValue.trim() === '') {
      return 0.0;
    }

    // Remover leading zeros
    const cleanValue = rawValue.replace(/^0+/, '') || '0';

    // Converter para número inteiro primeiro
    const intValue = parseInt(cleanValue, 10);

    if (isNaN(intValue)) {
      throw new Error(`Valor decimal inválido: '${rawValue}' para picture ${pictureInfo.originalFormat}`);
    }

    // Aplicar casas decimais implícitas
    const decimalValue = intValue / Math.pow(10, pictureInfo.decimals);

    return parseFloat(decimalValue.toFixed(pictureInfo.decimals));
  }

  /**
   * Converte data baseada em formatos comuns CNAB
   * @param {string} rawValue - Valor bruto da data
   * @param {string} format - Formato esperado (%d%m%Y, %d%m%y, etc.)
   * @returns {string|Date} Data convertida
   */
  convertDate(rawValue, format = '%d%m%Y') {
    if (!rawValue || rawValue.trim() === '' || rawValue === '00000000' || rawValue === '000000') {
      return null;
    }

    try {
      let day, month, year;

      switch (format) {
      case '%d%m%Y': // ddmmaaaa
        if (rawValue.length === 8) {
          day = parseInt(rawValue.substr(0, 2));
          month = parseInt(rawValue.substr(2, 2));
          year = parseInt(rawValue.substr(4, 4));
        }
        break;

      case '%d%m%y': // ddmmaa
        if (rawValue.length === 6) {
          day = parseInt(rawValue.substr(0, 2));
          month = parseInt(rawValue.substr(2, 2));
          year = parseInt(rawValue.substr(4, 2));
          // Assumir século 20xx se ano < 50, senão 19xx
          year += year < 50 ? 2000 : 1900;
        }
        break;

      case '%Y%m%d': // aaaammdd
        if (rawValue.length === 8) {
          year = parseInt(rawValue.substr(0, 4));
          month = parseInt(rawValue.substr(4, 2));
          day = parseInt(rawValue.substr(6, 2));
        }
        break;

      case '%y%m%d': // aammdd
        if (rawValue.length === 6) {
          year = parseInt(rawValue.substr(0, 2));
          month = parseInt(rawValue.substr(2, 2));
          day = parseInt(rawValue.substr(4, 2));
          year += year < 50 ? 2000 : 1900;
        }
        break;

      default:
        return rawValue; // Retornar string se formato não reconhecido
      }

      // Validar data
      if (day && month && year && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const date = new Date(year, month - 1, day);

        // Verificar se a data é válida (não teve overflow)
        if (date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year) {
          return date.toISOString().split('T')[0]; // Retornar como string YYYY-MM-DD
        }
      }

      return rawValue; // Retornar valor original se não conseguir converter

    } catch (error) {
      return rawValue;
    }
  }

  /**
   * Obtém informações sobre o extrator
   */
  getExtractorInfo() {
    return {
      version: '1.0.0',
      configuration: this.config,
      supportedPictureFormats: [
        '9(n) - Numérico',
        'X(n) - Alfanumérico',
        '9(n)V9(m) - Decimal com casas implícitas',
        '9V9(m) - Decimal simples'
      ],
      supportedDateFormats: [
        '%d%m%Y - dd/mm/aaaa',
        '%d%m%y - dd/mm/aa',
        '%Y%m%d - aaaa/mm/dd',
        '%y%m%d - aa/mm/dd'
      ]
    };
  }
}

export default FieldExtractor; 