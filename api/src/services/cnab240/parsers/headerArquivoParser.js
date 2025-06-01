/**
 * Parser específico para Header de Arquivo CNAB 240 (Tipo de Registro 0)
 * 
 * Especificação FEBRABAN - posições exatas dos campos
 */

import { HeaderArquivo240 } from '../../../models/cnab240/index.js';

/**
 * Parser para Header de Arquivo CNAB 240
 */
export class HeaderArquivoParser {
  /**
   * Processa uma linha de header de arquivo CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados do header parseados
   */
  static parse(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha de header de arquivo deve ter 240 caracteres');
    }

    // Verificar se é realmente um header de arquivo (tipo 0)
    const tipoRegistro = linha[7];
    if (tipoRegistro !== '0') {
      throw new Error(`Tipo de registro esperado: 0, encontrado: ${tipoRegistro}`);
    }

    // Extrair campos conforme posições FEBRABAN
    const dados = {
      // Posições 001-003: Código do banco
      codigoBanco: linha.substring(0, 3).trim(),

      // Posições 004-007: Lote de serviço (0000 para header de arquivo)
      lote: linha.substring(3, 7),

      // Posição 008: Tipo de registro (0)
      tipoRegistro: linha[7],

      // Posições 009-017: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN1: linha.substring(8, 17).trim(),

      // Posição 018: Tipo de inscrição da empresa
      tipoInscricaoEmpresa: linha[17],

      // Posições 019-032: Número de inscrição da empresa
      numeroInscricaoEmpresa: linha.substring(18, 32).trim(),

      // Posições 033-052: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN2: linha.substring(32, 52).trim(),

      // Posições 053-057: Agência mantenedora da conta
      agencia: linha.substring(52, 57).trim(),

      // Posição 058: Dígito verificador da agência
      dvAgencia: linha[57].trim(),

      // Posições 059-070: Número da conta corrente
      conta: linha.substring(58, 70).trim(),

      // Posição 071: Dígito verificador da conta
      dvConta: linha[70].trim(),

      // Posição 072: Dígito verificador da agência/conta
      dvAgenciaConta: linha[71].trim(),

      // Posições 073-102: Nome da empresa
      nomeEmpresa: linha.substring(72, 102).trim(),

      // Posições 103-132: Nome do banco
      nomeBanco: linha.substring(102, 132).trim(),

      // Posições 133-142: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN3: linha.substring(132, 142).trim(),

      // Posição 143: Código de remessa ou retorno
      codigoRemessaRetorno: linha[142],

      // Posições 144-151: Data de geração do arquivo (DDMMAAAA)
      dataGeracao: linha.substring(143, 151),

      // Posições 152-157: Hora de geração do arquivo (HHMMSS)
      horaGeracao: linha.substring(151, 157),

      // Posições 158-163: Número sequencial do arquivo
      numeroSequencialArquivo: linha.substring(157, 163).trim(),

      // Posições 164-166: Número da versão do layout do arquivo
      versaoLayoutArquivo: linha.substring(163, 166).trim(),

      // Posições 167-171: Densidade de gravação do arquivo
      densidadeGravacao: linha.substring(166, 171).trim(),

      // Posições 172-191: Para uso reservado do banco
      usoReservadoBanco: linha.substring(171, 191).trim(),

      // Posições 192-211: Para uso reservado da empresa
      usoReservadoEmpresa: linha.substring(191, 211).trim(),

      // Posições 212-240: Uso exclusivo FEBRABAN/CNAB
      usoFEBRABAN4: linha.substring(211, 240).trim()
    };

    return dados;
  }

  /**
   * Cria uma instância do modelo HeaderArquivo240 a partir de uma linha
   * @param {string} linha - Linha de 240 caracteres
   * @returns {HeaderArquivo240} Instância do modelo
   */
  static parseToModel(linha) {
    const dados = this.parse(linha);
    return new HeaderArquivo240(dados);
  }

  /**
   * Valida se uma linha é um header de arquivo válido
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validate(linha) {
    const erros = [];

    try {
      const dados = this.parse(linha);

      // Validações específicas
      if (!dados.codigoBanco || dados.codigoBanco.length !== 3) {
        erros.push('Código do banco deve ter 3 dígitos');
      }

      if (dados.lote !== '0000') {
        erros.push('Lote deve ser 0000 para header de arquivo');
      }

      if (!['1', '2'].includes(dados.codigoRemessaRetorno)) {
        erros.push('Código de remessa/retorno deve ser 1 (remessa) ou 2 (retorno)');
      }

      // Validar formato de data
      if (dados.dataGeracao.length === 8) {
        const dia = parseInt(dados.dataGeracao.substring(0, 2));
        const mes = parseInt(dados.dataGeracao.substring(2, 4));
        const ano = parseInt(dados.dataGeracao.substring(4, 8));

        if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000) {
          erros.push('Data de geração inválida');
        }
      } else {
        erros.push('Data de geração deve ter 8 dígitos (DDMMAAAA)');
      }

      // Validar formato de hora
      if (dados.horaGeracao.length === 6) {
        const hora = parseInt(dados.horaGeracao.substring(0, 2));
        const minuto = parseInt(dados.horaGeracao.substring(2, 4));
        const segundo = parseInt(dados.horaGeracao.substring(4, 6));

        if (hora > 23 || minuto > 59 || segundo > 59) {
          erros.push('Hora de geração inválida');
        }
      } else {
        erros.push('Hora de geração deve ter 6 dígitos (HHMMSS)');
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
   * Extrai informações resumidas do header de arquivo
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Informações resumidas
   */
  static extractSummary(linha) {
    const dados = this.parse(linha);

    return {
      banco: {
        codigo: dados.codigoBanco,
        nome: dados.nomeBanco
      },
      empresa: {
        nome: dados.nomeEmpresa,
        inscricao: dados.numeroInscricaoEmpresa,
        tipoInscricao: dados.tipoInscricaoEmpresa === '1' ? 'CPF' : 'CNPJ'
      },
      arquivo: {
        tipo: dados.codigoRemessaRetorno === '1' ? 'Remessa' : 'Retorno',
        dataGeracao: dados.dataGeracao,
        horaGeracao: dados.horaGeracao,
        numeroSequencial: dados.numeroSequencialArquivo,
        versaoLayout: dados.versaoLayoutArquivo
      }
    };
  }
}

export default HeaderArquivoParser; 