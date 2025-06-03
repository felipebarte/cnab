import cnab400ItauParser from 'cnab400-itau-parser';
import { File, CnabHeader, CnabRecord, getDatabaseStats, checkDatabaseHealth } from '../models/index.js';

/**
 * Serviço para processar arquivos CNAB 400 do Itaú
 */
class CnabService {
  /**
   * Processa um arquivo CNAB 400 do Itaú e extrai informações relevantes
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @param {Object} options - Opções de processamento
   * @returns {Object} Dados extraídos do arquivo CNAB
   */
  static async processarArquivoCnab(cnabContent, options = {}) {
    try {
      if (!cnabContent || typeof cnabContent !== 'string') {
        throw new Error('Conteúdo do arquivo CNAB é obrigatório e deve ser uma string');
      }

      // Utiliza a biblioteca para processar o arquivo CNAB
      const resultado = cnab400ItauParser(cnabContent);

      // Extrai dados estruturados do CNAB
      const dadosEstruturados = this.extrairDadosEstruturados(cnabContent, resultado);

      return {
        sucesso: true,
        dados: resultado,
        dadosEstruturados,
        totalRegistros: Array.isArray(resultado) ? resultado.length : 0,
        dataProcessamento: new Date().toISOString(),
        informacoesArquivo: {
          tamanhoOriginal: cnabContent.length,
          totalLinhas: cnabContent.split('\n').filter(linha => linha.trim() !== '').length,
          formato: 'CNAB 400',
          banco: '341',
          nomeBanco: 'BANCO ITAU SA',
        },
      };
    } catch (error) {
      console.error('Erro ao processar arquivo CNAB:', error);
      throw new Error(`Falha ao processar arquivo CNAB: ${error.message}`);
    }
  }

  /**
   * Extrai dados estruturados completos do arquivo CNAB
   * @param {string} cnabContent - Conteúdo bruto do CNAB
   * @param {Array} dadosProcessados - Dados já processados pela biblioteca
   * @returns {Object} Estrutura completa de dados
   */
  static extrairDadosEstruturados(cnabContent, dadosProcessados) {
    const linhas = cnabContent.split('\n').filter(linha => linha.trim() !== '');

    return {
      cabecalho: this.extrairCabecalho(linhas[0]), // Primeira linha é sempre header
      registros: this.processarRegistrosDetalhados(dadosProcessados, linhas),
      trailer: this.extrairTrailer(linhas[linhas.length - 1]), // Última linha é sempre trailer
      resumo: this.calcularResumoCompleto(dadosProcessados),
      estatisticas: this.calcularEstatisticas(dadosProcessados),
    };
  }

