/**
 * Parser CNAB240 Específico - Multi-State
 * 
 * Este módulo implementa um parser específico para arquivos CNAB240
 * com foco em processamento multi-state do Segmento J e extração
 * posicional específica conforme PRD.
 * 
 * Arquitetura híbrida: funciona junto com o parser atual
 */

import { SegmentJMultiStateParser } from './segmentJParser.js';
import { PositionalExtractor } from './positionalExtractor.js';
import { SegmentBAdvancedProcessor } from './segmentBProcessor.js';
import { MonetaryConverter } from './monetaryConverter.js';
import { IntelligentMergeSystem } from './mergeSystem.js';

/**
 * Classe principal do parser específico CNAB240
 */
export class CNAB240SpecificParser {
  constructor(options = {}) {
    this.options = {
      enableFeatureFlag: options.enableFeatureFlag ?? true,
      debug: options.debug ?? false,
      multiStateJ: {
        enabled: options.multiStateJ?.enabled ?? true,
        sequenceValidation: options.multiStateJ?.sequenceValidation ?? true,
        enrichment: options.multiStateJ?.enrichment ?? true
      },
      segmentB: {
        advancedProcessing: options.segmentB?.advancedProcessing ?? true,
        qualityAnalysis: options.segmentB?.qualityAnalysis ?? true
      },
      merge: {
        enabled: options.merge?.enabled ?? true,
        strategy: options.merge?.strategy ?? 'intelligent',
        conflictResolution: options.merge?.conflictResolution ?? 'specific-wins'
      },
      ...options
    };

    // ✅ NOVO: Adicionar propriedade features para os testes
    this.features = {
      multiStateJ: this.options.multiStateJ.enabled,
      advancedSegmentB: this.options.segmentB.advancedProcessing,
      intelligentMerge: this.options.merge.enabled,
      positionalExtraction: true,
      monetaryConversion: true
    };

    // Inicializar componentes
    this.segmentJParser = new SegmentJMultiStateParser(this.options);
    this.positionalExtractor = new PositionalExtractor(this.options);
    this.segmentBProcessor = new SegmentBAdvancedProcessor(this.options);
    this.monetaryConverter = new MonetaryConverter(this.options);
    this.mergeSystem = new IntelligentMergeSystem(this.options);

    this.stats = {
      processedLines: 0,
      segmentJPairs: 0,
      extractedPayments: 0,
      errors: 0
    };

    this.debug = this.options.debug ? console.log.bind(console, '[SPECIFIC-PARSER]') : () => { };
  }

