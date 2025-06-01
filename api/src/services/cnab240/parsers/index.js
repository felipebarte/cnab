/**
 * Centralização dos Parsers CNAB 240
 * 
 * Arquivo principal que unifica todos os parsers específicos
 * e fornece uma API centralizada para parsing automático
 */

import { HeaderArquivoParser } from './headerArquivoParser.js';
import { HeaderLoteParser } from './headerLoteParser.js';
import { SegmentoParser } from './segmentoParser.js';
import { SegmentoBParser } from './segmentoBParser.js';
import { TrailerParser } from './trailerParser.js';

/**
 * Parser unificado CNAB 240
 * Detecta automaticamente o tipo de registro e usa o parser apropriado
 */
export class CNAB240Parser {
  /**
   * Detecta o tipo de registro de uma linha CNAB 240
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Informações sobre o tipo de registro
   */
  static detectType(linha) {
    if (!linha || linha.length !== 240) {
      throw new Error('Linha deve ter 240 caracteres');
    }

    const tipoRegistro = linha[7];
    const lote = linha.substring(3, 7);

    let detalhes = {
      tipoRegistro,
      lote,
      descricao: '',
      parser: null,
      categoria: ''
    };

    switch (tipoRegistro) {
      case '0':
        detalhes.descricao = 'Header de Arquivo';
        detalhes.parser = 'HeaderArquivoParser';
        detalhes.categoria = 'controle';
        break;

      case '1':
        detalhes.descricao = 'Header de Lote';
        detalhes.parser = 'HeaderLoteParser';
        detalhes.categoria = 'controle';
        break;

      case '3':
        const segmento = linha[13];
        detalhes.segmento = segmento;
        detalhes.descricao = `Detalhe - Segmento ${segmento}`;
        detalhes.categoria = 'detalhe';

        switch (segmento) {
          case 'A':
            detalhes.parser = 'SegmentoParser';
            detalhes.metodo = 'parseSegmentoA';
            detalhes.descricao = 'Detalhe - Segmento A (Dados principais)';
            break;
          case 'B':
            detalhes.parser = 'SegmentoBParser';
            detalhes.metodo = 'parse';
            detalhes.descricao = 'Detalhe - Segmento B (Dados complementares PIX)';
            break;
          case 'J':
            detalhes.parser = 'SegmentoParser';
            detalhes.metodo = 'parseSegmentoJ';
            detalhes.descricao = 'Detalhe - Segmento J (Dados adicionais)';
            break;
          case 'O':
            detalhes.parser = 'SegmentoParser';
            detalhes.metodo = 'parseSegmentoO';
            detalhes.descricao = 'Detalhe - Segmento O (Outras informações)';
            break;
          default:
            detalhes.parser = 'SegmentoParser';
            detalhes.metodo = 'parseGenerico';
            detalhes.descricao = `Detalhe - Segmento ${segmento} (Genérico)`;
        }
        break;

      case '5':
        detalhes.descricao = 'Trailer de Lote';
        detalhes.parser = 'TrailerParser';
        detalhes.metodo = 'parseTrailerLote';
        detalhes.categoria = 'controle';
        break;

      case '9':
        detalhes.descricao = 'Trailer de Arquivo';
        detalhes.parser = 'TrailerParser';
        detalhes.metodo = 'parseTrailerArquivo';
        detalhes.categoria = 'controle';
        break;

      default:
        throw new Error(`Tipo de registro "${tipoRegistro}" não reconhecido`);
    }

    return detalhes;
  }

  /**
   * Parser automático que detecta o tipo e aplica o parser correto
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Dados parseados com metadados do tipo
   */
  static parse(linha) {
    const tipoInfo = this.detectType(linha);
    let dadosParsed;

    try {
      switch (tipoInfo.parser) {
        case 'HeaderArquivoParser':
          dadosParsed = HeaderArquivoParser.parse(linha);
          break;

        case 'HeaderLoteParser':
          dadosParsed = HeaderLoteParser.parse(linha);
          break;

        case 'SegmentoParser':
          if (tipoInfo.metodo === 'parseSegmentoA') {
            dadosParsed = SegmentoParser.parseSegmentoA(linha);
          } else if (tipoInfo.metodo === 'parseSegmentoJ') {
            dadosParsed = SegmentoParser.parseSegmentoJ(linha);
          } else if (tipoInfo.metodo === 'parseSegmentoO') {
            dadosParsed = SegmentoParser.parseSegmentoO(linha);
          } else {
            dadosParsed = SegmentoParser.parseGenerico(linha);
          }
          break;

        case 'SegmentoBParser':
          dadosParsed = SegmentoBParser.parse(linha);
          break;

        case 'TrailerParser':
          if (tipoInfo.metodo === 'parseTrailerLote') {
            dadosParsed = TrailerParser.parseTrailerLote(linha);
          } else {
            dadosParsed = TrailerParser.parseTrailerArquivo(linha);
          }
          break;

        default:
          throw new Error(`Parser "${tipoInfo.parser}" não encontrado`);
      }
    } catch (error) {
      throw new Error(`Erro no parsing ${tipoInfo.descricao}: ${error.message}`);
    }

    // Adicionar metadados sobre o tipo
    return {
      ...dadosParsed,
      _metadata: {
        tipo: tipoInfo.tipoRegistro,
        descricao: tipoInfo.descricao,
        categoria: tipoInfo.categoria,
        segmento: tipoInfo.segmento || null,
        parser: tipoInfo.parser,
        linhaOriginal: linha
      }
    };
  }

