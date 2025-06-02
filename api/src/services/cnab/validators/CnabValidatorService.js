/**
 * CnabValidatorService - Sistema de Validação Universal CNAB
 * 
 * Implementa validação completa de arquivos CNAB baseada em schemas YAML.
 * Utiliza Decorator Pattern para combinar diferentes tipos de validação:
 * - Estrutural (tamanho de linhas, posicionamento)
 * - Campos (formatos, obrigatoriedade)
 * - Integridade (checksums, totalizadores)
 * - Regras de Negócio (datas, valores, códigos)
 */

import CnabSchemaLoader from '../schemas/CnabSchemaLoader.js';
import { StructuralValidator } from './StructuralValidator.js';
import { FieldValidator } from './FieldValidator.js';
import { IntegrityValidator } from './IntegrityValidator.js';
import { BusinessRuleValidator } from './BusinessRuleValidator.js';

/**
 * Resultado padronizado de validação
 */
export class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.fieldValidations = {};
    this.summary = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 0
    };
    this.performance = {
      startTime: Date.now(),
      endTime: null,
      durationMs: null
    };
  }

  addError(error, lineNumber = null, fieldName = null) {
    this.valid = false;
    this.errors.push({
      message: error,
      line: lineNumber,
      field: fieldName,
      type: 'error',
      timestamp: new Date().toISOString()
    });
    this.summary.failedChecks++;
  }

  addWarning(warning, lineNumber = null, fieldName = null) {
    this.warnings.push({
      message: warning,
      line: lineNumber,
      field: fieldName,
      type: 'warning',
      timestamp: new Date().toISOString()
    });
    this.summary.warningChecks++;
  }

  addFieldValidation(fieldName, validation) {
    this.fieldValidations[fieldName] = validation;
    this.summary.totalChecks++;

    if (validation.valid) {
      this.summary.passedChecks++;
    } else {
      this.summary.failedChecks++;
      this.valid = false;
    }
  }

  finalize() {
    this.performance.endTime = Date.now();
    this.performance.durationMs = this.performance.endTime - this.performance.startTime;

    return {
      valid: this.valid,
      errors: this.errors,
      warnings: this.warnings,
      fieldValidations: this.fieldValidations,
      summary: this.summary,
      performance: this.performance
    };
  }
}

/**
 * Serviço principal de validação CNAB
 */
export class CnabValidatorService {
  constructor(config = {}) {
    this.config = {
      enableStructuralValidation: true,
      enableFieldValidation: true,
      enableIntegrityValidation: true,
      enableBusinessRuleValidation: true,
      strictMode: false, // Se true, warnings se tornam errors
      maxErrorsPerLine: 10,
      enablePerformanceLogging: false,
      ...config
    };

    this.schemaLoader = new CnabSchemaLoader(this.config);
    this.initialized = false;

    // Estatísticas de validação
    this.stats = {
      validationsPerformed: 0,
      filesValidated: 0,
      errorsFound: 0,
      warningsFound: 0,
      performance: {
        avgValidationTime: 0,
        totalValidationTime: 0
      }
    };

    // Cache de validators
    this.validatorCache = new Map();
  }

  /**
   * Inicializa o serviço de validação
   */
  async initialize() {
    if (this.initialized) {
      return this.getSystemInfo();
    }

    try {
      console.log('🔧 Inicializando CnabValidatorService...');

      // Inicializar schema loader
      await this.schemaLoader.initialize();

      this.initialized = true;
      console.log('✅ CnabValidatorService inicializado com sucesso!');

      return this.getSystemInfo();

    } catch (error) {
      console.error('❌ Erro na inicialização do CnabValidatorService:', error);
      throw error;
    }
  }

