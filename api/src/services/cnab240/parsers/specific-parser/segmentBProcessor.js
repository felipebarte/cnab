/**
 * Processador Avançado do Segmento B
 * 
 * Implementa processamento especializado para o Segmento B do CNAB240
 * com foco em extração e processamento inteligente de dados complementares
 * conforme especificado no PRD.
 */

import { PositionalExtractor } from './positionalExtractor.js';

export class SegmentBAdvancedProcessor {
  constructor() {
    this.extractor = new PositionalExtractor();

    this.stats = {
      processedLines: 0,
      extractedEmails: 0,
      validAddresses: 0,
      validCnpjs: 0,
      errors: 0
    };

    // Configurações para processamento avançado
    this.config = {
      enableEmailExtraction: true,
      enableAddressValidation: true,
      enableCnpjValidation: true,
      strictValidation: false,
      addressMinLength: 10,
      emailRegexStrict: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    };
  }

  /**
   * Processa linha do Segmento B com lógica avançada
   * @param {string} line - Linha do Segmento B
   * @param {Object} options - Opções específicas de processamento
   * @returns {Object|null} Dados processados ou null
   */
  async process(line, options = {}) {
    try {
      this.stats.processedLines++;

      // Combinar configurações
      const config = { ...this.config, ...options };

      // Extrair dados básicos
      const basicData = this.extractor.extractSegmentB(line);
      if (!basicData) {
        this.stats.errors++;
        return null;
      }

      // Aplicar processamento avançado
      const processedData = await this._applyAdvancedProcessing(basicData, config);

      // Enriquecer com validações e análises
      const enrichedData = this._enrichData(processedData, config);

      // Atualizar estatísticas
      this._updateStats(enrichedData);

      return enrichedData;

    } catch (error) {
      this.stats.errors++;
      console.error('Erro no processamento avançado do Segmento B:', error);
      return null;
    }
  }

  /**
   * Aplica processamento avançado aos dados extraídos
   * @private
   */
  async _applyAdvancedProcessing(data, config) {
    const processed = { ...data };

    // 1. Processamento avançado de endereço
    if (config.enableAddressValidation) {
      processed.endereco = this._processAddress(data);
    }

    // 2. Extração avançada de email
    if (config.enableEmailExtraction) {
      processed.email = this._extractAdvancedEmail(data, config);
    }

    // 3. Processamento de CNPJ
    if (config.enableCnpjValidation) {
      processed.cnpj = this._processCnpj(data);
    }

    // 4. Análise de dados inconsistentes
    processed.qualidade = this._analyzeDataQuality(processed);

    // 5. Detecção de padrões especiais
    processed.padroes = this._detectSpecialPatterns(processed);

    return processed;
  }

  /**
   * Processamento avançado de endereço
   * @private
   */
  _processAddress(data) {
    const address = {
      logradouro: data.logradouro || '',
      numero: data.numeroEndereco || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.cidade || '',
      uf: data.uf || '',
      cep: data.cep || '',
      cepFormatado: data.cepFormatado || '',
      enderecoCompleto: data.enderecoCompleto || ''
    };

    // Limpeza e normalização
    address.logradouroLimpo = this._cleanAddressField(address.logradouro);
    address.bairroLimpo = this._cleanAddressField(address.bairro);
    address.cidadeLimpa = this._cleanAddressField(address.cidade);

    // Validações específicas
    address.validacoes = {
      cepValido: this._validateCep(address.cep),
      ufValida: this._validateUf(address.uf),
      cidadeValida: this._validateCity(address.cidade),
      enderecoCompleto: address.enderecoCompleto.length >= this.config.addressMinLength
    };

    // Detecção de tipos de logradouro
    address.tipoLogradouro = this._detectAddressType(address.logradouro);

    // Padronização de CEP
    if (address.cep && address.cep.length === 8) {
      address.cepPadronizado = `${address.cep.substring(0, 5)}-${address.cep.substring(5)}`;
    }

    return address;
  }

  /**
   * Extração avançada de email
   * @private
   */
  _extractAdvancedEmail(data, config) {
    const emailData = {
      email: data.email || '',
      encontrado: false,
      valido: false,
      origem: null
    };

    // Buscar email em múltiplos campos
    const searchFields = [
      { field: 'logradouro', content: data.logradouro },
      { field: 'complemento', content: data.complemento },
      { field: 'bairro', content: data.bairro },
      { field: 'cidade', content: data.cidade }
    ];

    for (const field of searchFields) {
      if (field.content) {
        const emails = this._extractEmailsFromText(field.content, config);
        if (emails.length > 0) {
          emailData.email = emails[0]; // Primeiro email encontrado
          emailData.encontrado = true;
          emailData.origem = field.field;
          emailData.valido = config.emailRegexStrict.test(emails[0]);
          break;
        }
      }
    }

    // Validação adicional se email foi fornecido diretamente
    if (!emailData.encontrado && data.email) {
      emailData.encontrado = true;
      emailData.origem = 'direto';
      emailData.valido = config.emailRegexStrict.test(data.email);
    }

    return emailData;
  }

