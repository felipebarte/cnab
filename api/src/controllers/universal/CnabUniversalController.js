/**
 * CnabUniversalController - Controller dos Endpoints Universais
 * 
 * Controlador moderno para endpoints universais de processamento CNAB.
 * Integra CnabUniversalService, CnabParserService e CnabValidatorService.
 * 
 * Características:
 * - Upload de arquivos otimizado
 * - Processamento completo com parsing e validação
 * - Respostas padronizadas com metadados ricos
 * - Suporte a múltiplos formatos e bancos
 * - Documentação OpenAPI integrada
 */

import CnabUniversalService from '../../services/cnab/CnabUniversalService.js';
import CnabParserService from '../../services/cnab/parsers/CnabParserService.js';
import CnabValidatorService from '../../services/cnab/validators/CnabValidatorService.js';
import CnabSchemaLoader from '../../services/cnab/schemas/CnabSchemaLoader.js';

/**
 * Classe principal do controller universal
 */
class CnabUniversalController {
  constructor() {
    this.universalService = null;
    this.parserService = null;
    this.validatorService = null;
    this.schemaLoader = null;
    this.initialized = false;
  }

  /**
   * Inicialização lazy dos serviços
   */
  async _ensureInitialized() {
    if (this.initialized) return;

    try {
      // Inicializar serviços
      this.universalService = new CnabUniversalService();
      await this.universalService.initialize();

      this.parserService = new CnabParserService();
      await this.parserService.initialize();

      this.validatorService = new CnabValidatorService();
      await this.validatorService.initialize();

      this.schemaLoader = new CnabSchemaLoader();
      await this.schemaLoader.initialize();

      this.initialized = true;
    } catch (error) {
      throw new Error(`Falha na inicialização dos serviços: ${error.message}`);
    }
  }

