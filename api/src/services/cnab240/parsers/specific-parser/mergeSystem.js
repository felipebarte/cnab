/**
 * Sistema de Merge Inteligente
 * 
 * Implementa a lógica de merge inteligente entre o parser atual
 * e o parser específico conforme arquitetura híbrida do PRD.
 */

export class IntelligentMergeSystem {
  constructor() {
    this.config = {
      prioritizeSpecific: true,        // Priorizar dados do parser específico
      enableDeduplication: true,       // Remover duplicatas
      enableEnrichment: true,          // Enriquecer dados existentes
      conflictResolution: 'specific',  // 'specific' | 'current' | 'merge'
      preserveOriginal: true           // Manter dados originais como backup
    };

    this.stats = {
      mergedItems: 0,
      enrichedItems: 0,
      duplicatesRemoved: 0,
      conflicts: 0,
      errors: 0
    };
  }

  /**
   * Faz merge inteligente entre resultados dos parsers
   * @param {Object} currentResult - Resultado do parser atual
   * @param {Object} specificResult - Resultado do parser específico
   * @returns {Object} Resultado combinado
   */
  async mergeResults(currentResult, specificResult) {
    try {
      if (!currentResult && !specificResult) {
        return null;
      }

      if (!currentResult) {
        return this._formatSpecificResult(specificResult);
      }

      if (!specificResult) {
        return this._formatCurrentResult(currentResult);
      }

      // Realizar merge completo
      const merged = await this._performIntelligentMerge(currentResult, specificResult);

      return merged;

    } catch (error) {
      this.stats.errors++;
      console.error('Erro no merge inteligente:', error);

      // Retornar resultado atual como fallback
      return currentResult || specificResult;
    }
  }

  /**
   * Executa o merge inteligente completo
   * @private
   */
  async _performIntelligentMerge(currentResult, specificResult) {
    const merged = {
      // Metadados de merge
      processamento: {
        timestamp: new Date().toISOString(),
        mergeInteligente: true,
        parsers: {
          atual: !!currentResult,
          especifico: !!specificResult
        }
      }
    };

    // 1. Merge de pagamentos
    if (currentResult.pagamentos || specificResult.pagamentosEspecificos) {
      merged.pagamentos = await this._mergePayments(
        currentResult.pagamentos || [],
        specificResult.pagamentosEspecificos || []
      );
    }

    // 2. Merge de dados complementares
    if (currentResult.dadosComplementares || specificResult.dadosComplementares) {
      merged.dadosComplementares = this._mergeComplementaryData(
        currentResult.dadosComplementares || {},
        specificResult.dadosComplementares || {}
      );
    }

    // 3. Merge de estatísticas
    merged.estatisticas = this._mergeStatistics(
      currentResult.estatisticas || {},
      specificResult.processamento?.estatisticas || {}
    );

    // 4. Preservar dados originais se configurado
    if (this.config.preserveOriginal) {
      merged._backup = {
        parserAtual: currentResult,
        parserEspecifico: specificResult
      };
    }

    // 5. Merge de dados de processamento
    merged.processamento = {
      ...merged.processamento,
      ...this._mergeProcessingData(currentResult, specificResult)
    };

    this.stats.mergedItems++;
    return merged;
  }

  /**
   * Faz merge de pagamentos com lógica de deduplicação
   * @private
   */
  async _mergePayments(currentPayments, specificPayments) {
    const mergedPayments = [];
    const processedIds = new Set();

    // Primeiro, adicionar pagamentos específicos (prioridade)
    for (const specificPayment of specificPayments) {
      const enrichedPayment = this._enrichPaymentData(specificPayment, 'specific');
      mergedPayments.push(enrichedPayment);

      // Criar chave única para deduplicação
      const uniqueKey = this._generatePaymentKey(specificPayment);
      processedIds.add(uniqueKey);

      this.stats.enrichedItems++;
    }

    // Depois, adicionar pagamentos do parser atual (se não duplicados)
    for (const currentPayment of currentPayments) {
      const uniqueKey = this._generatePaymentKey(currentPayment);

      if (this.config.enableDeduplication && processedIds.has(uniqueKey)) {
        this.stats.duplicatesRemoved++;
        continue;
      }

      // Tentar enriquecer com dados específicos
      const enriched = await this._tryEnrichCurrentPayment(currentPayment, specificPayments);
      const finalPayment = this._enrichPaymentData(enriched, 'current');

      mergedPayments.push(finalPayment);
      processedIds.add(uniqueKey);
    }

    return this._sortPayments(mergedPayments);
  }

