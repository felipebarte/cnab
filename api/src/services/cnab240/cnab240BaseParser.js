/**
 * Parser base para registros CNAB 240
 * 
 * Este módulo é responsável por processar registros de 240 caracteres
 * e identificar seus tipos, segmentos e extrair campos básicos.
 * 
 * Estrutura CNAB 240:
 * - Registros de exatamente 240 caracteres
 * - Posição 8: Tipo de registro (0, 1, 3, 5, 9)
 * - Posição 14: Segmento (para registros tipo 3 - Detalhe)
 * - Posições 1-3: Código do banco
 * - Posições 4-7: Número do lote
 */

import { TIPOS_REGISTRO, SEGMENTOS, BANCOS_240 } from '../../config/bancos240.js';

class Cnab240BaseParser {
  /**
   * Processa uma linha do arquivo CNAB 240
   * @param {string} linha - Linha do arquivo com 240 caracteres
   * @param {number} numeroLinha - Número da linha no arquivo (para debug)
   * @returns {Object} Dados básicos do registro
   */
  static processarLinha(linha, numeroLinha = 0) {
    // Validação básica
    if (!linha || typeof linha !== 'string') {
      throw new Error(`Linha ${numeroLinha}: Linha inválida ou vazia`);
    }

    // Remover caracteres de quebra de linha e retorno de carro
    linha = linha.replace(/[\r\n]/g, '');

    // CNAB 240 deve ter exatamente 240 caracteres
    if (linha.length !== 240) {
      throw new Error(`Linha ${numeroLinha}: Registro deve ter 240 caracteres, encontrado: ${linha.length}`);
    }

    // Extração dos campos básicos
    const codigoBanco = linha.substring(0, 3);
    const lote = linha.substring(3, 7).trim();
    const tipoRegistro = linha.substring(7, 8);

    // Validação do tipo de registro
    if (!TIPOS_REGISTRO[tipoRegistro]) {
      throw new Error(`Linha ${numeroLinha}: Tipo de registro inválido: '${tipoRegistro}'`);
    }

    // Validação do banco
    if (!BANCOS_240[codigoBanco]) {
      console.warn(`Linha ${numeroLinha}: Banco não configurado: ${codigoBanco}`);
    }

    const registroBase = {
      numeroLinha,
      codigoBanco,
      nomeBanco: BANCOS_240[codigoBanco]?.nome || 'Banco não identificado',
      lote: lote || '0000',
      tipoRegistro,
      tipoRegistroDescricao: TIPOS_REGISTRO[tipoRegistro],
      linhaCompleta: linha,
      posicoes: {
        codigoBanco: [1, 3],
        lote: [4, 7],
        tipoRegistro: [8, 8]
      }
    };

    // Para registros de detalhe (tipo 3), extrair segmento
    if (tipoRegistro === '3') {
      const segmento = linha.substring(13, 14);

      if (!SEGMENTOS[segmento]) {
        throw new Error(`Linha ${numeroLinha}: Segmento inválido: '${segmento}'`);
      }

      registroBase.segmento = segmento;
      registroBase.segmentoDescricao = SEGMENTOS[segmento];
      registroBase.posicoes.segmento = [14, 14];

      // Para segmento B, identificar subtipo
      if (segmento === 'B') {
        const subtipoB = this.identificarSubtipoSegmentoB(linha);
        registroBase.subtipoSegmentoB = subtipoB;
      }
    }

    // Para registros de lote (tipo 1), extrair informações específicas
    if (tipoRegistro === '1') {
      registroBase.codigoOperacao = linha.substring(11, 17);
      registroBase.posicoes.codigoOperacao = [12, 17];
    }

    // Extrair sequencial do registro (posições diferentes por tipo)
    registroBase.sequencial = this.extrairSequencial(linha, tipoRegistro);

    return registroBase;
  }

  /**
   * Identifica o subtipo do Segmento B baseado no conteúdo
   * @param {string} linha - Linha completa do registro
   * @returns {string} Subtipo identificado (B01, B02, B03, B04)
   */
  static identificarSubtipoSegmentoB(linha) {
    // Análise baseada nos exemplos reais encontrados
    const dados = linha.substring(23, 200).trim();

    // B03: CNPJ/CPF - formato de número com 11 ou 14 dígitos
    if (/^[12]\d{10,13}$/.test(dados.substring(0, 20).trim())) {
      return 'B03';
    }

    // B04: UUID - formato de UUID
    if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(dados)) {
      return 'B04';
    }

    // B02: Email - contém @ e .
    if (dados.includes('@') && dados.includes('.')) {
      return 'B02';
    }

    // B01: Telefone - formato de telefone
    if (/^\+?55\d{10,11}$/.test(dados.replace(/\D/g, ''))) {
      return 'B01';
    }

