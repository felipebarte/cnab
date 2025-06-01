/**
 * Validador de Estrutura CNAB 240
 * 
 * Responsável por validar a estrutura hierárquica e sequencial
 * dos registros CNAB 240, garantindo a correta organização
 * de headers, lotes, detalhes e trailers.
 */

import { TIPOS_REGISTRO, SEGMENTOS } from '../../../config/bancos240.js';

class EstruturaValidator {
  /**
   * Valida a estrutura completa do arquivo CNAB 240
   * @param {Object} dadosProcessados - Dados estruturados do arquivo
   * @returns {Object} Resultado da validação estrutural
   */
  static validar(dadosProcessados) {
    const resultado = {
      valido: true,
      erros: [],
      avisos: [],
      detalhes: {
        headerArquivo: false,
        trailerArquivo: false,
        lotes: [],
        sequenciaValida: true,
        estruturaCompleta: true
      }
    };

    try {
      // 1. Validar presença obrigatória de header e trailer de arquivo
      this.validarHeaderTrailerArquivo(dadosProcessados, resultado);

      // 2. Validar estrutura dos lotes
      this.validarEstruturaLotes(dadosProcessados, resultado);

      // 3. Validar sequência hierárquica
      this.validarSequenciaHierarquica(dadosProcessados, resultado);

      // 4. Validar relação entre lotes e detalhes
      this.validarRelacaoLotesDetalhes(dadosProcessados, resultado);

      // 5. Validar coerência de sequenciais
      this.validarSequenciais(dadosProcessados, resultado);

    } catch (error) {
      resultado.valido = false;
      resultado.erros.push(`Erro interno de validação estrutural: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Valida a presença obrigatória de header e trailer de arquivo
   */
  static validarHeaderTrailerArquivo(dadosProcessados, resultado) {
    // Header de arquivo
    if (!dadosProcessados.headerArquivo) {
      resultado.valido = false;
      resultado.erros.push('Header de arquivo (tipo 0) é obrigatório');
      resultado.detalhes.headerArquivo = false;
    } else {
      resultado.detalhes.headerArquivo = true;

      // Validar campos essenciais do header
      const header = dadosProcessados.headerArquivo;
      if (!header.codigoBanco || header.codigoBanco === '000') {
        resultado.erros.push('Código do banco no header de arquivo é inválido');
        resultado.valido = false;
      }

      if (!header.nomeEmpresa || header.nomeEmpresa.trim() === '') {
        resultado.avisos.push('Nome da empresa no header de arquivo está vazio');
      }
    }

    // Trailer de arquivo
    if (!dadosProcessados.trailerArquivo) {
      resultado.valido = false;
      resultado.erros.push('Trailer de arquivo (tipo 9) é obrigatório');
      resultado.detalhes.trailerArquivo = false;
    } else {
      resultado.detalhes.trailerArquivo = true;

      // Validar campos essenciais do trailer
      const trailer = dadosProcessados.trailerArquivo;
      if (trailer.quantidadeLotes === undefined || trailer.quantidadeLotes < 0) {
        resultado.erros.push('Quantidade de lotes no trailer de arquivo é inválida');
        resultado.valido = false;
      }

      if (trailer.quantidadeRegistros === undefined || trailer.quantidadeRegistros < 3) {
        resultado.erros.push('Quantidade de registros no trailer de arquivo é inválida (mínimo 3)');
        resultado.valido = false;
      }
    }
  }

  /**
   * Valida a estrutura individual de cada lote
   */
  static validarEstruturaLotes(dadosProcessados, resultado) {
    if (!dadosProcessados.lotes || dadosProcessados.lotes.length === 0) {
      resultado.erros.push('Arquivo deve conter pelo menos um lote');
      resultado.valido = false;
      return;
    }

    dadosProcessados.lotes.forEach((lote, index) => {
      const loteInfo = {
        numero: index + 1,
        headerValido: false,
        trailerValido: false,
        detalhesPresentes: false,
        erros: [],
        avisos: []
      };

      // Validar header do lote
      if (!lote.header) {
        loteInfo.erros.push(`Lote ${index + 1}: Header de lote (tipo 1) é obrigatório`);
        resultado.valido = false;
      } else {
        loteInfo.headerValido = true;

        // Validar campos essenciais do header do lote
        const header = lote.header;

        if (!header.numeroLote || header.numeroLote <= 0) {
          loteInfo.erros.push(`Lote ${index + 1}: Número do lote inválido`);
          resultado.valido = false;
        }

        if (!header.tipoOperacao || header.tipoOperacao.trim() === '') {
          loteInfo.erros.push(`Lote ${index + 1}: Tipo de operação é obrigatório`);
          resultado.valido = false;
        }

        if (!header.codigoConvenio || header.codigoConvenio.trim() === '') {
          loteInfo.erros.push(`Lote ${index + 1}: Código de convênio/operação é obrigatório`);
          resultado.valido = false;
        }
      }

      // Validar trailer do lote
      if (!lote.trailer) {
        loteInfo.erros.push(`Lote ${index + 1}: Trailer de lote (tipo 5) é obrigatório`);
        resultado.valido = false;
      } else {
        loteInfo.trailerValido = true;

        // Validar campos essenciais do trailer do lote
        const trailer = lote.trailer;

        if (trailer.quantidadeRegistros === undefined || trailer.quantidadeRegistros < 2) {
          loteInfo.erros.push(`Lote ${index + 1}: Quantidade de registros no trailer é inválida (mínimo 2)`);
          resultado.valido = false;
        }

        if (trailer.numeroLote !== lote.header?.numeroLote) {
          loteInfo.erros.push(`Lote ${index + 1}: Número do lote no trailer não confere com o header`);
          resultado.valido = false;
        }
      }

      // Validar presença de detalhes
      if (!lote.detalhes || lote.detalhes.length === 0) {
        loteInfo.erros.push(`Lote ${index + 1}: Deve conter pelo menos um registro de detalhe`);
        resultado.valido = false;
      } else {
        loteInfo.detalhesPresentes = true;

        // Validar segmentos obrigatórios
        this.validarSegmentosObrigatorios(lote, loteInfo, index + 1);
      }

      // Acumular erros e avisos
      resultado.erros.push(...loteInfo.erros);
      resultado.avisos.push(...loteInfo.avisos);
      resultado.detalhes.lotes.push(loteInfo);
    });
  }

  /**
   * Valida os segmentos obrigatórios em cada lote
   */
  static validarSegmentosObrigatorios(lote, loteInfo, numeroLote) {
    const segmentosEncontrados = new Set();

    // Mapear segmentos presentes
    lote.detalhes.forEach(detalhe => {
      if (detalhe.segmento) {
        segmentosEncontrados.add(detalhe.segmento);
      }
    });

    // Segmento A é sempre obrigatório
    if (!segmentosEncontrados.has('A')) {
      loteInfo.erros.push(`Lote ${numeroLote}: Segmento A é obrigatório`);
    }

    // Para operações PIX, segmento B é obrigatório
    const codigoOperacao = lote.header?.codigoConvenio;
    if (codigoOperacao && (codigoOperacao === '204504' || codigoOperacao === '204704')) {
      if (!segmentosEncontrados.has('B')) {
        loteInfo.erros.push(`Lote ${numeroLote}: Segmento B é obrigatório para operações PIX`);
      }
    }

    // Para operações de cobrança com complemento, segmento B é obrigatório
    if (codigoOperacao === '203103') {
      if (!segmentosEncontrados.has('B')) {
        loteInfo.erros.push(`Lote ${numeroLote}: Segmento B é obrigatório para cobrança com complemento`);
      }
    }
  }

  /**
   * Valida a sequência hierárquica dos registros
   */
  static validarSequenciaHierarquica(dadosProcessados, resultado) {
    const sequenciaEsperada = [];

    // Deve começar com header de arquivo
    sequenciaEsperada.push('Header de Arquivo');

    // Cada lote: header -> detalhes -> trailer
    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, index) => {
        sequenciaEsperada.push(`Header Lote ${index + 1}`);
        if (lote.detalhes) {
          lote.detalhes.forEach((_, detIndex) => {
            sequenciaEsperada.push(`Detalhe ${index + 1}.${detIndex + 1}`);
          });
        }
        sequenciaEsperada.push(`Trailer Lote ${index + 1}`);
      });
    }

    // Deve terminar com trailer de arquivo
    sequenciaEsperada.push('Trailer de Arquivo');

    // Verificar se a estrutura segue a hierarquia esperada
    if (!dadosProcessados.headerArquivo) {
      resultado.detalhes.sequenciaValida = false;
    }

    if (!dadosProcessados.trailerArquivo) {
      resultado.detalhes.sequenciaValida = false;
    }

    // Verificar consistência dos lotes
    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, index) => {
        if (!lote.header || !lote.trailer) {
          resultado.detalhes.sequenciaValida = false;
          resultado.erros.push(`Lote ${index + 1}: Estrutura incompleta (header ou trailer ausente)`);
          resultado.valido = false;
        }
      });
    }
  }

  /**
   * Valida a relação correta entre lotes e seus detalhes
   */
  static validarRelacaoLotesDetalhes(dadosProcessados, resultado) {
    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      // Verificar se todos os detalhes pertencem ao lote correto
      if (lote.detalhes) {
        lote.detalhes.forEach((detalhe, detIndex) => {
          if (detalhe.numeroLote && detalhe.numeroLote !== lote.header?.numeroLote) {
            resultado.erros.push(
              `Lote ${numeroLote}, Detalhe ${detIndex + 1}: ` +
              `Número do lote (${detalhe.numeroLote}) não confere com o header (${lote.header?.numeroLote})`
            );
            resultado.valido = false;
          }
        });
      }

      // Verificar coerência nas quantidades do trailer
      if (lote.trailer && lote.detalhes) {
        const quantidadeDetalhes = lote.detalhes.length;
        const quantidadeRegistrosLote = quantidadeDetalhes + 2; // +2 para header e trailer do lote

        if (lote.trailer.quantidadeRegistros !== quantidadeRegistrosLote) {
          resultado.avisos.push(
            `Lote ${numeroLote}: Quantidade de registros no trailer (${lote.trailer.quantidadeRegistros}) ` +
            `não confere com a contagem real (${quantidadeRegistrosLote})`
          );
        }
      }
    });
  }

  /**
   * Valida a coerência dos números sequenciais
   */
  static validarSequenciais(dadosProcessados, resultado) {
    // Validar sequencial de lotes
    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, index) => {
        const numeroEsperado = index + 1;

        if (lote.header?.numeroLote !== numeroEsperado) {
          resultado.avisos.push(
            `Lote ${index + 1}: Numeração sequencial inconsistente ` +
            `(esperado: ${numeroEsperado}, encontrado: ${lote.header?.numeroLote})`
          );
        }
      });
    }

    // Validar sequencial de registros dentro de cada lote
    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, loteIndex) => {
        if (lote.detalhes) {
          lote.detalhes.forEach((detalhe, detIndex) => {
            const sequencialEsperado = detIndex + 1;

            if (detalhe.numeroSequencial && detalhe.numeroSequencial !== sequencialEsperado) {
              resultado.avisos.push(
                `Lote ${loteIndex + 1}, Detalhe ${detIndex + 1}: ` +
                `Sequencial inconsistente (esperado: ${sequencialEsperado}, encontrado: ${detalhe.numeroSequencial})`
              );
            }
          });
        }
      });
    }

    // Validar quantidades no trailer do arquivo
    if (dadosProcessados.trailerArquivo && dadosProcessados.lotes) {
      const quantidadeLotesReal = dadosProcessados.lotes.length;

      if (dadosProcessados.trailerArquivo.quantidadeLotes !== quantidadeLotesReal) {
        resultado.erros.push(
          `Trailer de arquivo: Quantidade de lotes (${dadosProcessados.trailerArquivo.quantidadeLotes}) ` +
          `não confere com a contagem real (${quantidadeLotesReal})`
        );
        resultado.valido = false;
      }
    }
  }
}

export default EstruturaValidator; 