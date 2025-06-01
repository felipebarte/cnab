/**
 * Serviço principal para processamento completo de arquivos CNAB 240
 * 
 * Este serviço orquestra todo o processamento de arquivos CNAB 240,
 * utilizando os parsers especializados e as configurações de bancos.
 */

import Cnab240BaseParser from './cnab240BaseParser.js';
import { CNAB240Parser } from './parsers/index.js';
import { BANCOS_240, UTILS_VALIDACAO } from '../../config/bancos240.js';

/**
 * Serviço principal para processamento de arquivos CNAB 240
 */
class Cnab240Service {
  /**
   * Processa um arquivo CNAB 240 completo
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @param {Object} options - Opções de processamento
   * @returns {Object} Dados estruturados do arquivo CNAB 240
   */
  static async processar(cnabContent, options = {}) {
    try {
      if (!cnabContent || typeof cnabContent !== 'string') {
        throw new Error('Conteúdo do arquivo CNAB é obrigatório e deve ser uma string');
      }

      // Validação inicial do arquivo
      const validacaoInicial = this.validarArquivo(cnabContent);
      if (!validacaoInicial.valido) {
        throw new Error(`Arquivo CNAB 240 inválido: ${validacaoInicial.erros.join(', ')}`);
      }

      // Processamento linha por linha
      const linhas = cnabContent.split('\n')
        .map(linha => linha.replace(/\r?\n?$/g, '')) // Remove \r e \n do final
        .filter(linha => linha.trim() !== '');
      const dadosProcessados = this.processarLinhas(linhas);

      // Identificação do banco
      const codigoBanco = dadosProcessados.headerArquivo?.codigoBanco;
      const configuracaoBanco = BANCOS_240[codigoBanco];

      // Validação da estrutura
      const validacaoEstrutura = this.validarEstrutura(dadosProcessados, configuracaoBanco);
      if (!validacaoEstrutura.valido) {
        console.warn('Avisos de estrutura:', validacaoEstrutura.avisos);
      }

      // Extração de dados completos
      const dadosCompletos = this.extrairDadosCompletos(dadosProcessados, configuracaoBanco);

      // Cálculo de somatórias e validações
      const somatorias = this.calcularSomatorias(dadosProcessados);
      const resumoProcessamento = this.gerarResumoProcessamento(dadosProcessados, somatorias);

      return {
        sucesso: true,
        dadosEstruturados: dadosCompletos,
        validacao: validacaoEstrutura,
        somatorias,
        resumoProcessamento,
        informacoesArquivo: {
          tamanhoOriginal: cnabContent.length,
          totalLinhas: linhas.length,
          formato: 'CNAB 240',
          banco: configuracaoBanco?.codigo || codigoBanco,
          nomeBanco: configuracaoBanco?.nome || 'Banco não identificado',
          versaoLayout: configuracaoBanco?.versaoLayout || 'Não identificada'
        },
        dataProcessamento: new Date().toISOString(),
        opcoes: options
      };

    } catch (error) {
      console.error('Erro ao processar arquivo CNAB 240:', error);
      return {
        sucesso: false,
        erro: error.message,
        dataProcessamento: new Date().toISOString()
      };
    }
  }

