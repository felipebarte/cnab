/**
 * StructuralValidator - Validador de Estrutura CNAB
 * 
 * Responsável por validar a estrutura básica dos arquivos CNAB:
 * - Tamanho correto das linhas (240 ou 400 caracteres)
 * - Posicionamento de campos-chave
 * - Estrutura geral do arquivo (header, detalhes, trailer)
 * - Sequência de registros
 */

/**
 * Validador estrutural para arquivos CNAB
 */
export class StructuralValidator {
  constructor(config = {}) {
    this.config = config;

    // Tamanhos esperados por formato
    this.expectedLengths = {
      cnab240: 240,
      cnab400: 400
    };

    // Posições críticas por formato
    this.criticalPositions = {
      cnab240: {
        bankCode: [0, 3],      // Código do banco
        recordType: [7, 8],    // Tipo de registro
        segmentType: [13, 14]  // Tipo de segmento (para detalhes)
      },
      cnab400: {
        recordType: [0, 1],    // Tipo de registro
        bankCode: [76, 79]     // Código do banco (no header)
      }
    };
  }

  /**
   * Valida estrutura de uma linha específica
   */
  async validateLine(line, lineNumber, schema, detection, result) {
    try {
      // Validar tamanho da linha
      this._validateLineLength(line, lineNumber, detection, result);

      // Validar posições críticas
      this._validateCriticalPositions(line, lineNumber, detection, result);

      // Validar formato básico de caracteres
      this._validateBasicFormat(line, lineNumber, detection, result);

      // Validar sequência de registro
      this._validateRecordSequence(line, lineNumber, detection, result);

    } catch (error) {
      result.addError(`Erro na validação estrutural da linha ${lineNumber}: ${error.message}`, lineNumber);
    }
  }