  /**
   * Processamento de CNPJ
   * @private
   */
  _processCnpj(data) {
    const cnpjData = {
      cnpj: data.cnpjFavorecido || '',
      valido: false,
      formatado: '',
      digitos: '',
      empresa: null
    };

    if (cnpjData.cnpj) {
      // Limpar CNPJ
      cnpjData.digitos = cnpjData.cnpj.replace(/\D/g, '');

      // Validar
      cnpjData.valido = this._validateCnpjAdvanced(cnpjData.digitos);

      // Formatar
      if (cnpjData.digitos.length === 14) {
        cnpjData.formatado = this._formatCnpj(cnpjData.digitos);
      }

      // Análise adicional (se implementado)
      cnpjData.tipo = this._analyzeCnpjType(cnpjData.digitos);
    }

    return cnpjData;
  }

  /**
   * Análise de qualidade dos dados
   * @private
   */
  _analyzeDataQuality(data) {
    const quality = {
      score: 0,
      issues: [],
      recommendations: []
    };

    let totalFields = 0;
    let validFields = 0;

    // Verificar campos obrigatórios
    const requiredFields = ['logradouro', 'cidade', 'uf', 'cep'];

    for (const field of requiredFields) {
      totalFields++;
      if (data[field] && data[field].toString().trim().length > 0) {
        validFields++;
      } else {
        quality.issues.push(`Campo obrigatório vazio: ${field}`);
      }
    }

    // Verificar campos opcionais mas importantes
    const optionalFields = ['bairro', 'numeroEndereco'];

    for (const field of optionalFields) {
      totalFields++;
      if (data[field] && data[field].toString().trim().length > 0) {
        validFields++;
      }
    }

    // Calcular score base
    quality.score = totalFields > 0 ? (validFields / totalFields) * 100 : 0;

    // Ajustes baseados em validações específicas
    if (data.endereco?.validacoes?.cepValido) {
      quality.score += 5;
    } else {
      quality.issues.push('CEP inválido');
    }

    if (data.endereco?.validacoes?.ufValida) {
      quality.score += 5;
    } else {
      quality.issues.push('UF inválida');
    }

    if (data.email?.valido) {
      quality.score += 10;
    }

    if (data.cnpj?.valido) {
      quality.score += 10;
    }

    // Normalizar score (máximo 100)
    quality.score = Math.min(100, quality.score);

    // Gerar recomendações
    if (quality.score < 70) {
      quality.recommendations.push('Verificar e completar campos obrigatórios');
    }

    if (!data.email?.encontrado) {
      quality.recommendations.push('Buscar email em outros campos do arquivo');
    }

    return quality;
  }

  /**
   * Detecta padrões especiais nos dados
   * @private
   */
  _detectSpecialPatterns(data) {
    const patterns = {
      enderecoComercial: false,
      enderecoResidencial: false,
      enderecoRural: false,
      temTelefone: false,
      temWhatsapp: false,
      temSite: false
    };

    const fullText = [
      data.logradouro,
      data.complemento,
      data.bairro
    ].join(' ').toLowerCase();

    // Padrões de endereço comercial
    const comercialPatterns = [
      /sala|andar|conjunto|loja|galpão|escritório|empresarial/i
    ];
    patterns.enderecoComercial = comercialPatterns.some(pattern => pattern.test(fullText));

    // Padrões residenciais
    const residencialPatterns = [
      /casa|residência|apt|apartamento|bloco/i
    ];
    patterns.enderecoResidencial = residencialPatterns.some(pattern => pattern.test(fullText));

    // Padrões rurais
    const ruralPatterns = [
      /fazenda|sítio|chácara|estrada|zona rural|km/i
    ];
    patterns.enderecoRural = ruralPatterns.some(pattern => pattern.test(fullText));

    // Detecção de telefone
    const phonePattern = /\(?(\d{2})\)?\s*(\d{4,5})-?(\d{4})/;
    patterns.temTelefone = phonePattern.test(fullText);

    // Detecção de WhatsApp
    patterns.temWhatsapp = /whats|wpp|zap/i.test(fullText);

    // Detecção de site
    const sitePattern = /(www\.|http|\.com|\.br)/i;
    patterns.temSite = sitePattern.test(fullText);

    return patterns;
  }

