/**
 * CnabDetector - Detector Universal de Formatos CNAB
 * 
 * Responsável por detectar automaticamente:
 * - Formato CNAB (240 ou 400)
 * - Banco emissor do arquivo
 * - Tipo de arquivo (remessa/retorno)
 * - Estrutura e características
 */

/**
 * Classe principal para detecção automática de CNAB
 */
export class CnabDetector {
  constructor(config = {}) {
    this.config = config;

    // Mapeamento de códigos de banco conhecidos
    this.bankCodes = {
      '001': 'Banco do Brasil',
      '033': 'Santander',
      '041': 'Banrisul',
      '104': 'Caixa Econômica Federal',
      '237': 'Bradesco',
      '341': 'Itaú',
      '422': 'Banco Safra',
      '748': 'Sicredi',
      '756': 'Sicoob'
    };

    // Padrões de detecção de formato
    this.formatPatterns = {
      cnab240: {
        lineLength: 240,
        headerPattern: /^.{7}[01]/,  // 8ª posição: 0=header arquivo, 1=header lote
        bankPosition: [0, 3],        // Posições 1-3
        recordTypePosition: 7        // 8ª posição
      },
      cnab400: {
        lineLength: 400,
        headerPattern: /^0/,         // 1ª posição: 0=header
        bankPosition: [76, 79],      // Posições 77-79 no header
        recordTypePosition: 0        // 1ª posição
      }
    };
  }