  /**
   * Gera chave única para pagamento (para deduplicação)
   * @private
   */
  _generatePaymentKey(payment) {
    // Usar múltiplos campos para criar chave única
    const keys = [
      payment.codigo_barras || payment.codigoBarras || '',
      payment.valor || payment.valorPagamento || '',
      payment.favorecido_nome || payment.nomeFavorecido || '',
      payment.data_pagamento || payment.dataPagamento || ''
    ];

    return keys.join('|').toLowerCase().trim();
  }

  /**
   * Tenta enriquecer pagamento atual com dados específicos
   * @private
   */
  async _tryEnrichCurrentPayment(currentPayment, specificPayments) {
    if (!this.config.enableEnrichment) {
      return currentPayment;
    }

    // Buscar pagamento correspondente no resultado específico
    const currentKey = this._generatePaymentKey(currentPayment);

    for (const specificPayment of specificPayments) {
      const specificKey = this._generatePaymentKey(specificPayment);

      if (this._keysMatch(currentKey, specificKey)) {
        // Encontrou correspondência - fazer merge dos dados
        return this._mergePaymentData(currentPayment, specificPayment);
      }
    }

    return currentPayment;
  }

  /**
   * Verifica se duas chaves correspondem (com tolerância)
   * @private
   */
  _keysMatch(key1, key2) {
    // Comparação exata
    if (key1 === key2) return true;

    // Comparação com tolerância para valores monetários
    const parts1 = key1.split('|');
    const parts2 = key2.split('|');

    if (parts1.length !== parts2.length) return false;

    for (let i = 0; i < parts1.length; i++) {
      if (i === 1) { // Campo de valor (índice 1)
        const val1 = parseFloat(parts1[i]) || 0;
        const val2 = parseFloat(parts2[i]) || 0;

        // Tolerância de 1 centavo
        if (Math.abs(val1 - val2) > 0.01) return false;
      } else {
        if (parts1[i] !== parts2[i]) return false;
      }
    }

    return true;
  }

  /**
   * Faz merge de dados de dois pagamentos
   * @private
   */
  _mergePaymentData(currentPayment, specificPayment) {
    const merged = { ...currentPayment };

    // Resolver conflitos baseado na configuração
    for (const [key, specificValue] of Object.entries(specificPayment)) {
      if (specificValue !== null && specificValue !== undefined && specificValue !== '') {
        const currentValue = merged[key];

        if (currentValue && currentValue !== specificValue) {
          // Conflito detectado
          this.stats.conflicts++;
          merged[key] = this._resolveConflict(key, currentValue, specificValue);

          // Preservar ambos os valores em caso de conflito
          if (!merged._conflicts) merged._conflicts = {};
          merged._conflicts[key] = {
            atual: currentValue,
            especifico: specificValue,
            resolvido: merged[key]
          };
        } else {
          // Não há conflito, usar valor específico
          merged[key] = specificValue;
        }
      }
    }

    return merged;
  }

  /**
   * Resolve conflito entre valores
   * @private
   */
  _resolveConflict(field, currentValue, specificValue) {
    switch (this.config.conflictResolution) {
      case 'specific':
        return specificValue;

      case 'current':
        return currentValue;

      case 'merge':
        // Lógica específica por campo
        if (field === 'valor' || field === 'valorPagamento') {
          // Para valores, usar o específico (mais preciso)
          return specificValue;
        }

        if (field.includes('nome') || field.includes('Nome')) {
          // Para nomes, usar o mais completo
          return specificValue.length > currentValue.length ? specificValue : currentValue;
        }

        // Padrão: priorizar específico
        return specificValue;

      default:
        return specificValue;
    }
  }

  /**
   * Enriquece dados do pagamento com metadados
   * @private
   */
  _enrichPaymentData(payment, source) {
    return {
      ...payment,
      _metadata: {
        origem: source,
        timestamp: new Date().toISOString(),
        enriquecido: this.config.enableEnrichment
      }
    };
  }

  /**
   * Ordena pagamentos por critérios relevantes
   * @private
   */
  _sortPayments(payments) {
    return payments.sort((a, b) => {
      // 1. Por data de pagamento
      const dateA = new Date(a.data_pagamento || a.dataPagamento || 0);
      const dateB = new Date(b.data_pagamento || b.dataPagamento || 0);

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // 2. Por valor (decrescente)
      const valueA = parseFloat(a.valor || a.valorPagamento || 0);
      const valueB = parseFloat(b.valor || b.valorPagamento || 0);

      return valueB - valueA;
    });
  }