  /**
   * Extrai informações do cabeçalho do CNAB 400
   * @param {string} linhaHeader - Linha do cabeçalho
   * @returns {Object} Dados do cabeçalho estruturados
   */
  static extrairCabecalho(linhaHeader) {
    if (!linhaHeader || linhaHeader.length < 400) {
      return this.getCabecalhoPadrao();
    }

    try {
      return {
        tipoRegistro: linhaHeader.substring(0, 2).trim(),
        tipoOperacao: linhaHeader.substring(2, 4).trim(),
        literalRemessa: linhaHeader.substring(4, 11).trim(),
        codigoServico: linhaHeader.substring(11, 13).trim(),
        literalServico: linhaHeader.substring(13, 21).trim(),
        banco: {
          codigo: linhaHeader.substring(76, 79).trim() || '341',
          nome: linhaHeader.substring(79, 94).trim() || 'BANCO ITAU SA',
        },
        empresa: {
          codigoCedente: linhaHeader.substring(21, 37).trim(),
          razaoSocial: linhaHeader.substring(46, 76).trim() || 'Empresa não identificada',
        },
        arquivo: {
          dataGeracao: this.formatarDataCnab(linhaHeader.substring(94, 100)),
          numeroSequencial: linhaHeader.substring(394, 400).trim(),
          numeroAvisoBancario: linhaHeader.substring(108, 110).trim(),
          sequencialRemessa: linhaHeader.substring(110, 117).trim(),
        },
        processamento: {
          formato: 'CNAB 400',
          versao: '1.0',
          charset: 'ASCII',
          dataProcessamento: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.warn('Erro ao extrair cabeçalho, usando padrão:', error.message);
      return this.getCabecalhoPadrao();
    }
  }

  /**
   * Extrai informações do trailer do CNAB 400
   * @param {string} linhaTrailer - Linha do trailer
   * @returns {Object} Dados do trailer estruturados
   */
  static extrairTrailer(linhaTrailer) {
    if (!linhaTrailer || linhaTrailer.length < 400) {
      return {
        tipoRegistro: '9',
        totalRegistros: 0,
        valorTotal: 0,
        numeroSequencial: '000001',
      };
    }

    try {
      return {
        tipoRegistro: linhaTrailer.substring(0, 1).trim(),
        totalRegistros: parseInt(linhaTrailer.substring(1, 7)) || 0,
        valorTotal: this.converterValorCnab(linhaTrailer.substring(7, 20)),
        informacoesBanco: {
          codigo: '341',
          nome: 'BANCO ITAU SA',
        },
        numeroSequencial: linhaTrailer.substring(394, 400).trim(),
        validacao: {
          formatoCorreto: linhaTrailer.substring(0, 1) === '9',
          tamanhoCorreto: linhaTrailer.length === 400,
        },
      };
    } catch (error) {
      console.warn('Erro ao extrair trailer:', error.message);
      return {
        tipoRegistro: '9',
        totalRegistros: 0,
        valorTotal: 0,
        numeroSequencial: '000001',
        erro: error.message,
      };
    }
  }

  /**
   * Processa registros com informações detalhadas
   * @param {Array} dadosProcessados - Dados da biblioteca
   * @param {Array} linhas - Linhas originais do CNAB
   * @returns {Array} Registros processados com detalhes
   */
  static processarRegistrosDetalhados(dadosProcessados, linhas) {
    if (!Array.isArray(dadosProcessados)) {
      return [];
    }

    return dadosProcessados.map((registro, index) => {
      const linhaOriginal = linhas[index + 1]; // +1 porque a primeira linha é header

      return {
        sequencia: index + 1,
        tipoRegistro: '1', // Registro de detalhe
        dadosOriginais: registro,
        informacoesExtendidas: this.extrairInformacoesDetalhadas(linhaOriginal, registro),
        pagador: this.extrairDadosPagador(linhaOriginal, registro),
        recebedor: this.extrairDadosRecebedor(linhaOriginal, registro),
        boleto: this.extrairDadosBoleto(linhaOriginal, registro),
        financeiro: this.extrairDadosFinanceiros(linhaOriginal, registro),
        status: this.determinarStatusRegistro(registro),
        observacoes: this.extrairObservacoes(linhaOriginal, registro),
        validacao: this.validarRegistro(linhaOriginal, registro),
      };
    });
  }

  /**
   * Extrai informações detalhadas do registro
   * @param {string} linha - Linha original do CNAB
   * @param {Object} registro - Registro processado
   * @returns {Object} Informações estendidas
   */
  static extrairInformacoesDetalhadas(linha, registro) {
    if (!linha || linha.length < 400) {
      return {};
    }

    try {
      return {
        nossoNumero: registro.nossoNumero || linha.substring(62, 73).trim(),
        numeroDocumento: registro.numeroDocumento || linha.substring(116, 126).trim(),
        dataVencimento: this.formatarDataCnab(linha.substring(146, 152)),
        dataEmissao: this.formatarDataCnab(linha.substring(152, 158)),
        especieDocumento: linha.substring(173, 175).trim(),
        aceite: linha.substring(175, 176).trim(),
        dataProcessamento: linha.substring(175, 181) ? this.formatarDataCnab(linha.substring(175, 181)) : null,
        valorTitulo: this.converterValorCnab(linha.substring(126, 139)),
        codigoOcorrencia: linha.substring(108, 110).trim(),
        motivoOcorrencia: this.obterDescricaoOcorrencia(linha.substring(108, 110).trim()),
      };
    } catch (error) {
      console.warn('Erro ao extrair informações detalhadas:', error.message);
      return {};
    }
  }

  /**
   * Extrai dados do pagador/sacado
   * @param {string} linha - Linha original do CNAB
   * @param {Object} registro - Registro processado
   * @returns {Object} Dados do pagador
   */
  static extrairDadosPagador(linha, registro) {
    if (!linha || linha.length < 400) {
      return {
        nome: 'Não identificado',
        documento: '',
        endereco: '',
      };
    }

    try {
      return {
        tipoInscricao: linha.substring(220, 222).trim(),
        documento: linha.substring(222, 236).trim(),
        nome: linha.substring(236, 276).trim() || 'Não identificado',
        endereco: linha.substring(276, 316).trim(),
        cep: linha.substring(326, 334).trim(),
        cidade: linha.substring(334, 349).trim(),
        uf: linha.substring(349, 351).trim(),
        telefone: '',
        email: '',
        observacoes: linha.substring(351, 391).trim(),
      };
    } catch (error) {
      console.warn('Erro ao extrair dados do pagador:', error.message);
      return {
        nome: 'Não identificado',
        documento: '',
        endereco: '',
      };
    }
  }

  /**
   * Extrai dados do recebedor/cedente
   * @param {string} linha - Linha original do CNAB
   * @param {Object} registro - Registro processado
   * @returns {Object} Dados do recebedor
   */
  static extrairDadosRecebedor(linha, registro) {
    try {
      return {
        nome: 'EMPRESA TESTE LTDA', // Geralmente vem do header
        documento: '',
        conta: linha ? linha.substring(21, 37).trim() : '',
        agencia: linha ? linha.substring(17, 21).trim() : '',
        banco: '341',
        nomeBanco: 'BANCO ITAU SA',
        codigoCedente: linha ? linha.substring(21, 37).trim() : '',
      };
    } catch (error) {
      console.warn('Erro ao extrair dados do recebedor:', error.message);
      return {
        nome: 'Não identificado',
        documento: '',
        conta: '',
      };
    }
  }

  /**
   * Extrai dados específicos do boleto
   * @param {string} linha - Linha original do CNAB
   * @param {Object} registro - Registro processado
   * @returns {Object} Dados do boleto
   */
  static extrairDadosBoleto(linha, registro) {
    return {
      nossoNumero: registro.nossoNumero || '',
      codigoBarras: registro.codigoBarras || null,
      linhaDigitavel: registro.linhaDigitavel || null,
      numeroDocumento: registro.numeroDocumento || '',
      especieDocumento: registro.especieDocumento || 'DM',
      aceite: registro.aceite || 'N',
      instrucoes: this.extrairInstrucoes(linha),
      multa: {
        aplicar: false,
        percentual: 0,
        valor: 0,
      },
      juros: {
        aplicar: false,
        percentual: 0,
        valorDia: 0,
      },
      desconto: {
        aplicar: false,
        dataLimite: null,
        valor: 0,
      },
    };
  }

  /**
   * Extrai dados financeiros do registro
   * @param {string} linha - Linha original do CNAB
   * @param {Object} registro - Registro processado
   * @returns {Object} Dados financeiros
   */
  static extrairDadosFinanceiros(linha, registro) {
    return {
      valorOriginal: registro.valor || 0,
      valorPago: registro.valorPago || 0,
      valorDesconto: registro.valorDesconto || 0,
      valorJuros: registro.valorJuros || 0,
      valorMulta: registro.valorMulta || 0,
      valorLiquido: this.calcularValorLiquido(registro),
      dataVencimento: registro.vencimento || null,
      dataPagamento: registro.dataPagamento || null,
      diasAtraso: this.calcularDiasAtraso(registro.vencimento, registro.dataPagamento),
      moeda: 'BRL',
      cambio: 1.0,
    };
  }

  /**
   * Calcula resumo completo dos dados CNAB
   * @param {Array} dadosProcessados - Dados processados
   * @returns {Object} Resumo completo
   */
  static calcularResumoCompleto(dadosProcessados) {
    if (!Array.isArray(dadosProcessados)) {
      return this.getResumoVazio();
    }

    const resumo = {
      totais: {
        registros: dadosProcessados.length,
        valor: 0,
        valorPago: 0,
        valorDesconto: 0,
        valorJuros: 0,
        valorMulta: 0,
      },
      contadores: {
        comCodigoBarras: 0,
        comLinhaDigitavel: 0,
        pagos: 0,
        pendentes: 0,
        vencidos: 0,
        emAberto: 0,
      },
      datas: {
        primeiroVencimento: null,
        ultimoVencimento: null,
        primeiroPagamento: null,
        ultimoPagamento: null,
      },
      valores: {
        menor: Number.MAX_VALUE,
        maior: 0,
        media: 0,
        mediana: 0,
      },
    };

    const valores = [];
    const hoje = new Date();

    dadosProcessados.forEach(registro => {
      const valor = parseFloat(registro.valor) || 0;
      valores.push(valor);

      // Totais
      resumo.totais.valor += valor;
      resumo.totais.valorPago += parseFloat(registro.valorPago) || 0;
      resumo.totais.valorDesconto += parseFloat(registro.valorDesconto) || 0;
      resumo.totais.valorJuros += parseFloat(registro.valorJuros) || 0;
      resumo.totais.valorMulta += parseFloat(registro.valorMulta) || 0;

      // Contadores
      if (registro.codigoBarras) resumo.contadores.comCodigoBarras++;
      if (registro.linhaDigitavel) resumo.contadores.comLinhaDigitavel++;
      if (registro.dataPagamento) resumo.contadores.pagos++;
      else resumo.contadores.pendentes++;

      // Verifica vencimento
      if (registro.vencimento) {
        const vencimento = new Date(registro.vencimento);
        if (vencimento < hoje && !registro.dataPagamento) {
          resumo.contadores.vencidos++;
        } else if (!registro.dataPagamento) {
          resumo.contadores.emAberto++;
        }
      }

      // Valores min/max
      if (valor > 0) {
        resumo.valores.menor = Math.min(resumo.valores.menor, valor);
        resumo.valores.maior = Math.max(resumo.valores.maior, valor);
      }

      // Datas
      this.atualizarDatasResumo(resumo.datas, registro);
    });

    // Cálculos finais
    if (valores.length > 0) {
      resumo.valores.media = resumo.totais.valor / valores.length;
      resumo.valores.mediana = this.calcularMediana(valores);
    }

    if (resumo.valores.menor === Number.MAX_VALUE) {
      resumo.valores.menor = 0;
    }

    return resumo;
  }

  /**
   * Calcula estatísticas adicionais
   * @param {Array} dadosProcessados - Dados processados
   * @returns {Object} Estatísticas
   */
  static calcularEstatisticas(dadosProcessados) {
    if (!Array.isArray(dadosProcessados) || dadosProcessados.length === 0) {
      return {
        distribuicaoVencimentos: {},
        distribuicaoValores: {},
        taxaPagamento: 0,
        tempoMedioPagamento: 0,
      };
    }

    return {
      distribuicaoVencimentos: this.calcularDistribuicaoVencimentos(dadosProcessados),
      distribuicaoValores: this.calcularDistribuicaoValores(dadosProcessados),
      taxaPagamento: this.calcularTaxaPagamento(dadosProcessados),
      tempoMedioPagamento: this.calcularTempoMedioPagamento(dadosProcessados),
      ocorrenciasMaisFrequentes: this.calcularOcorrenciasMaisFrequentes(dadosProcessados),
    };
  }

  /**
   * Extrai código de barras de um arquivo CNAB 400 do Itaú
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @returns {Array} Array com códigos de barras encontrados
   */
  static async extrairCodigosBarras(cnabContent) {
    try {
      const dadosProcessados = await this.processarArquivoCnab(cnabContent);

      // Extrai apenas os códigos de barras dos dados processados
      const dados = Array.isArray(dadosProcessados.dados) ? dadosProcessados.dados : [];
      const codigosBarras = dados
        .filter(registro => registro && registro.codigoBarras)
        .map(registro => ({
          codigoBarras: registro.codigoBarras,
          valor: registro.valor,
          vencimento: registro.vencimento,
          nossoNumero: registro.nossoNumero,
        }));

      return {
        sucesso: true,
        codigosBarras,
        total: codigosBarras.length,
        dataProcessamento: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Erro ao extrair códigos de barras:', error);
      throw new Error(`Falha ao extrair códigos de barras: ${error.message}`);
    }
  }

  /**
   * Extrai linhas digitáveis de um arquivo CNAB 400 do Itaú
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @returns {Array} Array com linhas digitáveis encontradas
   */
  static async extrairLinhasDigitaveis(cnabContent) {
    try {
      const dadosProcessados = await this.processarArquivoCnab(cnabContent);

      // Extrai apenas as linhas digitáveis dos dados processados
      const dados = Array.isArray(dadosProcessados.dados) ? dadosProcessados.dados : [];
      const linhasDigitaveis = dados
        .filter(registro => registro && registro.linhaDigitavel)
        .map(registro => ({
          linhaDigitavel: registro.linhaDigitavel,
          valor: registro.valor,
          vencimento: registro.vencimento,
          nossoNumero: registro.nossoNumero,
        }));

      return {
        sucesso: true,
        linhasDigitaveis,
        total: linhasDigitaveis.length,
        dataProcessamento: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Erro ao extrair linhas digitáveis:', error);
      throw new Error(`Falha ao extrair linhas digitáveis: ${error.message}`);
    }
  }

  /**
   * Valida se o conteúdo é um arquivo CNAB válido
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @returns {Object} Resultado da validação
   */
  static validarArquivoCnab(cnabContent) {
    try {
      if (!cnabContent || typeof cnabContent !== 'string') {
        return {
          valido: false,
          erro: 'Conteúdo do arquivo é obrigatório e deve ser uma string',
        };
      }

      const linhas = cnabContent.split('\n').filter(linha => linha.trim() !== '');

      if (linhas.length === 0) {
        return {
          valido: false,
          erro: 'Arquivo CNAB não contém linhas válidas',
        };
      }

      // Verifica se as linhas têm o tamanho esperado para CNAB 400 (400 caracteres)
      const linhasInvalidas = linhas.filter(linha => linha.length !== 400);

      if (linhasInvalidas.length > 0) {
        return {
          valido: false,
          erro: `Arquivo contém ${linhasInvalidas.length} linha(s) com tamanho inválido. CNAB 400 deve ter 400 caracteres por linha`,
        };
      }

      return {
        valido: true,
        totalLinhas: linhas.length,
        formato: 'CNAB 400',
      };
    } catch (error) {
      return {
        valido: false,
        erro: `Erro na validação: ${error.message}`,
      };
    }
  }

  // === MÉTODOS AUXILIARES ===

  /**
   * Retorna cabeçalho padrão
   */
  static getCabecalhoPadrao() {
    return {
      tipoRegistro: '0',
      tipoOperacao: '2',
      literalRemessa: 'RETORNO',
      codigoServico: '01',
      literalServico: 'COBRANCA',
      banco: {
        codigo: '341',
        nome: 'BANCO ITAU SA',
      },
      empresa: {
        codigoCedente: '00000000000000000000',
        razaoSocial: 'Empresa não identificada',
      },
      arquivo: {
        dataGeracao: new Date().toISOString().split('T')[0],
        numeroSequencial: '000001',
        numeroAvisoBancario: 'MX',
        sequencialRemessa: '0000001',
      },
      processamento: {
        formato: 'CNAB 400',
        versao: '1.0',
        charset: 'ASCII',
        dataProcessamento: new Date().toISOString(),
      },
    };
  }

  /**
   * Retorna resumo vazio
   */
  static getResumoVazio() {
    return {
      totais: {
        registros: 0,
        valor: 0,
        valorPago: 0,
        valorDesconto: 0,
        valorJuros: 0,
        valorMulta: 0,
      },
      contadores: {
        comCodigoBarras: 0,
        comLinhaDigitavel: 0,
        pagos: 0,
        pendentes: 0,
        vencidos: 0,
        emAberto: 0,
      },
      datas: {
        primeiroVencimento: null,
        ultimoVencimento: null,
        primeiroPagamento: null,
        ultimoPagamento: null,
      },
      valores: {
        menor: 0,
        maior: 0,
        media: 0,
        mediana: 0,
      },
    };
  }

  /**
   * Formata data do CNAB (DDMMAA ou DDMMAAAA)
   * @param {string} dataStr - Data em formato CNAB
   * @returns {string|null} Data formatada ISO ou null
   */
  static formatarDataCnab(dataStr) {
    if (!dataStr || dataStr.trim() === '' || dataStr === '000000' || dataStr === '00000000') {
      return null;
    }

    try {
      let dia, mes, ano;

      if (dataStr.length === 6) {
        // DDMMAA
        dia = parseInt(dataStr.substring(0, 2));
        mes = parseInt(dataStr.substring(2, 4));
        ano = parseInt(dataStr.substring(4, 6));
        ano = ano > 50 ? 1900 + ano : 2000 + ano; // Conversão Y2K
      } else if (dataStr.length === 8) {
        // DDMMAAAA
        dia = parseInt(dataStr.substring(0, 2));
        mes = parseInt(dataStr.substring(2, 4));
        ano = parseInt(dataStr.substring(4, 8));
      } else {
        return null;
      }

      const data = new Date(ano, mes - 1, dia);
      return isNaN(data.getTime()) ? null : data.toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Converte valor do CNAB (inteiro sem vírgula)
   * @param {string} valorStr - Valor em formato CNAB
   * @returns {number} Valor convertido
   */
  static converterValorCnab(valorStr) {
    if (!valorStr || valorStr.trim() === '') {
      return 0;
    }

    const valorLimpo = valorStr.replace(/^0+/, '') || '0';
    return parseFloat(valorLimpo) / 100; // CNAB usa centavos
  }

  /**
   * Calcula valor líquido
   * @param {Object} registro - Registro do boleto
   * @returns {number} Valor líquido
   */
  static calcularValorLiquido(registro) {
    const valor = parseFloat(registro.valor) || 0;
    const desconto = parseFloat(registro.valorDesconto) || 0;
    const juros = parseFloat(registro.valorJuros) || 0;
    const multa = parseFloat(registro.valorMulta) || 0;

    return valor - desconto + juros + multa;
  }

  /**
   * Calcula dias de atraso
   * @param {string} vencimento - Data de vencimento
   * @param {string} pagamento - Data de pagamento
   * @returns {number} Dias de atraso
   */
  static calcularDiasAtraso(vencimento, pagamento) {
    if (!vencimento || !pagamento) return 0;

    try {
      const dataVenc = new Date(vencimento);
      const dataPag = new Date(pagamento);
      const diffTime = dataPag - dataVenc;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calcula mediana de array de valores
   * @param {Array} valores - Array de valores
   * @returns {number} Mediana
   */
  static calcularMediana(valores) {
    const sorted = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[meio - 1] + sorted[meio]) / 2;
    }
    return sorted[meio];
  }

  /**
   * Determina status do registro
   * @param {Object} registro - Registro do boleto
   * @returns {string} Status
   */
  static determinarStatusRegistro(registro) {
    if (registro.dataPagamento) return 'pago';
    if (registro.vencimento) {
      const vencimento = new Date(registro.vencimento);
      const hoje = new Date();
      if (vencimento < hoje) return 'vencido';
      return 'em_aberto';
    }
    return 'processado';
  }

  /**
   * Obtém descrição da ocorrência
   * @param {string} codigo - Código da ocorrência
   * @returns {string} Descrição
   */
  static obterDescricaoOcorrencia(codigo) {
    const ocorrencias = {
      '01': 'Entrada Confirmada',
      '02': 'Entrada Rejeitada',
      '03': 'Entrada Registrada',
      '06': 'Liquidação',
      '09': 'Baixa',
      '10': 'Baixa Solicitada',
      '11': 'Títulos em Ser',
      '14': 'Vencimento Alterado',
      '15': 'Liquidação em Cartório',
      '17': 'Liquidação após Baixa',
      '19': 'Confirmação Recebimento Instrução de Protesto',
      '20': 'Confirmação Recebimento Instrução Sustação de Protesto',
      '21': 'Acerto de Depositária',
      '23': 'Remessa a Cartório',
      '24': 'Retirada de Cartório',
      '25': 'Protestado e Baixado',
      '26': 'Instrução Rejeitada',
      '27': 'Confirmação do Pedido de Alteração de Outros Dados',
      '28': 'Débito de Tarifas/Custas',
      '30': 'Alteração de Outros Dados Rejeitada',
      '32': 'Instrução de Protesto/Sustação Rejeitada',
      '33': 'Confirmação Pedido Alteração Outros Dados',
      '34': 'Retirada de Cartório e Manutenção em Carteira',
      '35': 'Desagendamento do Débito Automático',
      '68': 'Acerto dos Dados do Rateio de Crédito',
      '69': 'Cancelamento dos Dados do Rateio',
    };

    return ocorrencias[codigo] || `Ocorrência ${codigo}`;
  }

  /**
   * Atualiza datas no resumo
   * @param {Object} datas - Objeto de datas do resumo
   * @param {Object} registro - Registro atual
   */
  static atualizarDatasResumo(datas, registro) {
    if (registro.vencimento) {
      const venc = new Date(registro.vencimento);
      if (!datas.primeiroVencimento || venc < new Date(datas.primeiroVencimento)) {
        datas.primeiroVencimento = registro.vencimento;
      }
      if (!datas.ultimoVencimento || venc > new Date(datas.ultimoVencimento)) {
        datas.ultimoVencimento = registro.vencimento;
      }
    }

    if (registro.dataPagamento) {
      const pag = new Date(registro.dataPagamento);
      if (!datas.primeiroPagamento || pag < new Date(datas.primeiroPagamento)) {
        datas.primeiroPagamento = registro.dataPagamento;
      }
      if (!datas.ultimoPagamento || pag > new Date(datas.ultimoPagamento)) {
        datas.ultimoPagamento = registro.dataPagamento;
      }
    }
  }

  /**
   * Placeholder para métodos de estatísticas (implementação simplificada)
   */
  static calcularDistribuicaoVencimentos(dados) { return {}; }
  static calcularDistribuicaoValores(dados) { return {}; }
  static calcularTaxaPagamento(dados) {
    const pagos = dados.filter(r => r.dataPagamento).length;
    return dados.length > 0 ? (pagos / dados.length) * 100 : 0;
  }
  static calcularTempoMedioPagamento(dados) { return 0; }
  static calcularOcorrenciasMaisFrequentes(dados) { return []; }
  static extrairInstrucoes(linha) { return []; }
  static extrairObservacoes(linha, registro) { return ''; }
  static validarRegistro(linha, registro) {
    return {
      valido: true,
      erros: []
    };
  }

  /**
   * Busca arquivo CNAB 400 por hash SHA-256
   * @param {string} fileHash - Hash SHA-256 do arquivo
   * @returns {Object|null} Dados do arquivo ou null se não encontrado
   */
  static async buscarPorHash(fileHash) {
    try {
      const file = await File.findByHash(fileHash);
      if (!file) return null;

      const cnabHeader = await CnabHeader.findOne({
        where: { file_id: file.id },
        include: [
          {
            model: CnabRecord,
            as: 'records',
            limit: 100 // Limitar registros para evitar sobrecarga
          }
        ]
      });

      return {
        file: file.getFormattedData ? file.getFormattedData() : file,
        header: cnabHeader?.getFormattedData ? cnabHeader.getFormattedData() : cnabHeader,
        registros: cnabHeader?.records?.map(r => r.getFormattedData ? r.getFormattedData() : r) || [],
        operation: file.operation
      };
    } catch (error) {
      console.error('Erro ao buscar arquivo por hash:', error);
      return null;
    }
  }

  /**
   * Obtém estatísticas do banco de dados
   * @returns {Object} Estatísticas do sistema
   */
  static async obterEstatisticas() {
    try {
      const [dbStats, healthCheck] = await Promise.all([
        getDatabaseStats(),
        checkDatabaseHealth()
      ]);

      return {
        database: dbStats,
        health: healthCheck,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        database: { error: error.message },
        health: { status: 'unhealthy', message: error.message },
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default CnabService; 