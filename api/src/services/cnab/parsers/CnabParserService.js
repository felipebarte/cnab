/**
 * CnabParserService - Parser Universal CNAB
 * 
 * Extrai dados estruturados de arquivos CNAB baseado em schemas YAML.
 * Utiliza Strategy Pattern para diferentes formatos:
 * - CNAB240: Parser com suporte a lotes e segmentos
 * - CNAB400: Parser direto de registros
 * 
 * Características:
 * - Otimizado para arquivos grandes (streaming)
 * - Integração com validação opcional
 * - Dados tipados e estruturados
 * - Suporte a todos os bancos do cnab_yaml
 */

import CnabSchemaLoader from '../schemas/CnabSchemaLoader.js';
import { Cnab240Parser } from './Cnab240Parser.js';
import { Cnab400Parser } from './Cnab400Parser.js';
import { ParsedData } from './ParsedData.js';

/**
 * Resultado padronizado de parsing
 */
export class ParseResult {
  constructor() {
    this.success = false;
    this.data = null;
    this.metadata = {
      format: null,
      bankCode: null,
      bankName: null,
      totalLines: 0,
      totalBatches: 0,
      totalRecords: 0,
      processingTime: null,
      validation: null,
      timestamp: new Date().toISOString()
    };
    this.errors = [];
    this.warnings = [];
    this.performance = {
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      memoryUsage: null
    };
  }

  addError(error, lineNumber = null, fieldName = null) {
    this.errors.push({
      message: error,
      line: lineNumber,
      field: fieldName,
      type: 'error',
      timestamp: new Date().toISOString()
    });
  }

  addWarning(warning, lineNumber = null, fieldName = null) {
    this.warnings.push({
      message: warning,
      line: lineNumber,
      field: fieldName,
      type: 'warning',
      timestamp: new Date().toISOString()
    });
  }

  finalize(data) {
    this.performance.endTime = Date.now();
    this.performance.durationMs = this.performance.endTime - this.performance.startTime;
    this.metadata.processingTime = `${this.performance.durationMs}ms`;

    if (process.memoryUsage) {
      this.performance.memoryUsage = process.memoryUsage();
    }

    this.success = this.errors.length === 0;
    this.data = data;

    return {
      success: this.success,
      data: this.data,
      metadata: this.metadata,
      errors: this.errors,
      warnings: this.warnings,
      performance: this.performance
    };
  }
}

/**
 * Serviço principal de parsing CNAB
 */
export class CnabParserService {
  constructor(config = {}) {
    this.config = {
      enableValidation: true,
      streamingMode: true, // Para arquivos grandes
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      chunkSize: 1000, // Linhas por chunk
      includeRawData: false, // Se deve incluir dados brutos
      typeConversion: true, // Converter tipos automaticamente
      strictMode: false, // Se deve falhar em erros menores
      ...config
    };

    this.schemaLoader = new CnabSchemaLoader(this.config);
    this.initialized = false;

    // Estatísticas de parsing
    this.stats = {
      filesProcessed: 0,
      linesProcessed: 0,
      recordsExtracted: 0,
      errorsFound: 0,
      warningsFound: 0,
      performance: {
        avgParsingTime: 0,
        totalParsingTime: 0,
        peakMemoryUsage: 0
      }
    };

    // Cache de parsers
    this.parserCache = new Map();
  }

  /**
   * Inicializa o serviço de parsing
   */
  async initialize() {
    if (this.initialized) {
      return this.getSystemInfo();
    }

    try {
      console.log('🔧 Inicializando CnabParserService...');

      // Inicializar schema loader
      await this.schemaLoader.initialize();

      this.initialized = true;
      console.log('✅ CnabParserService inicializado com sucesso!');

      return this.getSystemInfo();

    } catch (error) {
      console.error('❌ Erro na inicialização do CnabParserService:', error);
      throw error;
    }
  }

