/**
 * Cnab240Parser - Parser Específico CNAB240
 * 
 * Implementa Strategy Pattern para parsing de arquivos CNAB240.
 * Características:
 * - Estrutura hierárquica: Arquivo > Lotes > Detalhes/Segmentos
 * - State Machine para controle de fluxo
 * - Otimizado para arquivos grandes
 * - Extração de dados tipados baseada em schemas
 */

import { ParsedDataBuilder, ParsedRecord, ParsedBatch } from './ParsedData.js';
import { FieldExtractor } from './FieldExtractor.js';

/**
 * Estados possíveis do parser CNAB240
 */
const ParserState = {
  WAITING_FILE_HEADER: 'waiting_file_header',
  WAITING_BATCH_HEADER: 'waiting_batch_header',
  PROCESSING_BATCH_DETAILS: 'processing_batch_details',
  WAITING_BATCH_TRAILER: 'waiting_batch_trailer',
  WAITING_FILE_TRAILER: 'waiting_file_trailer',
  FINISHED: 'finished',
  ERROR: 'error'
};

export class Cnab240Parser {
  constructor(config = {}) {
    this.config = config;
    this.fieldExtractor = new FieldExtractor(config);
    this.state = ParserState.WAITING_FILE_HEADER;
    this.currentBatch = null;
    this.batchCounter = 0;
  }

  /**
   * Parseia arquivo CNAB240 completo
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
    this.state = ParserState.WAITING_FILE_HEADER;
    this.currentBatch = null;
    this.batchCounter = 0;
  }

  /**
   * Processa uma linha baseada no estado atual
   */
  async _processLine(line, lineNumber, recordType, schemas, builder, result, config) {
    const schema = schemas.get(recordType);

    switch (this.state) {
      case ParserState.WAITING_FILE_HEADER:
        await this._processFileHeader(line, lineNumber, schema, builder, result, config);
        break;

      case ParserState.WAITING_BATCH_HEADER:
        await this._processBatchHeader(line, lineNumber, schema, builder, result, config);
        break;

      case ParserState.PROCESSING_BATCH_DETAILS:
        await this._processBatchDetail(line, lineNumber, recordType, schema, builder, result, config);
        break;

      case ParserState.WAITING_BATCH_TRAILER:
        await this._processBatchTrailer(line, lineNumber, schema, builder, result, config);
        break;

      case ParserState.WAITING_FILE_TRAILER:
        await this._processFileTrailer(line, lineNumber, schema, builder, result, config);
        break;

      default:
        result.addError(`Estado inválido do parser: ${this.state}`, lineNumber);
        this.state = ParserState.ERROR;
    }
  }

  /**
   * Processa header do arquivo
   */
  async _processFileHeader(line, lineNumber, schema, builder, result, config) {
    // Verificar se é tipo 0 (header de arquivo) pela posição 8
    const recordTypeChar = line.charAt(7); // 8ª posição (base zero)
    
    if (recordTypeChar !== '0') {
      result.addError('Arquivo deve começar com header (tipo 0)', lineNumber);
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
      this.state = ParserState.WAITING_BATCH_HEADER;

    } catch (error) {
      result.addError(`Erro no header do arquivo: ${error.message}`, lineNumber);
      this.state = ParserState.ERROR;
    }
  }

  /**
   * Processa header do lote
   */
  async _processBatchHeader(line, lineNumber, schema, builder, result, config) {
    const recordTypeChar = line.charAt(7);

    if (recordTypeChar === '1') {
      // Header de lote
      try {
        this.batchCounter++;
        this.currentBatch = new ParsedBatch(this.batchCounter);

        const record = new ParsedRecord('header_lote', line, lineNumber);

        if (schema) {
          const extractedData = await this.fieldExtractor.extractFields(line, schema, config);
          record.addFields(extractedData, schema);
        }

        this.currentBatch.setHeader(record);
        this.state = ParserState.PROCESSING_BATCH_DETAILS;

      } catch (error) {
        result.addError(`Erro no header do lote: ${error.message}`, lineNumber);
        this.state = ParserState.ERROR;
      }

    } else if (recordTypeChar === '9') {
      // Trailer de arquivo (sem lotes)
      await this._processFileTrailer(line, lineNumber, schema, builder, result, config);

    } else {
      result.addError(`Esperado header de lote ou trailer de arquivo, encontrado: ${recordTypeChar}`, lineNumber);
      this.state = ParserState.ERROR;
    }
  }

  /**
   * Processa detalhe do lote
   */
  async _processBatchDetail(line, lineNumber, recordType, schema, builder, result, config) {
    const recordTypeChar = line.charAt(7);

    if (recordTypeChar === '3') {
      // Registro de detalhe
      try {
        const record = new ParsedRecord(recordType, line, lineNumber);

        if (schema) {
          const extractedData = await this.fieldExtractor.extractFields(line, schema, config);
          record.addFields(extractedData, schema);
        }

        this.currentBatch.addDetail(record);

      } catch (error) {
        result.addError(`Erro no detalhe: ${error.message}`, lineNumber);
      }

    } else if (recordTypeChar === '5') {
      // Trailer do lote
      this.state = ParserState.WAITING_BATCH_TRAILER;
      await this._processBatchTrailer(line, lineNumber, schema, builder, result, config);

    } else {
      result.addError(`Tipo de registro inválido no lote: ${recordTypeChar}`, lineNumber);
    }
  }

  /**
   * Processa trailer do lote
   */
  async _processBatchTrailer(line, lineNumber, schema, builder, result, config) {
    const recordTypeChar = line.charAt(7);

    if (recordTypeChar !== '5') {
      result.addError(`Esperado trailer de lote (tipo 5), encontrado: ${recordTypeChar}`, lineNumber);
      this.state = ParserState.ERROR;
      return;
    }

    try {
      const record = new ParsedRecord('trailer_lote', line, lineNumber);

      if (schema) {
        const extractedData = await this.fieldExtractor.extractFields(line, schema, config);
        record.addFields(extractedData, schema);
      }

      this.currentBatch.setTrailer(record);
      this.currentBatch.finalize();

      builder.addBatch(this.currentBatch.toJSON());
      this.currentBatch = null;

      this.state = ParserState.WAITING_BATCH_HEADER;

    } catch (error) {
      result.addError(`Erro no trailer do lote: ${error.message}`, lineNumber);
      this.state = ParserState.ERROR;
    }
  }

  /**
   * Processa trailer do arquivo
   */
  async _processFileTrailer(line, lineNumber, schema, builder, result, config) {
    const recordTypeChar = line.charAt(7);

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
   * Determina o tipo de registro baseado na posição
   */
  _getRecordType(line) {
    if (line.length < 14) {
      return 'unknown';
    }

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
          case 'J': return 'detalhe_segmento_j';
          case 'N': return 'detalhe_segmento_n';
          case 'O': return 'detalhe_segmento_o';
          case 'W': return 'detalhe_segmento_w';
          default: return 'detalhe';
        }
      case '5': return 'trailer_lote';
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
      type: 'cnab240',
      state: this.state,
      currentBatch: this.currentBatch?.numeroLote || null,
      batchesProcessed: this.batchCounter,
      configuration: this.config
    };
  }
}

export default Cnab240Parser; 