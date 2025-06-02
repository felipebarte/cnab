/**
 * FieldValidator - Validador de Campos CNAB
 * 
 * Responsável por validar campos individuais baseados em schemas YAML:
 * - Formato Picture (9, X, V para decimais)
 * - Obrigatoriedade de campos
 * - Valores padrão e permitidos
 * - Formatos de data e hora
 * - Validações numéricas e alfanuméricas
 */

/**
 * Validador de campos para arquivos CNAB
 */
export class FieldValidator {
  constructor(config = {}) {
    this.config = config;

    // Expressões regulares para formatos Picture
    this.picturePatterns = {
      numeric: /^9+(\((\d+)\))?$/,           // 9(5) = 5 dígitos numéricos
      alphanumeric: /^X+(\((\d+)\))?$/,      // X(40) = 40 caracteres alfanuméricos
      decimal: /^9+(\((\d+)\))?V9+(\((\d+)\))?$/, // 9(11)V9(2) = decimal com 2 casas
      date: /^9+(\((\d+)\))?$/               // Datas são numéricas
    };

    // Formatos de data suportados
    this.dateFormats = {
      '%d%m%Y': { length: 8, regex: /^(\d{2})(\d{2})(\d{4})$/ },
      '%d%m%y': { length: 6, regex: /^(\d{2})(\d{2})(\d{2})$/ },
      '%Y%m%d': { length: 8, regex: /^(\d{4})(\d{2})(\d{2})$/ },
      '%y%m%d': { length: 6, regex: /^(\d{2})(\d{2})(\d{2})$/ }
    };
  }