  /**
   * Parseia um arquivo CNAB completo
   * @param {string} content - Conteúdo do arquivo CNAB
   * @param {Object} detection - Resultado da detecção (formato, banco)
   * @param {Object} options - Opções de parsing
   * @returns {ParseResult} Resultado do parsing
   */
  async parseFile(content, detection, options = {}) {
    const result = new ParseResult();
    const config = { ...this.config, ...options };

    try {
      this.stats.filesProcessed++;

      // Configurar metadados
      result.metadata.format = detection.format;
      result.metadata.bankCode = detection.bankCode;
      result.metadata.bankName = detection.bankName;

      // Dividir conteúdo em linhas
      const lines = this._parseLines(content);
      result.metadata.totalLines = lines.length;

      if (lines.length === 0) {
        result.addError('Arquivo vazio ou sem linhas válidas');
        return result.finalize(null);
      }

      // Validação opcional
      if (config.enableValidation && this.validator) {
        const validation = await this.validator.validateFile(content, detection, config);
        result.metadata.validation = validation;

        if (!validation.valid && config.strictMode) {
          result.addError('Arquivo falhou na validação em modo estrito');
          return result.finalize(null);
        }
      }

      // Carregar schemas necessários
      const schemas = await this._loadSchemasForParsing(detection, lines);

      // Obter parser específico para o formato
      const parser = this._getParser(detection.format);

      // Executar parsing usando a estratégia apropriada
      const parsedData = await parser.parse(lines, schemas, detection, result, config);

      // Atualizar estatísticas
      this._updateStats(result, lines.length);

      return result.finalize(parsedData);

    } catch (error) {
      result.addError(`Erro interno no parsing: ${error.message}`);
      return result.finalize(null);
    }
  }

  /**
   * Parseia uma linha específica
   */
  async parseLine(line, lineNumber, schema, detection, options = {}) {
    const result = new ParseResult();
    const config = { ...this.config, ...options };

    try {
      const parser = this._getParser(detection.format);
      const parsedLine = await parser.parseLine(line, lineNumber, schema, detection, config);

      return {
        success: true,
        data: parsedLine,
        errors: [],
        warnings: []
      };

    } catch (error) {
      result.addError(`Erro no parsing da linha ${lineNumber}: ${error.message}`, lineNumber);
      return result.finalize(null);
    }
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
      supportedFormats: ['cnab240', 'cnab400'],
      parserTypes: ['streaming', 'batch'],
      schemaLoader: this.schemaLoader.getSystemInfo?.() || { initialized: true }
    };
  }

  /**
   * Redefine estatísticas
   */
  resetStats() {
    this.stats = {
      filesProcessed: 0,
      linesProcessed: 0,
      recordsExtracted: 0,
      errorsFound: 0,
      warningsFound: 0,
      performance: {
        avgParsingTime: 0,
        totalParsingTime: 0,
        peakMemoryUsage: 0
      }
    };
  }

  /**
   * Define validator para integração opcional
   */
  setValidator(validator) {
    this.validator = validator;
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
   * Carrega schemas necessários para parsing
   */
  async _loadSchemasForParsing(detection, lines) {
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
            case 'U': return 'detalhe_segmento_u';
            case 'Y': return 'detalhe_segmento_y';
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
   * Obtém ou cria parser específico (Factory Pattern)
   */
  _getParser(format) {
    if (!this.parserCache.has(format)) {
      switch (format) {
        case 'cnab240':
          this.parserCache.set(format, new Cnab240Parser(this.config));
          break;
        case 'cnab400':
          this.parserCache.set(format, new Cnab400Parser(this.config));
          break;
        default:
          throw new Error(`Formato de parser desconhecido: ${format}`);
      }
    }

    return this.parserCache.get(format);
  }

  /**
   * Atualiza estatísticas de performance
   */
  _updateStats(result, linesCount) {
    this.stats.linesProcessed += linesCount;
    this.stats.errorsFound += result.errors.length;
    this.stats.warningsFound += result.warnings.length;
    this.stats.performance.totalParsingTime += result.performance.durationMs;
    this.stats.performance.avgParsingTime =
      this.stats.performance.totalParsingTime / this.stats.filesProcessed;

    if (result.performance.memoryUsage) {
      const currentMemory = result.performance.memoryUsage.heapUsed;
      if (currentMemory > this.stats.performance.peakMemoryUsage) {
        this.stats.performance.peakMemoryUsage = currentMemory;
      }
    }
  }
}

export default CnabParserService; 