  /**
   * Enriquece dados com informações adicionais
   * @private
   */
  _enrichData(data, config) {
    return {
      ...data,

      // Metadados de processamento
      processamento: {
        timestamp: new Date().toISOString(),
        configuracao: {
          emailExtraction: config.enableEmailExtraction,
          addressValidation: config.enableAddressValidation,
          cnpjValidation: config.enableCnpjValidation
        }
      },

      // Resumo de validações
      resumoValidacoes: {
        enderecoValido: data.qualidade?.score >= 70,
        emailValido: data.email?.valido || false,
        cnpjValido: data.cnpj?.valido || false,
        qualidadeGeral: data.qualidade?.score || 0
      }
    };
  }

  /**
   * Atualiza estatísticas de processamento
   * @private
   */
  _updateStats(data) {
    if (data.email?.encontrado) {
      this.stats.extractedEmails++;
    }

    if (data.endereco?.validacoes?.enderecoCompleto) {
      this.stats.validAddresses++;
    }

    if (data.cnpj?.valido) {
      this.stats.validCnpjs++;
    }
  }

  // Métodos auxiliares privados

  /**
   * Limpa campo de endereço
   * @private
   */
  _cleanAddressField(field) {
    if (!field) return '';

    return field
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sÀ-ÿ]/g, '')
      .toUpperCase();
  }

  /**
   * Extrai emails de texto
   * @private
   */
  _extractEmailsFromText(text, config) {
    const emails = [];
    const matches = text.match(config.emailRegexStrict);

    if (matches) {
      emails.push(...matches);
    }

    return emails;
  }

  /**
   * Valida CEP
   * @private
   */
  _validateCep(cep) {
    if (!cep) return false;
    const cleaned = cep.replace(/\D/g, '');
    return cleaned.length === 8 && !/^0+$/.test(cleaned);
  }

  /**
   * Valida UF
   * @private
   */
  _validateUf(uf) {
    const validUfs = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];

    return uf && validUfs.includes(uf.toUpperCase());
  }

  /**
   * Valida cidade
   * @private
   */
  _validateCity(city) {
    return city && city.trim().length >= 2;
  }

  /**
   * Detecta tipo de logradouro
   * @private
   */
  _detectAddressType(logradouro) {
    if (!logradouro) return 'desconhecido';

    const tipos = {
      'rua': /^r\.|rua/i,
      'avenida': /^av\.|avenida/i,
      'alameda': /^al\.|alameda/i,
      'travessa': /^tv\.|travessa/i,
      'praça': /^pç\.|praça/i,
      'estrada': /^estr\.|estrada/i
    };

    for (const [tipo, pattern] of Object.entries(tipos)) {
      if (pattern.test(logradouro)) {
        return tipo;
      }
    }

    return 'outro';
  }

  /**
   * Valida CNPJ avançado
   * @private
   */
  _validateCnpjAdvanced(cnpj) {
    if (!cnpj || cnpj.length !== 14) return false;

    // Verificar se não são todos dígitos iguais
    if (/^(\d)\1*$/.test(cnpj)) return false;

    // Algoritmo de validação do CNPJ
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const calc = (cnpj, weights) => {
      const sum = cnpj.slice(0, weights.length).split('')
        .reduce((acc, digit, index) => acc + (parseInt(digit) * weights[index]), 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const digit1 = calc(cnpj, weights1);
    const digit2 = calc(cnpj, weights2);

    return digit1 === parseInt(cnpj[12]) && digit2 === parseInt(cnpj[13]);
  }

  /**
   * Formata CNPJ
   * @private
   */
  _formatCnpj(cnpj) {
    return `${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12)}`;
  }

  /**
   * Analisa tipo de CNPJ
   * @private
   */
  _analyzeCnpjType(cnpj) {
    if (!cnpj || cnpj.length !== 14) return 'inválido';

    // Análise básica baseada na estrutura
    const matriz = cnpj.substring(8, 12);

    if (matriz === '0001') return 'matriz';
    if (parseInt(matriz) > 1) return 'filial';

    return 'outro';
  }

  /**
   * Processa múltiplas linhas em lote
   */
  async processBatch(lines, options = {}) {
    const results = [];

    for (const line of lines) {
      const result = await this.process(line, options);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Obtém estatísticas de processamento
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.processedLines > 0
        ? ((this.stats.processedLines - this.stats.errors) / this.stats.processedLines) * 100
        : 0
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      processedLines: 0,
      extractedEmails: 0,
      validAddresses: 0,
      validCnpjs: 0,
      errors: 0
    };
  }

  /**
   * Atualiza configurações
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
}

export default SegmentBAdvancedProcessor; 