  /**
   * Valida um arquivo CNAB completo
   * @param {string} content - Conteúdo do arquivo CNAB
   * @param {Object} detection - Resultado da detecção (formato, banco)
   * @param {Object} options - Opções de validação
   * @returns {ValidationResult} Resultado da validação
   */
  async validateFile(content, detection, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.validationsPerformed++;
      this.stats.filesValidated++;

      const result = new ValidationResult();
      const config = { ...this.config, ...options };

      // Dividir conteúdo em linhas
      const lines = this._parseLines(content);

      if (lines.length === 0) {
        result.addError('Arquivo vazio ou sem linhas válidas');
        return result.finalize();
      }

      // Carregar schemas necessários para validação
      const schemas = await this._loadSchemasForValidation(detection, lines);

      // Aplicar validações usando Decorator Pattern
      await this._applyValidations(lines, schemas, detection, config, result);

      // Atualizar estatísticas
      this._updateStats(result, Date.now() - startTime);

      return result.finalize();

    } catch (error) {
      const result = new ValidationResult();
      result.addError(`Erro interno na validação: ${error.message}`);
      return result.finalize();
    }
  }

  /**
   * Valida uma linha específica
   */
  async validateLine(line, lineNumber, schema, detection, options = {}) {
    const result = new ValidationResult();
    const config = { ...this.config, ...options };

    try {
      // Validação estrutural da linha
      if (config.enableStructuralValidation) {
        const structuralValidator = this._getValidator('structural');
        await structuralValidator.validateLine(line, lineNumber, schema, detection, result);
      }

      // Validação de campos
      if (config.enableFieldValidation) {
        const fieldValidator = this._getValidator('field');
        await fieldValidator.validateLine(line, lineNumber, schema, detection, result);
      }

      return result.finalize();

    } catch (error) {
      result.addError(`Erro na validação da linha ${lineNumber}: ${error.message}`, lineNumber);
      return result.finalize();
    }
  }

  /**
   * Valida campos específicos usando schema
   */
  validateField(value, fieldSchema, fieldName) {
    const fieldValidator = this._getValidator('field');
    return fieldValidator.validateField(value, fieldSchema, fieldName);
  }

  /**
   * Obtém informações do sistema
   */
  getSystemInfo() {
    return {
      version: '1.0.0',
      initialized: this.initialized,
      configuration: this.config,
      stats: this.stats,
      validatorTypes: ['structural', 'field', 'integrity', 'business'],
      schemaLoader: this.schemaLoader.getSystemInfo?.() || { initialized: true }
    };
  }

  /**
   * Redefine estatísticas
   */
  resetStats() {
    this.stats = {
      validationsPerformed: 0,
      filesValidated: 0,
      errorsFound: 0,
      warningsFound: 0,
      performance: {
        avgValidationTime: 0,
        totalValidationTime: 0
      }
    };
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Parseia linhas do arquivo
   */
  _parseLines(content) {
    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Carrega schemas necessários para validação
   */
  async _loadSchemasForValidation(detection, lines) {
    const schemas = new Map();

    try {
      // Identificar tipos de registro presentes no arquivo
      const recordTypes = this._identifyRecordTypes(lines, detection);

      // Carregar schema para cada tipo de registro
      for (const recordType of recordTypes) {
        try {
          const schema = await this.schemaLoader.loadSchema(
            detection.bankCode,
            detection.format,
            recordType
          );
          schemas.set(recordType, schema);
        } catch (error) {
          console.warn(`⚠️  Schema ${recordType} não encontrado para ${detection.bankCode}/${detection.format}`);
        }
      }

      return schemas;

    } catch (error) {
      throw new Error(`Erro ao carregar schemas: ${error.message}`);
    }
  }

  /**
   * Identifica tipos de registro no arquivo
   */
  _identifyRecordTypes(lines, detection) {
    const recordTypes = new Set();

    for (const line of lines) {
      const recordType = this._getRecordType(line, detection);
      recordTypes.add(recordType);
    }

    return Array.from(recordTypes);
  }

  /**
   * Determina o tipo de registro de uma linha
   */
  _getRecordType(line, detection) {
    if (detection.format === 'cnab240') {
      const recordTypeChar = line.charAt(7); // 8ª posição
      const segmentChar = line.charAt(13); // 14ª posição para segmentos

      switch (recordTypeChar) {
        case '0': return 'header_arquivo';
        case '1': return 'header_lote';
        case '3':
          // Detalhes têm segmentos
          switch (segmentChar) {
            case 'P': return 'detalhe_segmento_p';
            case 'Q': return 'detalhe_segmento_q';
            case 'R': return 'detalhe_segmento_r';
            case 'T': return 'detalhe_segmento_t';
            default: return 'detalhe';
          }
        case '5': return 'trailer_lote';
        case '9': return 'trailer_arquivo';
        default: return 'unknown';
      }
    } else if (detection.format === 'cnab400') {
      const recordTypeChar = line.charAt(0); // 1ª posição

      switch (recordTypeChar) {
        case '0': return 'header_arquivo';
        case '1': return 'detalhe';
        case '9': return 'trailer_arquivo';
        default: return 'unknown';
      }
    }

    return 'unknown';
  }

  /**
   * Aplica todas as validações usando Decorator Pattern
   */
  async _applyValidations(lines, schemas, detection, config, result) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      const recordType = this._getRecordType(line, detection);
      const schema = schemas.get(recordType);

      // Validação estrutural
      if (config.enableStructuralValidation) {
        const validator = this._getValidator('structural');
        await validator.validateLine(line, lineNumber, schema, detection, result);
      }

      // Validação de campos
      if (config.enableFieldValidation && schema) {
        const validator = this._getValidator('field');
        await validator.validateLine(line, lineNumber, schema, detection, result);
      }

      // Parar se muitos erros por linha
      const lineErrors = result.errors.filter(e => e.line === lineNumber);
      if (lineErrors.length >= config.maxErrorsPerLine) {
        result.addWarning(`Linha ${lineNumber}: Muitos erros, validação interrompida`, lineNumber);
        break;
      }
    }

    // Validação de integridade (arquivo completo)
    if (config.enableIntegrityValidation) {
      const validator = this._getValidator('integrity');
      await validator.validateFile(lines, schemas, detection, result);
    }

    // Validação de regras de negócio
    if (config.enableBusinessRuleValidation) {
      const validator = this._getValidator('business');
      await validator.validateFile(lines, schemas, detection, result);
    }
  }

  /**
   * Obtém ou cria validator específico (Factory Pattern)
   */
  _getValidator(type) {
    if (!this.validatorCache.has(type)) {
      switch (type) {
        case 'structural':
          this.validatorCache.set(type, new StructuralValidator(this.config));
          break;
        case 'field':
          this.validatorCache.set(type, new FieldValidator(this.config));
          break;
        case 'integrity':
          this.validatorCache.set(type, new IntegrityValidator(this.config));
          break;
        case 'business':
          this.validatorCache.set(type, new BusinessRuleValidator(this.config));
          break;
        default:
          throw new Error(`Tipo de validator desconhecido: ${type}`);
      }
    }

    return this.validatorCache.get(type);
  }

  /**
   * Atualiza estatísticas de performance
   */
  _updateStats(result, validationTime) {
    this.stats.errorsFound += result.errors.length;
    this.stats.warningsFound += result.warnings.length;
    this.stats.performance.totalValidationTime += validationTime;
    this.stats.performance.avgValidationTime =
      this.stats.performance.totalValidationTime / this.stats.validationsPerformed;
  }
}

export default CnabValidatorService; 