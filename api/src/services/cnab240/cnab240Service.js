/**
 * Serviço principal para processamento completo de arquivos CNAB 240
 * 
 * Este serviço orquestra todo o processamento de arquivos CNAB 240,
 * utilizando os parsers especializados e as configurações de bancos.
 */

import Cnab240BaseParser from './cnab240BaseParser.js';
import { CNAB240Parser } from './parsers/index.js';
import { BANCOS_240, UTILS_VALIDACAO } from '../../config/bancos240.js';
import crypto from 'crypto';

// Importar modelos MySQL para persistência
import {
  Operation,
  File,
  Cnab240File,
  sequelize,
  createOperationWithFile,
  processCnab240File,
  getDatabaseStats,
  checkDatabaseHealth
} from '../../models/index.js';

/**
 * Serviço principal para processamento de arquivos CNAB 240
 */
class Cnab240Service {
  /**
   * Processa um arquivo CNAB 240 completo com persistência no banco
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @param {Object} options - Opções de processamento
   * @returns {Object} Dados estruturados do arquivo CNAB 240 com informações de persistência
   */
  static async processar(cnabContent, options = {}) {
    // Gerar operation ID único
    const operationId = options.operationId || crypto.randomUUID();

    // Inicializar transação
    const transaction = await sequelize.transaction();

    try {
      if (!cnabContent || typeof cnabContent !== 'string') {
        throw new Error('Conteúdo do arquivo CNAB é obrigatório e deve ser uma string');
      }

      // Log início da operação
      console.log(`[CNAB240] Iniciando processamento - Operation ID: ${operationId}`);

      // Gerar hash do arquivo para verificação de duplicatas
      const fileHash = crypto.createHash('sha256').update(cnabContent).digest('hex');

      // Verificar se arquivo já foi processado
      const existingFile = await File.findByHash(fileHash);
      if (existingFile && !options.forceReprocess) {
        await transaction.rollback();

        console.log(`[CNAB240] Arquivo já processado - Hash: ${fileHash}`);
        return {
          sucesso: true,
          mensagem: 'Arquivo já foi processado anteriormente',
          duplicado: true,
          operationId,
          arquivoId: existingFile.id,
          dataProcessamentoOriginal: existingFile.created_at,
          hash: fileHash
        };
      }

      // Validação inicial do arquivo
      const validacaoInicial = this.validarArquivo(cnabContent);
      if (!validacaoInicial.valido) {
        throw new Error(`Arquivo CNAB 240 inválido: ${validacaoInicial.erros.join(', ')}`);
      }

      // Criar operação no banco
      const operation = await Operation.create({
        operation_id: operationId,
        operation_type: 'cnab240',
        status: 'processing',
        request_data: {
          file_size: cnabContent.length,
          options: options,
          started_at: new Date().toISOString()
        }
      }, { transaction });

      // Criar registro do arquivo
      const file = await File.create({
        operation_id: operationId,
        file_hash: fileHash,
        file_name: options.fileName || 'cnab240_file.txt',
        file_size: cnabContent.length,
        file_type: 'cnab240',
        content_preview: File.generatePreview(cnabContent, 3),
        validation_status: 'valid'
      }, { transaction });

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

      // Extrair dados para persistência CNAB 240
      const cnab240Data = this.extrairDadosParaPersistencia(dadosProcessados, configuracaoBanco, somatorias);

      // Salvar dados CNAB 240 no banco
      const cnab240File = await Cnab240File.create({
        ...cnab240Data,
        operation_id: operationId,
        file_id: file.id
      }, { transaction });

      // Atualizar operação como sucesso
      await operation.update({
        status: 'success',
        response_data: {
          file_id: file.id,
          cnab240_file_id: cnab240File.id,
          total_lotes: somatorias.totalLotes,
          total_registros: somatorias.totalRegistros,
          valor_total: somatorias.valorTotalGeral,
          completed_at: new Date().toISOString()
        }
      }, { transaction });

      // Commit da transação
      await transaction.commit();

      console.log(`[CNAB240] Processamento concluído com sucesso - Operation ID: ${operationId}`);

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
        // Dados de persistência
        persistencia: {
          operationId,
          fileId: file.id,
          cnab240FileId: cnab240File.id,
          hash: fileHash,
          saved_at: new Date().toISOString()
        },
        dataProcessamento: new Date().toISOString(),
        opcoes: options
      };

    } catch (error) {
      // Rollback da transação em caso de erro
      await transaction.rollback();

      // Tentar atualizar operação como erro (se foi criada)
      try {
        const existingOperation = await Operation.findByOperationId(operationId);
        if (existingOperation) {
          await existingOperation.markAsError({
            error_message: error.message,
            error_stack: error.stack,
            failed_at: new Date().toISOString()
          });
        }
      } catch (updateError) {
        console.error('Erro ao atualizar operação com falha:', updateError);
      }

      console.error('Erro ao processar arquivo CNAB 240:', error);
      return {
        sucesso: false,
        erro: error.message,
        operationId,
        dataProcessamento: new Date().toISOString()
      };
    }
  }

  /**
   * Extrai dados do CNAB 240 para persistência no banco
   * @param {Object} dadosProcessados - Dados processados do CNAB
   * @param {Object} configuracaoBanco - Configuração do banco
   * @param {Object} somatorias - Somatórias calculadas
   * @returns {Object} Dados formatados para persistência
   */
  static extrairDadosParaPersistencia(dadosProcessados, configuracaoBanco, somatorias) {
    const headerArquivo = dadosProcessados.headerArquivo;
    const trailerArquivo = dadosProcessados.trailerArquivo;

    return {
      // Dados do banco e arquivo
      banco_codigo: configuracaoBanco?.codigo || headerArquivo?.codigoBanco,
      banco_nome: configuracaoBanco?.nome || 'Banco não identificado',
      arquivo_sequencia: headerArquivo?.numeroSequencialArquivo || null,
      data_geracao: this.parseDateCnab240(headerArquivo?.dataGeracao),
      hora_geracao: this.parseTimeCnab240(headerArquivo?.horaGeracao),
      versao_layout: configuracaoBanco?.versaoLayout || headerArquivo?.versaoLayout,
      densidade: headerArquivo?.densidade,

      // Dados da empresa
      empresa_tipo_pessoa: headerArquivo?.tipoInscricaoEmpresa === '1' ? '1' : '2',
      empresa_documento: headerArquivo?.numeroInscricaoEmpresa,
      empresa_nome: headerArquivo?.nomeEmpresa,
      empresa_codigo: headerArquivo?.codigoConvenio,

      // Totalizadores
      total_lotes: somatorias.totalLotes,
      total_registros: somatorias.totalRegistros,
      valor_total: somatorias.valorTotalGeral,

      // Dados completos
      header_dados: {
        ...headerArquivo,
        configuracao_banco: configuracaoBanco,
        parsed_at: new Date().toISOString()
      },
      trailer_dados: {
        ...trailerArquivo,
        parsed_at: new Date().toISOString()
      }
    };
  }

  /**
   * Converte data CNAB 240 (DDMMAAAA) para formato Date
   * @param {string} dateString - Data no formato CNAB
   * @returns {Date|null} Data convertida ou null
   */
  static parseDateCnab240(dateString) {
    if (!dateString || dateString.length !== 8) return null;

    const day = dateString.substring(0, 2);
    const month = dateString.substring(2, 4);
    const year = dateString.substring(4, 8);

    try {
      return new Date(`${year}-${month}-${day}`);
    } catch (error) {
      return null;
    }
  }

  /**
   * Converte hora CNAB 240 (HHMMSS) para formato TIME
   * @param {string} timeString - Hora no formato CNAB
   * @returns {string|null} Hora convertida ou null
   */
  static parseTimeCnab240(timeString) {
    if (!timeString || timeString.length !== 6) return null;

    const hour = timeString.substring(0, 2);
    const minute = timeString.substring(2, 4);
    const second = timeString.substring(4, 6);

    try {
      return `${hour}:${minute}:${second}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Busca dados de arquivo CNAB 240 processado por hash
   * @param {string} fileHash - Hash SHA-256 do arquivo
   * @returns {Object|null} Dados do arquivo ou null se não encontrado
   */
  static async buscarPorHash(fileHash) {
    try {
      const file = await File.findByHash(fileHash);
      if (!file) return null;

      const cnab240File = await Cnab240File.findByFile(file.id);
      if (!cnab240File) return null;

      return {
        file: file.getFormattedData ? file.getFormattedData() : file,
        cnab240: cnab240File.getFormattedData ? cnab240File.getFormattedData() : cnab240File,
        operation: file.operation
      };
    } catch (error) {
      console.error('Erro ao buscar arquivo por hash:', error);
      return null;
    }
  }

  /**
   * Busca arquivos CNAB 240 por período
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @param {number} limit - Limite de resultados
   * @returns {Array} Lista de arquivos processados
   */
  static async buscarPorPeriodo(startDate, endDate, limit = 100) {
    try {
      return await Cnab240File.findByDateRange(startDate, endDate, limit);
    } catch (error) {
      console.error('Erro ao buscar arquivos por período:', error);
      return [];
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
      .map(linha => linha.replace(/\r?\n?$/g, '')) // Remove apenas quebras de linha
      .filter(linha => linha.trim() !== '');

    // Verificar se tem pelo menos 3 linhas (header arquivo, header lote, trailer arquivo)
    if (linhas.length < 3) {
      erros.push('Arquivo deve ter pelo menos 3 linhas (header arquivo, header lote, trailer arquivo)');
    }

    // Verificar tamanho das linhas
    linhas.forEach((linha, index) => {
      // CORREÇÃO: Não usar trim() pois remove espaços que são parte do formato CNAB 240
      // Os espaços no final das linhas são importantes e fazem parte da estrutura
      const linhaSemQuebra = linha.replace(/\r?\n?$/g, ''); // Remove apenas quebras de linha

      if (linhaSemQuebra.length < 240) {
        erros.push(`Linha ${index + 1}: deve ter pelo menos 240 caracteres, encontrado ${linhaSemQuebra.length}`);
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
    let totalSegmentosJ = 0;
    let totalSegmentosO = 0;

    dadosProcessados.lotes.forEach(lote => {
      totalRegistros += lote.detalhes.length + 2; // +2 para header e trailer do lote

      lote.detalhes.forEach(detalhe => {
        if (detalhe.segmento === 'A' && detalhe.valorPagamento) {
          // Converter valor para número se ainda for string
          const valor = typeof detalhe.valorPagamento === 'string'
            ? this.parseValorCNAB(detalhe.valorPagamento)
            : (detalhe.valorPagamento || 0);
          valorTotalGeral += valor;
          totalSegmentosA++;

        } else if (detalhe.segmento === 'J') {
          // ✅ CORRIGIDO: Processar apenas registros J que realmente contêm valores
          let valorProcessado = 0;

          // Tentar valorPago primeiro, depois valorTitulo
          if (detalhe.valorPago && detalhe.valorPago !== '000000000000000') {
            valorProcessado = typeof detalhe.valorPago === 'string'
              ? this.parseValorCNAB(detalhe.valorPago)
              : (detalhe.valorPago || 0);
          } else if (detalhe.valorTitulo && detalhe.valorTitulo !== '000000000000000') {
            valorProcessado = typeof detalhe.valorTitulo === 'string'
              ? this.parseValorCNAB(detalhe.valorTitulo)
              : (detalhe.valorTitulo || 0);
          }

          // ✅ CRUCIAL: Só somar se realmente houver valor válido (> 0)
          if (valorProcessado > 0) {
            valorTotalGeral += valorProcessado;
            totalSegmentosJ++;
            console.log(`[DEBUG] Segmento J VÁLIDO - valorTitulo: ${detalhe.valorTitulo}, valorPago: ${detalhe.valorPago}, valorProcessado: ${valorProcessado}`);
          } else {
            console.log(`[DEBUG] Segmento J IGNORADO - valorTitulo: ${detalhe.valorTitulo}, valorPago: ${detalhe.valorPago}, valorProcessado: ${valorProcessado}`);
          }

        } else if (detalhe.segmento === 'O') {
          // ✅ NOVO: Processar Segmentos O (tributos)
          let valorProcessado = 0;

          if (detalhe.valorPago && detalhe.valorPago !== '000000000000000') {
            valorProcessado = typeof detalhe.valorPago === 'string'
              ? this.parseValorCNAB(detalhe.valorPago)
              : (detalhe.valorPago || 0);
          } else if (detalhe.valorDocumento && detalhe.valorDocumento !== '000000000000000') {
            valorProcessado = typeof detalhe.valorDocumento === 'string'
              ? this.parseValorCNAB(detalhe.valorDocumento)
              : (detalhe.valorDocumento || 0);
          }

          if (valorProcessado > 0) {
            valorTotalGeral += valorProcessado;
            totalSegmentosO++;
            console.log(`[DEBUG] Segmento O VÁLIDO - valorDocumento: ${detalhe.valorDocumento}, valorPago: ${detalhe.valorPago}, valorProcessado: ${valorProcessado}`);
          } else {
            console.log(`[DEBUG] Segmento O IGNORADO - valorDocumento: ${detalhe.valorDocumento}, valorPago: ${detalhe.valorPago}, valorProcessado: ${valorProcessado}`);
          }

        } else if (detalhe.segmento === 'B') {
          totalSegmentosB++;
        }
      });
    });

    // Adicionar 2 registros para header e trailer do arquivo
    totalRegistros += 2;

    return {
      totalRegistros,
      totalLotes,
      valorTotalGeral,
      totalSegmentosA,
      totalSegmentosB,
      totalSegmentosJ,
      totalSegmentosO
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
    // ✅ NOVO: Calcular total de pagamentos incluindo todos os segmentos relevantes
    const totalPagamentos = somatorias.totalSegmentosA + (somatorias.totalSegmentosJ || 0) + (somatorias.totalSegmentosO || 0);

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
        quantidadePagamentos: totalPagamentos, // ✅ ATUALIZADO: Incluir todos os tipos de pagamento
        ticketMedio: totalPagamentos > 0 ? somatorias.valorTotalGeral / totalPagamentos : 0
      },
      distribuicao: {
        segmentosA: somatorias.totalSegmentosA,
        segmentosB: somatorias.totalSegmentosB,
        segmentosJ: somatorias.totalSegmentosJ || 0, // ✅ NOVO: Incluir Segmentos J
        segmentosO: somatorias.totalSegmentosO || 0, // ✅ NOVO: Incluir Segmentos O
        outrosSegmentos: somatorias.totalRegistros - somatorias.totalSegmentosA - somatorias.totalSegmentosB - (somatorias.totalSegmentosJ || 0) - (somatorias.totalSegmentosO || 0) - (somatorias.totalLotes * 2) - 2
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
      } else if (segmento === 'J') {
        // ✅ NOVO: Processar Segmentos J (títulos de cobrança)
        let valorJ = 0;
        if (detalhe.valorPago && detalhe.valorPago.trim() !== '000000000000000') {
          valorJ = typeof detalhe.valorPago === 'string'
            ? this.parseValorCNAB(detalhe.valorPago)
            : (detalhe.valorPago || 0);
        } else if (detalhe.valorTitulo) {
          valorJ = typeof detalhe.valorTitulo === 'string'
            ? this.parseValorCNAB(detalhe.valorTitulo)
            : (detalhe.valorTitulo || 0);
        }

        if (valorJ > 0) {
          valorTotal += valorJ;
          quantidadePagamentos++;
        }
      } else if (segmento === 'O') {
        // ✅ NOVO: Processar Segmentos O (pagamento de tributos)
        let valorO = 0;
        if (detalhe.valorPago && detalhe.valorPago.trim() !== '000000000000000') {
          valorO = typeof detalhe.valorPago === 'string'
            ? this.parseValorCNAB(detalhe.valorPago)
            : (detalhe.valorPago || 0);
        } else if (detalhe.valorDocumento) {
          valorO = typeof detalhe.valorDocumento === 'string'
            ? this.parseValorCNAB(detalhe.valorDocumento)
            : (detalhe.valorDocumento || 0);
        }

        if (valorO > 0) {
          valorTotal += valorO;
          quantidadePagamentos++;
        }
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

  /**
   * Valida arquivo CNAB 240 de forma simples (seguindo padrão CNAB 400)
   * Verifica apenas se as linhas têm exatamente 240 caracteres
   * @param {string} cnabContent - Conteúdo do arquivo CNAB como string
   * @returns {Object} Resultado da validação simples
   */
  static validarArquivoCnab240(cnabContent) {
    try {
      if (cnabContent === null || cnabContent === undefined || typeof cnabContent !== 'string') {
        return {
          valido: false,
          erro: 'Conteúdo do arquivo é obrigatório e deve ser uma string',
        };
      }

      // Tratar string vazia ou só com espaços
      if (cnabContent.trim() === '') {
        return {
          valido: false,
          erro: 'Arquivo CNAB não contém linhas válidas',
        };
      }

      const linhas = cnabContent.split('\n').filter(linha => linha.trim() !== '');

      if (linhas.length === 0) {
        return {
          valido: false,
          erro: 'Arquivo CNAB não contém linhas válidas',
        };
      }

      // Verifica se as linhas têm o tamanho esperado para CNAB 240 (240 caracteres)
      const linhasInvalidas = linhas.filter(linha => linha.length !== 240);

      if (linhasInvalidas.length > 0) {
        return {
          valido: false,
          erro: `Arquivo contém ${linhasInvalidas.length} linha(s) com tamanho inválido. CNAB 240 deve ter 240 caracteres por linha`,
        };
      }

      return {
        valido: true,
        totalLinhas: linhas.length,
        formato: 'CNAB 240',
      };
    } catch (error) {
      return {
        valido: false,
        erro: `Erro na validação: ${error.message}`,
      };
    }
  }
}

export default Cnab240Service; 