  /**
   * Processa arquivo CNAB240 completo
   * @param {string} fileContent - Conteúdo do arquivo
   * @param {Object} traditionalResult - Resultado do parser tradicional (opcional)
   * @returns {Object} Resultado do processamento específico
   */
  async processFile(fileContent, traditionalResult = null) {
    try {
      this.debug('Iniciando processamento específico');

      // Validar entrada
      if (!fileContent || typeof fileContent !== 'string') {
        throw new Error('Conteúdo do arquivo é obrigatório');
      }

      // Dividir em linhas
      const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
      this.stats.totalLines = lines.length;

      this.debug(`Processando ${lines.length} linhas`);

      // Processar cada linha conforme tipo
      const results = {
        pagamentos: [],
        segmentosJ: [],
        segmentosB: [],
        errors: [],
        processamento: {
          parserEspecifico: true,
          timestamp: new Date().toISOString()
        }
      };

      // 1. Processar segmentos J multi-state
      const segmentJResults = await this.processSegmentJLines(lines);
      if (segmentJResults.pairs.length > 0) {
        results.segmentosJ = segmentJResults.pairs;
        results.pagamentos.push(...segmentJResults.pagamentos);
        this.stats.segmentJPairs = segmentJResults.pairs.length;
      }

      // 2. Processar segmentos B avançados
      const segmentBResults = await this.processSegmentBLines(lines);
      if (segmentBResults.processed.length > 0) {
        results.segmentosB = segmentBResults.processed;
        this.stats.segmentBAdvanced = segmentBResults.processed.length;
      }

      // 3. Aplicar conversões monetárias
      if (results.pagamentos.length > 0) {
        results.pagamentos = results.pagamentos.map(pagamento =>
          this.monetaryConverter.convertPaymentValues(pagamento)
        );
      }

      // 4. Merge com resultado tradicional se fornecido
      if (traditionalResult && this.options.merge.enabled) {
        this.debug('Aplicando merge inteligente com resultado tradicional');
        const mergedResult = await this.mergeSystem.mergeResults(traditionalResult, results);
        this.stats.mergeOperations++;

        return {
          ...mergedResult,
          dadosComplementares: results,
          estatisticas: this.getProcessingStats(),
          processamento: {
            ...results.processamento,
            merge: true,
            mergeStrategy: this.options.merge.strategy
          }
        };
      }

      // 5. Retornar resultado específico
      return {
        ...results,
        estatisticas: this.getProcessingStats(),
        processamento: {
          ...results.processamento,
          merge: false
        }
      };

    } catch (error) {
      this.stats.errors.push({
        type: 'processFile',
        message: error.message,
        timestamp: new Date().toISOString()
      });

      this.debug(`Erro no processamento específico: ${error.message}`);

      // Retornar erro estruturado
      return {
        success: false,
        error: error.message,
        pagamentos: [],
        estatisticas: this.getProcessingStats(),
        processamento: {
          parserEspecifico: true,
          erro: true,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Processa linhas buscando pares de segmentos J consecutivos
   * @param {Array} lines - Linhas do arquivo
   * @returns {Object} Resultado do processamento de segmentos J
   */
  async processSegmentJLines(lines) {
    const results = {
      pairs: [],
      pagamentos: [],
      errors: []
    };

    try {
      // Buscar linhas de segmento J
      const segmentJLines = lines
        .map((line, index) => ({ line, index, isSegmentJ: line.length >= 14 && line[13] === 'J' }))
        .filter(item => item.isSegmentJ);

      this.debug(`Encontradas ${segmentJLines.length} linhas de segmento J`);

      // Processar pares consecutivos
      for (let i = 0; i < segmentJLines.length - 1; i++) {
        const current = segmentJLines[i];
        const next = segmentJLines[i + 1];

        // Verificar se são consecutivos
        if (next.index === current.index + 1) {
          this.debug(`Processando par J consecutivo: linhas ${current.index + 1}-${next.index + 1}`);

          try {
            const processedPair = await this.segmentJParser.processConsecutiveLines(current.line, next.line);

            if (processedPair.success) {
              results.pairs.push(processedPair);

              // Extrair dados de pagamento do par processado
              const paymentData = this.extractPaymentFromJPair(processedPair);
              if (paymentData) {
                results.pagamentos.push(paymentData);
              }
            } else {
              results.errors.push({
                lines: [current.index + 1, next.index + 1],
                error: processedPair.error
              });
            }
          } catch (error) {
            results.errors.push({
              lines: [current.index + 1, next.index + 1],
              error: error.message
            });
          }

          // Pular próxima linha já que foi processada como par
          i++;
        }
      }

      this.debug(`Processamento de segmentos J concluído: ${results.pairs.length} pares, ${results.pagamentos.length} pagamentos`);

    } catch (error) {
      results.errors.push({
        type: 'processSegmentJLines',
        error: error.message
      });
    }

    return results;
  }

  /**
   * Extrai dados de pagamento de um par de segmentos J processado
   * @param {Object} jPair - Par de segmentos J processado
   * @returns {Object|null} Dados de pagamento extraídos
   */
  extractPaymentFromJPair(jPair) {
    if (!jPair.success || !jPair.data) {
      return null;
    }

    try {
      const paymentData = {
        id: `J_${jPair.data.sequence || Date.now()}`,
        tipo: 'SegmentoJ_MultiState',
        codigoBarras: jPair.data.codigoBarras,
        nomeBeneficiario: jPair.data.nomeBeneficiario,
        valorDocumento: jPair.data.valorDocumento,
        valorPago: jPair.data.valorPago,
        dataVencimento: jPair.data.dataVencimento,
        dataPagamento: jPair.data.dataPagamento,
        informacoesComplementares: jPair.data.informacoesComplementares,

        // Metadados específicos
        _metadata: {
          parser: 'CNAB240SpecificParser',
          type: 'segmentJ_multiState',
          linhas: jPair.metadata?.sourceLines || [],
          processedAt: new Date().toISOString(),
          qualityScore: jPair.data.qualityScore || 0
        }
      };

      return paymentData;
    } catch (error) {
      this.debug(`Erro ao extrair pagamento do par J: ${error.message}`);
      return null;
    }
  }

  /**
   * Processa linhas de segmento B com processamento avançado
   * @param {Array} lines - Linhas do arquivo
   * @returns {Object} Resultado do processamento de segmentos B
   */
  async processSegmentBLines(lines) {
    const results = {
      processed: [],
      errors: []
    };

    try {
      // Buscar linhas de segmento B
      const segmentBLines = lines
        .map((line, index) => ({ line, index, isSegmentB: line.length >= 14 && line[13] === 'B' }))
        .filter(item => item.isSegmentB);

      this.debug(`Encontradas ${segmentBLines.length} linhas de segmento B`);

      // Processar cada segmento B
      for (const item of segmentBLines) {
        try {
          const processedB = await this.segmentBProcessor.processSegmentB(item.line);

          if (processedB.success) {
            results.processed.push({
              ...processedB,
              sourceLineIndex: item.index
            });
          } else {
            results.errors.push({
              line: item.index + 1,
              error: processedB.error
            });
          }
        } catch (error) {
          results.errors.push({
            line: item.index + 1,
            error: error.message
          });
        }
      }

      this.debug(`Processamento de segmentos B concluído: ${results.processed.length} processados`);

    } catch (error) {
      results.errors.push({
        type: 'processSegmentBLines',
        error: error.message
      });
    }

    return results;
  }

  /**
   * Retorna estatísticas do processamento
   * @returns {Object} Estatísticas de processamento
   */
  getProcessingStats() {
    return {
      totalLines: this.stats.totalLines,
      processedLines: this.stats.processedLines,
      segmentJPairs: this.stats.segmentJPairs,
      segmentBAdvanced: this.stats.segmentBAdvanced,
      mergeOperations: this.stats.mergeOperations,
      errors: this.stats.errors.length,
      errorDetails: this.stats.errors,
      features: this.features,
      options: {
        enableFeatureFlag: this.options.enableFeatureFlag,
        multiStateJ: this.options.multiStateJ.enabled,
        advancedSegmentB: this.options.segmentB.advancedProcessing,
        intelligentMerge: this.options.merge.enabled
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset das estatísticas
   */
  resetStats() {
    this.stats = {
      totalLines: 0,
      processedLines: 0,
      segmentJPairs: 0,
      segmentBAdvanced: 0,
      mergeOperations: 0,
      errors: []
    };
  }
}

// Exportações
export { SegmentJMultiStateParser } from './segmentJParser.js';
export { PositionalExtractor } from './positionalExtractor.js';
export { SegmentBAdvancedProcessor } from './segmentBProcessor.js';
export { MonetaryConverter } from './monetaryConverter.js';
export { IntelligentMergeSystem } from './mergeSystem.js';

export default CNAB240SpecificParser; 