  /**
   * Valida todos os campos de uma linha usando schema
   */
  async validateLine(line, lineNumber, schema, detection, result) {
    if (!schema) {
      result.addWarning(`Linha ${lineNumber}: schema não encontrado para validação de campos`, lineNumber);
      return;
    }

    try {
      // Validar cada campo definido no schema
      for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        // Pular metadados
        if (fieldName.startsWith('_')) continue;

        await this._validateField(line, lineNumber, fieldName, fieldSchema, result);
      }

    } catch (error) {
      result.addError(`Erro na validação de campos da linha ${lineNumber}: ${error.message}`, lineNumber);
    }
  }

  /**
   * Valida um campo específico
   */
  validateField(value, fieldSchema, fieldName) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      value: value,
      formattedValue: null
    };

    try {
      // Extrair valor do campo
      const fieldValue = this._extractFieldValue(value, fieldSchema);

      // Validar formato Picture
      const pictureValidation = this._validatePictureFormat(fieldValue, fieldSchema, fieldName);
      if (!pictureValidation.valid) {
        result.valid = false;
        result.errors.push(...pictureValidation.errors);
      }

      // Validar obrigatoriedade
      const requiredValidation = this._validateRequired(fieldValue, fieldSchema, fieldName);
      if (!requiredValidation.valid) {
        result.valid = false;
        result.errors.push(...requiredValidation.errors);
      }

      // Validar formato de data (se aplicável)
      if (fieldSchema.date_format) {
        const dateValidation = this._validateDateFormat(fieldValue, fieldSchema, fieldName);
        if (!dateValidation.valid) {
          result.valid = false;
          result.errors.push(...dateValidation.errors);
        } else {
          result.formattedValue = dateValidation.formattedValue;
        }
      }

      // Validar valores específicos
      if (fieldSchema.valid_values) {
        const valueValidation = this._validateAllowedValues(fieldValue, fieldSchema, fieldName);
        if (!valueValidation.valid) {
          result.valid = false;
          result.errors.push(...valueValidation.errors);
        }
      }

      return result;

    } catch (error) {
      result.valid = false;
      result.errors.push(`Erro na validação do campo ${fieldName}: ${error.message}`);
      return result;
    }
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Valida um campo específico de uma linha
   */
  async _validateField(line, lineNumber, fieldName, fieldSchema, result) {
    if (!fieldSchema.pos || !fieldSchema.picture) {
      result.addWarning(
        `Linha ${lineNumber}: schema incompleto para campo ${fieldName}`,
        lineNumber,
        fieldName
      );
      return;
    }

    // Extrair valor do campo da linha
    const fieldValue = this._extractFieldValueFromLine(line, fieldSchema);

    // Validar usando validateField
    const fieldValidation = this.validateField(fieldValue, fieldSchema, fieldName);

    // Adicionar resultados
    if (!fieldValidation.valid) {
      for (const error of fieldValidation.errors) {
        result.addError(`Linha ${lineNumber}, campo ${fieldName}: ${error}`, lineNumber, fieldName);
      }
    }

    for (const warning of fieldValidation.warnings) {
      result.addWarning(`Linha ${lineNumber}, campo ${fieldName}: ${warning}`, lineNumber, fieldName);
    }

    // Adicionar validação de campo
    result.addFieldValidation(fieldName, fieldValidation);
  }

  /**
   * Extrai valor do campo da linha
   */
  _extractFieldValueFromLine(line, fieldSchema) {
    const [start, end] = fieldSchema.pos;

    // Posições no schema são 1-indexed, ajustar para 0-indexed
    const startPos = start - 1;
    const endPos = end;

    if (startPos < 0 || endPos > line.length) {
      throw new Error(`Posição do campo fora dos limites da linha (${start}-${end}, linha tem ${line.length} chars)`);
    }

    return line.substring(startPos, endPos);
  }

  /**
   * Extrai valor do campo (genérico)
   */
  _extractFieldValue(value, fieldSchema) {
    // Se value já é a string do campo, retorna direto
    if (typeof value === 'string') {
      return value;
    }

    // Se value é um objeto com os dados da linha, extrai o campo
    if (value.line && fieldSchema.pos) {
      return this._extractFieldValueFromLine(value.line, fieldSchema);
    }

    return String(value);
  }

  /**
   * Valida formato Picture
   */
  _validatePictureFormat(fieldValue, fieldSchema, fieldName) {
    const result = { valid: true, errors: [] };
    const picture = fieldSchema.picture;

    try {
      // Analisar formato Picture
      const pictureInfo = this._parsePictureFormat(picture);

      // Validar tamanho
      if (pictureInfo.expectedLength && fieldValue.length !== pictureInfo.expectedLength) {
        result.valid = false;
        result.errors.push(
          `tamanho incorreto ${fieldValue.length}, esperado ${pictureInfo.expectedLength} (formato ${picture})`
        );
      }

      // Validar tipo de dados
      if (pictureInfo.type === 'numeric') {
        if (!/^\d*$/.test(fieldValue.replace(/^0+/, '') || '0')) {
          result.valid = false;
          result.errors.push(`deve conter apenas dígitos numéricos (formato ${picture})`);
        }
      } else if (pictureInfo.type === 'decimal') {
        // Para decimais com V, validar como numérico
        if (!/^\d*$/.test(fieldValue)) {
          result.valid = false;
          result.errors.push(`deve conter apenas dígitos para decimal (formato ${picture})`);
        }
      }
      // Para alphanumeric (X), aceitar qualquer caractere

      return result;

    } catch (error) {
      result.valid = false;
      result.errors.push(`erro no formato Picture ${picture}: ${error.message}`);
      return result;
    }
  }

  /**
   * Parseia formato Picture
   */
  _parsePictureFormat(picture) {
    const info = {
      type: 'unknown',
      expectedLength: null,
      integerPart: null,
      decimalPart: null
    };

    // Numérico simples: 9(5) ou 9999
    const numericMatch = picture.match(/^9+(\((\d+)\))?$/);
    if (numericMatch) {
      info.type = 'numeric';
      info.expectedLength = numericMatch[2] ? parseInt(numericMatch[2]) : picture.length;
      return info;
    }

    // Alfanumérico: X(40) ou XXX
    const alphanumericMatch = picture.match(/^X+(\((\d+)\))?$/);
    if (alphanumericMatch) {
      info.type = 'alphanumeric';
      info.expectedLength = alphanumericMatch[2] ? parseInt(alphanumericMatch[2]) : picture.length;
      return info;
    }

    // Decimal: 9(11)V9(2) ou 999V99
    const decimalMatch = picture.match(/^9+(\((\d+)\))?V9+(\((\d+)\))?$/);
    if (decimalMatch) {
      info.type = 'decimal';
      const integerPart = decimalMatch[2] ? parseInt(decimalMatch[2]) : picture.indexOf('V');
      const decimalPart = decimalMatch[4] ? parseInt(decimalMatch[4]) : (picture.length - picture.indexOf('V') - 1);

      info.integerPart = integerPart;
      info.decimalPart = decimalPart;
      info.expectedLength = integerPart + decimalPart; // V não conta no tamanho
      return info;
    }

    throw new Error(`Formato Picture não reconhecido: ${picture}`);
  }

  /**
   * Valida obrigatoriedade
   */
  _validateRequired(fieldValue, fieldSchema, fieldName) {
    const result = { valid: true, errors: [] };

    // Se campo tem default, não é obrigatório ter valor
    if (fieldSchema.default !== undefined) {
      return result;
    }

    // Se campo está vazio e não tem default
    if (!fieldValue || fieldValue.trim() === '') {
      // Verificar se o schema indica que o campo é obrigatório
      if (fieldSchema.required === true) {
        result.valid = false;
        result.errors.push('campo obrigatório está vazio');
      }
    }

    return result;
  }

  /**
   * Valida formato de data
   */
  _validateDateFormat(fieldValue, fieldSchema, fieldName) {
    const result = { valid: true, errors: [], formattedValue: null };
    const dateFormat = fieldSchema.date_format;

    if (!this.dateFormats[dateFormat]) {
      result.valid = false;
      result.errors.push(`formato de data não suportado: ${dateFormat}`);
      return result;
    }

    const formatInfo = this.dateFormats[dateFormat];

    // Verificar tamanho
    if (fieldValue.length !== formatInfo.length) {
      result.valid = false;
      result.errors.push(
        `data com tamanho incorreto ${fieldValue.length}, esperado ${formatInfo.length} para formato ${dateFormat}`
      );
      return result;
    }

    // Verificar se é numérico
    if (!/^\d+$/.test(fieldValue)) {
      result.valid = false;
      result.errors.push(`data deve conter apenas dígitos`);
      return result;
    }

    // Verificar se é uma data válida
    try {
      const dateValidation = this._parseAndValidateDate(fieldValue, dateFormat);
      if (!dateValidation.valid) {
        result.valid = false;
        result.errors.push(...dateValidation.errors);
      } else {
        result.formattedValue = dateValidation.formattedDate;
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`erro na validação de data: ${error.message}`);
    }

    return result;
  }

  /**
   * Parseia e valida data
   */
  _parseAndValidateDate(dateValue, dateFormat) {
    const result = { valid: true, errors: [], formattedDate: null };

    try {
      let day, month, year;

      switch (dateFormat) {
        case '%d%m%Y':
          day = parseInt(dateValue.substring(0, 2));
          month = parseInt(dateValue.substring(2, 4));
          year = parseInt(dateValue.substring(4, 8));
          break;

        case '%d%m%y':
          day = parseInt(dateValue.substring(0, 2));
          month = parseInt(dateValue.substring(2, 4));
          year = parseInt(dateValue.substring(4, 6));
          // Assumir século 20xx para anos 00-50, 19xx para 51-99
          year = year <= 50 ? 2000 + year : 1900 + year;
          break;

        case '%Y%m%d':
          year = parseInt(dateValue.substring(0, 4));
          month = parseInt(dateValue.substring(4, 6));
          day = parseInt(dateValue.substring(6, 8));
          break;

        case '%y%m%d':
          year = parseInt(dateValue.substring(0, 2));
          year = year <= 50 ? 2000 + year : 1900 + year;
          month = parseInt(dateValue.substring(2, 4));
          day = parseInt(dateValue.substring(4, 6));
          break;
      }

      // Validar faixas básicas
      if (month < 1 || month > 12) {
        result.valid = false;
        result.errors.push(`mês inválido: ${month}`);
      }

      if (day < 1 || day > 31) {
        result.valid = false;
        result.errors.push(`dia inválido: ${day}`);
      }

      if (year < 1900 || year > 2100) {
        result.valid = false;
        result.errors.push(`ano inválido: ${year}`);
      }

      // Tentar criar objeto Date para validação adicional
      if (result.valid) {
        const dateObj = new Date(year, month - 1, day);

        if (dateObj.getFullYear() !== year ||
          dateObj.getMonth() !== month - 1 ||
          dateObj.getDate() !== day) {
          result.valid = false;
          result.errors.push(`data inválida: ${day}/${month}/${year}`);
        } else {
          result.formattedDate = dateObj.toISOString().split('T')[0];
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`erro ao processar data: ${error.message}`);
    }

    return result;
  }

  /**
   * Valida valores permitidos
   */
  _validateAllowedValues(fieldValue, fieldSchema, fieldName) {
    const result = { valid: true, errors: [] };

    if (!fieldSchema.valid_values || !Array.isArray(fieldSchema.valid_values)) {
      return result;
    }

    const allowedValues = fieldSchema.valid_values;

    if (!allowedValues.includes(fieldValue)) {
      result.valid = false;
      result.errors.push(
        `valor '${fieldValue}' não permitido. Valores válidos: ${allowedValues.join(', ')}`
      );
    }

    return result;
  }
}

export default FieldValidator; 