  /**
   * Cria resposta padronizada de sucesso
   */
  _createSuccessResponse(data, operation, metadata = {}) {
    return {
      success: true,
      operation,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        version: '1.0.0',
        processedBy: 'cnab-universal-api',
        ...metadata
      }
    };
  }

  /**
   * Cria resposta padronizada de erro
   */
  _createErrorResponse(error, operation, statusCode = 500) {
    return {
      success: false,
      operation,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
        type: error.type || 'UnknownError',
        details: error.details || null
      },
      statusCode
    };
  }

  /**
   * Extrai conteúdo CNAB do request (arquivo ou JSON)
   */
  _extractCnabContent(req) {
    // Prioridade: arquivo -> body.content -> body.data
    if (req.file && req.file.buffer) {
      return req.file.buffer.toString('utf8');
    }

    if (req.body.content) {
      return req.body.content;
    }

    if (req.body.data) {
      return req.body.data;
    }

    throw new Error('Nenhum conteúdo CNAB fornecido. Use upload de arquivo ou campo "content"/"data" no JSON.');
  }

  /**
   * POST /api/v1/cnab/universal/processar
   * Processamento completo: detecção + parsing + validação
   */
  async processar(req, res) {
    const operationId = req.operationId || `proc_${Date.now()}`;

    try {
      await this._ensureInitialized();

      // Extrair conteúdo CNAB
      const content = this._extractCnabContent(req);
      const startTime = Date.now();

      // 1. Detectar formato automaticamente
      const detection = await this.universalService.detectFormat(content);
      const detectionTime = Date.now() - startTime;

      if (detection.confidence < 80) {
        return res.status(400).json(
          this._createErrorResponse(
            new Error(`Baixa confiança na detecção do formato (${detection.confidence}%). Arquivo pode estar corrompido.`),
            'processar',
            400
          )
        );
      }

      // 2. Fazer parsing completo
      const parseStartTime = Date.now();
      const parseResult = await this.parserService.parseFile(content, detection);
      const parseTime = Date.now() - parseStartTime;

      // 3. Executar validação (se solicitada)
      let validationResult = null;
      let validationTime = 0;

      if (req.body.includeValidation !== false) { // Por padrão inclui validação
        const validationStartTime = Date.now();
        validationResult = await this.validatorService.validateFile(content, detection);
        validationTime = Date.now() - validationStartTime;
      }

      const totalTime = Date.now() - startTime;

      // Montar resposta completa
      const response = this._createSuccessResponse({
        detection: {
          format: detection.format,
          bankCode: detection.bankCode,
          bankName: detection.bankName,
          confidence: detection.confidence,
          reason: detection.reason || 'Detecção automática bem-sucedida'
        },
        parsing: {
          success: parseResult.success,
          metadata: parseResult.metadata || {},
          data: parseResult.data || null,
          errors: parseResult.errors || [],
          warnings: parseResult.warnings || []
        },
        validation: validationResult ? {
          isValid: validationResult.isValid,
          score: validationResult.score || 0,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
          statistics: validationResult.statistics || {}
        } : null
      }, 'processar', {
        operationId,
        timing: {
          detection: `${detectionTime}ms`,
          parsing: `${parseTime}ms`,
          validation: `${validationTime}ms`,
          total: `${totalTime}ms`
        },
        file: req.file ? {
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype
        } : null
      });

      return res.json(response);

    } catch (error) {
      console.error('Erro no processamento universal:', {
        operationId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json(
        this._createErrorResponse(error, 'processar', 500)
      );
    }
  }

  /**
   * POST /api/v1/cnab/universal/upload
   * Upload e análise básica (sem parsing completo)
   */
  async upload(req, res) {
    const operationId = req.operationId || `upload_${Date.now()}`;

    try {
      await this._ensureInitialized();

      // Verificar se tem arquivo
      if (!req.file) {
        return res.status(400).json(
          this._createErrorResponse(
            new Error('Arquivo é obrigatório para upload'),
            'upload',
            400
          )
        );
      }

      const content = req.file.buffer.toString('utf8');
      const startTime = Date.now();

      // Análise básica do arquivo
      const lines = content.trim().split('\n');
      const detection = await this.universalService.detectFormat(content);
      const analysisTime = Date.now() - startTime;

      // Estatísticas básicas
      const stats = {
        totalLines: lines.length,
        firstLineLength: lines[0]?.length || 0,
        lastLineLength: lines[lines.length - 1]?.length || 0,
        estimatedFormat: detection.format,
        fileSize: req.file.size,
        encoding: 'utf8'
      };

      // Análise de estrutura (contagem de tipos de registro)
      const recordTypes = {};
      lines.forEach(line => {
        if (line.length >= 8) {
          const recordType = line.charAt(7); // Posição padrão do tipo de registro
          recordTypes[recordType] = (recordTypes[recordType] || 0) + 1;
        }
      });

      const response = this._createSuccessResponse({
        upload: {
          filename: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: new Date().toISOString()
        },
        detection: {
          format: detection.format,
          bankCode: detection.bankCode,
          bankName: detection.bankName,
          confidence: detection.confidence
        },
        analysis: {
          statistics: stats,
          recordTypes,
          structurePreview: {
            firstLine: lines[0]?.substring(0, 50) + (lines[0]?.length > 50 ? '...' : ''),
            lastLine: lines[lines.length - 1]?.substring(0, 50) + (lines[lines.length - 1]?.length > 50 ? '...' : '')
          }
        }
      }, 'upload', {
        operationId,
        timing: {
          analysis: `${analysisTime}ms`
        }
      });

      return res.json(response);

    } catch (error) {
      console.error('Erro no upload universal:', {
        operationId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json(
        this._createErrorResponse(error, 'upload', 500)
      );
    }
  }

  /**
   * POST /api/v1/cnab/universal/validar
   * Validação especializada com relatório detalhado
   */
  async validar(req, res) {
    const operationId = req.operationId || `valid_${Date.now()}`;

    try {
      await this._ensureInitialized();

      const content = this._extractCnabContent(req);
      const startTime = Date.now();

      // Detectar formato primeiro
      const detection = await this.universalService.detectFormat(content);

      // Executar validação completa
      const validationResult = await this.validatorService.validateFile(content, detection);
      const validationTime = Date.now() - startTime;

      // Organizar erros por categoria
      const errorsByCategory = {
        structural: [],
        field: [],
        integrity: [],
        business: []
      };

      if (validationResult.errors) {
        validationResult.errors.forEach(error => {
          const category = error.category || 'structural';
          if (errorsByCategory[category]) {
            errorsByCategory[category].push(error);
          } else {
            errorsByCategory.structural.push(error);
          }
        });
      }

      // Organizar avisos por tipo
      const warningsByType = {};
      if (validationResult.warnings) {
        validationResult.warnings.forEach(warning => {
          const type = warning.type || 'general';
          if (!warningsByType[type]) {
            warningsByType[type] = [];
          }
          warningsByType[type].push(warning);
        });
      }

      const response = this._createSuccessResponse({
        detection: {
          format: detection.format,
          bankCode: detection.bankCode,
          bankName: detection.bankName,
          confidence: detection.confidence
        },
        validation: {
          isValid: validationResult.isValid,
          score: validationResult.score || 0,
          summary: {
            totalErrors: validationResult.errors?.length || 0,
            totalWarnings: validationResult.warnings?.length || 0,
            errorsByCategory: Object.keys(errorsByCategory).reduce((acc, key) => {
              acc[key] = errorsByCategory[key].length;
              return acc;
            }, {}),
            warningsByType: Object.keys(warningsByType).reduce((acc, key) => {
              acc[key] = warningsByType[key].length;
              return acc;
            }, {})
          },
          details: {
            errorsByCategory,
            warningsByType,
            statistics: validationResult.statistics || {}
          }
        }
      }, 'validar', {
        operationId,
        timing: {
          validation: `${validationTime}ms`
        }
      });

      return res.json(response);

    } catch (error) {
      console.error('Erro na validação universal:', {
        operationId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json(
        this._createErrorResponse(error, 'validar', 500)
      );
    }
  }

  /**
   * GET /api/v1/cnab/universal/bancos
   * Lista todos os bancos suportados com seus schemas
   */
  async listarBancos(req, res) {
    try {
      await this._ensureInitialized();

      const startTime = Date.now();
      const bancos = await this.schemaLoader.listAvailableBanks();
      const loadTime = Date.now() - startTime;

      // Enriquecer informações dos bancos
      const bancosDetalhados = bancos.map(banco => ({
        code: banco.code,
        name: banco.name,
        schemas: {
          cnab240: banco.schemas.filter(s => s.format === 'cnab240').length,
          cnab400: banco.schemas.filter(s => s.format === 'cnab400').length,
          total: banco.schemas.length
        },
        supported: banco.schemas.length > 0,
        lastUpdated: banco.lastModified || null
      }));

      // Estatísticas gerais
      const statistics = {
        totalBanks: bancosDetalhados.length,
        supportedBanks: bancosDetalhados.filter(b => b.supported).length,
        totalSchemas: bancosDetalhados.reduce((acc, b) => acc + b.schemas.total, 0),
        formatDistribution: {
          cnab240: bancosDetalhados.reduce((acc, b) => acc + b.schemas.cnab240, 0),
          cnab400: bancosDetalhados.reduce((acc, b) => acc + b.schemas.cnab400, 0)
        }
      };

      const response = this._createSuccessResponse({
        banks: bancosDetalhados,
        statistics
      }, 'listar-bancos', {
        timing: {
          load: `${loadTime}ms`
        }
      });

      return res.json(response);

    } catch (error) {
      console.error('Erro ao listar bancos:', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json(
        this._createErrorResponse(error, 'listar-bancos', 500)
      );
    }
  }

  /**
   * GET /api/v1/cnab/universal/schemas/:bankCode
   * Retorna schemas específicos de um banco
   */
  async obterSchemasBanco(req, res) {
    try {
      await this._ensureInitialized();

      const { bankCode } = req.params;
      const { format } = req.query; // Filtro opcional por formato

      if (!bankCode) {
        return res.status(400).json(
          this._createErrorResponse(
            new Error('Código do banco é obrigatório'),
            'obter-schemas-banco',
            400
          )
        );
      }

      const startTime = Date.now();

      // Buscar schemas do banco
      const schemas = await this.schemaLoader.getBankSchemas(bankCode);

      if (!schemas || schemas.length === 0) {
        return res.status(404).json(
          this._createErrorResponse(
            new Error(`Nenhum schema encontrado para o banco ${bankCode}`),
            'obter-schemas-banco',
            404
          )
        );
      }

      // Filtrar por formato se especificado
      let filteredSchemas = schemas;
      if (format) {
        filteredSchemas = schemas.filter(s => s.format.toLowerCase() === format.toLowerCase());
      }

      // Organizar schemas por tipo
      const schemasByType = {
        header_arquivo: [],
        header_lote: [],
        detalhe: [],
        trailer_lote: [],
        trailer_arquivo: []
      };

      filteredSchemas.forEach(schema => {
        const type = schema.type || 'detalhe';
        if (schemasByType[type]) {
          schemasByType[type].push(schema);
        }
      });

      const loadTime = Date.now() - startTime;

      const response = this._createSuccessResponse({
        bankCode,
        bankName: filteredSchemas[0]?.bankName || `Banco ${bankCode}`,
        filter: format || 'all',
        schemas: {
          byType: schemasByType,
          total: filteredSchemas.length,
          list: filteredSchemas.map(schema => ({
            id: schema.id,
            format: schema.format,
            type: schema.type,
            name: schema.name,
            path: schema.path,
            fields: schema.fields?.length || 0,
            lastModified: schema.lastModified
          }))
        }
      }, 'obter-schemas-banco', {
        timing: {
          load: `${loadTime}ms`
        }
      });

      return res.json(response);

    } catch (error) {
      console.error('Erro ao obter schemas do banco:', {
        bankCode: req.params.bankCode,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json(
        this._createErrorResponse(error, 'obter-schemas-banco', 500)
      );
    }
  }
}

// Exportar instância única (singleton)
export default new CnabUniversalController(); 