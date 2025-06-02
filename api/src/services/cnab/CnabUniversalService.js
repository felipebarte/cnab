/**
 * CnabUniversalService - Serviço Principal do Sistema CNAB Universal
 * 
 * Orquestra todos os componentes do sistema:
 * - Detecção automática de formato e banco
 * - Carregamento de schemas apropriados
 * - Validação e processamento de arquivos
 * - Interface unificada para toda a funcionalidade CNAB
 */

import CnabDetector from '../../utils/cnab/CnabDetector.js';
import CnabSchemaLoader from './schemas/CnabSchemaLoader.js';
import { createHash } from 'crypto';

/**
 * Classe principal do sistema CNAB Universal
 */
export class CnabUniversalService {
  constructor(config = {}) {
    this.config = {
      autoDetect: true,
      validateSchema: true,
      cacheResults: true,
      ...config
    };

    // Inicializar componentes
    this.detector = new CnabDetector(this.config);
    this.schemaLoader = new CnabSchemaLoader(this.config);
    this.cache = new Map();
    this.initialized = false;

    // Estatísticas de uso
    this.stats = {
      filesProcessed: 0,
      detectionCalls: 0,
      schemaLoads: 0,
      cacheHits: 0,
      errors: 0,
      performance: {
        totalTime: 0,
        avgDetectionTime: 0,
        avgProcessingTime: 0
      }
    };
  }

  /**
   * Inicializa o serviço carregando schemas base
   */
  async initialize() {
    if (this.initialized) {
      return this.getSystemInfo();
    }

    try {
      console.log('🚀 Inicializando CnabUniversalService...');

      // Inicializar SchemaLoader
      await this.schemaLoader.initialize();

      // Cache de schemas mais usados (pré-carregamento)
      await this._preloadCommonSchemas();

      this.initialized = true;
      console.log('✅ CnabUniversalService inicializado com sucesso!');

      return this.getSystemInfo();

    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      throw error;
    }
  }

