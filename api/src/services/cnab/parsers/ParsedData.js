/**
 * ParsedData - Estrutura de Dados Parseados CNAB
 * 
 * Define as estruturas padronizadas para dados extraídos dos arquivos CNAB.
 * Utiliza Builder Pattern para construção gradual dos objetos complexos.
 */

/**
 * Builder para construir dados parseados
 */
export class ParsedDataBuilder {
  constructor(format, bankCode, bankName) {
    this.data = {
      metadata: {
        format,
        bankCode,
        bankName,
        totalLines: 0,
        totalBatches: 0,
        totalRecords: 0,
        buildTime: new Date().toISOString()
      },
      arquivo: {
        header: null,
        trailer: null
      },
      lotes: [], // Para CNAB240
      detalhes: [] // Para CNAB400 ou detalhes unificados
    };
  }

  setMetadata(metadata) {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  setFileHeader(headerData) {
    this.data.arquivo.header = headerData;
    return this;
  }

  setFileTrailer(trailerData) {
    this.data.arquivo.trailer = trailerData;
    return this;
  }

  addBatch(batchData) {
    this.data.lotes.push(batchData);
    this.data.metadata.totalBatches++;
    return this;
  }

  addDetail(detailData) {
    this.data.detalhes.push(detailData);
    this.data.metadata.totalRecords++;
    return this;
  }

  build() {
    return new ParsedData(this.data);
  }
}

/**
 * Estrutura principal de dados parseados
 */
export class ParsedData {
  constructor(data) {
    this.metadata = data.metadata;
    this.arquivo = data.arquivo;
    this.lotes = data.lotes;
    this.detalhes = data.detalhes;
  }

  /**
   * Obtém todos os detalhes (de todos os lotes para CNAB240)
   */
  getAllDetails() {
    if (this.metadata.format === 'cnab240') {
      return this.lotes.flatMap(lote => lote.detalhes || []);
    }
    return this.detalhes;
  }

  /**
   * Filtra detalhes por tipo de segmento
   */
  getDetailsBySegment(segmentType) {
    return this.getAllDetails().filter(detail =>
      detail.tipo === `detalhe_segmento_${segmentType.toLowerCase()}`
    );
  }

  /**
   * Obtém dados financeiros consolidados
   */
  getFinancialSummary() {
    const details = this.getAllDetails();

    const summary = {
      totalValue: 0,
      totalDiscount: 0,
      totalRecords: details.length,
      currency: 'BRL',
      bySegment: {}
    };

    for (const detail of details) {
      const data = detail.dados;

      // Somar valores (se existir)
      if (data.valor_titulo) {
        summary.totalValue += parseFloat(data.valor_titulo) || 0;
      }

      if (data.valor_desconto) {
        summary.totalDiscount += parseFloat(data.valor_desconto) || 0;
      }

      // Agrupar por segmento
      const segmentType = detail.tipo;
      if (!summary.bySegment[segmentType]) {
        summary.bySegment[segmentType] = {
          count: 0,
          totalValue: 0
        };
      }

      summary.bySegment[segmentType].count++;
      if (data.valor_titulo) {
        summary.bySegment[segmentType].totalValue += parseFloat(data.valor_titulo) || 0;
      }
    }

    return summary;
  }

  /**
   * Obtém estatísticas por tipo de registro
   */
  getRecordTypeStats() {
    const stats = {};

    const allRecords = [
      ...this.getAllDetails(),
      this.arquivo.header,
      this.arquivo.trailer,
      ...this.lotes.flatMap(lote => [lote.header, lote.trailer].filter(Boolean))
    ].filter(Boolean);

    for (const record of allRecords) {
      const type = record.tipo || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Converte para JSON serializable
   */
  toJSON() {
    return {
      metadata: this.metadata,
      arquivo: this.arquivo,
      lotes: this.lotes,
      detalhes: this.detalhes
    };
  }

  /**
   * Converte para formato simplificado
   */
  toSimpleFormat() {
    return {
      format: this.metadata.format,
      bank: {
        code: this.metadata.bankCode,
        name: this.metadata.bankName
      },
      summary: {
        totalRecords: this.metadata.totalRecords,
        totalBatches: this.metadata.totalBatches,
        financial: this.getFinancialSummary()
      },
      records: this.getAllDetails().map(detail => ({
        type: detail.tipo,
        data: detail.dados
      }))
    };
  }
}

/**
 * Estrutura para registro individual parseado
 */
export class ParsedRecord {
  constructor(type, rawLine, lineNumber) {
    this.tipo = type;
    this.linha = lineNumber;
    this.dados = {};
    this.metadata = {
      rawLine,
      extractedFields: 0,
      parseTime: new Date().toISOString()
    };
  }

  addField(fieldName, value, schema = null) {
    this.dados[fieldName] = value;
    this.metadata.extractedFields++;

    // Adicionar metadados do schema se disponível
    if (schema) {
      if (!this.metadata.schema) {
        this.metadata.schema = {};
      }
      this.metadata.schema[fieldName] = {
        picture: schema.picture,
        pos: schema.pos,
        description: schema.description || null
      };
    }

    return this;
  }

  addFields(fields, schemas = null) {
    for (const [fieldName, value] of Object.entries(fields)) {
      const fieldSchema = schemas?.[fieldName];
      this.addField(fieldName, value, fieldSchema);
    }
    return this;
  }

  setMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  toJSON() {
    return {
      tipo: this.tipo,
      linha: this.linha,
      dados: this.dados,
      metadata: this.metadata
    };
  }
}

/**
 * Estrutura para lote CNAB240
 */
export class ParsedBatch {
  constructor(batchNumber) {
    this.numeroLote = batchNumber;
    this.header = null;
    this.trailer = null;
    this.detalhes = [];
    this.metadata = {
      totalDetails: 0,
      segments: new Set(),
      createTime: new Date().toISOString()
    };
  }

  setHeader(headerData) {
    this.header = headerData;
    return this;
  }

  setTrailer(trailerData) {
    this.trailer = trailerData;
    return this;
  }

  addDetail(detailData) {
    this.detalhes.push(detailData);
    this.metadata.totalDetails++;

    // Rastrear tipos de segmento
    if (detailData.tipo) {
      this.metadata.segments.add(detailData.tipo);
    }

    return this;
  }

  finalize() {
    // Converter Set para Array para serialização
    this.metadata.segments = Array.from(this.metadata.segments);
    return this;
  }

  toJSON() {
    return {
      numeroLote: this.numeroLote,
      header: this.header,
      trailer: this.trailer,
      detalhes: this.detalhes,
      metadata: this.metadata
    };
  }
}

export default ParsedData; 