  /**
   * Processa as linhas do arquivo CNAB 240
   * @param {Array<string>} linhas - Array de linhas do arquivo
   * @returns {Object} Estrutura de dados processada
   */
  static processarLinhas(linhas) {
    const estrutura = {
      headerArquivo: null,
      lotes: [],
      trailerArquivo: null
    };

    let loteAtual = null;

    linhas.forEach((linha, index) => {
      try {
        // Usar o parser genérico que detecta automaticamente o tipo
        const dadosParsed = CNAB240Parser.parse(linha);
        const tipoRegistro = dadosParsed._metadata.tipo;

        switch (tipoRegistro) {
          case '0': // Header de arquivo
            estrutura.headerArquivo = dadosParsed;
            break;

          case '1': // Header de lote
            loteAtual = {
              header: dadosParsed,
              detalhes: [],
              trailer: null
            };
            estrutura.lotes.push(loteAtual);
            break;

          case '3': // Detalhe (Segmentos A, B, etc.)
            if (!loteAtual) {
              throw new Error(`Linha ${index + 1}: Registro de detalhe encontrado sem header de lote`);
            }
            loteAtual.detalhes.push(dadosParsed);
            break;

          case '5': // Trailer de lote
            if (!loteAtual) {
              throw new Error(`Linha ${index + 1}: Trailer de lote encontrado sem header de lote`);
            }
            loteAtual.trailer = dadosParsed;
            break;

          case '9': // Trailer de arquivo
            estrutura.trailerArquivo = dadosParsed;
            break;

          default:
            console.warn(`Linha ${index + 1}: Tipo de registro "${tipoRegistro}" não reconhecido`);
        }

      } catch (error) {
        console.error(`Erro ao processar linha ${index + 1}:`, error.message);
        // Continua processamento das demais linhas
      }
    });

    return estrutura;
  }

  /**
   * Valida a estrutura básica do arquivo CNAB 240
   * @param {string} cnabContent - Conteúdo do arquivo
   * @returns {Object} Resultado da validação
   */
  static validarArquivo(cnabContent) {
    const erros = [];
    const avisos = [];

    // Verificar se não está vazio
    if (!cnabContent || cnabContent.trim().length === 0) {
      erros.push('Arquivo vazio');
      return { valido: false, erros, avisos };
    }

    // Dividir em linhas e limpar caracteres de quebra de linha
    const linhas = cnabContent.split('\n')
      .map(linha => linha.replace(/\r?\n?$/g, '')) // Remove \r e \n do final
      .filter(linha => linha.trim() !== '');

    // Verificar se tem pelo menos 3 linhas (header arquivo, header lote, trailer arquivo)
    if (linhas.length < 3) {
      erros.push('Arquivo deve ter pelo menos 3 linhas (header arquivo, header lote, trailer arquivo)');
    }

    // Verificar tamanho das linhas
    linhas.forEach((linha, index) => {
      if (linha.length !== 240) {
        erros.push(`Linha ${index + 1}: deve ter exatamente 240 caracteres, encontrado ${linha.length}`);
      }
    });

    // Verificar se primeira linha é header de arquivo (tipo 0)
    if (linhas.length > 0 && linhas[0][7] !== '0') {
      erros.push('Primeira linha deve ser header de arquivo (tipo registro 0)');
    }

    // Verificar se última linha é trailer de arquivo (tipo 9)
    if (linhas.length > 0 && linhas[linhas.length - 1][7] !== '9') {
      erros.push('Última linha deve ser trailer de arquivo (tipo registro 9)');
    }

    return {
      valido: erros.length === 0,
      erros,
      avisos
    };
  }