  /**
   * Valida estrutura do arquivo completo
   */
  async validateFile(lines, schemas, detection, result) {
    try {
      // Validar estrutura geral do arquivo
      this._validateFileStructure(lines, detection, result);

      // Validar presença de registros obrigatórios
      this._validateMandatoryRecords(lines, detection, result);

      // Validar ordem dos registros
      this._validateRecordOrder(lines, detection, result);

      // Validar integridade da estrutura
      this._validateStructuralIntegrity(lines, detection, result);

    } catch (error) {
      result.addError(`Erro na validação estrutural do arquivo: ${error.message}`);
    }
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Valida tamanho da linha
   */
  _validateLineLength(line, lineNumber, detection, result) {
    const expectedLength = this.expectedLengths[detection.format];
    const actualLength = line.length;

    if (actualLength !== expectedLength) {
      result.addError(
        `Linha ${lineNumber}: tamanho incorreto ${actualLength}, esperado ${expectedLength}`,
        lineNumber
      );
    } else if (this.config.enablePerformanceLogging) {
      // Log de sucesso apenas se performance logging estiver habilitado
      result.addFieldValidation(`linha_${lineNumber}_tamanho`, { valid: true });
    }
  }

  /**
   * Valida posições críticas
   */
  _validateCriticalPositions(line, lineNumber, detection, result) {
    const positions = this.criticalPositions[detection.format];

    // Verificar se a linha é longa o suficiente para as posições críticas
    for (const [fieldName, [start, end]] of Object.entries(positions)) {
      if (line.length < end) {
        result.addError(
          `Linha ${lineNumber}: linha muito curta para campo ${fieldName} (posição ${start}-${end})`,
          lineNumber,
          fieldName
        );
        continue;
      }

      const fieldValue = line.substring(start, end);

      // Validações específicas por campo
      if (fieldName === 'bankCode') {
        this._validateBankCode(fieldValue, lineNumber, detection, result);
      } else if (fieldName === 'recordType') {
        this._validateRecordType(fieldValue, lineNumber, detection, result);
      } else if (fieldName === 'segmentType') {
        this._validateSegmentType(fieldValue, lineNumber, detection, result);
      }
    }
  }

  /**
   * Valida código do banco
   */
  _validateBankCode(bankCode, lineNumber, detection, result) {
    // Verificar se é numérico
    if (!/^\d{3}$/.test(bankCode)) {
      result.addError(
        `Linha ${lineNumber}: código do banco inválido '${bankCode}' (deve ser 3 dígitos numéricos)`,
        lineNumber,
        'bankCode'
      );
    }

    // Verificar consistência com detecção
    if (bankCode !== detection.bankCode && bankCode !== '000') {
      result.addWarning(
        `Linha ${lineNumber}: código do banco '${bankCode}' diferente do detectado '${detection.bankCode}'`,
        lineNumber,
        'bankCode'
      );
    }
  }

  /**
   * Valida tipo de registro
   */
  _validateRecordType(recordType, lineNumber, detection, result) {
    const validTypes = detection.format === 'cnab240'
      ? ['0', '1', '3', '5', '9']
      : ['0', '1', '9'];

    if (!validTypes.includes(recordType)) {
      result.addError(
        `Linha ${lineNumber}: tipo de registro inválido '${recordType}' para ${detection.format}`,
        lineNumber,
        'recordType'
      );
    }
  }

  /**
   * Valida tipo de segmento (CNAB240)
   */
  _validateSegmentType(segmentType, lineNumber, detection, result) {
    if (detection.format === 'cnab240') {
      const validSegments = ['P', 'Q', 'R', 'S', 'T', 'U', 'Y', ' '];

      if (!validSegments.includes(segmentType) && segmentType.trim() !== '') {
        result.addWarning(
          `Linha ${lineNumber}: tipo de segmento '${segmentType}' não reconhecido`,
          lineNumber,
          'segmentType'
        );
      }
    }
  }

  /**
   * Valida formato básico de caracteres
   */
  _validateBasicFormat(line, lineNumber, detection, result) {
    // Verificar se há caracteres de controle inválidos
    const controlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
    if (controlChars.test(line)) {
      result.addError(
        `Linha ${lineNumber}: contém caracteres de controle inválidos`,
        lineNumber
      );
    }

    // Verificar encoding básico (ASCII válido)
    try {
      const encoded = Buffer.from(line, 'utf8');
      if (encoded.length !== line.length) {
        result.addWarning(
          `Linha ${lineNumber}: possível problema de encoding`,
          lineNumber
        );
      }
    } catch (error) {
      result.addError(
        `Linha ${lineNumber}: erro de encoding - ${error.message}`,
        lineNumber
      );
    }
  }

  /**
   * Valida sequência de registro
   */
  _validateRecordSequence(line, lineNumber, detection, result) {
    // Esta validação será expandida para verificar sequências específicas
    // Por enquanto, validação básica de posição
    if (detection.format === 'cnab240') {
      const recordType = line.charAt(7);

      // Header arquivo deve ser a primeira linha
      if (recordType === '0' && lineNumber !== 1) {
        result.addWarning(
          `Linha ${lineNumber}: header arquivo fora da posição inicial`,
          lineNumber,
          'sequence'
        );
      }
    } else if (detection.format === 'cnab400') {
      const recordType = line.charAt(0);

      // Header arquivo deve ser a primeira linha
      if (recordType === '0' && lineNumber !== 1) {
        result.addWarning(
          `Linha ${lineNumber}: header arquivo fora da posição inicial`,
          lineNumber,
          'sequence'
        );
      }
    }
  }

  /**
   * Valida estrutura geral do arquivo
   */
  _validateFileStructure(lines, detection, result) {
    if (lines.length === 0) {
      result.addError('Arquivo vazio');
      return;
    }

    // Verificar se todas as linhas têm o mesmo tamanho
    const expectedLength = this.expectedLengths[detection.format];
    const differentSizes = lines.filter(line => line.length !== expectedLength);

    if (differentSizes.length > 0) {
      result.addError(
        `${differentSizes.length} linhas com tamanho incorreto no arquivo`
      );
    }

    // Verificar tamanho mínimo do arquivo
    if (lines.length < 2) {
      result.addError('Arquivo muito pequeno (deve ter pelo menos header e trailer)');
    }
  }

  /**
   * Valida presença de registros obrigatórios
   */
  _validateMandatoryRecords(lines, detection, result) {
    const recordTypes = lines.map(line =>
      detection.format === 'cnab240' ? line.charAt(7) : line.charAt(0)
    );

    // Header obrigatório
    if (!recordTypes.includes('0')) {
      result.addError('Header arquivo obrigatório não encontrado');
    }

    // Trailer obrigatório
    if (!recordTypes.includes('9')) {
      result.addError('Trailer arquivo obrigatório não encontrado');
    }

    // Para CNAB240, verificar estrutura de lotes
    if (detection.format === 'cnab240') {
      const hasHeaderLote = recordTypes.includes('1');
      const hasTrailerLote = recordTypes.includes('5');

      if (hasHeaderLote && !hasTrailerLote) {
        result.addError('Header de lote encontrado sem trailer correspondente');
      } else if (!hasHeaderLote && hasTrailerLote) {
        result.addError('Trailer de lote encontrado sem header correspondente');
      }
    }
  }

  /**
   * Valida ordem dos registros
   */
  _validateRecordOrder(lines, detection, result) {
    const recordTypes = lines.map((line, index) => ({
      type: detection.format === 'cnab240' ? line.charAt(7) : line.charAt(0),
      line: index + 1
    }));

    // Verificar ordem básica: header primeiro, trailer último
    if (recordTypes[0].type !== '0') {
      result.addError('Primeira linha deve ser header arquivo');
    }

    if (recordTypes[recordTypes.length - 1].type !== '9') {
      result.addError('Última linha deve ser trailer arquivo');
    }

    // Para CNAB240, validar ordem de lotes
    if (detection.format === 'cnab240') {
      this._validateCnab240Order(recordTypes, result);
    }
  }

  /**
   * Valida ordem específica CNAB240
   */
  _validateCnab240Order(recordTypes, result) {
    let currentState = 'START';
    let loteCount = 0;

    for (const record of recordTypes) {
      switch (currentState) {
      case 'START':
        if (record.type === '0') {
          currentState = 'HEADER_ARQUIVO';
        } else {
          result.addError(`Linha ${record.line}: esperado header arquivo`);
        }
        break;

      case 'HEADER_ARQUIVO':
        if (record.type === '1') {
          currentState = 'HEADER_LOTE';
          loteCount++;
        } else if (record.type === '9') {
          currentState = 'TRAILER_ARQUIVO';
        } else {
          result.addError(`Linha ${record.line}: sequência inválida após header arquivo`);
        }
        break;

      case 'HEADER_LOTE':
        if (record.type === '3') {
          currentState = 'DETALHE';
        } else if (record.type === '5') {
          currentState = 'TRAILER_LOTE';
        } else {
          result.addError(`Linha ${record.line}: esperado detalhe ou trailer de lote`);
        }
        break;

      case 'DETALHE':
        if (record.type === '3') {
          // Continua em detalhes
        } else if (record.type === '5') {
          currentState = 'TRAILER_LOTE';
        } else {
          result.addError(`Linha ${record.line}: sequência inválida em detalhes`);
        }
        break;

      case 'TRAILER_LOTE':
        if (record.type === '1') {
          currentState = 'HEADER_LOTE';
          loteCount++;
        } else if (record.type === '9') {
          currentState = 'TRAILER_ARQUIVO';
        } else {
          result.addError(`Linha ${record.line}: sequência inválida após trailer de lote`);
        }
        break;
      }
    }

    if (currentState !== 'TRAILER_ARQUIVO') {
      result.addError('Arquivo terminou em estado inválido');
    }
  }

  /**
   * Valida integridade estrutural
   */
  _validateStructuralIntegrity(lines, detection, result) {
    // Verificar consistência de códigos de banco
    const bankCodes = new Set();

    for (const line of lines) {
      if (detection.format === 'cnab240') {
        bankCodes.add(line.substring(0, 3));
      } else if (detection.format === 'cnab400') {
        // Para CNAB400, o banco pode estar em posições diferentes
        if (line.charAt(0) === '0') { // Header
          bankCodes.add(line.substring(76, 79));
        }
      }
    }

    if (bankCodes.size > 1) {
      result.addWarning(
        `Múltiplos códigos de banco encontrados: ${Array.from(bankCodes).join(', ')}`
      );
    }
  }
}

export default StructuralValidator; 