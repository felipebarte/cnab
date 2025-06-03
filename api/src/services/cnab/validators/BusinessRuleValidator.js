/**
 * BusinessRuleValidator - Validador de Regras de Negócio CNAB
 * 
 * Responsável por validar regras de negócio específicas:
 * - Datas válidas (vencimento não pode ser passado)
 * - CPF/CNPJ válidos
 * - Valores monetários positivos
 * - Códigos de banco válidos
 * - Regras específicas por banco
 * - Relacionamentos entre campos
 */

/**
 * Validador de regras de negócio para arquivos CNAB
 */
export class BusinessRuleValidator {
  constructor(config = {}) {
    this.config = config;

    // Códigos de banco válidos (principais bancos brasileiros)
    this.validBankCodes = new Set([
      '001', // Banco do Brasil
      '033', // Santander
      '104', // Caixa Econômica Federal
      '237', // Bradesco
      '341', // Itaú
      '356', // Banco Real (agora Santander)
      '389', // Banco Mercantil do Brasil
      '422', // Banco Safra
      '745', // Citibank
      '756', // SICOOB
      '077', // Banco Inter
      '212', // Banco Original
      '260', // Nu Pagamentos (Nubank)
      '336', // Banco C6
      '290', // Pagseguro
      '364', // Gerencianet
      '323', // Mercado Pago
      '380', // PicPay
    ]);

    // Tipos de documento válidos
    this.documentTypes = {
      '01': 'CPF',
      '02': 'CNPJ',
      '03': 'PIS/PASEP',
      '04': 'RG',
      '05': 'CNH'
    };

    // Códigos de moeda válidos
    this.validCurrencyCodes = new Set([
      'BRL', // Real Brasileiro
      'USD', // Dólar Americano
      'EUR', // Euro
      'ARS', // Peso Argentino
      'UYU', // Peso Uruguaio
      'PYG'  // Guarani Paraguaio
    ]);
  }

