/**
 * Configuração do Sistema CNAB Universal
 * Responsável por definir parâmetros globais do sistema
 */

export const cnabConfig = {
  // Caminhos para schemas YAML
  schemaPath: './src/schemas',

  // Bancos suportados pelo sistema
  supportedBanks: {
    '001': { name: 'Banco do Brasil', formats: ['cnab240', 'cnab400'] },
    '104': { name: 'Caixa Econômica Federal', formats: ['cnab240', 'cnab400'] },
    '237': { name: 'Bradesco', formats: ['cnab240', 'cnab400'] },
    '341': { name: 'Itaú', formats: ['cnab240', 'cnab400'] },
    '033': { name: 'Santander', formats: ['cnab240'] },
    '422': { name: 'Banco Safra', formats: ['cnab240'] },
    '756': { name: 'Sicoob', formats: ['cnab240'] }
  },

  // Formatos CNAB suportados
  supportedFormats: ['cnab240', 'cnab400'],

  // Configurações de cache
  cache: {
    enabled: true,
    timeout: 3600000, // 1 hora em millisegundos
    maxEntries: 100
  },

  // Configurações de detecção automática
  autoDetection: {
    enabled: true,
    detectByLength: true, // CNAB240 = 240 chars, CNAB400 = 400 chars
    detectByHeader: true, // Detectar pelo header do arquivo
    detectByBank: true    // Detectar pelo código do banco
  },

  // Configurações de validação
  validation: {
    strict: true,         // Validação rigorosa
    allowUnknownFields: false,
    requireAllFields: true
  },

  // Configurações de logging
  logging: {
    enabled: true,
    level: 'info',        // debug, info, warn, error
    logSchemaLoading: true,
    logValidationErrors: true
  },

  // Configurações de compatibilidade
  compatibility: {
    enableLegacySupport: true,  // Suporte ao cnab400-itau-parser existente
    wrapLegacyAPIs: true,       // Wrapper para APIs existentes
    migrateGradually: true      // Migração gradual sem quebrar código existente
  }
};

// Configurações específicas por banco (override das configurações globais)
export const bankSpecificConfig = {
  '104': { // Caixa
    validation: {
      strict: false,  // Caixa tem algumas particularidades
      allowUnknownFields: true
    }
  },
  '341': { // Itaú
    compatibility: {
      enableLegacySupport: true,  // Manter suporte ao parser existente
      legacyParserPath: 'cnab400-itau-parser'
    }
  }
};

export default cnabConfig; 