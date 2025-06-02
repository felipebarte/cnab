/**
 * Sistema CNAB Universal - Ponto de entrada principal
 * 
 * Este módulo serve como interface principal para o sistema CNAB universal,
 * exportando todos os serviços e utilitários necessários.
 */

// Importar configurações
import cnabConfig from '../../config/cnab.js';

// Importar serviços principais
import CnabSchemaLoader from './schemas/CnabSchemaLoader.js';
import CnabUniversalService from './CnabUniversalService.js';
// import CnabValidatorService from './validators/CnabValidatorService.js';
// import CnabParserService from './parsers/CnabParserService.js';

// Importar utilitários
import CnabDetector from '../../utils/cnab/CnabDetector.js';
// import CnabFormatter from '../../utils/cnab/CnabFormatter.js';

/**
 * Classe principal do sistema CNAB Universal
 * Coordena todos os serviços e fornece interface unificada
 */
export class CnabSystem {
  constructor(config = {}) {
    this.config = { ...cnabConfig, ...config };
    this.services = {};
    this.initialized = false;

    // Inicializar serviços principais
    this.universalService = new CnabUniversalService(this.config);
    this.schemaLoader = new CnabSchemaLoader(this.config);
    this.detector = new CnabDetector(this.config);
  }

  /**
   * Inicializa todo o sistema CNAB
   */
  async initialize() {
    if (this.initialized) {
      return this.getSystemInfo();
    }

    try {
      console.log('🚀 Inicializando Sistema CNAB Universal...');

      // Inicializar serviço universal (que já inicializa os outros)
      await this.universalService.initialize();

      this.initialized = true;
      console.log('✅ Sistema CNAB Universal inicializado com sucesso!');

      return this.getSystemInfo();

    } catch (error) {
      console.error('❌ Erro na inicialização do sistema:', error);
      throw error;
    }
  }

  /**
   * Processa um arquivo CNAB (método principal)
   */
  async processFile(content, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.universalService.processFile(content, options);
  }

  /**
   * Detecta formato de arquivo CNAB
   */
  async detectFormat(content) {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.universalService.detectFormat(content);
  }

  /**
   * Carrega schema específico
   */
  async loadSchema(bankCode, format) {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.universalService.loadSchema(bankCode, format);
  }

  /**
   * Obtém informações do sistema
   */
  getSystemInfo() {
    const baseInfo = {
      version: '1.0.0',
      name: 'CNAB Universal System',
      initialized: this.initialized,
      configuration: this.config
    };

    if (this.initialized) {
      return {
        ...baseInfo,
        universalService: this.universalService.getSystemInfo(),
        schemaLoader: this.schemaLoader.getSystemInfo?.() || { initialized: true },
        supportedBanksAndFormats: this.universalService.getSupportedBanksAndFormats()
      };
    }

    return baseInfo;
  }

  /**
   * Obtém estatísticas de uso
   */
  getStats() {
    if (!this.initialized) {
      return { error: 'Sistema não inicializado' };
    }

    return this.universalService.getSystemInfo().stats;
  }

  /**
   * Limpa cache do sistema
   */
  clearCache() {
    if (!this.initialized) {
      return { error: 'Sistema não inicializado' };
    }

    return this.universalService.clearCache();
  }

  /**
   * Redefine estatísticas
   */
  resetStats() {
    if (!this.initialized) {
      return { error: 'Sistema não inicializado' };
    }

    return this.universalService.resetStats();
  }

  /**
   * Obtém bancos e formatos suportados
   */
  getSupportedBanksAndFormats() {
    if (!this.initialized) {
      return this.detector.getSupportedBanks();
    }

    return this.universalService.getSupportedBanksAndFormats();
  }

  /**
   * Verifica se um arquivo é válido
   */
  isValidCnabFile(content) {
    return this.detector.isValidCnabFile(content);
  }
}

// Criar instância global do sistema
const cnabSystem = new CnabSystem();

// Exportar instância global e classes individuais
export default cnabSystem;
export {
  CnabUniversalService,
  CnabSchemaLoader,
  CnabDetector
}; 