  /**
   * Detecta o formato CNAB a partir do conteúdo do arquivo
   * @param {string|Buffer} content - Conteúdo do arquivo CNAB
   * @returns {Object} Informações de detecção
   */
  detectFormat(content) {
    try {
      // Converter para string se for Buffer
      const textContent = content instanceof Buffer ? content.toString('utf8') : content;

      // Dividir em linhas e pegar a primeira linha válida
      const lines = textContent.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length === 0) {
        throw new Error('Arquivo vazio ou inválido');
      }

      const firstLine = lines[0];
      const detectionResult = this._analyzeFirstLine(firstLine);

      // Análise adicional do arquivo completo
      const fileAnalysis = this._analyzeCompleteFile(lines);

      return {
        ...detectionResult,
        ...fileAnalysis,
        confidence: this._calculateConfidence(detectionResult, fileAnalysis),
        detectedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Erro na detecção: ${error.message}`);
    }
  }

  /**
   * Analisa a primeira linha para detecção básica
   */
  _analyzeFirstLine(line) {
    const lineLength = line.length;

    // Detectar formato baseado no tamanho da linha
    let format = null;
    let bankCode = null;
    let recordType = null;

    if (lineLength === 240) {
      format = 'cnab240';
      bankCode = line.substring(0, 3);
      recordType = line.charAt(7);

      // Validar se é realmente um header arquivo CNAB240
      if (recordType !== '0') {
        console.warn('⚠️  CNAB240 detectado mas primeira linha não é header arquivo');
      }

    } else if (lineLength === 400) {
      format = 'cnab400';
      recordType = line.charAt(0);

      // No CNAB400, o banco está em posições diferentes dependendo do registro
      if (recordType === '0') { // Header
        bankCode = line.substring(76, 79);
      } else {
        console.warn('⚠️  CNAB400 detectado mas primeira linha não é header');
        // Tentar encontrar banco em outras posições comuns
        bankCode = this._extractBankFromCnab400Detail(line);
      }

    } else {
      throw new Error(`Tamanho de linha inválido: ${lineLength} (esperado 240 ou 400)`);
    }

    // Validar código do banco
    const bankName = this.bankCodes[bankCode] || 'Banco Desconhecido';

    return {
      format,
      bankCode,
      bankName,
      recordType,
      lineLength,
      isValidBank: this.bankCodes.hasOwnProperty(bankCode),
      firstLineData: {
        raw: line.substring(0, 50) + '...', // Primeiros 50 chars para debug
        length: lineLength
      }
    };
  }

  /**
   * Analisa o arquivo completo para informações adicionais
   */
  _analyzeCompleteFile(lines) {
    const analysis = {
      totalLines: lines.length,
      recordTypes: new Set(),
      hasHeader: false,
      hasTrailer: false,
      estimatedRecords: 0,
      fileType: 'unknown' // remessa, retorno, etc.
    };

    // Analisar todas as linhas
    for (const line of lines) {
      if (line.length === 240) {
        // CNAB240
        const recordType = line.charAt(7);
        analysis.recordTypes.add(`240-${recordType}`);

        if (recordType === '0') analysis.hasHeader = true;
        if (recordType === '9') analysis.hasTrailer = true;
        if (recordType === '3') analysis.estimatedRecords++;

      } else if (line.length === 400) {
        // CNAB400
        const recordType = line.charAt(0);
        analysis.recordTypes.add(`400-${recordType}`);

        if (recordType === '0') analysis.hasHeader = true;
        if (recordType === '9') analysis.hasTrailer = true;
        if (recordType === '1') analysis.estimatedRecords++;
      }
    }

    // Determinar tipo de arquivo baseado em padrões
    analysis.fileType = this._determineFileType(lines);

    return analysis;
  }

  /**
   * Determina se é arquivo de remessa ou retorno
   */
  _determineFileType(lines) {
    // Análise baseada em padrões comuns
    const firstLine = lines[0];

    if (firstLine.length === 240) {
      // CNAB240: verificar campo específico do tipo de arquivo
      // Posição comum para tipo de arquivo em muitos bancos
      const typeIndicator = firstLine.substring(142, 143); // Exemplo

      if (typeIndicator === '1') return 'remessa';
      if (typeIndicator === '2') return 'retorno';
    }

    if (firstLine.length === 400) {
      // CNAB400: padrões variam por banco
      // Análise heurística baseada em conteúdo
      const content = firstLine.toLowerCase();

      if (content.includes('remessa')) return 'remessa';
      if (content.includes('retorno')) return 'retorno';
    }

    return 'unknown';
  }

  /**
   * Tenta extrair código do banco em linha de detalhe CNAB400
   */
  _extractBankFromCnab400Detail(line) {
    // Posições comuns onde bancos podem aparecer em registros de detalhe
    const commonPositions = [[0, 3], [20, 23], [50, 53]];

    for (const [start, end] of commonPositions) {
      const potential = line.substring(start, end);
      if (this.bankCodes.hasOwnProperty(potential)) {
        return potential;
      }
    }

    return '000'; // Código genérico se não encontrar
  }

  /**
   * Calcula nível de confiança da detecção
   */
  _calculateConfidence(detectionResult, fileAnalysis) {
    let confidence = 0;

    // Formato detectado corretamente
    if (detectionResult.format) confidence += 30;

    // Banco conhecido
    if (detectionResult.isValidBank) confidence += 25;

    // Estrutura válida (header + trailer)
    if (fileAnalysis.hasHeader && fileAnalysis.hasTrailer) confidence += 25;

    // Número razoável de registros
    if (fileAnalysis.estimatedRecords > 0) confidence += 10;

    // Tipo de arquivo identificado
    if (fileAnalysis.fileType !== 'unknown') confidence += 10;

    return Math.min(confidence, 100);
  }

  /**
   * Detecta formato apenas pela primeira linha (método rápido)
   */
  quickDetect(firstLine) {
    return this._analyzeFirstLine(firstLine);
  }

  /**
   * Verifica se um arquivo é válido para processamento
   */
  isValidCnabFile(content) {
    try {
      const detection = this.detectFormat(content);
      return detection.confidence >= 70;
    } catch {
      return false;
    }
  }

  /**
   * Obtém lista de bancos suportados
   */
  getSupportedBanks() {
    return this.bankCodes;
  }
}

export default CnabDetector; 