  /**
   * Valida regras de negócio do arquivo completo
   */
  async validateFile(lines, schemas, detection, result) {
    try {
      // Validar regras de data
      await this._validateDateRules(lines, detection, result);

      // Validar regras financeiras
      await this._validateFinancialRules(lines, detection, result);

      // Validar documentos (CPF/CNPJ)
      await this._validateDocumentRules(lines, detection, result);

      // Validar códigos de banco
      await this._validateBankCodeRules(lines, detection, result);

      // Validar regras específicas por banco
      await this._validateBankSpecificRules(lines, detection, result);

      // Validar relacionamentos entre campos
      await this._validateFieldRelationships(lines, detection, result);

    } catch (error) {
      result.addError(`Erro na validação de regras de negócio: ${error.message}`);
    }
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Valida regras de data
   */
  async _validateDateRules(lines, detection, result) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        // Extrair datas relevantes da linha
        const dates = this._extractDatesFromLine(line, detection);

        for (const dateInfo of dates) {
          const { value: dateStr, type, fieldName } = dateInfo;

          if (!dateStr || dateStr === '00000000' || dateStr === '000000') {
            continue; // Data vazia ou zerada é válida em muitos casos
          }

          const parsedDate = this._parseDate(dateStr);
          if (!parsedDate) {
            result.addError(
              `Linha ${lineNumber}, campo ${fieldName}: data inválida '${dateStr}'`,
              lineNumber,
              fieldName
            );
            continue;
          }

          // Validar regras específicas por tipo de data
          switch (type) {
          case 'vencimento':
            // Vencimento não pode ser muito no passado (tolerância de 30 dias)
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            if (parsedDate < thirtyDaysAgo) {
              result.addWarning(
                `Linha ${lineNumber}, campo ${fieldName}: data de vencimento muito antiga (${this._formatDate(parsedDate)})`,
                lineNumber,
                fieldName
              );
            }
            break;

          case 'emissao':
            // Data de emissão não pode ser futura
            if (parsedDate > today) {
              result.addError(
                `Linha ${lineNumber}, campo ${fieldName}: data de emissão futura (${this._formatDate(parsedDate)})`,
                lineNumber,
                fieldName
              );
            }

            // Data de emissão não pode ser muito antiga (5 anos)
            const fiveYearsAgo = new Date(today);
            fiveYearsAgo.setFullYear(today.getFullYear() - 5);

            if (parsedDate < fiveYearsAgo) {
              result.addWarning(
                `Linha ${lineNumber}, campo ${fieldName}: data de emissão muito antiga (${this._formatDate(parsedDate)})`,
                lineNumber,
                fieldName
              );
            }
            break;

          case 'processamento':
            // Data de processamento deve ser hoje ou próxima
            const tenDaysFromNow = new Date(today);
            tenDaysFromNow.setDate(today.getDate() + 10);

            if (parsedDate > tenDaysFromNow) {
              result.addWarning(
                `Linha ${lineNumber}, campo ${fieldName}: data de processamento muito futura (${this._formatDate(parsedDate)})`,
                lineNumber,
                fieldName
              );
            }
            break;
          }
        }

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar datas - ${error.message}`, lineNumber);
      }
    }
  }

  /**
   * Extrai datas de uma linha
   */
  _extractDatesFromLine(line, detection) {
    const dates = [];

    if (detection.format === 'cnab240') {
      // Registros de detalhe CNAB240
      if (line.charAt(7) === '3') {
        const segment = line.charAt(13);

        if (segment === 'P') {
          // Segmento P - informações do título
          dates.push({
            value: line.substring(73, 81),  // Data vencimento
            type: 'vencimento',
            fieldName: 'data_vencimento'
          });

          dates.push({
            value: line.substring(157, 165), // Data emissão
            type: 'emissao',
            fieldName: 'data_emissao'
          });
        }
      }

      // Header arquivo
      if (line.charAt(7) === '0') {
        dates.push({
          value: line.substring(143, 151), // Data geração
          type: 'processamento',
          fieldName: 'data_geracao'
        });
      }

    } else if (detection.format === 'cnab400') {
      // Registros de detalhe CNAB400
      if (line.charAt(0) === '1') {
        dates.push({
          value: line.substring(120, 126), // Data vencimento (ddmmyy)
          type: 'vencimento',
          fieldName: 'vencimento'
        });

        dates.push({
          value: line.substring(150, 156), // Data emissão (ddmmyy)
          type: 'emissao',
          fieldName: 'data_emissao'
        });
      }

      // Header arquivo
      if (line.charAt(0) === '0') {
        dates.push({
          value: line.substring(94, 100), // Data geração (ddmmyy)
          type: 'processamento',
          fieldName: 'data_geracao'
        });
      }
    }

    return dates;
  }

  /**
   * Parseia data de string
   */
  _parseDate(dateStr) {
    try {
      let day, month, year;

      if (dateStr.length === 8) { // DDMMYYYY
        day = parseInt(dateStr.substring(0, 2));
        month = parseInt(dateStr.substring(2, 4));
        year = parseInt(dateStr.substring(4, 8));
      } else if (dateStr.length === 6) { // DDMMYY
        day = parseInt(dateStr.substring(0, 2));
        month = parseInt(dateStr.substring(2, 4));
        year = parseInt(dateStr.substring(4, 6));
        // Assumir século
        year = year <= 50 ? 2000 + year : 1900 + year;
      } else {
        return null;
      }

      // Validar valores básicos
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }

      return new Date(year, month - 1, day);

    } catch (error) {
      return null;
    }
  }

  /**
   * Formata data para exibição
   */
  _formatDate(date) {
    return date.toLocaleDateString('pt-BR');
  }

  /**
   * Valida regras financeiras
   */
  async _validateFinancialRules(lines, detection, result) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        // Extrair valores monetários da linha
        const monetaryValues = this._extractMonetaryValues(line, detection);

        for (const valueInfo of monetaryValues) {
          const { value, fieldName, required } = valueInfo;

          // Validar se é um valor válido
          if (isNaN(value) || !isFinite(value)) {
            result.addError(
              `Linha ${lineNumber}, campo ${fieldName}: valor monetário inválido`,
              lineNumber,
              fieldName
            );
            continue;
          }

          // Validar valores negativos
          if (value < 0) {
            result.addWarning(
              `Linha ${lineNumber}, campo ${fieldName}: valor negativo (${value.toFixed(2)})`,
              lineNumber,
              fieldName
            );
          }

          // Validar valores muito altos (possível erro)
          if (value > 1000000000) { // 1 bilhão
            result.addWarning(
              `Linha ${lineNumber}, campo ${fieldName}: valor muito alto (${value.toFixed(2)})`,
              lineNumber,
              fieldName
            );
          }

          // Validar obrigatoriedade
          if (required && value === 0) {
            result.addError(
              `Linha ${lineNumber}, campo ${fieldName}: valor obrigatório não pode ser zero`,
              lineNumber,
              fieldName
            );
          }
        }

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar valores financeiros - ${error.message}`, lineNumber);
      }
    }
  }

  /**
   * Extrai valores monetários de uma linha
   */
  _extractMonetaryValues(line, detection) {
    const values = [];

    if (detection.format === 'cnab240') {
      if (line.charAt(7) === '3' && line.charAt(13) === 'P') {
        // Segmento P - valor do título
        const valorTituloStr = line.substring(119, 133);
        values.push({
          value: this._parseDecimalValue(valorTituloStr, 2),
          fieldName: 'valor_titulo',
          required: true
        });

        // Valor do desconto
        const valorDescontoStr = line.substring(165, 178);
        values.push({
          value: this._parseDecimalValue(valorDescontoStr, 2),
          fieldName: 'valor_desconto',
          required: false
        });
      }
    } else if (detection.format === 'cnab400') {
      if (line.charAt(0) === '1') {
        // Valor do título
        const valorTituloStr = line.substring(126, 139);
        values.push({
          value: this._parseDecimalValue(valorTituloStr, 2),
          fieldName: 'valor_titulo',
          required: true
        });

        // Valor do desconto
        const valorDescontoStr = line.substring(179, 192);
        values.push({
          value: this._parseDecimalValue(valorDescontoStr, 2),
          fieldName: 'valor_desconto',
          required: false
        });
      }
    }

    return values.filter(v => v.value !== null);
  }

  /**
   * Parseia valor decimal
   */
  _parseDecimalValue(valueStr, decimalPlaces) {
    if (!/^\d+$/.test(valueStr)) {
      return null;
    }

    const numValue = parseInt(valueStr);
    return numValue / Math.pow(10, decimalPlaces);
  }

  /**
   * Valida documentos (CPF/CNPJ)
   */
  async _validateDocumentRules(lines, detection, result) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        const documents = this._extractDocuments(line, detection);

        for (const docInfo of documents) {
          const { number: docNumber, type: docType, fieldName } = docInfo;

          if (!docNumber || docNumber === '00000000000' || docNumber === '00000000000000') {
            continue; // Documento vazio pode ser válido
          }

          // Validar CPF
          if (docType === '01' || (docNumber.length === 11 && !docType)) {
            if (!this._validateCPF(docNumber)) {
              result.addError(
                `Linha ${lineNumber}, campo ${fieldName}: CPF inválido '${docNumber}'`,
                lineNumber,
                fieldName
              );
            }
          }

          // Validar CNPJ
          else if (docType === '02' || (docNumber.length === 14 && !docType)) {
            if (!this._validateCNPJ(docNumber)) {
              result.addError(
                `Linha ${lineNumber}, campo ${fieldName}: CNPJ inválido '${docNumber}'`,
                lineNumber,
                fieldName
              );
            }
          }
        }

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar documentos - ${error.message}`, lineNumber);
      }
    }
  }

  /**
   * Extrai documentos de uma linha
   */
  _extractDocuments(line, detection) {
    const documents = [];

    if (detection.format === 'cnab240') {
      if (line.charAt(7) === '3' && line.charAt(13) === 'P') {
        // Tipo e número de inscrição do pagador
        const tipoInscricao = line.substring(17, 18);
        const numeroInscricao = line.substring(18, 33);

        documents.push({
          number: numeroInscricao.replace(/^0+/, ''),
          type: tipoInscricao,
          fieldName: 'numero_inscricao_pagador'
        });
      }
    } else if (detection.format === 'cnab400') {
      if (line.charAt(0) === '1') {
        // Tipo e número de inscrição do sacado
        const tipoInscricao = line.substring(218, 220);
        const numeroInscricao = line.substring(220, 234);

        documents.push({
          number: numeroInscricao.replace(/^0+/, ''),
          type: tipoInscricao,
          fieldName: 'sacado_numero_inscricao'
        });
      }
    }

    return documents;
  }

  /**
   * Valida CPF
   */
  _validateCPF(cpf) {
    // Remove caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');

    // Verifica se tem 11 dígitos
    if (cpf.length !== 11) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // Valida primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    // Valida segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  /**
   * Valida CNPJ
   */
  _validateCNPJ(cnpj) {
    // Remove caracteres não numéricos
    cnpj = cnpj.replace(/\D/g, '');

    // Verifica se tem 14 dígitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    // Valida primeiro dígito verificador
    let sum = 0;
    let weight = 2;
    for (let i = 11; i >= 0; i--) {
      sum += parseInt(cnpj.charAt(i)) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digit1 !== parseInt(cnpj.charAt(12))) return false;

    // Valida segundo dígito verificador
    sum = 0;
    weight = 2;
    for (let i = 12; i >= 0; i--) {
      sum += parseInt(cnpj.charAt(i)) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (digit2 !== parseInt(cnpj.charAt(13))) return false;

    return true;
  }

  /**
   * Valida códigos de banco
   */
  async _validateBankCodeRules(lines, detection, result) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        const bankCode = this._extractBankCode(line, detection);

        if (bankCode && !this.validBankCodes.has(bankCode)) {
          result.addWarning(
            `Linha ${lineNumber}: código de banco '${bankCode}' não reconhecido`,
            lineNumber,
            'codigo_banco'
          );
        }

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar código do banco - ${error.message}`, lineNumber);
      }
    }
  }

  /**
   * Extrai código do banco
   */
  _extractBankCode(line, detection) {
    if (detection.format === 'cnab240') {
      return line.substring(0, 3);
    } else if (detection.format === 'cnab400') {
      if (line.charAt(0) === '0') { // Header
        return line.substring(76, 79);
      }
    }
    return null;
  }

  /**
   * Valida regras específicas por banco
   */
  async _validateBankSpecificRules(lines, detection, result) {
    const bankCode = detection.bankCode;

    switch (bankCode) {
    case '001': // Banco do Brasil
      await this._validateBancoBrasilRules(lines, detection, result);
      break;
    case '033': // Santander
      await this._validateSantanderRules(lines, detection, result);
      break;
    case '104': // Caixa
      await this._validateCaixaRules(lines, detection, result);
      break;
    case '237': // Bradesco
      await this._validateBradescoRules(lines, detection, result);
      break;
    case '341': // Itaú
      await this._validateItauRules(lines, detection, result);
      break;
    default:
      // Regras genéricas para bancos não específicos
      break;
    }
  }

  /**
   * Regras específicas do Banco do Brasil
   */
  async _validateBancoBrasilRules(lines, detection, result) {
    // Implementar regras específicas do BB
    // Por exemplo: validar formato do nosso número
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Validações específicas do BB aqui
    }
  }

  /**
   * Regras específicas do Santander
   */
  async _validateSantanderRules(lines, detection, result) {
    // Implementar regras específicas do Santander
  }

  /**
   * Regras específicas da Caixa
   */
  async _validateCaixaRules(lines, detection, result) {
    // Implementar regras específicas da Caixa
  }

  /**
   * Regras específicas do Bradesco
   */
  async _validateBradescoRules(lines, detection, result) {
    // Implementar regras específicas do Bradesco
  }

  /**
   * Regras específicas do Itaú
   */
  async _validateItauRules(lines, detection, result) {
    // Implementar regras específicas do Itaú
  }

  /**
   * Valida relacionamentos entre campos
   */
  async _validateFieldRelationships(lines, detection, result) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        // Validar relacionamento valor x desconto
        this._validateValueDiscountRelationship(line, lineNumber, detection, result);

        // Validar relacionamento data vencimento x data emissão
        this._validateDateRelationships(line, lineNumber, detection, result);

        // Validar relacionamento tipo documento x tamanho
        this._validateDocumentTypeRelationship(line, lineNumber, detection, result);

      } catch (error) {
        result.addWarning(`Linha ${lineNumber}: erro ao validar relacionamentos - ${error.message}`, lineNumber);
      }
    }
  }

  /**
   * Valida relacionamento valor x desconto
   */
  _validateValueDiscountRelationship(line, lineNumber, detection, result) {
    const values = this._extractMonetaryValues(line, detection);
    const valorTitulo = values.find(v => v.fieldName === 'valor_titulo')?.value;
    const valorDesconto = values.find(v => v.fieldName === 'valor_desconto')?.value;

    if (valorTitulo && valorDesconto && valorDesconto > valorTitulo) {
      result.addWarning(
        `Linha ${lineNumber}: desconto (${valorDesconto.toFixed(2)}) maior que valor do título (${valorTitulo.toFixed(2)})`,
        lineNumber
      );
    }
  }

  /**
   * Valida relacionamentos entre datas
   */
  _validateDateRelationships(line, lineNumber, detection, result) {
    const dates = this._extractDatesFromLine(line, detection);
    const dataEmissao = dates.find(d => d.type === 'emissao');
    const dataVencimento = dates.find(d => d.type === 'vencimento');

    if (dataEmissao && dataVencimento) {
      const emissao = this._parseDate(dataEmissao.value);
      const vencimento = this._parseDate(dataVencimento.value);

      if (emissao && vencimento && vencimento < emissao) {
        result.addError(
          `Linha ${lineNumber}: data de vencimento anterior à data de emissão`,
          lineNumber
        );
      }
    }
  }

  /**
   * Valida relacionamento tipo documento x tamanho
   */
  _validateDocumentTypeRelationship(line, lineNumber, detection, result) {
    const documents = this._extractDocuments(line, detection);

    for (const doc of documents) {
      const cleanNumber = doc.number.replace(/\D/g, '');

      if (doc.type === '01' && cleanNumber.length !== 11) { // CPF
        result.addError(
          `Linha ${lineNumber}: CPF deve ter 11 dígitos, encontrado ${cleanNumber.length}`,
          lineNumber,
          doc.fieldName
        );
      } else if (doc.type === '02' && cleanNumber.length !== 14) { // CNPJ
        result.addError(
          `Linha ${lineNumber}: CNPJ deve ter 14 dígitos, encontrado ${cleanNumber.length}`,
          lineNumber,
          doc.fieldName
        );
      }
    }
  }
}

export default BusinessRuleValidator; 