  /**
   * Valida a estrutura hierárquica e integridade dos dados
   * @param {Object} dadosProcessados - Dados já processados
   * @param {Object} configuracaoBanco - Configuração do banco
   * @returns {Object} Resultado da validação
   */
  static validarEstrutura(dadosProcessados, configuracaoBanco) {
    const erros = [];
    const avisos = [];

    // Validar header de arquivo
    if (!dadosProcessados.headerArquivo) {
      erros.push('Header de arquivo não encontrado');
    }

    // Validar trailer de arquivo
    if (!dadosProcessados.trailerArquivo) {
      erros.push('Trailer de arquivo não encontrado');
    }

    // Validar lotes
    if (!dadosProcessados.lotes || dadosProcessados.lotes.length === 0) {
      avisos.push('Nenhum lote encontrado no arquivo');
    } else {
      dadosProcessados.lotes.forEach((lote, index) => {
        if (!lote.header) {
          erros.push(`Lote ${index + 1}: Header de lote não encontrado`);
        }
        if (!lote.trailer) {
          erros.push(`Lote ${index + 1}: Trailer de lote não encontrado`);
        }

        // Validar sequência de registros no lote
        if (lote.header && lote.trailer) {
          const quantidadeEsperada = lote.trailer.quantidadeRegistros;
          const quantidadeReal = lote.detalhes.length + 2; // +2 para header e trailer do lote

          if (quantidadeEsperada !== quantidadeReal) {
            avisos.push(`Lote ${index + 1}: Quantidade de registros não confere. Esperado: ${quantidadeEsperada}, Real: ${quantidadeReal}`);
          }
        }
      });
    }

    // Validar configurações específicas do banco
    if (configuracaoBanco) {
      dadosProcessados.lotes.forEach((lote, index) => {
        if (lote.header?.codigoOperacao) {
          const operacaoSuportada = UTILS_VALIDACAO.operacaoSuportada(
            configuracaoBanco.codigo,
            lote.header.codigoOperacao
          );

          if (!operacaoSuportada) {
            avisos.push(`Lote ${index + 1}: Operação ${lote.header.codigoOperacao} pode não ser suportada pelo banco ${configuracaoBanco.nome}`);
          }
        }
      });
    }

    return {
      valido: erros.length === 0,
      erros,
      avisos
    };
  }

  /**
   * Extrai dados completos e estruturados
   * @param {Object} dadosProcessados - Dados processados
   * @param {Object} configuracaoBanco - Configuração do banco
   * @returns {Object} Dados completos estruturados
   */
  static extrairDadosCompletos(dadosProcessados, configuracaoBanco) {
    return {
      arquivo: {
        header: dadosProcessados.headerArquivo,
        trailer: dadosProcessados.trailerArquivo,
        banco: configuracaoBanco,
        totalizadores: this.calcularTotalizadoresArquivo(dadosProcessados)
      },
      lotes: dadosProcessados.lotes.map((lote, index) => ({
        sequencia: index + 1,
        header: lote.header,
        trailer: lote.trailer,
        detalhes: this.processarDetalhesLote(lote.detalhes, configuracaoBanco),
        estatisticas: this.calcularEstatisticasLote(lote),
        totalizadores: this.calcularTotalizadoresLote(lote)
      })),
      estatisticas: Cnab240BaseParser.obterEstatisticas(dadosProcessados),
      configuracao: configuracaoBanco
    };
  }

  /**
   * Processa os detalhes de um lote com informações enriquecidas
   * @param {Array} detalhes - Detalhes do lote
   * @param {Object} configuracaoBanco - Configuração do banco
   * @returns {Array} Detalhes processados
   */
  static processarDetalhesLote(detalhes, configuracaoBanco) {
    return detalhes.map((detalhe, index) => {
      const resultado = {
        sequencia: index + 1,
        segmento: detalhe.segmento,
        dadosOriginais: detalhe,
        validacao: { valido: true, erros: [], avisos: [] }
      };

      // Processamento específico por segmento
      if (detalhe.segmento === 'A') {
        resultado.pagamento = this.extrairDadosPagamento(detalhe);
        resultado.beneficiario = this.extrairDadosBeneficiario(detalhe);
      } else if (detalhe.segmento === 'B') {
        resultado.informacoesComplementares = this.extrairInformacoesComplementares(detalhe);
        resultado.pix = this.extrairDadosPix(detalhe, configuracaoBanco);
      }

      return resultado;
    });
  }

