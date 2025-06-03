/**
 * CnabSchemaLoader - Carregador Universal de Schemas YAML
 * 
 * Responsável por carregar, cachear e validar schemas YAML dos bancos
 * suportados pelo sistema CNAB Universal.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// Compatibilidade com Jest e Node.js
const __dirname = process.cwd() + '/src/services/cnab/schemas';

/**
 * Classe principal para carregamento de schemas CNAB
 */
export class CnabSchemaLoader {
  constructor(config = {}) {
    this.config = config;
    this.cache = new Map();
    this.basePath = this._resolveBasePath();
    this.initialized = false;

    // Bancos suportados mapeados da análise ULTRATHINK
    this.supportedBanks = {
      cnab240: ['001', '033', '041', '104', '341', '748', '756'],
      cnab400: ['001', '033', '041', '104', '237', '341', '756']
    };

    // Tipos de schemas identificados
    this.schemaTypes = [
      'header_arquivo',
      'header_lote',
      'trailer_lote',
      'trailer_arquivo',
      'detalhe_segmento_p',
      'detalhe_segmento_q',
      'detalhe_segmento_r',
      'detalhe_segmento_t'
    ];
  }

  /**
   * Resolve o caminho base para os schemas YAML
   */
  _resolveBasePath() {
    // Caminho para node_modules/@banco-br/cnab_yaml
    const nodeModulesPath = join(__dirname, '../../../../node_modules/@banco-br/cnab_yaml');

    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }

    // Fallback: tentar encontrar em outros locais
    const alternatePaths = [
      join(process.cwd(), 'node_modules/@banco-br/cnab_yaml'),
      join(__dirname, '../../../node_modules/@banco-br/cnab_yaml')
    ];

    for (const path of alternatePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    throw new Error('❌ Não foi possível localizar @banco-br/cnab_yaml');
  }

  /**
   * Inicializa o loader e verifica disponibilidade dos schemas
   */
  async initialize() {
    if (this.initialized) return this;

    console.log('🔧 Inicializando CnabSchemaLoader...');
    console.log(`📂 Base path: ${this.basePath}`);

    try {
      // Verificar se o diretório base existe
      if (!existsSync(this.basePath)) {
        throw new Error(`Base path não encontrado: ${this.basePath}`);
      }

      // Escanear schemas disponíveis
      const availableSchemas = await this._scanAvailableSchemas();
      console.log(`✅ Encontrados ${availableSchemas.total} schemas em ${availableSchemas.banks} bancos`);

      this.initialized = true;
      return this;
    } catch (error) {
      console.error('❌ Erro na inicialização do CnabSchemaLoader:', error);
      throw error;
    }
  }