  /**
   * Faz merge de dados complementares
   * @private
   */
  _mergeComplementaryData(currentData, specificData) {
    return {
      ...currentData,
      ...specificData,

      // Metadados de merge
      _merge: {
        timestamp: new Date().toISOString(),
        camposAtuais: Object.keys(currentData).length,
        camposEspecificos: Object.keys(specificData).length
      }
    };
  }

  /**
   * Faz merge de estatísticas
   * @private
   */
  _mergeStatistics(currentStats, specificStats) {
    return {
      ...currentStats,
      ...specificStats,

      // Estatísticas combinadas
      totalRegistros: (currentStats.totalRegistros || 0) + (specificStats.processedLines || 0),

      // Estatísticas de merge
      merge: {
        itensCombiandos: this.stats.mergedItems,
        itensEnriquecidos: this.stats.enrichedItems,
        duplicatasRemovidas: this.stats.duplicatesRemoved,
        conflitos: this.stats.conflicts
      }
    };
  }

  /**
   * Faz merge de dados de processamento
   * @private
   */
  _mergeProcessingData(currentResult, specificResult) {
    return {
      parserAtual: {
        versao: currentResult.versao || 'N/A',
        tempo: currentResult.tempo || null
      },

      parserEspecifico: {
        versao: specificResult.processamento?.versao || 'específico-v1',
        totalLinhas: specificResult.processamento?.totalLinhas || 0,
        totalPagamentosEspecificos: specificResult.processamento?.totalPagamentosEspecificos || 0
      },

      configuracao: { ...this.config }
    };
  }

  /**
   * Formata resultado específico quando não há parser atual
   * @private
   */
  _formatSpecificResult(specificResult) {
    return {
      pagamentos: specificResult.pagamentosEspecificos || [],
      processamento: {
        ...specificResult.processamento,
        apenasParserEspecifico: true
      },
      estatisticas: specificResult.processamento?.estatisticas || {}
    };
  }

  /**
   * Formata resultado atual quando não há parser específico
   * @private
   */
  _formatCurrentResult(currentResult) {
    return {
      ...currentResult,
      processamento: {
        ...currentResult.processamento,
        apenasParserAtual: true,
        parserEspecificoDisponivel: false
      }
    };
  }

  /**
   * Obtém estatísticas de merge
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.mergedItems > 0
        ? ((this.stats.mergedItems - this.stats.errors) / this.stats.mergedItems) * 100
        : 0
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      mergedItems: 0,
      enrichedItems: 0,
      duplicatesRemoved: 0,
      conflicts: 0,
      errors: 0
    };
  }

  /**
   * Atualiza configurações do sistema de merge
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém configurações atuais
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Valida se merge pode ser realizado
   */
  canMerge(currentResult, specificResult) {
    return !!(currentResult || specificResult);
  }

  /**
   * Analisa qualidade do merge
   */
  analyzeMergeQuality(mergedResult) {
    const analysis = {
      qualidade: 0,
      aspectos: {},
      recomendacoes: []
    };

    if (!mergedResult) {
      return analysis;
    }

    // Análise de cobertura de dados
    const totalPayments = mergedResult.pagamentos?.length || 0;
    const enrichedPayments = mergedResult.pagamentos?.filter(p => p._metadata?.enriquecido)?.length || 0;

    analysis.aspectos.coberturaEnriquecimento = totalPayments > 0 ? (enrichedPayments / totalPayments) * 100 : 0;
    analysis.aspectos.totalPagamentos = totalPayments;
    analysis.aspectos.conflitosResolvidos = this.stats.conflicts;
    analysis.aspectos.duplicatasRemovidas = this.stats.duplicatesRemoved;

    // Calcular qualidade geral
    analysis.qualidade = (
      analysis.aspectos.coberturaEnriquecimento * 0.4 +
      (totalPayments > 0 ? 50 : 0) * 0.3 +
      (this.stats.conflicts === 0 ? 100 : 80) * 0.3
    );

    // Gerar recomendações
    if (analysis.aspectos.coberturaEnriquecimento < 50) {
      analysis.recomendacoes.push('Melhorar cobertura de enriquecimento de dados');
    }

    if (this.stats.conflicts > 0) {
      analysis.recomendacoes.push('Revisar resolução de conflitos');
    }

    return analysis;
  }
}

export default IntelligentMergeSystem; 