  /**
   * Extrai dados de pagamento do Segmento A
   * @param {Object} segmentoA - Dados do Segmento A
   * @returns {Object} Dados de pagamento estruturados
   */
  static extrairDadosPagamento(segmentoA) {
    // Converter valor de string CNAB para número
    const valorPagamento = segmentoA.valorPagamento
      ? this.parseValorCNAB(segmentoA.valorPagamento)
      : 0;

    return {
      valorPagamento: valorPagamento,
      dataVencimento: segmentoA.dataVencimento,
      dataPagamento: segmentoA.dataPagamento,
      numeroDocumento: segmentoA.numeroDocumento,
      identificacaoTitulo: segmentoA.identificacaoTitulo,
      status: this.determinarStatusPagamento(segmentoA),
      observacoes: segmentoA.observacoes || ''
    };
  }

  /**
   * Converte valor do formato CNAB (string com centavos) para número em reais
   * @param {string} valorString - Valor em formato CNAB (ex: "000000000010000" = R$ 100,00)
   * @returns {number} Valor em reais
   */
  static parseValorCNAB(valorString) {
    if (!valorString || typeof valorString !== 'string') {
      return 0;
    }

    // Remove espaços e converte para inteiro
    const valorLimpo = valorString.trim();
    const valorInteiro = parseInt(valorLimpo) || 0;

    // Converte centavos para reais (divide por 100)
    return valorInteiro / 100;
  }

  /**
   * Extrai dados do beneficiário
   * @param {Object} segmentoA - Dados do Segmento A
   * @returns {Object} Dados do beneficiário
   */
  static extrairDadosBeneficiario(segmentoA) {
    return {
      nome: segmentoA.nomeFavorecido || '',
      documento: segmentoA.numeroDocumentoEmpresa || '',
      banco: {
        codigo: segmentoA.bancoFavorecido || '',
        agencia: segmentoA.agenciaFavorecido || '',
        conta: segmentoA.contaFavorecido || '',
        digitoVerificador: segmentoA.dvContaFavorecido || ''
      }
    };
  }

  /**
   * Extrai informações complementares do Segmento B
   * @param {Object} segmentoB - Dados do Segmento B
   * @returns {Object} Informações complementares
   */
  static extrairInformacoesComplementares(segmentoB) {
    return {
      subtipo: segmentoB.subtipo || '',
      dadosEspecificos: segmentoB.dadosEspecificos || {},
      informacoesAdicionais: segmentoB.informacoesAdicionais || ''
    };
  }

  /**
   * Extrai dados PIX específicos do Segmento B
   * @param {Object} segmentoB - Dados do Segmento B
   * @param {Object} configuracaoBanco - Configuração do banco
   * @returns {Object} Dados PIX estruturados
   */
  static extrairDadosPix(segmentoB, configuracaoBanco) {
    if (!segmentoB.subtipo || !segmentoB.subtipo.startsWith('B0')) {
      return null;
    }

    const dadosPix = {
      subtipo: segmentoB.subtipo,
      tipoChave: this.determinarTipoChavePix(segmentoB.subtipo),
      chave: segmentoB.chavePix || '',
      validacao: { valido: false, erro: null }
    };

    // Validar chave PIX se configuração do banco estiver disponível
    if (configuracaoBanco?.pix && dadosPix.tipoChave && dadosPix.chave) {
      dadosPix.validacao = UTILS_VALIDACAO.validarChavePix(dadosPix.chave, dadosPix.tipoChave);
    }

    return dadosPix;
  }