  /**
   * Carrega um schema específico
   * @param {string} bank - Código do banco (ex: '104', '341')
   * @param {string} format - Formato CNAB ('cnab240', 'cnab400')
   * @param {string} type - Tipo do schema ('header_arquivo', 'detalhe_segmento_p', etc.)
   * @param {string} subType - Subtipo opcional ('retorno', 'remessa', 'sigcb')
   */
  async loadSchema(bank, format, type, subType = null) {
    const cacheKey = this._generateCacheKey(bank, format, type, subType);

    // Verificar cache primeiro
    if (this.cache.has(cacheKey)) {
      console.log(`📋 Schema ${cacheKey} carregado do cache`);
      return this.cache.get(cacheKey);
    }

    try {
      const schemaPath = this._buildSchemaPath(bank, format, type, subType);

      if (!existsSync(schemaPath)) {
        // Tentar schema genérico como fallback
        const genericPath = this._buildSchemaPath('generic', format, type, subType);
        if (existsSync(genericPath)) {
          console.log(`⚠️  Schema específico não encontrado, usando genérico: ${genericPath}`);
          return this._loadSchemaFile(genericPath, cacheKey);
        }

        throw new Error(`Schema não encontrado: ${schemaPath}`);
      }

      return this._loadSchemaFile(schemaPath, cacheKey);

    } catch (error) {
      console.error(`❌ Erro ao carregar schema ${cacheKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Carrega e parseia um arquivo de schema YAML
   */
  _loadSchemaFile(schemaPath, cacheKey) {
    console.log(`📖 Carregando schema: ${schemaPath}`);

    const yamlContent = readFileSync(schemaPath, 'utf8');
    const schemaData = yaml.load(yamlContent);

    // Validar estrutura básica do schema
    if (!this._validateSchema(schemaData)) {
      throw new Error(`Schema inválido: ${schemaPath}`);
    }

    // Adicionar metadados
    const enrichedSchema = {
      ...schemaData,
      _metadata: {
        cacheKey,
        filePath: schemaPath,
        loadedAt: new Date().toISOString(),
        fieldCount: Object.keys(schemaData).length - 1 // -1 para _metadata
      }
    };

    // Cachear o schema
    this.cache.set(cacheKey, enrichedSchema);
    console.log(`✅ Schema ${cacheKey} carregado e cacheado`);

    return enrichedSchema;
  }

  /**
   * Constrói o caminho para um arquivo de schema
   */
  _buildSchemaPath(bank, format, type, subType = null) {
    let path = join(this.basePath, format, bank);

    // Tratamento especial para Caixa (104) que tem estrutura diferente
    if (bank === '104' && subType) {
      path = join(path, subType);
    } else if (subType) {
      path = join(path, subType);
    }

    return join(path, `${type}.yml`);
  }

  /**
   * Gera chave única para cache
   */
  _generateCacheKey(bank, format, type, subType = null) {
    return subType ?
      `${bank}-${format}-${type}-${subType}` :
      `${bank}-${format}-${type}`;
  }

  /**
   * Valida estrutura básica de um schema
   */
  _validateSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    // Verificar se tem pelo menos um campo com estrutura válida
    const fields = Object.entries(schema);
    if (fields.length === 0) {
      return false;
    }

    // Verificar se pelo menos um campo tem a estrutura esperada (pos, picture)
    const validFields = fields.filter(([key, value]) => {
      return value &&
        Array.isArray(value.pos) &&
        value.pos.length === 2 &&
        typeof value.picture === 'string';
    });

    return validFields.length > 0;
  }

  /**
   * Escaneia todos os schemas disponíveis
   */
  async _scanAvailableSchemas() {
    const summary = { total: 0, banks: 0, formats: {} };

    for (const format of ['cnab240', 'cnab400']) {
      summary.formats[format] = {};

      for (const bank of this.supportedBanks[format]) {
        const bankPath = join(this.basePath, format, bank);

        if (existsSync(bankPath)) {
          const bankSchemas = this._countSchemasInDirectory(bankPath);
          summary.formats[format][bank] = bankSchemas;
          summary.total += bankSchemas;
          summary.banks++;
        }
      }
    }

    return summary;
  }

  /**
   * Conta schemas em um diretório
   */
  _countSchemasInDirectory(dirPath) {
    try {
      let count = 0;

      const scanDir = (path) => {
        const items = readdirSync(path);
        for (const item of items) {
          const itemPath = join(path, item);
          const stat = statSync(itemPath);

          if (stat.isDirectory()) {
            scanDir(itemPath); // Recursivo para subdiretórios
          } else if (item.endsWith('.yml')) {
            count++;
          }
        }
      };

      scanDir(dirPath);
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Obtém lista de bancos suportados por formato
   */
  getSupportedBanks(format = null) {
    if (format) {
      return this.supportedBanks[format] || [];
    }
    return this.supportedBanks;
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryEstimate: `${Math.round(JSON.stringify([...this.cache.values()]).length / 1024)}KB`
    };
  }

  /**
   * Limpa o cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cache limpo: ${size} schemas removidos`);
  }

  /**
   * Obtém informações do sistema
   */
  getSystemInfo() {
    return {
      initialized: this.initialized,
      basePath: this.basePath,
      cacheSize: this.cache.size,
      supportedBanks: this.supportedBanks,
      schemaTypes: this.schemaTypes
    };
  }
}

export default CnabSchemaLoader; 