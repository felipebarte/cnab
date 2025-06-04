/**
 * Serviço principal para processamento completo de arquivos CNAB 240
 * 
 * Este serviço orquestra todo o processamento de arquivos CNAB 240,
 * utilizando os parsers especializados e as configurações de bancos.
 */

import Cnab240BaseParser from './cnab240BaseParser.js';
import { CNAB240Parser } from './parsers/index.js';
import { BANCOS_240, UTILS_VALIDACAO } from '../../config/bancos240.js';
import sequelize from '../../config/database.js';

// Importar modelos MySQL para persistência
import {
  File,
  Cnab240File,
  getDatabaseStats,
  checkDatabaseHealth
} from '../../models/index.js';

/**
 * Serviço principal para processamento de arquivos CNAB 240
 */
class Cnab240Service {
  /**
   * Processa um arquivo CNAB 240
   * @param {string} cnabContent - Conteúdo do arquivo CNAB
   * @param {Object} options - Opções de processamento
   * @returns {Object} Dados processados
   */
  static async processar(cnabContent, options = {}) {
    try {
      console.log('[INFO] Iniciando processamento CNAB 240');

      // 1. Validar arquivo básico
      const validacao = this.validarArquivo(cnabContent);
      if (!validacao.valido) {
        throw new Error(`Arquivo CNAB 240 inválido: ${validacao.erros.join(', ')}`);
      }

      // 2. Processar linhas do arquivo
      const linhas = cnabContent.split('\n').filter(linha => linha.trim().length > 0);
      const dadosProcessados = this.processarLinhas(linhas);

      // 3. Obter configuração do banco
      const configuracaoBanco = BANCOS_240[dadosProcessados.headerArquivo?.codigoBanco] || {};

      // 4. Validar estrutura
      const validacaoEstrutura = this.validarEstrutura(dadosProcessados, configuracaoBanco);
      if (!validacaoEstrutura.valido) {
        console.warn('[WARNING] Estrutura com problemas:', validacaoEstrutura.avisos);
      }

      // 5. Calcular somatórias
      const somatorias = this.calcularSomatorias(dadosProcessados);

      // 6. Validar somatórias do trailer
      const validacaoSomatorias = this.validarSomatoriasTrailer(dadosProcessados, somatorias);
      if (!validacaoSomatorias.valido) {
        console.warn('[WARNING] Somatórias divergentes:', validacaoSomatorias.divergencias);
      }

      // 7. Extrair dados completos
      const dadosCompletos = this.extrairDadosCompletos(dadosProcessados, configuracaoBanco);

      // 8. Gerar resumo
      const resumo = this.gerarResumoProcessamento(dadosProcessados, somatorias);

      // ✅ NOVO: 9. Persistir dados no banco se fileId e operationId estiverem disponíveis
      let resultadoPersistencia = null;
      if (options.fileId && options.operationId) {
        try {
          console.log(`[INFO] Iniciando persistência no banco - FileID: ${options.fileId}, OperationID: ${options.operationId}`);

          resultadoPersistencia = await this.persistirDadosCompletos(
            options.fileId,
            options.operationId,
            dadosProcessados,
            configuracaoBanco,
            options.nomeArquivo || 'arquivo_cnab_240.txt'
          );

          console.log(`[SUCCESS] Dados persistidos com sucesso - ${resultadoPersistencia.estatisticas.totalCodigosBarras} códigos de barras salvos`);
        } catch (persistenciaError) {
          console.error('[ERROR] Erro na persistência, continuando com processamento:', persistenciaError.message);
          // Não interromper o processamento se a persistência falhar
        }
      } else {
        console.log('[INFO] Dados de persistência não fornecidos (fileId/operationId), pulando salvamento no banco');
      }

      // 10. Retornar resultado completo
      const resultado = {
        sucesso: true,
        valido: validacao.valido && validacaoEstrutura.valido,

        // Dados processados
        dados: dadosCompletos,

        // Validações
        validacao: {
          arquivo: validacao,
          estrutura: validacaoEstrutura,
          somatorias: validacaoSomatorias
        },

        // Somatórias e estatísticas
        somatorias,
        resumo,

        // ✅ NOVO: Resultado da persistência
        persistencia: resultadoPersistencia,

        // Metadados
        processamento: {
          timestamp: new Date().toISOString(),
          linhasProcessadas: linhas.length,
          configuracaoBanco: configuracaoBanco?.nome || 'Não identificada',
          options: {
            fileId: options.fileId,
            operationId: options.operationId,
            nomeArquivo: options.nomeArquivo
          }
        }
      };

      console.log('[SUCCESS] Processamento CNAB 240 concluído com sucesso');
      console.log(`  - Arquivo válido: ${resultado.valido}`);
      console.log(`  - Lotes processados: ${dadosCompletos.lotes.length}`);
      console.log(`  - Total de registros: ${resumo.totalRegistros}`);
      if (resultadoPersistencia) {
        console.log(`  - Códigos de barras salvos: ${resultadoPersistencia.estatisticas.totalCodigosBarras}`);
        console.log(`  - Segmentos persistidos: ${resultadoPersistencia.estatisticas.totalSegmentos}`);
      }

      return resultado;

    } catch (error) {
      console.error('[ERROR] Erro durante processamento CNAB 240:', error.message);

      return {
        sucesso: false,
        valido: false,
        erro: {
          message: error.message,
          stack: error.stack
        },
        processamento: {
          timestamp: new Date().toISOString(),
          falhou: true
        }
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
    } catch {
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
    } catch {
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

    console.log(`[DEBUG] Iniciando processamento de ${linhas.length} linhas`);

    linhas.forEach((linha, index) => {
      try {
        console.log(`[DEBUG] Processando linha ${index + 1}: tipo registro ${linha[7]}, tamanho ${linha.length}`);

        // Usar o parser genérico que detecta automaticamente o tipo
        const dadosParsed = CNAB240Parser.parse(linha);
        const tipoRegistro = dadosParsed._metadata.tipo;

        console.log(`[DEBUG] Linha ${index + 1} parsed com sucesso: tipo ${tipoRegistro}`);

        switch (tipoRegistro) {
          case '0': // Header de arquivo
            estrutura.headerArquivo = dadosParsed;
            console.log('[DEBUG] Header de arquivo definido');
            break;

          case '1': // Header de lote
            loteAtual = {
              header: dadosParsed,
              detalhes: [],
              trailer: null
            };
            estrutura.lotes.push(loteAtual);
            console.log(`[DEBUG] Novo lote criado: ${estrutura.lotes.length}`);
            break;

          case '3': // Detalhe (Segmentos A, B, etc.)
            if (!loteAtual) {
              throw new Error(`Linha ${index + 1}: Registro de detalhe encontrado sem header de lote`);
            }
            loteAtual.detalhes.push(dadosParsed);
            console.log(`[DEBUG] Detalhe adicionado ao lote: segmento ${dadosParsed.segmento}, total detalhes: ${loteAtual.detalhes.length}`);
            break;

          case '5': // Trailer de lote
            if (!loteAtual) {
              throw new Error(`Linha ${index + 1}: Trailer de lote encontrado sem header de lote`);
            }
            loteAtual.trailer = dadosParsed;
            console.log('[DEBUG] Trailer de lote definido');
            break;

          case '9': // Trailer de arquivo
            estrutura.trailerArquivo = dadosParsed;
            console.log('[DEBUG] Trailer de arquivo definido');
            break;

          default:
            console.warn(`Linha ${index + 1}: Tipo de registro "${tipoRegistro}" não reconhecido`);
        }

      } catch (error) {
        console.error(`Erro ao processar linha ${index + 1}:`, error.message);
        // Continua processamento das demais linhas
      }
    });

    console.log(`[DEBUG] Processamento concluído: ${estrutura.lotes.length} lotes, header: ${!!estrutura.headerArquivo}, trailer: ${!!estrutura.trailerArquivo}`);

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
      .filter(linha => linha.length > 0); // ✅ CORRIGIDO: usar length ao invés de trim()

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
   * Processa os detalhes de um lote, incluindo extração de códigos de barras
   * @param {Array} detalhes - Array de detalhes do lote
   * @param {Object} configuracaoBanco - Configuração do banco
   * @returns {Array} Detalhes processados com códigos de barras
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
      } else if (detalhe.segmento === 'J') {
        // ✅ NOVO: Extrair dados de títulos de cobrança com código de barras
        resultado.titulo = this.extrairDadosTitulo(detalhe);
        console.log(`[DEBUG] Código de barras extraído do segmento J: ${detalhe.codigoBarras}`);
      } else if (detalhe.segmento === 'O') {
        // ✅ NOVO: Extrair dados de tributos com código de barras
        resultado.tributo = this.extrairDadosTributo(detalhe);
        console.log(`[DEBUG] Código de barras extraído do segmento O: ${detalhe.codigoBarras}`);
      }

      // ✅ CORREÇÃO CRÍTICA: Incluir código de barras se disponível
      if (detalhe.codigoBarras && detalhe.codigoBarras.trim() !== '') {
        resultado.codigo_barras = detalhe.codigoBarras.trim();
        console.log(`[DEBUG] Código de barras registrado para segmento ${detalhe.segmento}: ${resultado.codigo_barras}`);
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
      valorPagamento,
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
    const totalLotes = dadosProcessados.lotes.length;
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

  /**
   * ✅ NOVA FUNÇÃO: Extrai dados específicos de títulos de cobrança (Segmento J)
   * @param {Object} detalhe - Dados do segmento J parseado
   * @returns {Object} Dados formatados do título
   */
  static extrairDadosTitulo(detalhe) {
    return {
      codigoBarras: detalhe.codigoBarras || '',
      nomeFavorecido: detalhe.nomeFavorecido || '',
      dataVencimento: this.formatarData(detalhe.dataVencimento),
      valorTitulo: this.formatarValor(detalhe.valorTitulo),
      valorPago: this.formatarValor(detalhe.valorPago),
      dataPagamento: this.formatarData(detalhe.dataPagamento),
      valorEfetivo: this.formatarValor(detalhe.valorEfetivo),
      descontoAbatimento: this.formatarValor(detalhe.descontoAbatimento),
      acrescimoMora: this.formatarValor(detalhe.acrescimoMora),
      informacoesComplementares: detalhe.informacoesComplementares || '',
      metadata: detalhe._metadata || {}
    };
  }

  /**
   * ✅ NOVA FUNÇÃO: Extrai dados específicos de tributos/concessionárias (Segmento O)
   * @param {Object} detalhe - Dados do segmento O parseado
   * @returns {Object} Dados formatados do tributo
   */
  static extrairDadosTributo(detalhe) {
    return {
      codigoBarras: detalhe.codigoBarras || '',
      nomeConcessionaria: detalhe.nomeConcessionaria || '',
      dataVencimento: this.formatarData(detalhe.dataVencimento),
      valorDocumento: this.formatarValor(detalhe.valorDocumento),
      valorPago: this.formatarValor(detalhe.valorPago),
      valorDesconto: this.formatarValor(detalhe.valorDesconto),
      dataPagamento: this.formatarData(detalhe.dataPagamento),
      valorEfetivado: this.formatarValor(detalhe.valorEfetivado),
      referencia: detalhe.referencia || '',
      informacoesComplementares: detalhe.informacoesComplementares || '',
      metadata: detalhe._metadata || {}
    };
  }

  /**
   * ✅ NOVA FUNÇÃO: Formata uma data do formato CNAB (DDMMAAAA) para formato legível
   * @param {string} dataCnab - Data no formato CNAB (ex: "19052025")
   * @returns {string} Data formatada (ex: "19/05/2025") ou string vazia se inválida
   */
  static formatarData(dataCnab) {
    if (!dataCnab || typeof dataCnab !== 'string' || dataCnab.length !== 8) {
      return '';
    }

    // Verificar se não são zeros
    if (dataCnab === '00000000') {
      return '';
    }

    try {
      const dia = dataCnab.substring(0, 2);
      const mes = dataCnab.substring(2, 4);
      const ano = dataCnab.substring(4, 8);

      // Validação básica
      const diaNum = parseInt(dia);
      const mesNum = parseInt(mes);
      const anoNum = parseInt(ano);

      if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12 || anoNum < 1900) {
        return '';
      }

      return `${dia}/${mes}/${ano}`;
    } catch {
      return '';
    }
  }

  /**
   * ✅ NOVA FUNÇÃO: Formata um valor do formato CNAB (string com centavos) para número em reais
   * @param {string} valorCnab - Valor no formato CNAB (ex: "000002234040")
   * @returns {number} Valor em reais (ex: 22340.40) ou 0 se inválido
   */
  static formatarValor(valorCnab) {
    if (!valorCnab || typeof valorCnab !== 'string') {
      return 0;
    }

    // Remove espaços e verifica se não são apenas zeros
    const valorLimpo = valorCnab.trim();
    if (valorLimpo === '' || /^0+$/.test(valorLimpo)) {
      return 0;
    }

    try {
      const valorInteiro = parseInt(valorLimpo) || 0;
      // Converte centavos para reais (divide por 100)
      return valorInteiro / 100;
    } catch {
      return 0;
    }
  }

  /**
   * ✅ CORREÇÃO CRÍTICA: Salva segmento CNAB 240 no banco de dados incluindo códigos de barras
   * @param {number} batchId - ID do lote
   * @param {Object} segmento - Dados do segmento processado
   * @param {string} operationId - ID da operação
   * @returns {Promise<Object>} Segmento salvo
   */
  static async salvarSegmentoCnab240(batchId, segmento, operationId) {
    try {
      // ✅ NOVO: Extrair código de barras baseado no segmento
      let codigoBarras = null;

      // Para segmentos J (títulos/cobrança)
      if (segmento.segmento === 'J' && segmento.titulo?.codigoBarras) {
        codigoBarras = segmento.titulo.codigoBarras;
        console.log(`[DEBUG] Código de barras extraído do segmento J: ${codigoBarras}`);
      }

      // Para segmentos O (tributos/concessionárias)  
      if (segmento.segmento === 'O' && segmento.tributo?.codigoBarras) {
        codigoBarras = segmento.tributo.codigoBarras;
        console.log(`[DEBUG] Código de barras extraído do segmento O: ${codigoBarras}`);
      }

      // Também verificar diretamente nos dados originais como fallback
      if (!codigoBarras && segmento.dadosOriginais?.codigoBarras) {
        codigoBarras = segmento.dadosOriginais.codigoBarras;
        console.log(`[DEBUG] Código de barras extraído dos dados originais: ${codigoBarras}`);
      }

      // Dados básicos do segmento
      const dadosSegmento = {
        batch_id: batchId,
        operation_id: operationId,
        segmento_tipo: segmento.segmento,
        segmento_sequencia: segmento.sequencia || 0,
        registro_numero: segmento.numeroSequencial || 0,

        // ✅ CRÍTICO: Incluir código de barras no salvamento
        codigo_barras: codigoBarras,

        // Dados do pagamento se for segmento A
        codigo_movimento: segmento.pagamento?.codigoMovimento,
        codigo_instrucao: segmento.pagamento?.codigoInstrucao,

        // Dados do favorecido se disponível
        favorecido_banco: segmento.beneficiario?.banco?.codigo || segmento.pagamento?.bancoFavorecido,
        favorecido_agencia: segmento.beneficiario?.banco?.agencia || segmento.pagamento?.agenciaFavorecido,
        favorecido_agencia_dv: segmento.beneficiario?.banco?.agenciaDv || segmento.pagamento?.dvAgenciaFavorecido,
        favorecido_conta: segmento.beneficiario?.banco?.conta || segmento.pagamento?.contaFavorecido,
        favorecido_conta_dv: segmento.beneficiario?.banco?.digitoVerificador || segmento.pagamento?.dvContaFavorecido,
        favorecido_nome: segmento.beneficiario?.nome || segmento.pagamento?.nomeFavorecido || segmento.titulo?.nomeFavorecido || segmento.tributo?.nomeConcessionaria,
        favorecido_documento: segmento.beneficiario?.documento,

        // Valores - priorizar valores específicos por segmento
        valor_operacao: (() => {
          if (segmento.segmento === 'J' && segmento.titulo) {
            return this.parseValorCNAB(segmento.titulo.valorPago) || this.parseValorCNAB(segmento.titulo.valorTitulo);
          }
          if (segmento.segmento === 'O' && segmento.tributo) {
            return this.parseValorCNAB(segmento.tributo.valorPago) || this.parseValorCNAB(segmento.tributo.valorDocumento);
          }
          if (segmento.pagamento?.valorPagamento) {
            return this.parseValorCNAB(segmento.pagamento.valorPagamento);
          }
          return null;
        })(),

        // Datas - CORRIGIDO: usar parseDateCnab240 ao invés de formatarDataCNAB
        data_operacao: (() => {
          if (segmento.titulo?.dataPagamento) {
            return this.parseDateCnab240(segmento.titulo.dataPagamento);
          }
          if (segmento.tributo?.dataPagamento) {
            return this.parseDateCnab240(segmento.tributo.dataPagamento);
          }
          if (segmento.pagamento?.dataPagamento) {
            return this.parseDateCnab240(segmento.pagamento.dataPagamento);
          }
          return null;
        })(),

        data_efetivacao: (() => {
          if (segmento.titulo?.dataVencimento) {
            return this.parseDateCnab240(segmento.titulo.dataVencimento);
          }
          if (segmento.tributo?.dataVencimento) {
            return this.parseDateCnab240(segmento.tributo.dataVencimento);
          }
          if (segmento.pagamento?.dataEfetivacao) {
            return this.parseDateCnab240(segmento.pagamento.dataEfetivacao);
          }
          return null;
        })(),

        // PIX específico
        chave_pix: segmento.pix?.chave,
        tipo_chave_pix: segmento.pix?.tipoChave,

        // Informações adicionais
        finalidade_ted: segmento.pagamento?.finalidadeDOC,
        numero_documento: segmento.titulo?.numeroDocumento || segmento.tributo?.referencia || segmento.pagamento?.numeroDocumentoEmpresa,

        // Dados completos em JSON
        dados_completos: JSON.stringify(segmento)
      };

      console.log(`[DEBUG] Salvando segmento ${segmento.segmento} com código de barras: ${codigoBarras || 'NENHUM'}`);

      // Executar inserção SQL direta para garantir compatibilidade
      const [results] = await sequelize.query(
        `INSERT INTO cnab240_segments (
          batch_id, operation_id, segmento_tipo, segmento_sequencia, registro_numero,
          codigo_movimento, codigo_instrucao, 
          favorecido_banco, favorecido_agencia, favorecido_agencia_dv, 
          favorecido_conta, favorecido_conta_dv, favorecido_nome, favorecido_documento,
          valor_operacao, data_operacao, data_efetivacao,
          chave_pix, tipo_chave_pix, finalidade_ted, numero_documento, codigo_barras,
          dados_completos, created_at, updated_at
        ) VALUES (
          :batch_id, :operation_id, :segmento_tipo, :segmento_sequencia, :registro_numero,
          :codigo_movimento, :codigo_instrucao,
          :favorecido_banco, :favorecido_agencia, :favorecido_agencia_dv,
          :favorecido_conta, :favorecido_conta_dv, :favorecido_nome, :favorecido_documento,
          :valor_operacao, :data_operacao, :data_efetivacao,
          :chave_pix, :tipo_chave_pix, :finalidade_ted, :numero_documento, :codigo_barras,
          :dados_completos, NOW(), NOW()
        )`,
        {
          replacements: dadosSegmento,
          type: sequelize.QueryTypes.INSERT
        }
      );

      console.log(`[SUCCESS] Segmento ${segmento.segmento} salvo com ID: ${results}`);
      return { id: results, ...dadosSegmento };

    } catch (error) {
      console.error(`[ERROR] Erro ao salvar segmento ${segmento.segmento}:`, error.message);
      throw new Error(`Erro ao salvar segmento CNAB 240: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Salva arquivo CNAB 240 no banco de dados
   * @param {number} fileId - ID do arquivo na tabela files
   * @param {string} operationId - ID da operação
   * @param {Object} dadosArquivo - Dados extraídos do arquivo CNAB
   * @returns {Promise<Object>} Arquivo CNAB salvo
   */
  static async salvarArquivoCnab240(fileId, operationId, dadosArquivo) {
    try {
      console.log(`[DEBUG] Salvando arquivo CNAB 240 - FileID: ${fileId}, OperationID: ${operationId}`);

      const [results] = await sequelize.query(
        `INSERT INTO cnab240_files (
          file_id, operation_id, banco_codigo, banco_nome, arquivo_sequencia,
          data_geracao, hora_geracao, versao_layout, densidade,
          empresa_tipo_pessoa, empresa_documento, empresa_nome, empresa_codigo,
          total_lotes, total_registros, valor_total,
          header_dados, trailer_dados, created_at, updated_at
        ) VALUES (
          :file_id, :operation_id, :banco_codigo, :banco_nome, :arquivo_sequencia,
          :data_geracao, :hora_geracao, :versao_layout, :densidade,
          :empresa_tipo_pessoa, :empresa_documento, :empresa_nome, :empresa_codigo,
          :total_lotes, :total_registros, :valor_total,
          :header_dados, :trailer_dados, NOW(), NOW()
        )`,
        {
          replacements: {
            file_id: fileId,
            operation_id: operationId,
            banco_codigo: dadosArquivo.banco_codigo,
            banco_nome: dadosArquivo.banco_nome,
            arquivo_sequencia: dadosArquivo.arquivo_sequencia,
            data_geracao: dadosArquivo.data_geracao,
            hora_geracao: dadosArquivo.hora_geracao,
            versao_layout: dadosArquivo.versao_layout,
            densidade: dadosArquivo.densidade,
            empresa_tipo_pessoa: dadosArquivo.empresa_tipo_pessoa,
            empresa_documento: dadosArquivo.empresa_documento,
            empresa_nome: dadosArquivo.empresa_nome,
            empresa_codigo: dadosArquivo.empresa_codigo,
            total_lotes: dadosArquivo.total_lotes,
            total_registros: dadosArquivo.total_registros,
            valor_total: dadosArquivo.valor_total,
            header_dados: JSON.stringify(dadosArquivo.header_dados),
            trailer_dados: JSON.stringify(dadosArquivo.trailer_dados)
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      console.log(`[SUCCESS] Arquivo CNAB 240 salvo com ID: ${results}`);
      return { id: results, ...dadosArquivo };

    } catch (error) {
      console.error('[ERROR] Erro ao salvar arquivo CNAB 240:', error.message);
      throw new Error(`Erro ao salvar arquivo CNAB 240: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Salva lote CNAB 240 no banco de dados
   * @param {number} cnab240FileId - ID do arquivo CNAB 240
   * @param {string} operationId - ID da operação
   * @param {Object} lote - Dados do lote processado
   * @param {number} loteNumero - Número sequencial do lote
   * @returns {Promise<Object>} Lote salvo
   */
  static async salvarLoteCnab240(cnab240FileId, operationId, lote, loteNumero) {
    try {
      console.log(`[DEBUG] Salvando lote ${loteNumero} - CNAB240FileID: ${cnab240FileId}`);

      const header = lote.header;
      const trailer = lote.trailer;

      const dadosLote = {
        cnab240_file_id: cnab240FileId,
        operation_id: operationId,
        lote_numero: loteNumero,
        lote_tipo: header?.tipoOperacao || header?.formaLancamento,
        forma_lancamento: header?.formaLancamento,
        empresa_tipo_pessoa: header?.tipoInscricaoEmpresa === '1' ? '1' : '2',
        empresa_documento: header?.numeroInscricaoEmpresa,
        empresa_nome: header?.nomeEmpresa,
        agencia: header?.agencia,
        agencia_dv: header?.dvAgencia,
        conta: header?.numeroConta,
        conta_dv: header?.dvConta,
        quantidade_registros: trailer?.quantidadeRegistros || lote.detalhes.length,
        valor_total: this.parseValorCNAB(trailer?.somatoriaCreditosReais) || 0,
        quantidade_moedas: trailer?.quantidadeMoedas || 0,
        data_operacao: this.parseDateCnab240(header?.dataOperacao),
        data_credito: this.parseDateCnab240(header?.dataCredito),
        header_lote_dados: JSON.stringify(header),
        trailer_lote_dados: JSON.stringify(trailer)
      };

      const [results] = await sequelize.query(
        `INSERT INTO cnab240_batches (
          cnab240_file_id, operation_id, lote_numero, lote_tipo, forma_lancamento,
          empresa_tipo_pessoa, empresa_documento, empresa_nome,
          agencia, agencia_dv, conta, conta_dv,
          quantidade_registros, valor_total, quantidade_moedas,
          data_operacao, data_credito,
          header_lote_dados, trailer_lote_dados, created_at, updated_at
        ) VALUES (
          :cnab240_file_id, :operation_id, :lote_numero, :lote_tipo, :forma_lancamento,
          :empresa_tipo_pessoa, :empresa_documento, :empresa_nome,
          :agencia, :agencia_dv, :conta, :conta_dv,
          :quantidade_registros, :valor_total, :quantidade_moedas,
          :data_operacao, :data_credito,
          :header_lote_dados, :trailer_lote_dados, NOW(), NOW()
        )`,
        {
          replacements: dadosLote,
          type: sequelize.QueryTypes.INSERT
        }
      );

      console.log(`[SUCCESS] Lote ${loteNumero} salvo com ID: ${results}`);
      return { id: results, ...dadosLote };

    } catch (error) {
      console.error(`[ERROR] Erro ao salvar lote ${loteNumero}:`, error.message);
      throw new Error(`Erro ao salvar lote CNAB 240: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Salva código de barras na tabela otimizada para API Swap
   * @param {number} segmentId - ID do segmento
   * @param {string} operationId - ID da operação
   * @param {Object} dados - Dados do código de barras
   * @returns {Promise<Object>} Código de barras salvo
   */
  static async salvarCodigoBarras(segmentId, operationId, dados) {
    try {
      if (!dados.codigo_barras || dados.codigo_barras.trim() === '') {
        console.log(`[DEBUG] Segmento ${segmentId} não possui código de barras válido`);
        return null;
      }

      console.log(`[DEBUG] Salvando código de barras para segmento ${segmentId}: ${dados.codigo_barras}`);

      const dadosCodigoBarras = {
        segment_id: segmentId,
        operation_id: operationId,
        codigo_barras: dados.codigo_barras.trim(),
        tipo_documento: dados.tipo_documento,
        valor_documento: dados.valor_documento || 0,
        data_vencimento: dados.data_vencimento,
        favorecido_nome: dados.favorecido_nome,
        favorecido_documento: dados.favorecido_documento,
        numero_documento: dados.numero_documento,
        arquivo_origem: dados.arquivo_origem,
        lote_numero: dados.lote_numero,
        status_pagamento: 'PENDENTE'
      };

      const [results] = await sequelize.query(
        `INSERT INTO cnab240_codigo_barras (
          segment_id, operation_id, codigo_barras, tipo_documento,
          valor_documento, data_vencimento, favorecido_nome, favorecido_documento,
          numero_documento, arquivo_origem, lote_numero, status_pagamento,
          created_at, updated_at
        ) VALUES (
          :segment_id, :operation_id, :codigo_barras, :tipo_documento,
          :valor_documento, :data_vencimento, :favorecido_nome, :favorecido_documento,
          :numero_documento, :arquivo_origem, :lote_numero, :status_pagamento,
          NOW(), NOW()
        )`,
        {
          replacements: dadosCodigoBarras,
          type: sequelize.QueryTypes.INSERT
        }
      );

      console.log(`[SUCCESS] Código de barras salvo com ID: ${results} - Código: ${dados.codigo_barras}`);
      return { id: results, ...dadosCodigoBarras };

    } catch (error) {
      if (error.message.includes('Duplicate entry')) {
        console.log(`[WARNING] Código de barras ${dados.codigo_barras} já existe no banco`);
        return null;
      }
      console.error('[ERROR] Erro ao salvar código de barras:', error.message);
      throw new Error(`Erro ao salvar código de barras: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Persiste todos os dados processados no banco de dados
   * @param {number} fileId - ID do arquivo na tabela files
   * @param {string} operationId - ID da operação
   * @param {Object} dadosProcessados - Dados completos processados
   * @param {Object} configuracaoBanco - Configuração do banco
   * @param {string} nomeArquivo - Nome do arquivo original
   * @returns {Promise<Object>} Resultado da persistência
   */
  static async persistirDadosCompletos(fileId, operationId, dadosProcessados, configuracaoBanco, nomeArquivo) {
    try {
      console.log(`[INFO] Iniciando persistência completa - FileID: ${fileId}, OperationID: ${operationId}`);

      // 1. Calcular somatórias
      const somatorias = this.calcularSomatorias(dadosProcessados);

      // 2. Extrair dados para persistência do arquivo
      const dadosArquivo = this.extrairDadosParaPersistencia(dadosProcessados, configuracaoBanco, somatorias);

      // 3. Salvar arquivo CNAB 240
      const arquivoSalvo = await this.salvarArquivoCnab240(fileId, operationId, dadosArquivo);
      console.log(`[SUCCESS] Arquivo CNAB 240 persistido com ID: ${arquivoSalvo.id}`);

      const resultados = {
        arquivo: arquivoSalvo,
        lotes: [],
        segmentos: [],
        codigosBarras: [],
        estatisticas: {
          totalLotes: 0,
          totalSegmentos: 0,
          totalCodigosBarras: 0,
          erros: []
        }
      };

      // 4. Processar cada lote
      for (const [index, lote] of dadosProcessados.lotes.entries()) {
        try {
          const loteNumero = index + 1;

          // Salvar lote
          const loteSalvo = await this.salvarLoteCnab240(arquivoSalvo.id, operationId, lote, loteNumero);
          resultados.lotes.push(loteSalvo);
          resultados.estatisticas.totalLotes++;

          console.log(`[INFO] Processando ${lote.detalhes.length} segmentos do lote ${loteNumero}`);

          // 5. Processar cada segmento do lote
          for (const [segIndex, detalhe] of lote.detalhes.entries()) {
            try {
              // Processar dados do segmento
              const segmentoProcessado = {
                sequencia: segIndex + 1,
                segmento: detalhe.segmento,
                dadosOriginais: detalhe
              };

              // Processar dados específicos por tipo de segmento
              if (detalhe.segmento === 'J') {
                segmentoProcessado.titulo = this.extrairDadosTitulo(detalhe);
              } else if (detalhe.segmento === 'O') {
                segmentoProcessado.tributo = this.extrairDadosTributo(detalhe);
              } else if (detalhe.segmento === 'A') {
                segmentoProcessado.pagamento = this.extrairDadosPagamento(detalhe);
                segmentoProcessado.beneficiario = this.extrairDadosBeneficiario(detalhe);
              } else if (detalhe.segmento === 'B') {
                segmentoProcessado.informacoesComplementares = this.extrairInformacoesComplementares(detalhe);
                segmentoProcessado.pix = this.extrairDadosPix(detalhe, configuracaoBanco);
              }

              // Incluir código de barras se disponível
              if (detalhe.codigoBarras && detalhe.codigoBarras.trim() !== '') {
                segmentoProcessado.codigo_barras = detalhe.codigoBarras.trim();
              }

              // Salvar segmento
              const segmentoSalvo = await this.salvarSegmentoCnab240(loteSalvo.id, segmentoProcessado, operationId);
              resultados.segmentos.push(segmentoSalvo);
              resultados.estatisticas.totalSegmentos++;

              // 6. Salvar código de barras se existir
              if (segmentoProcessado.codigo_barras) {
                const dadosCodigoBarras = {
                  codigo_barras: segmentoProcessado.codigo_barras,
                  tipo_documento: detalhe.segmento === 'J' ? 'TITULO' : detalhe.segmento === 'O' ? 'TRIBUTO' : 'CONVENIO',
                  valor_documento: segmentoSalvo.valor_operacao || 0,
                  data_vencimento: segmentoSalvo.data_efetivacao,
                  favorecido_nome: segmentoSalvo.favorecido_nome,
                  favorecido_documento: segmentoSalvo.favorecido_documento,
                  numero_documento: segmentoSalvo.numero_documento,
                  arquivo_origem: nomeArquivo,
                  lote_numero: loteNumero
                };

                const codigoBarrasSalvo = await this.salvarCodigoBarras(segmentoSalvo.id, operationId, dadosCodigoBarras);
                if (codigoBarrasSalvo) {
                  resultados.codigosBarras.push(codigoBarrasSalvo);
                  resultados.estatisticas.totalCodigosBarras++;
                }
              }

            } catch (segmentoError) {
              console.error(`[ERROR] Erro ao processar segmento ${segIndex + 1} do lote ${loteNumero}:`, segmentoError.message);
              resultados.estatisticas.erros.push({
                tipo: 'segmento',
                lote: loteNumero,
                segmento: segIndex + 1,
                erro: segmentoError.message
              });
            }
          }

        } catch (loteError) {
          console.error(`[ERROR] Erro ao processar lote ${index + 1}:`, loteError.message);
          resultados.estatisticas.erros.push({
            tipo: 'lote',
            lote: index + 1,
            erro: loteError.message
          });
        }
      }

      console.log('[SUCCESS] Persistência completa finalizada:');
      console.log(`  - Arquivo: ${resultados.arquivo.id}`);
      console.log(`  - Lotes: ${resultados.estatisticas.totalLotes}`);
      console.log(`  - Segmentos: ${resultados.estatisticas.totalSegmentos}`);
      console.log(`  - Códigos de Barras: ${resultados.estatisticas.totalCodigosBarras}`);
      console.log(`  - Erros: ${resultados.estatisticas.erros.length}`);

      return resultados;

    } catch (error) {
      console.error('[ERROR] Erro na persistência completa:', error.message);
      throw new Error(`Erro na persistência dos dados CNAB 240: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Busca códigos de barras pendentes para pagamento via API Swap
   * @param {Object} filtros - Filtros de busca
   * @returns {Promise<Array>} Lista de códigos de barras
   */
  static async buscarCodigosBarrasPendentes(filtros = {}) {
    try {
      const {
        status = 'PENDENTE',
        tipo_documento = null,
        valor_minimo = null,
        valor_maximo = null,
        data_vencimento_ate = null,
        limit = 100,
        offset = 0
      } = filtros;

      let whereClause = 'WHERE cb.status_pagamento = :status';
      const replacements = { status };

      if (tipo_documento) {
        whereClause += ' AND cb.tipo_documento = :tipo_documento';
        replacements.tipo_documento = tipo_documento;
      }

      if (valor_minimo) {
        whereClause += ' AND cb.valor_documento >= :valor_minimo';
        replacements.valor_minimo = valor_minimo;
      }

      if (valor_maximo) {
        whereClause += ' AND cb.valor_documento <= :valor_maximo';
        replacements.valor_maximo = valor_maximo;
      }

      if (data_vencimento_ate) {
        whereClause += ' AND cb.data_vencimento <= :data_vencimento_ate';
        replacements.data_vencimento_ate = data_vencimento_ate;
      }

      const query = `
        SELECT 
          cb.id,
          cb.codigo_barras,
          cb.tipo_documento,
          cb.valor_documento,
          cb.data_vencimento,
          cb.favorecido_nome,
          cb.favorecido_documento,
          cb.numero_documento,
          cb.arquivo_origem,
          cb.lote_numero,
          cb.status_pagamento,
          cb.created_at,
          s.id as segment_id,
          s.segmento_tipo,
          s.dados_completos
        FROM cnab240_codigo_barras cb
        INNER JOIN cnab240_segments s ON cb.segment_id = s.id
        ${whereClause}
        ORDER BY cb.data_vencimento ASC, cb.valor_documento DESC
        LIMIT :limit OFFSET :offset
      `;

      const [results] = await sequelize.query(query, {
        replacements: { ...replacements, limit, offset },
        type: sequelize.QueryTypes.SELECT
      });

      console.log(`[INFO] Encontrados ${results.length} códigos de barras com status ${status}`);
      return results;

    } catch (error) {
      console.error('[ERROR] Erro ao buscar códigos de barras pendentes:', error.message);
      throw new Error(`Erro ao buscar códigos de barras: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Atualiza status de pagamento de um código de barras
   * @param {string} codigoBarras - Código de barras
   * @param {string} novoStatus - Novo status ('PROCESSANDO', 'PAGO', 'ERRO')
   * @param {Object} dadosSwap - Dados da resposta da API Swap
   * @returns {Promise<Object>} Resultado da atualização
   */
  static async atualizarStatusPagamento(codigoBarras, novoStatus, dadosSwap = {}) {
    try {
      console.log(`[INFO] Atualizando status do código de barras ${codigoBarras} para ${novoStatus}`);

      const dadosAtualizacao = {
        status_pagamento: novoStatus,
        data_pagamento: novoStatus === 'PAGO' ? new Date() : null,
        response_swap: dadosSwap.resposta ? JSON.stringify(dadosSwap.resposta) : null,
        erro_swap: dadosSwap.erro || null
      };

      const [affectedRows] = await sequelize.query(
        `UPDATE cnab240_codigo_barras 
         SET status_pagamento = :status_pagamento,
             data_pagamento = :data_pagamento,
             response_swap = :response_swap,
             erro_swap = :erro_swap,
             updated_at = NOW()
         WHERE codigo_barras = :codigo_barras`,
        {
          replacements: {
            ...dadosAtualizacao,
            codigo_barras: codigoBarras
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      if (affectedRows === 0) {
        throw new Error(`Código de barras ${codigoBarras} não encontrado`);
      }

      console.log(`[SUCCESS] Status atualizado para ${novoStatus} - Código: ${codigoBarras}`);
      return { sucesso: true, codigoBarras, novoStatus, dadosSwap };

    } catch (error) {
      console.error('[ERROR] Erro ao atualizar status de pagamento:', error.message);
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }
  }

  /**
   * ✅ NOVO: Busca histórico de pagamentos por período
   * @param {Date} dataInicio - Data inicial
   * @param {Date} dataFim - Data final
   * @param {Object} filtros - Filtros adicionais
   * @returns {Promise<Array>} Histórico de pagamentos
   */
  static async buscarHistoricoPagamentos(dataInicio, dataFim, filtros = {}) {
    try {
      const {
        status = null,
        tipo_documento = null,
        arquivo_origem = null
      } = filtros;

      let whereClause = 'WHERE cb.created_at BETWEEN :data_inicio AND :data_fim';
      const replacements = {
        data_inicio: dataInicio,
        data_fim: dataFim
      };

      if (status) {
        whereClause += ' AND cb.status_pagamento = :status';
        replacements.status = status;
      }

      if (tipo_documento) {
        whereClause += ' AND cb.tipo_documento = :tipo_documento';
        replacements.tipo_documento = tipo_documento;
      }

      if (arquivo_origem) {
        whereClause += ' AND cb.arquivo_origem = :arquivo_origem';
        replacements.arquivo_origem = arquivo_origem;
      }

      const query = `
        SELECT 
          cb.*,
          COUNT(*) OVER() as total_records,
          SUM(cb.valor_documento) OVER() as valor_total
        FROM cnab240_codigo_barras cb
        ${whereClause}
        ORDER BY cb.created_at DESC
      `;

      const [results] = await sequelize.query(query, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      console.log(`[INFO] Histórico: ${results.length} registros encontrados no período`);
      return results;

    } catch (error) {
      console.error('[ERROR] Erro ao buscar histórico de pagamentos:', error.message);
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }
  }
}

export default Cnab240Service;