  /**
   * Calcula somatórias e totalizadores
   * @param {Object} dadosProcessados - Dados processados
   * @returns {Object} Somatórias calculadas
   */
  static calcularSomatorias(dadosProcessados) {
    let totalRegistros = 0;
    let totalLotes = dadosProcessados.lotes.length;
    let valorTotalGeral = 0;
    let totalSegmentosA = 0;
    let totalSegmentosB = 0;

    dadosProcessados.lotes.forEach(lote => {
      totalRegistros += lote.detalhes.length + 2; // +2 para header e trailer do lote

      lote.detalhes.forEach(detalhe => {
        if (detalhe.segmento === 'A') {
          totalSegmentosA++;
          // Usar o valor já processado do pagamento se disponível
          if (detalhe.pagamento && typeof detalhe.pagamento.valorPagamento === 'number') {
            valorTotalGeral += detalhe.pagamento.valorPagamento;
          } else if (detalhe.valorPagamento) {
            // Fallback para dados brutos se necessário
            const valor = typeof detalhe.valorPagamento === 'string'
              ? this.parseValorCNAB(detalhe.valorPagamento)
              : (detalhe.valorPagamento || 0);
            valorTotalGeral += valor;
          }
        } else if (detalhe.segmento === 'B') {
          totalSegmentosB++;
        }
      });
    });

    totalRegistros += 2; // +2 para header e trailer do arquivo

    return {
      totalRegistros,
      totalLotes,
      valorTotalGeral,
      totalSegmentosA,
      totalSegmentosB,
      validacaoTrailer: this.validarSomatoriasTrailer(dadosProcessados, {
        totalRegistros,
        totalLotes,
        valorTotalGeral
      })
    };
  }