    // Default para casos não identificados
    return 'B03'; // Mais comum nos exemplos
  }

  /**
   * Extrai o número sequencial do registro
   * @param {string} linha - Linha completa
   * @param {string} tipoRegistro - Tipo do registro
   * @returns {string} Número sequencial
   */
  static extrairSequencial(linha, tipoRegistro) {
    switch (tipoRegistro) {
      case '0': // Header Arquivo
      case '9': // Trailer Arquivo
        return '000001';

      case '1': // Header Lote
      case '5': // Trailer Lote
        return linha.substring(8, 13).trim();

      case '3': // Detalhe
        return linha.substring(8, 13).trim();

      default:
        return '';
    }
  }

  /**
   * Processa um arquivo completo CNAB 240
   * @param {string} conteudoArquivo - Conteúdo completo do arquivo
   * @returns {Object} Estrutura organizada do arquivo
   */
  static processarArquivo(conteudoArquivo) {
    if (!conteudoArquivo || typeof conteudoArquivo !== 'string') {
      throw new Error('Conteúdo do arquivo inválido');
    }

    // Dividir linhas e filtrar linhas vazias, removendo quebras de linha
    const linhas = conteudoArquivo.split('\n')
      .map(linha => linha.replace(/\r/g, ''))  // Remove \r se existir
      .filter(linha => linha.trim().length > 0);

    if (linhas.length === 0) {
      throw new Error('Arquivo vazio');
    }

    const resultado = {
      headerArquivo: null,
      lotes: [],
      trailerArquivo: null,
      totalLinhas: linhas.length,
      totalRegistros: 0,
      erros: []
    };

    let loteAtual = null;

    linhas.forEach((linha, index) => {
      try {
        const registro = this.processarLinha(linha, index + 1);
        resultado.totalRegistros++;

        switch (registro.tipoRegistro) {
          case '0': // Header Arquivo
            resultado.headerArquivo = registro;
            break;

          case '1': // Header Lote
            loteAtual = {
              headerLote: registro,
              detalhes: [],
              trailerLote: null,
              numeroLote: registro.lote
            };
            resultado.lotes.push(loteAtual);
            break;

          case '3': // Detalhe
            if (loteAtual) {
              loteAtual.detalhes.push(registro);
            } else {
              throw new Error(`Linha ${index + 1}: Registro de detalhe sem lote`);
            }
            break;

          case '5': // Trailer Lote
            if (loteAtual) {
              loteAtual.trailerLote = registro;
            } else {
              throw new Error(`Linha ${index + 1}: Trailer de lote sem lote`);
            }
            break;

          case '9': // Trailer Arquivo
            resultado.trailerArquivo = registro;
            break;
        }

      } catch (error) {
        resultado.erros.push({
          linha: index + 1,
          erro: error.message,
          conteudo: linha.substring(0, 50) + '...'
        });
      }
    });

    // Validações básicas de estrutura - menos rígida para desenvolvimento
    this.validarEstruturaBasica(resultado);

    return resultado;
  }

  /**
   * Valida a estrutura básica do arquivo processado
   * @param {Object} resultado - Resultado do processamento
   */
  static validarEstruturaBasica(resultado) {
    const erros = resultado.erros;

    // Deve ter header de arquivo
    if (!resultado.headerArquivo) {
      erros.push({ linha: 1, erro: 'Header de arquivo não encontrado' });
    }

    // Deve ter trailer de arquivo
    if (!resultado.trailerArquivo) {
      erros.push({ linha: 'final', erro: 'Trailer de arquivo não encontrado' });
    }

    // Cada lote deve ter header e trailer
    resultado.lotes.forEach((lote, index) => {
      if (!lote.headerLote) {
        erros.push({ linha: 'lote', erro: `Lote ${index + 1}: Header de lote não encontrado` });
      }
      if (!lote.trailerLote) {
        erros.push({ linha: 'lote', erro: `Lote ${index + 1}: Trailer de lote não encontrado` });
      }
    });

    // Aumentei o limite de erros para desenvolvimento
    if (erros.length > 50) {
      throw new Error(`Muitos erros encontrados (${erros.length}). Arquivo pode estar corrompido.`);
    }
  }

  /**
   * Obtém estatísticas do arquivo processado
   * @param {Object} arquivo - Arquivo processado
   * @returns {Object} Estatísticas
   */
  static obterEstatisticas(arquivo) {
    const stats = {
      totalLotes: arquivo.lotes.length,
      totalDetalhes: 0,
      tiposSegmento: {},
      codigosOperacao: {},
      banco: arquivo.headerArquivo?.nomeBanco || 'Não identificado'
    };

    arquivo.lotes.forEach(lote => {
      stats.totalDetalhes += lote.detalhes.length;

      // Contar segmentos
      lote.detalhes.forEach(detalhe => {
        if (detalhe.segmento) {
          stats.tiposSegmento[detalhe.segmento] = (stats.tiposSegmento[detalhe.segmento] || 0) + 1;
        }
      });

      // Contar códigos de operação
      if (lote.headerLote?.codigoOperacao) {
        const codigo = lote.headerLote.codigoOperacao;
        stats.codigosOperacao[codigo] = (stats.codigosOperacao[codigo] || 0) + 1;
      }
    });

    return stats;
  }
}

export default Cnab240BaseParser; 