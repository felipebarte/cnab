/**
 * Validador de Integridade CNAB 240
 * 
 * Responsável por validar a integridade matemática e contábil
 * dos dados CNAB 240, incluindo somatórias, quantidades e
 * sequenciais de registros.
 */

class IntegridadeValidator {
  /**
   * Valida a integridade completa do arquivo CNAB 240
   * @param {Object} dadosProcessados - Dados estruturados do arquivo
   * @returns {Object} Resultado da validação de integridade
   */
  static validar(dadosProcessados) {
    const resultado = {
      valido: true,
      erros: [],
      avisos: [],
      detalhes: {
        somatoriasValidas: true,
        quantidadesValidas: true,
        sequenciaisValidos: true,
        totalizadores: {
          arquivo: null,
          lotes: []
        }
      }
    };

    try {
      // 1. Validar somatórias dos trailers
      this.validarSomatorias(dadosProcessados, resultado);

      // 2. Validar quantidades de registros
      this.validarQuantidadeRegistros(dadosProcessados, resultado);

      // 3. Validar sequencial de lotes
      this.validarSequencialLotes(dadosProcessados, resultado);

      // 4. Validar sequencial de registros
      this.validarSequencialRegistros(dadosProcessados, resultado);

      // 5. Calcular e validar totalizadores
      this.calcularTotalizadores(dadosProcessados, resultado);

      // 6. Validar coerência entre headers e trailers
      this.validarCoerenciaHeaderTrailer(dadosProcessados, resultado);

    } catch (error) {
      resultado.valido = false;
      resultado.erros.push(`Erro interno de validação de integridade: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Valida as somatórias nos trailers de lotes e arquivo
   */
  static validarSomatorias(dadosProcessados, resultado) {
    if (!dadosProcessados.lotes) return;

    let somaValoresLotes = 0;
    let totalRegistrosLotes = 0;

    // Validar somatórias de cada lote
    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      if (!lote.trailer) {
        resultado.erros.push(`Lote ${numeroLote}: Trailer ausente para validação de somatórias`);
        resultado.valido = false;
        return;
      }

      // Calcular somatória real dos valores do lote
      let somaRealLote = 0;
      let quantidadeRealRegistros = 2; // Header + Trailer do lote

      if (lote.detalhes) {
        quantidadeRealRegistros += lote.detalhes.length;

        lote.detalhes.forEach(detalhe => {
          // Somar valores dos segmentos A (principais)
          if (detalhe.segmento === 'A' && detalhe.valor !== undefined) {
            const valor = typeof detalhe.valor === 'string' ?
              parseInt(detalhe.valor) || 0 : detalhe.valor;
            somaRealLote += valor;
          }
        });
      }

      // Validar somatória do lote
      if (lote.trailer.somatoriaValores !== undefined) {
        const somaTrailer = typeof lote.trailer.somatoriaValores === 'string' ?
          parseInt(lote.trailer.somatoriaValores) || 0 : lote.trailer.somatoriaValores;

        if (somaTrailer !== somaRealLote) {
          resultado.erros.push(
            `Lote ${numeroLote}: Somatória de valores no trailer (${somaTrailer}) ` +
            `não confere com o calculado (${somaRealLote})`
          );
          resultado.valido = false;
          resultado.detalhes.somatoriasValidas = false;
        }
      }

      // Validar quantidade de registros do lote
      if (lote.trailer.quantidadeRegistros !== quantidadeRealRegistros) {
        resultado.erros.push(
          `Lote ${numeroLote}: Quantidade de registros no trailer (${lote.trailer.quantidadeRegistros}) ` +
          `não confere com o calculado (${quantidadeRealRegistros})`
        );
        resultado.valido = false;
        resultado.detalhes.quantidadesValidas = false;
      }

      // Acumular para validação do arquivo
      somaValoresLotes += somaRealLote;
      totalRegistrosLotes += quantidadeRealRegistros;
    });

    // Validar somatórias do arquivo
    if (dadosProcessados.trailerArquivo) {
      const totalRegistrosArquivo = totalRegistrosLotes + 2; // +2 para header e trailer do arquivo

      // Validar quantidade total de registros
      if (dadosProcessados.trailerArquivo.quantidadeRegistros !== totalRegistrosArquivo) {
        resultado.erros.push(
          `Trailer de arquivo: Quantidade de registros (${dadosProcessados.trailerArquivo.quantidadeRegistros}) ` +
          `não confere com o calculado (${totalRegistrosArquivo})`
        );
        resultado.valido = false;
        resultado.detalhes.quantidadesValidas = false;
      }

      // Validar quantidade de lotes
      if (dadosProcessados.trailerArquivo.quantidadeLotes !== dadosProcessados.lotes.length) {
        resultado.erros.push(
          `Trailer de arquivo: Quantidade de lotes (${dadosProcessados.trailerArquivo.quantidadeLotes}) ` +
          `não confere com o calculado (${dadosProcessados.lotes.length})`
        );
        resultado.valido = false;
        resultado.detalhes.quantidadesValidas = false;
      }

      // Validar somatória geral (se presente)
      if (dadosProcessados.trailerArquivo.somatoriaValores !== undefined) {
        const somaTrailerArquivo = typeof dadosProcessados.trailerArquivo.somatoriaValores === 'string' ?
          parseInt(dadosProcessados.trailerArquivo.somatoriaValores) || 0 :
          dadosProcessados.trailerArquivo.somatoriaValores;

        if (somaTrailerArquivo !== somaValoresLotes) {
          resultado.erros.push(
            `Trailer de arquivo: Somatória geral (${somaTrailerArquivo}) ` +
            `não confere com o calculado (${somaValoresLotes})`
          );
          resultado.valido = false;
          resultado.detalhes.somatoriasValidas = false;
        }
      }
    }
  }

  /**
   * Valida as quantidades de registros em todos os níveis
   */
  static validarQuantidadeRegistros(dadosProcessados, resultado) {
    // Contar registros reais
    let totalRegistros = 0;

    // Header e trailer de arquivo
    if (dadosProcessados.headerArquivo) totalRegistros++;
    if (dadosProcessados.trailerArquivo) totalRegistros++;

    // Registros dos lotes
    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, index) => {
        let registrosLote = 0;

        // Header e trailer do lote
        if (lote.header) registrosLote++;
        if (lote.trailer) registrosLote++;

        // Detalhes do lote
        if (lote.detalhes) {
          registrosLote += lote.detalhes.length;
        }

        totalRegistros += registrosLote;

        // Validar quantidade específica do lote
        if (lote.trailer && lote.trailer.quantidadeRegistros !== registrosLote) {
          resultado.avisos.push(
            `Lote ${index + 1}: Contagem de registros inconsistente ` +
            `(trailer: ${lote.trailer.quantidadeRegistros}, real: ${registrosLote})`
          );
        }
      });
    }

    // Validar total no trailer do arquivo
    if (dadosProcessados.trailerArquivo) {
      if (dadosProcessados.trailerArquivo.quantidadeRegistros !== totalRegistros) {
        resultado.erros.push(
          `Quantidade total de registros inconsistente ` +
          `(trailer: ${dadosProcessados.trailerArquivo.quantidadeRegistros}, real: ${totalRegistros})`
        );
        resultado.valido = false;
        resultado.detalhes.quantidadesValidas = false;
      }
    }
  }

  /**
   * Valida a sequência numérica dos lotes
   */
  static validarSequencialLotes(dadosProcessados, resultado) {
    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroEsperado = index + 1;

      // Validar sequencial no header do lote
      if (lote.header && lote.header.numeroLote !== numeroEsperado) {
        resultado.avisos.push(
          `Lote ${index + 1}: Sequencial inconsistente no header ` +
          `(esperado: ${numeroEsperado}, encontrado: ${lote.header.numeroLote})`
        );
        resultado.detalhes.sequenciaisValidos = false;
      }

      // Validar sequencial no trailer do lote
      if (lote.trailer && lote.trailer.numeroLote !== numeroEsperado) {
        resultado.avisos.push(
          `Lote ${index + 1}: Sequencial inconsistente no trailer ` +
          `(esperado: ${numeroEsperado}, encontrado: ${lote.trailer.numeroLote})`
        );
        resultado.detalhes.sequenciaisValidos = false;
      }

      // Verificar coerência entre header e trailer do mesmo lote
      if (lote.header && lote.trailer &&
        lote.header.numeroLote !== lote.trailer.numeroLote) {
        resultado.erros.push(
          `Lote ${index + 1}: Número do lote inconsistente entre header ` +
          `(${lote.header.numeroLote}) e trailer (${lote.trailer.numeroLote})`
        );
        resultado.valido = false;
        resultado.detalhes.sequenciaisValidos = false;
      }
    });
  }

  /**
   * Valida a sequência numérica dos registros dentro de cada lote
   */
  static validarSequencialRegistros(dadosProcessados, resultado) {
    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, loteIndex) => {
      if (!lote.detalhes) return;

      lote.detalhes.forEach((detalhe, detIndex) => {
        const sequencialEsperado = detIndex + 1;

        // Verificar se o detalhe tem campo de sequencial
        if (detalhe.numeroSequencial !== undefined) {
          if (detalhe.numeroSequencial !== sequencialEsperado) {
            resultado.avisos.push(
              `Lote ${loteIndex + 1}, Registro ${detIndex + 1}: ` +
              `Sequencial inconsistente (esperado: ${sequencialEsperado}, ` +
              `encontrado: ${detalhe.numeroSequencial})`
            );
            resultado.detalhes.sequenciaisValidos = false;
          }
        }

        // Verificar se o número do lote no detalhe confere
        if (detalhe.numeroLote !== undefined &&
          detalhe.numeroLote !== lote.header?.numeroLote) {
          resultado.erros.push(
            `Lote ${loteIndex + 1}, Registro ${detIndex + 1}: ` +
            `Número do lote no detalhe (${detalhe.numeroLote}) não confere ` +
            `com o header (${lote.header?.numeroLote})`
          );
          resultado.valido = false;
        }
      });
    });
  }

  /**
   * Calcula e armazena totalizadores para referência
   */
  static calcularTotalizadores(dadosProcessados, resultado) {
    // Totalizadores do arquivo
    const totalizadorArquivo = {
      quantidadeLotes: dadosProcessados.lotes?.length || 0,
      quantidadeRegistros: 0,
      somatoriaValores: 0
    };

    const totalizadoresLotes = [];

    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, index) => {
        const totalizadorLote = {
          numeroLote: index + 1,
          quantidadeRegistros: 2, // Header + Trailer
          quantidadeDetalhes: lote.detalhes?.length || 0,
          somatoriaValores: 0,
          segmentosEncontrados: new Set()
        };

        // Processar detalhes
        if (lote.detalhes) {
          totalizadorLote.quantidadeRegistros += lote.detalhes.length;

          lote.detalhes.forEach(detalhe => {
            // Mapear segmentos
            if (detalhe.segmento) {
              totalizadorLote.segmentosEncontrados.add(detalhe.segmento);
            }

            // Somar valores (apenas segmentos A)
            if (detalhe.segmento === 'A' && detalhe.valor !== undefined) {
              const valor = typeof detalhe.valor === 'string' ?
                parseInt(detalhe.valor) || 0 : detalhe.valor;
              totalizadorLote.somatoriaValores += valor;
            }
          });
        }

        // Converter Set para Array para serialização
        totalizadorLote.segmentosEncontrados = Array.from(totalizadorLote.segmentosEncontrados);

        totalizadoresLotes.push(totalizadorLote);

        // Acumular no totalizador do arquivo
        totalizadorArquivo.quantidadeRegistros += totalizadorLote.quantidadeRegistros;
        totalizadorArquivo.somatoriaValores += totalizadorLote.somatoriaValores;
      });
    }

    // Adicionar header e trailer do arquivo
    totalizadorArquivo.quantidadeRegistros += 2;

    // Armazenar nos detalhes do resultado
    resultado.detalhes.totalizadores.arquivo = totalizadorArquivo;
    resultado.detalhes.totalizadores.lotes = totalizadoresLotes;
  }

  /**
   * Valida coerência entre dados de headers e trailers
   */
  static validarCoerenciaHeaderTrailer(dadosProcessados, resultado) {
    // Validar coerência arquivo
    if (dadosProcessados.headerArquivo && dadosProcessados.trailerArquivo) {
      const header = dadosProcessados.headerArquivo;
      const trailer = dadosProcessados.trailerArquivo;

      // Código do banco deve ser o mesmo
      if (header.codigoBanco !== trailer.codigoBanco) {
        resultado.erros.push(
          `Código do banco inconsistente entre header (${header.codigoBanco}) ` +
          `e trailer (${trailer.codigoBanco}) do arquivo`
        );
        resultado.valido = false;
      }

      // Data de geração (se presente em ambos)
      if (header.dataGeracao && trailer.dataGeracao &&
        header.dataGeracao !== trailer.dataGeracao) {
        resultado.avisos.push(
          `Data de geração inconsistente entre header e trailer do arquivo`
        );
      }
    }

    // Validar coerência dos lotes
    if (dadosProcessados.lotes) {
      dadosProcessados.lotes.forEach((lote, index) => {
        if (lote.header && lote.trailer) {
          const header = lote.header;
          const trailer = lote.trailer;

          // Número do lote deve ser o mesmo
          if (header.numeroLote !== trailer.numeroLote) {
            resultado.erros.push(
              `Lote ${index + 1}: Número inconsistente entre header (${header.numeroLote}) ` +
              `e trailer (${trailer.numeroLote})`
            );
            resultado.valido = false;
          }

          // Tipo de operação deve ser o mesmo
          if (header.tipoOperacao !== trailer.tipoOperacao) {
            resultado.avisos.push(
              `Lote ${index + 1}: Tipo de operação inconsistente entre header e trailer`
            );
          }
        }
      });
    }
  }
}

export default IntegridadeValidator; 