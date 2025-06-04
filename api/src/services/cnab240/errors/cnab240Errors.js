/**
 * Classes de erro específicas para processamento CNAB 240
 */

/**
 * Erro de processamento CNAB 240
 */
export class ProcessingError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProcessingError';
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Erro de validação CNAB 240
 */
export class ValidationError extends Error {
  constructor(message, validationDetails = {}) {
    super(message);
    this.name = 'ValidationError';
    this.validationDetails = validationDetails;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Erro de formato CNAB 240
 */
export class FormatError extends Error {
  constructor(message, formatDetails = {}) {
    super(message);
    this.name = 'FormatError';
    this.formatDetails = formatDetails;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Erro de estrutura CNAB 240
 */
export class StructureError extends Error {
  constructor(message, structureDetails = {}) {
    super(message);
    this.name = 'StructureError';
    this.structureDetails = structureDetails;
    this.timestamp = new Date().toISOString();
  }
}

export default {
  ProcessingError,
  ValidationError,
  FormatError,
  StructureError
}; 