  /**
   * Cria instâncias dos modelos apropriados baseado no tipo de registro
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Instância do modelo apropriado
   */
  static parseToModel(linha) {
    const tipoInfo = this.detectType(linha);

    switch (tipoInfo.parser) {
      case 'HeaderArquivoParser':
        return HeaderArquivoParser.parseToModel(linha);

      case 'HeaderLoteParser':
        return HeaderLoteParser.parseToModel(linha);

      case 'SegmentoParser':
        return SegmentoParser.parseToModel(linha);

      case 'SegmentoBParser':
        return SegmentoBParser.parseToModel(linha);

      case 'TrailerParser':
        return TrailerParser.parseToModel(linha);

      default:
        throw new Error(`Parser "${tipoInfo.parser}" não suporta criação de modelo`);
    }
  }

  /**
   * Valida uma linha CNAB 240 usando o parser apropriado
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resultado da validação
   */
  static validate(linha) {
    try {
      const tipoInfo = this.detectType(linha);

      switch (tipoInfo.parser) {
        case 'HeaderArquivoParser':
          return HeaderArquivoParser.validate(linha);

        case 'HeaderLoteParser':
          return HeaderLoteParser.validate(linha);

        case 'SegmentoParser':
          return SegmentoParser.validate(linha);

        case 'SegmentoBParser':
          return SegmentoBParser.validate(linha);

        case 'TrailerParser':
          return TrailerParser.validate(linha);

        default:
          return {
            valido: false,
            erros: [`Parser "${tipoInfo.parser}" não suporta validação`]
          };
      }
    } catch (error) {
      return {
        valido: false,
        erros: [error.message]
      };
    }
  }

  /**
   * Processa múltiplas linhas de um arquivo CNAB 240
   * @param {string[]} linhas - Array de linhas de 240 caracteres
   * @returns {Object} Resultado do processamento do arquivo
   */
  static parseFile(linhas) {
    if (!Array.isArray(linhas)) {
      throw new Error('Parâmetro deve ser um array de linhas');
    }

    const resultado = {
      headerArquivo: null,
      lotes: [],
      trailerArquivo: null,
      totalLinhas: linhas.length,
      linhasProcessadas: 0,
      erros: [],
      warnings: []
    };

    let loteAtual = null;

    linhas.forEach((linha, indice) => {
      try {
        const tipoInfo = this.detectType(linha);
        const dados = this.parse(linha);

        resultado.linhasProcessadas++;

        switch (tipoInfo.tipoRegistro) {
          case '0':
            resultado.headerArquivo = dados;
            break;

          case '1':
            // Finalizar lote anterior se existir
            if (loteAtual) {
              resultado.lotes.push(loteAtual);
            }

            // Iniciar novo lote
            loteAtual = {
              headerLote: dados,
              detalhes: [],
              trailerLote: null,
              numero: dados.lote
            };
            break;

          case '3':
            if (!loteAtual) {
              resultado.warnings.push(`Linha ${indice + 1}: Detalhe encontrado sem header de lote`);
            } else {
              loteAtual.detalhes.push(dados);
            }
            break;

          case '5':
            if (!loteAtual) {
              resultado.warnings.push(`Linha ${indice + 1}: Trailer de lote encontrado sem header de lote`);
            } else {
              loteAtual.trailerLote = dados;
              resultado.lotes.push(loteAtual);
              loteAtual = null;
            }
            break;

          case '9':
            resultado.trailerArquivo = dados;
            break;
        }

      } catch (error) {
        resultado.erros.push({
          linha: indice + 1,
          erro: error.message,
          conteudo: linha.substring(0, 50) + '...'
        });
      }
    });

    // Finalizar lote se ainda estiver aberto
    if (loteAtual) {
      resultado.warnings.push('Lote não finalizado encontrado (sem trailer de lote)');
      resultado.lotes.push(loteAtual);
    }

    return resultado;
  }

