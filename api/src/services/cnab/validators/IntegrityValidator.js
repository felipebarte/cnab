/**
 * IntegrityValidator - Validador de Integridade CNAB
 * 
 * Responsável por validar a integridade dos arquivos CNAB:
 * - Checksums e totalizadores
 * - Sequências numéricas de registros
 * - Contadores de registros
 * - Consistência entre header/trailer
 * - Relacionamentos entre segmentos (CNAB240)
 */

/**
 * Validador de integridade para arquivos CNAB
 */
export class IntegrityValidator {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Valida integridade do arquivo completo
   */
  async validateFile(lines, schemas, detection, result) {
    try {
      // Validar contadores de registros
      await this._validateRecordCounts(lines, detection, result);

      // Validar sequências numéricas
      await this._validateSequences(lines, detection, result);

      // Validar totalizadores financeiros
      await this._validateFinancialTotals(lines, detection, result);

      // Validar consistência header/trailer
      await this._validateHeaderTrailerConsistency(lines, detection, result);

      // Para CNAB240, validar integridade de lotes
      if (detection.format === 'cnab240') {
        await this._validateCnab240BatchIntegrity(lines, detection, result);
      }

      // Validar checksums (se aplicável)
      await this._validateChecksums(lines, detection, result);

    } catch (error) {
      result.addError(`Erro na validação de integridade: ${error.message}`);
    }
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Valida contadores de registros
   */
  async _validateRecordCounts(lines, detection, result) {
    const recordCounts = this._countRecordTypes(lines, detection);

    // Para CNAB240
    if (detection.format === 'cnab240') {
      // Deve ter exatamente 1 header e 1 trailer de arquivo
      if (recordCounts.headerArquivo !== 1) {
        result.addError(`Arquivo deve ter exatamente 1 header, encontrado ${recordCounts.headerArquivo}`);
      }

      if (recordCounts.trailerArquivo !== 1) {
        result.addError(`Arquivo deve ter exatamente 1 trailer, encontrado ${recordCounts.trailerArquivo}`);
      }

      // Headers e trailers de lote devem ser iguais
      if (recordCounts.headerLote !== recordCounts.trailerLote) {
        result.addError(
          `Número de headers de lote (${recordCounts.headerLote}) diferente de trailers de lote (${recordCounts.trailerLote})`
        );
      }

      // Verificar se trailer arquivo tem contadores corretos
      const trailerLine = this._findTrailerArquivo(lines, detection);
      if (trailerLine) {
        this._validateCnab240TrailerCounts(trailerLine, recordCounts, result);
      }

    } else if (detection.format === 'cnab400') {
      // Para CNAB400 - estrutura mais simples
      if (recordCounts.headerArquivo !== 1) {
        result.addError(`Arquivo deve ter exatamente 1 header, encontrado ${recordCounts.headerArquivo}`);
      }

      if (recordCounts.trailerArquivo !== 1) {
        result.addError(`Arquivo deve ter exatamente 1 trailer, encontrado ${recordCounts.trailerArquivo}`);
      }

      // Verificar contadores no trailer
      const trailerLine = this._findTrailerArquivo(lines, detection);
      if (trailerLine) {
        this._validateCnab400TrailerCounts(trailerLine, recordCounts, result);
      }
    }
  }

  /**
   * Conta tipos de registro
   */
  _countRecordTypes(lines, detection) {
    const counts = {
      headerArquivo: 0,
      headerLote: 0,
      detalhes: 0,
      trailerLote: 0,
      trailerArquivo: 0,
      total: lines.length
    };

    for (const line of lines) {
      const recordType = detection.format === 'cnab240' ? line.charAt(7) : line.charAt(0);

      switch (recordType) {
        case '0':
          counts.headerArquivo++;
          break;
        case '1':
          if (detection.format === 'cnab240') counts.headerLote++;
          else counts.detalhes++;
          break;
        case '3':
          if (detection.format === 'cnab240') counts.detalhes++;
          break;
        case '5':
          if (detection.format === 'cnab240') counts.trailerLote++;
          break;
        case '9':
          counts.trailerArquivo++;
          break;
      }
    }

    return counts;
  }

  /**
   * Encontra linha do trailer arquivo
   */
  _findTrailerArquivo(lines, detection) {
    const recordTypePos = detection.format === 'cnab240' ? 7 : 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].charAt(recordTypePos) === '9') {
        return { line: lines[i], lineNumber: i + 1 };
      }
    }

    return null;
  }

  /**
   * Valida contadores no trailer CNAB240
   */
  _validateCnab240TrailerCounts(trailerInfo, actualCounts, result) {
    try {
      const line = trailerInfo.line;

      // Quantidade de lotes (posição 17-23)
      const qtdLotes = parseInt(line.substring(17, 23));
      if (qtdLotes !== actualCounts.headerLote) {
        result.addError(
          `Trailer: quantidade de lotes ${qtdLotes} diferente do encontrado ${actualCounts.headerLote}`
        );
      }

      // Quantidade de registros (posição 23-29)
      const qtdRegistros = parseInt(line.substring(23, 29));
      if (qtdRegistros !== actualCounts.total) {
        result.addError(
          `Trailer: quantidade de registros ${qtdRegistros} diferente do encontrado ${actualCounts.total}`
        );
      }

    } catch (error) {
      result.addWarning(`Erro ao validar contadores do trailer CNAB240: ${error.message}`);
    }
  }

  /**
   * Valida contadores no trailer CNAB400
   */
  _validateCnab400TrailerCounts(trailerInfo, actualCounts, result) {
    try {
      const line = trailerInfo.line;

      // Para CNAB400, a posição dos contadores varia por banco
      // Implementação básica - pode ser extendida por banco específico

      // Alguns bancos colocam contador na posição 394-400
      if (line.length >= 400) {
        const seqRegistro = line.substring(394, 400);
        if (/^\d+$/.test(seqRegistro)) {
          const expectedSeq = actualCounts.total;
          const actualSeq = parseInt(seqRegistro);

          if (actualSeq !== expectedSeq) {
            result.addWarning(
              `Trailer: sequência de registro ${actualSeq} diferente do esperado ${expectedSeq}`
            );
          }
        }
      }

    } catch (error) {
      result.addWarning(`Erro ao validar contadores do trailer CNAB400: ${error.message}`);
    }
  }

  /**
   * Valida sequências numéricas
   */
  async _validateSequences(lines, detection, result) {
    if (detection.format === 'cnab240') {
      this._validateCnab240Sequences(lines, result);
    } else if (detection.format === 'cnab400') {
      this._validateCnab400Sequences(lines, result);
    }
  }

  /**
   * Valida sequências CNAB240
   */
  _validateCnab240Sequences(lines, result) {
    let expectedSequence = 1;
    let currentBatchSequence = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      const recordType = line.charAt(7);

      try {
        // Validar sequência geral (posição 8-13)
        const sequenciaRegistro = parseInt(line.substring(8, 13));

        if (sequenciaRegistro !== expectedSequence) {
          result.addError(
            `Linha ${lineNumber}: sequência de registro ${sequenciaRegistro}, esperado ${expectedSequence}`
          );
        }

        expectedSequence++;

        // Para headers de lote, validar numeração do lote
        if (recordType === '1') {
          const numeroLote = parseInt(line.substring(3, 7));
          if (numeroLote !== currentBatchSequence) {
            result.addError(
              `Linha ${lineNumber}: número do lote ${numeroLote}, esperado ${currentBatchSequence}`
            );
          }
          currentBatchSequence++;
        }

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar sequência - ${error.message}`);
      }
    }
  }

  /**
   * Valida sequências CNAB400
   */
  _validateCnab400Sequences(lines, result) {
    let expectedSequence = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        // A posição da sequência varia por banco, implementação genérica
        // Muitos bancos usam as últimas 6 posições (395-400)
        if (line.length >= 400) {
          const sequenciaStr = line.substring(394, 400);

          if (/^\d+$/.test(sequenciaStr)) {
            const sequencia = parseInt(sequenciaStr);

            if (sequencia !== expectedSequence) {
              result.addWarning(
                `Linha ${lineNumber}: sequência ${sequencia}, esperado ${expectedSequence}`
              );
            }
          }
        }

        expectedSequence++;

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar sequência - ${error.message}`);
      }
    }
  }

  /**
   * Valida totalizadores financeiros
   */
  async _validateFinancialTotals(lines, detection, result) {
    try {
      const financialData = this._extractFinancialData(lines, detection);

      // Somar valores dos detalhes
      const totalDetails = financialData.detailValues.reduce((sum, value) => sum + value, 0);

      // Comparar com total do trailer (se existir)
      if (financialData.trailerTotal !== null) {
        const difference = Math.abs(totalDetails - financialData.trailerTotal);

        // Tolerância de 0.01 para questões de arredondamento
        if (difference > 0.01) {
          result.addError(
            `Total financeiro: soma dos detalhes ${totalDetails.toFixed(2)} ` +
            `diferente do trailer ${financialData.trailerTotal.toFixed(2)}`
          );
        }
      }

      // Verificar se há valores negativos inesperados
      const negativeValues = financialData.detailValues.filter(v => v < 0);
      if (negativeValues.length > 0) {
        result.addWarning(`Encontrados ${negativeValues.length} valores negativos nos detalhes`);
      }

    } catch (error) {
      result.addWarning(`Erro ao validar totalizadores financeiros: ${error.message}`);
    }
  }

  /**
   * Extrai dados financeiros do arquivo
   */
  _extractFinancialData(lines, detection) {
    const financialData = {
      detailValues: [],
      trailerTotal: null,
      currency: 'BRL'
    };

    for (const line of lines) {
      const recordType = detection.format === 'cnab240' ? line.charAt(7) : line.charAt(0);

      try {
        // Extrair valores dos detalhes
        if ((detection.format === 'cnab240' && recordType === '3') ||
          (detection.format === 'cnab400' && recordType === '1')) {

          const value = this._extractValueFromDetailLine(line, detection);
          if (value !== null) {
            financialData.detailValues.push(value);
          }
        }

        // Extrair total do trailer
        if (recordType === '9') {
          const trailerTotal = this._extractValueFromTrailerLine(line, detection);
          if (trailerTotal !== null) {
            financialData.trailerTotal = trailerTotal;
          }
        }

      } catch (error) {
        // Ignorar erros de extração individual
        continue;
      }
    }

    return financialData;
  }

  /**
   * Extrai valor monetário de linha de detalhe
   */
  _extractValueFromDetailLine(line, detection) {
    try {
      if (detection.format === 'cnab240') {
        // Posições comuns para valores em CNAB240 (pode variar por segmento)
        // Segmento P: posição 119-133 (valor título)
        if (line.length >= 133) {
          const valueStr = line.substring(119, 133);
          return this._parseDecimalValue(valueStr, 2); // 2 casas decimais
        }
      } else if (detection.format === 'cnab400') {
        // Posições comuns para valores em CNAB400
        // Posição 126-139 (valor título) - 13 dígitos, 2 decimais
        if (line.length >= 139) {
          const valueStr = line.substring(126, 139);
          return this._parseDecimalValue(valueStr, 2);
        }
      }
    } catch (error) {
      // Retornar null se não conseguir extrair
    }

    return null;
  }

  /**
   * Extrai valor monetário de linha de trailer
   */
  _extractValueFromTrailerLine(line, detection) {
    try {
      if (detection.format === 'cnab240') {
        // Total geral pode estar em diferentes posições
        // Implementação básica
        if (line.length >= 240) {
          // Tentar extrair de posições comuns
          const valueStr = line.substring(220, 235); // Exemplo
          return this._parseDecimalValue(valueStr, 2);
        }
      } else if (detection.format === 'cnab400') {
        // Similar para CNAB400
        if (line.length >= 400) {
          const valueStr = line.substring(380, 395); // Exemplo
          return this._parseDecimalValue(valueStr, 2);
        }
      }
    } catch (error) {
      // Retornar null se não conseguir extrair
    }

    return null;
  }

  /**
   * Parseia valor decimal de string
   */
  _parseDecimalValue(valueStr, decimalPlaces) {
    if (!/^\d+$/.test(valueStr)) {
      return null;
    }

    const numValue = parseInt(valueStr);
    return numValue / Math.pow(10, decimalPlaces);
  }

  /**
   * Valida consistência header/trailer
   */
  async _validateHeaderTrailerConsistency(lines, detection, result) {
    const headerLine = lines[0];
    const trailerLine = lines[lines.length - 1];

    if (!headerLine || !trailerLine) {
      result.addError('Header ou trailer não encontrado');
      return;
    }

    try {
      // Validar consistência de código do banco
      const headerBank = this._extractBankCodeFromHeader(headerLine, detection);
      const trailerBank = this._extractBankCodeFromTrailer(trailerLine, detection);

      if (headerBank && trailerBank && headerBank !== trailerBank) {
        result.addWarning(
          `Código do banco diferente entre header (${headerBank}) e trailer (${trailerBank})`
        );
      }

      // Validar data de geração (se presente em ambos)
      const headerDate = this._extractDateFromHeader(headerLine, detection);
      const trailerDate = this._extractDateFromTrailer(trailerLine, detection);

      if (headerDate && trailerDate && headerDate !== trailerDate) {
        result.addWarning(
          `Data de geração diferente entre header (${headerDate}) e trailer (${trailerDate})`
        );
      }

    } catch (error) {
      result.addWarning(`Erro ao validar consistência header/trailer: ${error.message}`);
    }
  }

  /**
   * Extrai código do banco do header
   */
  _extractBankCodeFromHeader(line, detection) {
    if (detection.format === 'cnab240') {
      return line.substring(0, 3);
    } else if (detection.format === 'cnab400') {
      return line.substring(76, 79);
    }
    return null;
  }

  /**
   * Extrai código do banco do trailer
   */
  _extractBankCodeFromTrailer(line, detection) {
    if (detection.format === 'cnab240') {
      return line.substring(0, 3);
    } else if (detection.format === 'cnab400') {
      // Para CNAB400, pode não ter código do banco no trailer
      return null;
    }
    return null;
  }

  /**
   * Extrai data do header
   */
  _extractDateFromHeader(line, detection) {
    try {
      if (detection.format === 'cnab240') {
        // Data de geração pode estar na posição 143-151
        const dateStr = line.substring(143, 151);
        return this._formatDate(dateStr);
      } else if (detection.format === 'cnab400') {
        // Data pode estar em diferentes posições
        const dateStr = line.substring(94, 100); // Exemplo
        return this._formatDate(dateStr);
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  /**
   * Extrai data do trailer
   */
  _extractDateFromTrailer(line, detection) {
    // Implementação similar ao header
    // Muitas vezes trailer não tem data
    return null;
  }

  /**
   * Formata data para comparação
   */
  _formatDate(dateStr) {
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 2)}/${dateStr.substring(2, 4)}/${dateStr.substring(4, 8)}`;
    } else if (dateStr.length === 6) {
      return `${dateStr.substring(0, 2)}/${dateStr.substring(2, 4)}/${dateStr.substring(4, 6)}`;
    }
    return dateStr;
  }

  /**
   * Valida integridade de lotes CNAB240
   */
  async _validateCnab240BatchIntegrity(lines, detection, result) {
    const batches = this._groupIntoButches(lines);

    for (const batch of batches) {
      this._validateSingleBatch(batch, result);
    }
  }

  /**
   * Agrupa linhas em lotes
   */
  _groupIntoButches(lines) {
    const batches = [];
    let currentBatch = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const recordType = line.charAt(7);

      if (recordType === '1') { // Header lote
        currentBatch = {
          headerLine: line,
          headerLineNumber: i + 1,
          detailLines: [],
          trailerLine: null,
          trailerLineNumber: null
        };
      } else if (recordType === '3' && currentBatch) { // Detalhe
        currentBatch.detailLines.push({
          line: line,
          lineNumber: i + 1
        });
      } else if (recordType === '5' && currentBatch) { // Trailer lote
        currentBatch.trailerLine = line;
        currentBatch.trailerLineNumber = i + 1;
        batches.push(currentBatch);
        currentBatch = null;
      }
    }

    return batches;
  }

  /**
   * Valida um lote individual
   */
  _validateSingleBatch(batch, result) {
    if (!batch.trailerLine) {
      result.addError(`Lote iniciado na linha ${batch.headerLineNumber} sem trailer correspondente`);
      return;
    }

    try {
      // Validar contadores do lote
      const expectedDetailCount = batch.detailLines.length;
      const trailerDetailCount = parseInt(batch.trailerLine.substring(17, 23));

      if (trailerDetailCount !== expectedDetailCount) {
        result.addError(
          `Lote linha ${batch.trailerLineNumber}: contador de detalhes ${trailerDetailCount}, encontrado ${expectedDetailCount}`
        );
      }

    } catch (error) {
      result.addWarning(`Erro ao validar lote: ${error.message}`);
    }
  }

  /**
   * Valida checksums (implementação básica)
   */
  async _validateChecksums(lines, detection, result) {
    // Implementação básica de checksum
    // Pode ser extendida para checksums específicos por banco

    try {
      const simpleChecksum = this._calculateSimpleChecksum(lines);

      // Se há um checksum esperado no arquivo, comparar
      // Esta é uma implementação genérica
      if (this.config.enableChecksumValidation) {
        result.addFieldValidation('file_checksum', {
          valid: true,
          value: simpleChecksum,
          algorithm: 'simple_sum'
        });
      }

    } catch (error) {
      result.addWarning(`Erro ao calcular checksum: ${error.message}`);
    }
  }

  /**
   * Calcula checksum simples
   */
  _calculateSimpleChecksum(lines) {
    let sum = 0;

    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        sum += line.charCodeAt(i);
      }
    }

    return sum % 65536; // Módulo 16-bit
  }
}

export default IntegrityValidator; 