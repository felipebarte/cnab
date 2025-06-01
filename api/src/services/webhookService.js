import axios from 'axios';
import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';

/**
 * Serviço para envio de dados CNAB para webhooks externos
 */
class WebhookService {
  /**
   * Configurações padrão do webhook
   */
  static defaultConfig = {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY) || 5000,
    enabled: process.env.WEBHOOK_ENABLED === 'true' || true,
  };

  /**
   * Envia dados processados de CNAB para webhook
   * @param {Object} dadosCnab - Dados processados do CNAB
   * @param {string} webhookUrl - URL do webhook (opcional, usa env se não fornecida)
   * @returns {Object} Resultado do envio
   */
  static async enviarParaWebhook(dadosCnab, webhookUrl = null) {
    const operationId = Logger.generateOperationId();
    const startTime = Date.now();

    // Determina URL do webhook
    const url = webhookUrl || process.env.WEBHOOK_CNAB_URL || process.env.WEBHOOK_URL;

    // Cria logger especializado
    const logger = Logger.createWebhookLogger(operationId, url);

    // Validação da configuração
    const configValidation = ErrorHandler.validateWebhookConfig(url);
    if (!configValidation.valido) {
      logger.failed(configValidation.erro, 0, { reason: 'invalid_config' });
      throw configValidation.erro;
    }

    // Verifica se webhook está habilitado
    if (!this.defaultConfig.enabled) {
      logger.start({ disabled: true });
      Logger.warn('Webhook desabilitado na configuração', {
        operationId,
        url,
        component: 'webhook',
      });

      return {
        sucesso: true,
        enviado: false,
        motivo: 'Webhook desabilitado na configuração',
        tentativas: 0,
        tempoResposta: 0,
        operationId,
      };
    }

    logger.start({
      dataSize: JSON.stringify(dadosCnab).length,
      config: this.defaultConfig,
    });

    try {
      // Formata dados para envio
      const dadosFormatados = this.formatarDadosCnab(dadosCnab);

      Logger.debug('Dados formatados para webhook', {
        operationId,
        totalRegistros: dadosFormatados.resumo?.totalRegistros,
        totalValor: dadosFormatados.resumo?.totalValor,
        component: 'webhook',
      });

      // Tenta envio com retry
      const resultado = await this.tentarEnvioComRetry(dadosFormatados, url, logger);

      const responseTime = Logger.calculateResponseTime(startTime);
      logger.success(resultado.response, { responseTime });

      return {
        sucesso: true,
        enviado: true,
        tentativas: resultado.tentativas,
        response: resultado.response,
        tempoResposta: responseTime,
        operationId,
        timestamp: resultado.timestamp,
      };

    } catch (error) {
      const responseTime = Logger.calculateResponseTime(startTime);
      const classifiedError = ErrorHandler.classifyWebhookError(error);

      logger.failed(error, this.defaultConfig.retryAttempts, {
        responseTime,
        errorType: classifiedError.tipo,
      });

      throw classifiedError;
    }
  }

  /**
   * Formata dados CNAB para estrutura esperada pelo webhook
   * @param {Object} dadosCnab - Dados brutos do CNAB
   * @returns {Object} Dados formatados
   */
  static formatarDadosCnab(dadosCnab) {
    try {
      const dataProcessamento = new Date().toISOString();

      // Estrutura base dos dados formatados
      const dadosFormatados = {
        metadados: {
          fonte: 'CNAB 400 Itaú Parser API',
          versao: '1.0.0',
          dataProcessamento,
          webhook: {
            tentativaEnvio: 1,
            timestamp: dataProcessamento,
          },
        },
        arquivo: {
          nome: dadosCnab.arquivo?.nome || 'arquivo_cnab.txt',
          tamanho: dadosCnab.arquivo?.tamanho || 0,
          formato: 'CNAB 400',
          dataProcessamento,
        },
        cabecalho: this.extrairCabecalho(dadosCnab),
        registros: this.formatarRegistros(dadosCnab),
        resumo: this.calcularResumo(dadosCnab),
      };

      console.log('📋 Dados CNAB formatados para webhook:', {
        totalRegistros: dadosFormatados.resumo.totalRegistros,
        arquivo: dadosFormatados.arquivo.nome,
      });

      return dadosFormatados;

    } catch (error) {
      console.error('Erro ao formatar dados CNAB:', error);
      throw new Error(`Falha na formatação dos dados: ${error.message}`);
    }
  }

  /**
   * Extrai informações do cabeçalho do CNAB
   * @param {Object} dadosCnab - Dados do CNAB
   * @returns {Object} Dados do cabeçalho
   */
  static extrairCabecalho(dadosCnab) {
    // Por enquanto retorna estrutura básica
    // Será expandido quando melhorarmos o CnabService (Task #2)
    return {
      banco: '341',
      nomeBanco: 'BANCO ITAU SA',
      empresa: 'Empresa não identificada',
      dataGeracao: new Date().toISOString().split('T')[0],
      sequencial: '000001',
      tipoArquivo: 'RETORNO',
      servico: 'COBRANCA',
    };
  }

  /**
   * Formata registros do CNAB para estrutura detalhada
   * @param {Object} dadosCnab - Dados do CNAB
   * @returns {Array} Registros formatados
   */
  static formatarRegistros(dadosCnab) {
    const dados = dadosCnab.dados?.dados || dadosCnab.dados || [];

    if (!Array.isArray(dados)) {
      console.warn('Dados CNAB não são um array, retornando array vazio');
      return [];
    }

    return dados.map((registro, index) => {
      return {
        sequencia: index + 1,
        tipo: 'transacao',
        nossoNumero: registro.nossoNumero || `SEQ${String(index + 1).padStart(6, '0')}`,
        codigoBarras: registro.codigoBarras || null,
        linhaDigitavel: registro.linhaDigitavel || null,
        valor: this.formatarValor(registro.valor),
        vencimento: this.formatarData(registro.vencimento),
        pagador: {
          nome: registro.pagador?.nome || 'Não identificado',
          documento: registro.pagador?.documento || '',
          endereco: registro.pagador?.endereco || '',
        },
        recebedor: {
          nome: registro.recebedor?.nome || 'Não identificado',
          documento: registro.recebedor?.documento || '',
          conta: registro.recebedor?.conta || '',
        },
        status: registro.status || 'processado',
        dataPagamento: registro.dataPagamento ? this.formatarData(registro.dataPagamento) : null,
        observacoes: registro.observacoes || '',
      };
    });
  }

  /**
   * Calcula resumo dos dados CNAB
   * @param {Object} dadosCnab - Dados do CNAB
   * @returns {Object} Resumo calculado
   */
  static calcularResumo(dadosCnab) {
    const registros = this.formatarRegistros(dadosCnab);

    const resumo = {
      totalRegistros: registros.length,
      totalValor: 0,
      totalComCodigoBarras: 0,
      totalComLinhaDigitavel: 0,
      totalPagos: 0,
      totalPendentes: 0,
      dataProcessamento: new Date().toISOString(),
    };

    registros.forEach(registro => {
      // Soma valores
      const valor = parseFloat(registro.valor) || 0;
      resumo.totalValor += valor;

      // Conta registros com código de barras
      if (registro.codigoBarras) {
        resumo.totalComCodigoBarras++;
      }

      // Conta registros com linha digitável
      if (registro.linhaDigitavel) {
        resumo.totalComLinhaDigitavel++;
      }

      // Conta status
      if (registro.status === 'pago') {
        resumo.totalPagos++;
      } else {
        resumo.totalPendentes++;
      }
    });

    return resumo;
  }

  /**
   * Tenta envio com sistema de retry
   * @param {Object} dados - Dados para enviar
   * @param {string} url - URL do webhook
   * @param {Object} logger - Logger especializado
   * @returns {Object} Resultado do envio
   */
  static async tentarEnvioComRetry(dados, url, logger) {
    let ultimoErro = null;
    let totalTime = 0;

    for (let tentativa = 1; tentativa <= this.defaultConfig.retryAttempts; tentativa++) {
      const attemptStartTime = Date.now();

      try {
        logger.attempt(tentativa, this.defaultConfig.retryAttempts, {
          previousAttempts: tentativa - 1,
          totalTimeSpent: totalTime,
        });

        // Atualiza metadados da tentativa
        dados.metadados.webhook.tentativaEnvio = tentativa;
        dados.metadados.webhook.timestamp = new Date().toISOString();

        const response = await axios.post(url, dados, {
          timeout: this.defaultConfig.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CNAB-400-Itau-Parser-API/1.0.0',
            'X-Webhook-Source': 'cnab-api',
            'X-Webhook-Version': '1.0.0',
            'X-Tentativa': tentativa.toString(),
            'X-Operation-Id': logger.operationId || 'unknown',
          },
        });

        const attemptTime = Logger.calculateResponseTime(attemptStartTime);
        totalTime += attemptTime;

        Logger.debug('Resposta do webhook recebida', {
          operationId: logger.operationId,
          status: response.status,
          responseTime: attemptTime,
          attempt: tentativa,
          component: 'webhook',
        });

        return {
          sucesso: true,
          tentativas: tentativa,
          response: {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            headers: Logger.sanitizeForLog(response.headers),
          },
          timestamp: new Date().toISOString(),
          totalTime,
        };

      } catch (error) {
        ultimoErro = error;
        const attemptTime = Logger.calculateResponseTime(attemptStartTime);
        totalTime += attemptTime;

        logger.attemptFailed(tentativa, error, {
          attemptTime,
          totalTimeSpent: totalTime,
          errorCode: error.code,
          status: error.response?.status,
        });

        // Se não é a última tentativa, aguarda antes de tentar novamente
        if (tentativa < this.defaultConfig.retryAttempts) {
          const delay = this.defaultConfig.retryDelay * tentativa; // Delay progressivo
          logger.delay(delay, tentativa + 1);
          await this.sleep(delay);
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    const finalError = new Error(
      `Todas as ${this.defaultConfig.retryAttempts} tentativas falharam. ` +
      `Tempo total gasto: ${totalTime}ms. ` +
      `Último erro: ${ultimoErro.message}`
    );

    // Preserva informações do erro original
    finalError.originalError = ultimoErro;
    finalError.totalAttempts = this.defaultConfig.retryAttempts;
    finalError.totalTime = totalTime;

    throw finalError;
  }

  /**
   * Formata valor monetário
   * @param {any} valor - Valor a ser formatado
   * @returns {number} Valor formatado
   */
  static formatarValor(valor) {
    if (valor === null || valor === undefined) return 0;

    const valorNumber = parseFloat(valor);
    return isNaN(valorNumber) ? 0 : Math.round(valorNumber * 100) / 100; // 2 casas decimais
  }

  /**
   * Formata data para padrão ISO
   * @param {any} data - Data a ser formatada
   * @returns {string|null} Data formatada ou null
   */
  static formatarData(data) {
    if (!data) return null;

    try {
      const dataObj = new Date(data);
      return isNaN(dataObj.getTime()) ? null : dataObj.toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Função auxiliar para sleep/delay
   * @param {number} ms - Milliseconds para aguardar
   * @returns {Promise} Promise que resolve após o delay
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Valida configuração do webhook
   * @returns {Object} Status da configuração
   */
  static validarConfiguracao() {
    const config = {
      url: process.env.WEBHOOK_CNAB_URL,
      enabled: this.defaultConfig.enabled,
      timeout: this.defaultConfig.timeout,
      retryAttempts: this.defaultConfig.retryAttempts,
      retryDelay: this.defaultConfig.retryDelay,
    };

    const problemas = [];

    if (!config.url) {
      problemas.push('WEBHOOK_CNAB_URL não configurada');
    }

    if (config.timeout < 1000) {
      problemas.push('WEBHOOK_TIMEOUT muito baixo (mínimo 1000ms)');
    }

    if (config.retryAttempts < 1 || config.retryAttempts > 10) {
      problemas.push('WEBHOOK_RETRY_ATTEMPTS deve estar entre 1 e 10');
    }

    return {
      valida: problemas.length === 0,
      config,
      problemas,
    };
  }
}

export default WebhookService; 