  /**
   * Processa um arquivo CNAB completo
   * @param {string|Buffer} content - Conteúdo do arquivo
   * @param {Object} options - Opções de processamento
   * @returns {Object} Resultado do processamento
   */
  async processFile(content, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.filesProcessed++;

      // 1. Detectar formato e banco
      const detection = await this.detectFormat(content);

      if (detection.confidence < 70) {
        throw new Error(`Confiança na detecção muito baixa: ${detection.confidence}%`);
      }

      // 2. Carregar schema apropriado
      const schema = await this.loadSchema(detection.bankCode, detection.format);

      // 3. Validar estrutura (se habilitado)
      const validation = this.config.validateSchema
        ? await this.validateStructure(content, schema, detection)
        : { valid: true, warnings: [] };

      // 4. Processar dados
      const processedData = await this.extractData(content, schema, detection);

      // Estatísticas
      const processingTime = Date.now() - startTime;
      this._updatePerformanceStats(processingTime);

      const result = {
        success: true,
        detection,
        schema: {
          bankCode: schema.bankCode,
          format: schema.format,
          fieldsCount: Object.keys(schema.fields || {}).length
        },
        validation,
        data: processedData,
        metadata: {
          processingTime: `${processingTime}ms`,
          confidence: `${detection.confidence}%`,
          timestamp: new Date().toISOString()
        }
      };

      // Cache result se habilitado
      if (this.config.cacheResults) {
        this._cacheResult(content, result);
      }

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
   * Detecta formato do arquivo CNAB
   */
  async detectFormat(content) {
    const startTime = Date.now();

    try {
      this.stats.detectionCalls++;

      // Verificar cache primeiro
      const cacheKey = this._generateCacheKey('detection', content);
      if (this.cache.has(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      const detection = this.detector.detectFormat(content);

      // Cache resultado
      this.cache.set(cacheKey, detection);

      // Estatísticas
      const detectionTime = Date.now() - startTime;
      this.stats.performance.avgDetectionTime =
        (this.stats.performance.avgDetectionTime + detectionTime) / this.stats.detectionCalls;

      return detection;

    } catch (error) {
      throw new Error(`Erro na detecção: ${error.message}`);
    }
  }

  /**
   * Carrega schema para banco e formato específicos
   */
  async loadSchema(bankCode, format) {
    try {
      this.stats.schemaLoads++;

      const schema = await this.schemaLoader.loadSchema(bankCode, format);

      if (!schema) {
        throw new Error(`Schema não encontrado para banco ${bankCode} formato ${format}`);
      }

      return schema;

    } catch (error) {
      throw new Error(`Erro no carregamento do schema: ${error.message}`);
    }
  }

  /**
   * Valida estrutura do arquivo contra o schema
   */
  async validateStructure(content, schema, detection) {
    try {
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        fieldValidations: {}
      };

      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

      // Validar cada linha
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineValidation = this._validateLine(line, schema, detection, i + 1);

        if (lineValidation.errors.length > 0) {
          validation.valid = false;
          validation.errors.push(...lineValidation.errors);
        }

        validation.warnings.push(...lineValidation.warnings);
      }

      return validation;

    } catch (error) {
      return {
        valid: false,
        errors: [`Erro na validação: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Extrai dados estruturados do arquivo
   */
  async extractData(content, schema, detection) {
    try {
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
      const extractedData = {
        header: null,
        details: [],
        trailer: null,
        lotes: [], // Para CNAB240
        summary: {
          totalRecords: lines.length,
          detailRecords: 0,
          format: detection.format,
          bank: detection.bankName
        }
      };

      // Processar cada linha baseado no formato
      if (detection.format === 'cnab240') {
        extractedData = this._extractCnab240Data(lines, schema);
      } else if (detection.format === 'cnab400') {
        extractedData = this._extractCnab400Data(lines, schema);
      }

      return extractedData;

    } catch (error) {
      throw new Error(`Erro na extração de dados: ${error.message}`);
    }
  }

  /**
   * Obtém lista de bancos e formatos suportados
   */
  getSupportedBanksAndFormats() {
    return {
      banks: this.detector.getSupportedBanks(),
      formats: ['cnab240', 'cnab400'],
      schemasAvailable: this.schemaLoader.getSystemInfo ? this.schemaLoader.getSystemInfo() : { banks: 0, schemas: 0 },
      totalSchemas: this.schemaLoader.getTotalSchemasCount ? this.schemaLoader.getTotalSchemasCount() : 0
    };
  }

  /**
   * Obtém informações do sistema
   */
  getSystemInfo() {
    return {
      version: '1.0.0',
      initialized: this.initialized,
      components: {
        detector: !!this.detector,
        schemaLoader: this.schemaLoader.initialized || false
      },
      stats: this.stats,
      cache: {
        size: this.cache.size,
        enabled: this.config.cacheResults
      },
      configuration: {
        autoDetect: this.config.autoDetect,
        validateSchema: this.config.validateSchema,
        cacheResults: this.config.cacheResults
      }
    };
  }

  /**
   * Limpa cache do sistema
   */
  clearCache() {
    const oldSize = this.cache.size;
    this.cache.clear();

    return {
      cleared: oldSize,
      newSize: this.cache.size
    };
  }

  /**
   * Redefine estatísticas
   */
  resetStats() {
    this.stats = {
      filesProcessed: 0,
      detectionCalls: 0,
      schemaLoads: 0,
      cacheHits: 0,
      errors: 0,
      performance: {
        totalTime: 0,
        avgDetectionTime: 0,
        avgProcessingTime: 0
      }
    };
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Pré-carrega schemas mais comuns
   */
  async _preloadCommonSchemas() {
    const commonBanks = ['001', '104', '237', '341']; // BB, Caixa, Bradesco, Itaú
    const formats = ['cnab240', 'cnab400'];
    const commonTypes = ['header_arquivo', 'header_lote', 'detalhe', 'trailer_lote', 'trailer_arquivo'];

    for (const bank of commonBanks) {
      for (const format of formats) {
        for (const type of commonTypes) {
          try {
            await this.schemaLoader.loadSchema(bank, format, type);
          } catch (error) {
            // Ignora erros de schema não encontrado no pré-carregamento
            // console.warn(`⚠️  Schema ${bank}/${format}/${type} não encontrado para pré-carregamento`);
          }
        }
      }
    }
  }

  /**
   * Valida uma linha específica
   */
  _validateLine(line, schema, detection, lineNumber) {
    const validation = {
      errors: [],
      warnings: []
    };

    // Validar tamanho da linha
    const expectedLength = detection.format === 'cnab240' ? 240 : 400;
    if (line.length !== expectedLength) {
      validation.errors.push(`Linha ${lineNumber}: tamanho incorreto ${line.length}, esperado ${expectedLength}`);
    }

    // Validações específicas baseadas no schema serão implementadas aqui
    // Por enquanto, validação básica

    return validation;
  }

  /**
   * Extrai dados de arquivo CNAB240
   */
  _extractCnab240Data(lines, schema) {
    // Implementação básica - será expandida
    return {
      format: 'cnab240',
      header: lines.find(line => line.charAt(7) === '0'),
      trailer: lines.find(line => line.charAt(7) === '9'),
      details: lines.filter(line => line.charAt(7) === '3'),
      lotes: [], // Implementar agrupamento por lotes
      summary: {
        totalRecords: lines.length,
        detailRecords: lines.filter(line => line.charAt(7) === '3').length
      }
    };
  }

  /**
   * Extrai dados de arquivo CNAB400
   */
  _extractCnab400Data(lines, schema) {
    // Implementação básica - será expandida
    return {
      format: 'cnab400',
      header: lines.find(line => line.charAt(0) === '0'),
      trailer: lines.find(line => line.charAt(0) === '9'),
      details: lines.filter(line => line.charAt(0) === '1'),
      summary: {
        totalRecords: lines.length,
        detailRecords: lines.filter(line => line.charAt(0) === '1').length
      }
    };
  }

  /**
   * Gera chave de cache
   */
  _generateCacheKey(type, content) {
    const hash = createHash('md5').update(content.toString()).digest('hex');
    return `${type}:${hash.substring(0, 8)}`;
  }

  /**
   * Cache resultado
   */
  _cacheResult(content, result) {
    const key = this._generateCacheKey('result', content);
    this.cache.set(key, result);
  }

  /**
   * Atualiza estatísticas de performance
   */
  _updatePerformanceStats(processingTime) {
    this.stats.performance.totalTime += processingTime;
    this.stats.performance.avgProcessingTime =
      this.stats.performance.totalTime / this.stats.filesProcessed;
  }
}

export default CnabUniversalService; 