  /**
   * Valida as somatórias com os dados do trailer
   * @param {Object} dadosProcessados - Dados processados
   * @param {Object} somatorias - Somatórias calculadas
   * @returns {Object} Resultado da validação
   */
  static validarSomatoriasTrailer(dadosProcessados, somatorias) {
    const trailer = dadosProcessados.trailerArquivo;
    if (!trailer) {
      return { valido: false, erro: 'Trailer de arquivo não encontrado' };
    }

    const erros = [];

    // Converter valores do trailer de string para número
    const quantidadeLotesTrailer = parseInt(trailer.quantidadeLotes) || 0;
    const quantidadeRegistrosTrailer = parseInt(trailer.quantidadeRegistros) || 0;

    if (quantidadeLotesTrailer !== somatorias.totalLotes) {
      erros.push(`Quantidade de lotes: esperado ${somatorias.totalLotes}, encontrado ${quantidadeLotesTrailer}`);
    }

    if (quantidadeRegistrosTrailer !== somatorias.totalRegistros) {
      erros.push(`Quantidade de registros: esperado ${somatorias.totalRegistros}, encontrado ${quantidadeRegistrosTrailer}`);
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }

  /**
   * Gera resumo completo do processamento
   * @param {Object} dadosProcessados - Dados processados
   * @param {Object} somatorias - Somatórias calculadas
   * @returns {Object} Resumo do processamento
   */
  static gerarResumoProcessamento(dadosProcessados, somatorias) {
    return {
      arquivo: {
        totalLinhas: somatorias.totalRegistros,
        totalLotes: somatorias.totalLotes,
        banco: dadosProcessados.headerArquivo?.nomeBanco || 'Não identificado',
        dataGeracao: dadosProcessados.headerArquivo?.dataGeracao,
        sequencialArquivo: dadosProcessados.headerArquivo?.numeroSequencialArquivo
      },
      financeiro: {
        valorTotalGeral: somatorias.valorTotalGeral,
        quantidadePagamentos: somatorias.totalSegmentosA,
        ticketMedio: somatorias.totalSegmentosA > 0 ? somatorias.valorTotalGeral / somatorias.totalSegmentosA : 0
      },
      distribuicao: {
        segmentosA: somatorias.totalSegmentosA,
        segmentosB: somatorias.totalSegmentosB,
        outrosSegmentos: somatorias.totalRegistros - somatorias.totalSegmentosA - somatorias.totalSegmentosB - (somatorias.totalLotes * 2) - 2
      },
      validacao: somatorias.validacaoTrailer,
      dataProcessamento: new Date().toISOString()
    };
  }

  /**
   * Calcula totalizadores específicos do arquivo
   * @param {Object} dadosProcessados - Dados processados
   * @returns {Object} Totalizadores do arquivo
   */
  static calcularTotalizadoresArquivo(dadosProcessados) {
    const trailer = dadosProcessados.trailerArquivo;

    return {
      quantidadeLotes: trailer?.quantidadeLotes || 0,
      quantidadeRegistros: trailer?.quantidadeRegistros || 0,
      valorTotalArquivo: trailer?.valorTotalArquivo || 0,
      dataProcessamento: new Date().toISOString()
    };
  }

  /**
   * Calcula totalizadores específicos de um lote
   * @param {Object} lote - Dados do lote
   * @returns {Object} Totalizadores do lote
   */
  static calcularTotalizadoresLote(lote) {
    const trailer = lote.trailer;

    return {
      quantidadeRegistros: trailer?.quantidadeRegistros || 0,
      valorTotalLote: trailer?.valorTotalLote || 0,
      quantidadeDetalhes: lote.detalhes.length
    };
  }

  /**
   * Calcula estatísticas específicas de um lote
   * @param {Object} lote - Dados do lote
   * @returns {Object} Estatísticas do lote
   */
  static calcularEstatisticasLote(lote) {
    const segmentos = {};
    let valorTotal = 0;
    let quantidadePagamentos = 0;

    lote.detalhes.forEach(detalhe => {
      const segmento = detalhe.segmento;
      segmentos[segmento] = (segmentos[segmento] || 0) + 1;

      if (segmento === 'A' && detalhe.valorPagamento) {
        // Converter valor para número se ainda for string
        const valor = typeof detalhe.valorPagamento === 'string'
          ? this.parseValorCNAB(detalhe.valorPagamento)
          : (detalhe.valorPagamento || 0);
        valorTotal += valor;
        quantidadePagamentos++;
      }
    });

    return {
      segmentos,
      valorTotal,
      quantidadePagamentos,
      ticketMedio: quantidadePagamentos > 0 ? valorTotal / quantidadePagamentos : 0,
      codigoOperacao: lote.header?.codigoOperacao
    };
  }

  /**
   * Determina o status de um pagamento baseado nos dados
   * @param {Object} segmentoA - Dados do Segmento A
   * @returns {string} Status do pagamento
   */
  static determinarStatusPagamento(segmentoA) {
    // Verificar se já foi pago (tem data de pagamento efetiva diferente de zeros)
    if (segmentoA.dataPagamento && segmentoA.dataPagamento !== '00000000') {
      // Se a data de pagamento é uma data válida no passado ou presente, considerar como PAGO
      const hoje = new Date();
      const diaPag = parseInt(segmentoA.dataPagamento.substring(0, 2));
      const mesPag = parseInt(segmentoA.dataPagamento.substring(2, 4)) - 1; // Mês é 0-indexed
      const anoPag = parseInt(segmentoA.dataPagamento.substring(4, 8));
      const dataPag = new Date(anoPag, mesPag, diaPag);

      if (dataPag <= hoje) {
        return 'PAGO';
      } else {
        // Data de pagamento no futuro - verificar se está vencido
        return dataPag < hoje ? 'VENCIDO' : 'PENDENTE';
      }
    }

    // Se não tem data de pagamento definida (zeros), é PENDENTE
    return 'PENDENTE';
  }

  /**
   * Determina o tipo de chave PIX baseado no subtipo do Segmento B
   * @param {string} subtipo - Subtipo do Segmento B
   * @returns {string} Tipo da chave PIX
   */
  static determinarTipoChavePix(subtipo) {
    // Verificar se o subtipo está no formato correto
    if (!subtipo || typeof subtipo !== 'string') {
      return 'DESCONHECIDO';
    }

    // Extrair os primeiros 3 caracteres para comparação
    const subtipoCode = subtipo.substring(0, 3);

    const mapeamento = {
      'B01': 'TELEFONE',
      'B02': 'EMAIL',
      'B03': 'CPF', // Pode ser CPF ou CNPJ, precisa verificar pelo tipo de inscrição
      'B04': 'UUID'
    };

    return mapeamento[subtipoCode] || 'DESCONHECIDO';
  }
}

export default Cnab240Service; 