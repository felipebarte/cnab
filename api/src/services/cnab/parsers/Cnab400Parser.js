/**
 * Cnab400Parser - Parser Específico CNAB400
 * 
 * Implementa Strategy Pattern para parsing de arquivos CNAB400.
 * Características:
 * - Estrutura linear: Header > Detalhes > Trailer
 * - Sem lotes (estrutura mais simples que CNAB240)
 * - Otimizado para processamento direto
 * - Extração de dados tipados baseada em schemas
 */

import { ParsedDataBuilder, ParsedRecord } from './ParsedData.js';
import { FieldExtractor } from './FieldExtractor.js';

/**
 * Estados possíveis do parser CNAB400
 */
const ParserState = {
  WAITING_HEADER: 'waiting_header',
  PROCESSING_DETAILS: 'processing_details',
  WAITING_TRAILER: 'waiting_trailer',
  FINISHED: 'finished',
  ERROR: 'error'
};

export class Cnab400Parser {
  constructor(config = {}) {
    this.config = config;
    this.fieldExtractor = new FieldExtractor(config);
    this.state = ParserState.WAITING_HEADER;
    this.recordCounter = 0;
  }

  /**
   * Parseia arquivo CNAB400 completo
   */
  async parse(lines, schemas, detection, result, config) {
    const builder = new ParsedDataBuilder(
      detection.format,
      detection.bankCode,
      detection.bankName
    );

    this._resetState();
    let lineIndex = 0;

    try {
      for (const line of lines) {
        lineIndex++;
        const recordType = this._getRecordType(line);

        await this._processLine(
          line,
          lineIndex,
          recordType,
          schemas,
          builder,
          result,
          config
        );

        // Verificar se atingiu limite de memória
        if (config.maxMemoryUsage && this._checkMemoryUsage() > config.maxMemoryUsage) {
          result.addWarning(`Uso de memória alto detectado na linha ${lineIndex}`);
        }
      }

      // Verificar se terminou no estado correto
      if (this.state !== ParserState.FINISHED) {
        result.addError(`Arquivo terminou em estado inválido: ${this.state}`);
      }

      return builder.build();

    } catch (error) {
      result.addError(`Erro no parsing na linha ${lineIndex}: ${error.message}`, lineIndex);
      throw error;
    }
  }

  /**
   * Parseia uma linha específica
   */
  async parseLine(line, lineNumber, schema, detection, config) {
    const recordType = this._getRecordType(line);
    const record = new ParsedRecord(recordType, line, lineNumber);

    try {
      if (schema) {
        const extractedData = await this.fieldExtractor.extractFields(
          line,
          schema,
          config
        );
        record.addFields(extractedData, schema);
      }

      return record;

    } catch (error) {
      throw new Error(`Erro no parsing da linha ${lineNumber}: ${error.message}`);
    }
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Reseta o estado do parser
   */
  _resetState() {
    this.state = ParserState.WAITING_HEADER;
    this.recordCounter = 0;
  }

  /**
   * Processa uma linha baseada no estado atual
   */
  async _processLine(line, lineNumber, recordType, schemas, builder, result, config) {
    const schema = schemas.get(recordType);

    switch (this.state) {
    case ParserState.WAITING_HEADER:
      await this._processHeader(line, lineNumber, schema, builder, result, config);
      break;

    case ParserState.PROCESSING_DETAILS:
      await this._processDetail(line, lineNumber, recordType, schema, builder, result, config);
      break;

    case ParserState.WAITING_TRAILER:
      await this._processTrailer(line, lineNumber, schema, builder, result, config);
      break;

    default:
      result.addError(`Estado inválido do parser: ${this.state}`, lineNumber);
      this.state = ParserState.ERROR;
    }
  }

  /**
   * Processa header do arquivo
   */
  async _processHeader(line, lineNumber, schema, builder, result, config) {
    const recordTypeChar = line.charAt(0);

    if (recordTypeChar !== '0') {
      result.addError('Arquivo CNAB400 deve começar com header (tipo 0)', lineNumber);
      this.state = ParserState.ERROR;
      return;
    }

    try {
      const record = new ParsedRecord('header_arquivo', line, lineNumber);

      if (schema) {
        const extractedData = await this.fieldExtractor.extractFields(line, schema, config);
        record.addFields(extractedData, schema);
      }

      builder.setFileHeader(record);
      this.state = ParserState.PROCESSING_DETAILS;

    } catch (error) {
      result.addError(`Erro no header do arquivo: ${error.message}`, lineNumber);
      this.state = ParserState.ERROR;
    }
  }

  /**
   * Processa registro de detalhe
   */
  async _processDetail(line, lineNumber, recordType, schema, builder, result, config) {
    const recordTypeChar = line.charAt(0);

    if (recordTypeChar === '1') {
      // Registro de detalhe
      try {
        const record = new ParsedRecord(recordType, line, lineNumber);

        if (schema) {
          const extractedData = await this.fieldExtractor.extractFields(line, schema, config);
          record.addFields(extractedData, schema);
        }

        builder.addDetail(record);
        this.recordCounter++;

      } catch (error) {
        result.addError(`Erro no detalhe: ${error.message}`, lineNumber);
      }

    } else if (recordTypeChar === '9') {
      // Trailer do arquivo
      this.state = ParserState.WAITING_TRAILER;
      await this._processTrailer(line, lineNumber, schema, builder, result, config);

    } else {
      result.addError(`Tipo de registro inválido: ${recordTypeChar}`, lineNumber);
    }
  }

  /**
   * Processa trailer do arquivo
   */
  async _processTrailer(line, lineNumber, schema, builder, result, config) {
    const recordTypeChar = line.charAt(0);

    if (recordTypeChar !== '9') {
      result.addError(`Esperado trailer de arquivo (tipo 9), encontrado: ${recordTypeChar}`, lineNumber);
      this.state = ParserState.ERROR;
      return;
    }

    try {
      const record = new ParsedRecord('trailer_arquivo', line, lineNumber);

      if (schema) {
        const extractedData = await this.fieldExtractor.extractFields(line, schema, config);
        record.addFields(extractedData, schema);
      }

      builder.setFileTrailer(record);
      this.state = ParserState.FINISHED;

    } catch (error) {
      result.addError(`Erro no trailer do arquivo: ${error.message}`, lineNumber);
      this.state = ParserState.ERROR;
    }
  }

  /**
   * Determina o tipo de registro baseado na primeira posição
   */
  _getRecordType(line) {
    if (line.length === 0) {
      return 'unknown';
    }

    const recordTypeChar = line.charAt(0); // 1ª posição

    switch (recordTypeChar) {
    case '0': return 'header_arquivo';
    case '1': return 'detalhe';
    case '9': return 'trailer_arquivo';
    default: return 'unknown';
    }
  }

  /**
   * Verifica uso de memória atual
   */
  _checkMemoryUsage() {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Obtém informações sobre o estado atual do parser
   */
  getParserInfo() {
    return {
      type: 'cnab400',
      state: this.state,
      recordsProcessed: this.recordCounter,
      configuration: this.config
    };
  }
}

export default Cnab400Parser; 