/**
 * Parser específico para Trailers CNAB 240 (Tipos de Registro 5 e 9)
 * 
 * Especificação FEBRABAN - posições exatas dos campos
 * Tipo 5: Trailer de Lote, Tipo 9: Trailer de Arquivo
 */

import { TrailerLote240, TrailerArquivo240 } from '../../../models/cnab240/index.js';

/**
 * Parser para Trailers CNAB 240
 */
export class TrailerParser {
  /**
   * Parser genérico que detecta automaticamente o tipo de trailer
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados parseados conforme o tipo de trailer
   */
  static parse(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter 240 caracteres');
    }

    const tipoRegistro = linha[7];

    switch (tipoRegistro) {
      case '5':
        return this.parseTrailerLote(linha);
      case '9':
        return this.parseTrailerArquivo(linha);
      default:
        throw new Error(`Tipo de registro esperado: 5 ou 9, encontrado: ${tipoRegistro}`);
    }
  }

  /**
   * Processa uma linha de trailer de lote CNAB 240 (tipo 5)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do trailer de lote parseados
   */
  static parseTrailerLote(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de trailer de lote deve ter 240 caracteres');
    }

    // Verificar se é realmente um trailer de lote (tipo 5)
    const tipoRegistro = linha[7];
    if (tipoRegistro !== '5') {
      throw new Error(`Tipo de registro esperado: 5, encontrado: ${tipoRegistro}`);
    }

    // Extrair campos conforme posições FEBRABAN
    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço
      lote: linha.substring(3, 7).trim(),

      // Posição 008: Tipo de registro (5)
      tipoRegistro: linha[7],

      // Posições 009-017: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN1: linha.substring(8, 17).trim(),

      // Posições 018-023: Quantidade de registros do lote
      quantidadeRegistros: linha.substring(17, 23).trim(),

      // Posições 024-041: Somatória dos valores de débito
      somatoriaDebitos: linha.substring(23, 41).trim(),

      // Posições 042-059: Somatória dos valores de crédito
      somatoriaCreditos: linha.substring(41, 59).trim(),

      // Posições 060-077: Somatória de valores
      somatoriaValores: linha.substring(59, 77).trim(),

      // Posições 078-083: Quantidade de registros de débito
      quantidadeDebitos: linha.substring(77, 83).trim(),

      // Posições 084-089: Quantidade de registros de crédito
      quantidadeCreditos: linha.substring(83, 89).trim(),

      // Posições 090-095: Quantidade de avisos de débito
      quantidadeAvisosDebito: linha.substring(89, 95).trim(),

      // Posições 096-101: Quantidade de avisos de crédito
      quantidadeAvisosCredito: linha.substring(95, 101).trim(),

      // Posições 102-117: Número do arquivo de retorno
      numeroArquivoRetorno: linha.substring(101, 117).trim(),

      // Posições 118-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN2: linha.substring(117, 240).trim()
    };

    return dados;
  }

  /**
   * Processa uma linha de trailer de arquivo CNAB 240 (tipo 9)
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do trailer de arquivo parseados
   */
  static parseTrailerArquivo(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de trailer de arquivo deve ter 240 caracteres');
    }

    // Verificar se é realmente um trailer de arquivo (tipo 9)
    const tipoRegistro = linha[7];
    if (tipoRegistro !== '9') {
      throw new Error(`Tipo de registro esperado: 9, encontrado: ${tipoRegistro}`);
    }

    // Extrair campos conforme posições FEBRABAN
    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço (9999 para trailer de arquivo)
      lote: linha.substring(3, 7),

      // Posição 008: Tipo de registro (9)
      tipoRegistro: linha[7],

      // Posições 009-017: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN1: linha.substring(8, 17).trim(),

      // Posições 018-023: Quantidade de lotes do arquivo
      quantidadeLotes: linha.substring(17, 23).trim(),

      // Posições 024-029: Quantidade de registros do arquivo
      quantidadeRegistros: linha.substring(23, 29).trim(),

      // Posições 030-035: Quantidade de contas para conciliação (débito)
      quantidadeContasDebito: linha.substring(29, 35).trim(),

      // Posições 036-041: Quantidade de contas para conciliação (crédito)
      quantidadeContasCredito: linha.substring(35, 41).trim(),

      // Posições 042-059: Somatória dos valores de débito
      somatoriaDebitos: linha.substring(41, 59).trim(),

      // Posições 060-077: Somatória dos valores de crédito
      somatoriaCreditos: linha.substring(59, 77).trim(),

      // Posições 078-095: Somatória geral de valores
      somatoriaGeral: linha.substring(77, 95).trim(),

      // Posições 096-101: Quantidade de avisos de débito
      quantidadeAvisosDebito: linha.substring(95, 101).trim(),

      // Posições 102-107: Quantidade de avisos de crédito
      quantidadeAvisosCredito: linha.substring(101, 107).trim(),

      // Posições 108-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN2: linha.substring(107, 240).trim()
    };

    return dados;
  }

  /**
   * Cria uma instância do modelo apropriado baseado no tipo de registro
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Instância do modelo apropriado
   */
  static parseToModel(linha) {
    const tipoRegistro = linha[7];

    switch (tipoRegistro) {
      case '5':
        const dadosLote = this.parseTrailerLote(linha);
        return new TrailerLote240(dadosLote);
      case '9':
        const dadosArquivo = this.parseTrailerArquivo(linha);
        return new TrailerArquivo240(dadosArquivo);
      default:
        throw new Error(`Tipo de registro "${tipoRegistro}" não suportado para criação de modelo`);
    }
  }

  /**
   * Valida um trailer específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validate(linha) {
    const erros = [];

    try {
      const tipoRegistro = linha[7];

      switch (tipoRegistro) {
        case '5':
          return this.validateTrailerLote(linha);
        case '9':
          return this.validateTrailerArquivo(linha);
        default:
          erros.push(`Tipo de registro "${tipoRegistro}" não reconhecido`);
          return { valido: false, erros };
      }
    } catch (error) {
      erros.push(error.message);
      return { valido: false, erros };
    }
  }

  /**
   * Valida trailer de lote específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validateTrailerLote(linha) {
    const erros = [];

    try {
      const dados = this.parseTrailerLote(linha);

      if (!dados.codigoBanco || dados.codigoBanco.length !== 3) {
        erros.push('Código do banco deve ter 3 dígitos');
      }

      if (!dados.lote || dados.lote === '0000') {
        erros.push('Número do lote deve ser diferente de 0000 para trailer de lote');
      }

      // Validar quantidades (devem ser números)
      const quantidadeRegistros = parseInt(dados.quantidadeRegistros);
      if (isNaN(quantidadeRegistros) || quantidadeRegistros < 0) {
        erros.push('Quantidade de registros deve ser um número válido');
      }

      // Verificar se pelo menos um tipo de operação tem valores
      const somaDebitos = parseFloat(dados.somatoriaDebitos) || 0;
      const somaCreditos = parseFloat(dados.somatoriaCreditos) || 0;
      const qtdDebitos = parseInt(dados.quantidadeDebitos) || 0;
      const qtdCreditos = parseInt(dados.quantidadeCreditos) || 0;

      if (somaDebitos === 0 && somaCreditos === 0) {
        erros.push('Deve haver ao menos valores de débito ou crédito no lote');
      }

      // Validar coerência entre quantidades e valores
      if (qtdDebitos > 0 && somaDebitos === 0) {
        erros.push('Quantidade de débitos informada mas sem valor de débito');
      }

      if (qtdCreditos > 0 && somaCreditos === 0) {
        erros.push('Quantidade de créditos informada mas sem valor de crédito');
      }

    } catch (error) {
      erros.push(error.message);
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Valida trailer de arquivo específico
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validateTrailerArquivo(linha) {
    const erros = [];

    try {
      const dados = this.parseTrailerArquivo(linha);

      if (!dados.codigoBanco || dados.codigoBanco.length !== 3) {
        erros.push('Código do banco deve ter 3 dígitos');
      }

      if (dados.lote !== '9999') {
        erros.push('Lote deve ser 9999 para trailer de arquivo');
      }

      // Validar quantidades (devem ser números)
      const quantidadeLotes = parseInt(dados.quantidadeLotes);
      if (isNaN(quantidadeLotes) || quantidadeLotes < 1) {
        erros.push('Quantidade de lotes deve ser um número maior que zero');
      }

      const quantidadeRegistros = parseInt(dados.quantidadeRegistros);
      if (isNaN(quantidadeRegistros) || quantidadeRegistros < 3) {
        erros.push('Quantidade de registros deve ser no mínimo 3 (header arquivo + trailer arquivo + pelo menos 1 lote)');
      }

      // Validar totalização
      const somaDebitos = parseFloat(dados.somatoriaDebitos) || 0;
      const somaCreditos = parseFloat(dados.somatoriaCreditos) || 0;
      const somaGeral = parseFloat(dados.somatoriaGeral) || 0;

      // A somatória geral pode ser diferente da soma de débitos + créditos 
      // dependendo do tipo de arquivo, mas deve ser coerente
      if (somaGeral < 0) {
        erros.push('Somatória geral não pode ser negativa');
      }

    } catch (error) {
      erros.push(error.message);
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Extrai informações resumidas do trailer
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Informações resumidas
   */
  static extractSummary(linha) {
    const tipoRegistro = linha[7];

    switch (tipoRegistro) {
      case '5':
        return this.extractTrailerLoteSummary(linha);
      case '9':
        return this.extractTrailerArquivoSummary(linha);
      default:
        throw new Error(`Tipo de registro "${tipoRegistro}" não suportado para extração de resumo`);
    }
  }

  /**
   * Extrai resumo do trailer de lote
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resumo do trailer de lote
   */
  static extractTrailerLoteSummary(linha) {
    const dados = this.parseTrailerLote(linha);

    return {
      tipo: 'TrailerLote',
      banco: dados.codigoBanco,
      lote: dados.lote,
      totalRegistros: parseInt(dados.quantidadeRegistros) || 0,
      totalizacao: {
        debitos: {
          quantidade: parseInt(dados.quantidadeDebitos) || 0,
          valor: parseFloat(dados.somatoriaDebitos) / 100 || 0 // Centavos para reais
        },
        creditos: {
          quantidade: parseInt(dados.quantidadeCreditos) || 0,
          valor: parseFloat(dados.somatoriaCreditos) / 100 || 0 // Centavos para reais
        },
        valorTotal: parseFloat(dados.somatoriaValores) / 100 || 0,
        avisos: {
          debito: parseInt(dados.quantidadeAvisosDebito) || 0,
          credito: parseInt(dados.quantidadeAvisosCredito) || 0
        }
      }
    };
  }

  /**
   * Extrai resumo do trailer de arquivo
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resumo do trailer de arquivo
   */
  static extractTrailerArquivoSummary(linha) {
    const dados = this.parseTrailerArquivo(linha);

    return {
      tipo: 'TrailerArquivo',
      banco: dados.codigoBanco,
      totalizacao: {
        lotes: parseInt(dados.quantidadeLotes) || 0,
        registros: parseInt(dados.quantidadeRegistros) || 0,
        contas: {
          debito: parseInt(dados.quantidadeContasDebito) || 0,
          credito: parseInt(dados.quantidadeContasCredito) || 0
        },
        valores: {
          debitos: parseFloat(dados.somatoriaDebitos) / 100 || 0, // Centavos para reais
          creditos: parseFloat(dados.somatoriaCreditos) / 100 || 0, // Centavos para reais
          geral: parseFloat(dados.somatoriaGeral) / 100 || 0 // Centavos para reais
        },
        avisos: {
          debito: parseInt(dados.quantidadeAvisosDebito) || 0,
          credito: parseInt(dados.quantidadeAvisosCredito) || 0
        }
      }
    };
  }

  /**
   * Verifica a integridade das totalizações
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da verificação de integridade
   */
  static checkIntegrity(linha) {
    const resultado = {
      integro: true,
      alertas: [],
      observacoes: []
    };

    try {
      const resumo = this.extractSummary(linha);

      if (resumo.tipo === 'TrailerLote') {
        // Verificações específicas para trailer de lote
        if (resumo.totalizacao.debitos.quantidade > 0 && resumo.totalizacao.debitos.valor === 0) {
          resultado.alertas.push('Lote tem registros de débito mas valor total é zero');
          resultado.integro = false;
        }

        if (resumo.totalizacao.creditos.quantidade > 0 && resumo.totalizacao.creditos.valor === 0) {
          resultado.alertas.push('Lote tem registros de crédito mas valor total é zero');
          resultado.integro = false;
        }

        const somaCalculada = resumo.totalizacao.debitos.valor + resumo.totalizacao.creditos.valor;
        if (Math.abs(somaCalculada - resumo.totalizacao.valorTotal) > 0.01) {
          resultado.observacoes.push(`Diferença entre soma calculada (${somaCalculada.toFixed(2)}) e valor total informado (${resumo.totalizacao.valorTotal.toFixed(2)})`);
        }

      } else if (resumo.tipo === 'TrailerArquivo') {
        // Verificações específicas para trailer de arquivo
        if (resumo.totalizacao.lotes < 1) {
          resultado.alertas.push('Arquivo deve ter pelo menos 1 lote');
          resultado.integro = false;
        }

        if (resumo.totalizacao.registros < 3) {
          resultado.alertas.push('Arquivo deve ter pelo menos 3 registros (header arquivo + lote + trailer arquivo)');
          resultado.integro = false;
        }
      }

    } catch (error) {
      resultado.alertas.push(`Erro na verificação de integridade: ${error.message}`);
      resultado.integro = false;
    }

    return resultado;
  }
}

export default TrailerParser; 