  /**
   * Extrai resumo rápido de uma linha sem processamento completo
   * @param {string} linha - Linha de 240 caracteres
   * @returns {Object} Resumo básico da linha
   */
  static extractQuickSummary(linha) {
    if (!linha || linha.length !== 240) {
      return {
        valido: false,
        erro: 'Linha deve ter 240 caracteres'
      };
    }

    try {
      const tipoInfo = this.detectType(linha);

      const resumo = {
        valido: true,
        tipo: tipoInfo.tipoRegistro,
        descricao: tipoInfo.descricao,
        categoria: tipoInfo.categoria,
        banco: linha.substring(0, 3),
        lote: linha.substring(3, 7)
      };

      // Adicionar informações específicas por tipo
      if (tipoInfo.categoria === 'detalhe') {
        resumo.segmento = linha[13];

        if (resumo.segmento === 'B') {
          try {
            const subtipo = SegmentoBParser.identifySubtype(linha);
            resumo.subtipo = subtipo;
          } catch (e) {
            resumo.subtipo = 'desconhecido';
          }
        }
      }

      return resumo;

    } catch (error) {
      return {
        valido: false,
        erro: error.message
      };
    }
  }

  /**
   * Estatísticas de um arquivo CNAB 240
   * @param {string[]} linhas - Array de linhas
   * @returns {Object} Estatísticas do arquivo
   */
  static getFileStats(linhas) {
    const stats = {
      totalLinhas: linhas.length,
      tipos: {},
      lotes: new Set(),
      bancos: new Set(),
      segmentos: {},
      validas: 0,
      invalidas: 0,
      erros: []
    };

    linhas.forEach((linha, indice) => {
      const resumo = this.extractQuickSummary(linha);

      if (resumo.valido) {
        stats.validas++;

        // Contagem por tipo
        stats.tipos[resumo.tipo] = (stats.tipos[resumo.tipo] || 0) + 1;

        // Coleção de lotes únicos
        if (resumo.lote !== '0000' && resumo.lote !== '9999') {
          stats.lotes.add(resumo.lote);
        }

        // Coleção de bancos únicos
        stats.bancos.add(resumo.banco);

        // Contagem por segmento (apenas para detalhes)
        if (resumo.categoria === 'detalhe' && resumo.segmento) {
          const chave = resumo.subtipo ? `${resumo.segmento}_${resumo.subtipo}` : resumo.segmento;
          stats.segmentos[chave] = (stats.segmentos[chave] || 0) + 1;
        }

      } else {
        stats.invalidas++;
        stats.erros.push({
          linha: indice + 1,
          erro: resumo.erro
        });
      }
    });

    // Converter Sets para arrays para serialização JSON
    stats.lotes = Array.from(stats.lotes);
    stats.bancos = Array.from(stats.bancos);

    return stats;
  }

  /**
   * Utilitário para detectar se um arquivo é CNAB 240 válido
   * @param {string[]} linhas - Array de linhas
   * @returns {Object} Resultado da detecção
   */
  static isCNAB240File(linhas) {
    if (!Array.isArray(linhas) || linhas.length < 3) {
      return {
        isCNAB240: false,
        motivo: 'Arquivo deve ter pelo menos 3 linhas (header arquivo + lote + trailer arquivo)'
      };
    }

    // Verificar se todas as linhas têm 240 caracteres
    const linhasComTamanhoIncorreto = linhas.filter(linha => linha.length !== 240);
    if (linhasComTamanhoIncorreto.length > 0) {
      return {
        isCNAB240: false,
        motivo: `${linhasComTamanhoIncorreto.length} linha(s) não têm 240 caracteres`
      };
    }

    // Verificar estrutura básica: deve começar com tipo 0 e terminar com tipo 9
    const primeiraLinha = linhas[0];
    const ultimaLinha = linhas[linhas.length - 1];

    if (primeiraLinha[7] !== '0') {
      return {
        isCNAB240: false,
        motivo: 'Arquivo deve começar com header de arquivo (tipo 0)'
      };
    }

    if (ultimaLinha[7] !== '9') {
      return {
        isCNAB240: false,
        motivo: 'Arquivo deve terminar com trailer de arquivo (tipo 9)'
      };
    }

    // Verificar se existe pelo menos um lote
    const temHeaderLote = linhas.some(linha => linha[7] === '1');
    const temTrailerLote = linhas.some(linha => linha[7] === '5');

    if (!temHeaderLote || !temTrailerLote) {
      return {
        isCNAB240: false,
        motivo: 'Arquivo deve conter pelo menos um lote completo (header e trailer de lote)'
      };
    }

    return {
      isCNAB240: true,
      motivo: 'Arquivo atende aos critérios básicos do CNAB 240'
    };
  }
}

// Exportar parsers individuais também
export {
  HeaderArquivoParser,
  HeaderLoteParser,
  SegmentoParser,
  SegmentoBParser,
  TrailerParser
};

// Exportar como default
export default CNAB240Parser; 