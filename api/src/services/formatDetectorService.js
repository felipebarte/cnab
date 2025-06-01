/**
 * Serviço para detectar automaticamente o formato de arquivos CNAB
 * 
 * Analisa o conteúdo do arquivo para determinar se é CNAB 240 ou CNAB 400
 * baseado no tamanho das linhas e validações de consistência.
 */

import Logger from '../utils/logger.js';
import ErrorHandler from '../utils/errorHandler.js';

/**
 * Serviço de detecção automática de formato CNAB
 */
class FormatDetectorService {
  /**
   * Formatos CNAB suportados
   */
  static FORMATOS = {
    CNAB_240: {
      codigo: 'CNAB_240',
      nome: 'CNAB 240',
      tamanhoLinha: 240,
      descricao: 'Centro Nacional de Automação Bancária - 240 posições',
      servicoProcessamento: 'cnab240Service'
    },
    CNAB_400: {
      codigo: 'CNAB_400',
      nome: 'CNAB 400',
      tamanhoLinha: 400,
      descricao: 'Centro Nacional de Automação Bancária - 400 posições',
      servicoProcessamento: 'cnabService'
    }
  };

  /**
   * Detecta automaticamente o formato do arquivo CNAB
   * @param {string|Buffer} conteudo - Conteúdo do arquivo CNAB
   * @param {Object} options - Opções de detecção
   * @returns {Object} Resultado da detecção com formato identificado
   */
  static detectarFormato(conteudo, options = {}) {
    const operationId = options.operationId || Logger.generateOperationId();
    const logger = Logger.createCnabLogger(operationId, 'format-detection');

    try {
      // Converter Buffer para string se necessário
      const conteudoTexto = Buffer.isBuffer(conteudo)
        ? conteudo.toString('utf8')
        : conteudo;

      if (!conteudoTexto || typeof conteudoTexto !== 'string') {
        const error = ErrorHandler.createError(
          'CONTEUDO_INVALIDO',
          'Conteúdo deve ser uma string ou Buffer válido'
        );
        logger.error(error, 'validation');
        throw error;
      }

      // Análise das linhas
      const analiseLinhas = this.analisarLinhas(conteudoTexto);

      // Detectar formato baseado no tamanho mais comum
      const formatoDetectado = this.determinarFormato(analiseLinhas);

      // Validar consistência
      const validacaoConsistencia = this.validarConsistencia(analiseLinhas, formatoDetectado);

      const resultado = {
        sucesso: true,
        formatoDetectado,
        analise: analiseLinhas,
        validacao: validacaoConsistencia,
        recomendacao: this.gerarRecomendacao(formatoDetectado, validacaoConsistencia),
        operationId,
        timestamp: new Date().toISOString()
      };

      logger.info('Formato detectado', {
        formato: formatoDetectado.codigo,
        totalLinhas: analiseLinhas.totalLinhas,
        consistencia: validacaoConsistencia.consistente
      });

      return resultado;

    } catch (error) {
      logger.error(error, 'detection');

      const structuredError = ErrorHandler.createError(
        'ERRO_DETECCAO_FORMATO',
        error.message,
        { operation: 'detectarFormato' },
        error
      );

      return {
        sucesso: false,
        erro: structuredError.mensagem,
        codigo: structuredError.codigo,
        operationId,
        timestamp: structuredError.timestamp
      };
    }
  }

  /**
   * Analisa as linhas do arquivo para identificar padrões
   * @param {string} conteudo - Conteúdo do arquivo
   * @returns {Object} Análise detalhada das linhas
   */
  static analisarLinhas(conteudo) {
    // Dividir em linhas e remover caracteres de quebra
    const linhas = conteudo.split('\n')
      .map(linha => linha.replace(/\r?\n?$/g, '')) // Remove \r e \n do final
      .filter(linha => linha.length > 0); // Remove linhas completamente vazias

    if (linhas.length === 0) {
      throw new Error('Arquivo não contém linhas válidas');
    }

    // Analisar tamanhos das linhas
    const tamanhos = {};
    const detalhesLinhas = [];

    linhas.forEach((linha, index) => {
      const tamanho = linha.length;
      tamanhos[tamanho] = (tamanhos[tamanho] || 0) + 1;

      detalhesLinhas.push({
        numero: index + 1,
        tamanho,
        primeiroChar: linha.charAt(0),
        ultimoChar: linha.charAt(linha.length - 1),
        amostra: linha.substring(0, Math.min(50, linha.length)) + (linha.length > 50 ? '...' : '')
      });
    });

    // Identificar tamanho mais comum
    const tamanhoMaisComum = Object.keys(tamanhos)
      .reduce((a, b) => tamanhos[a] > tamanhos[b] ? a : b);

    return {
      totalLinhas: linhas.length,
      tamanhos,
      tamanhoMaisComum: parseInt(tamanhoMaisComum),
      frequenciaMaisComum: tamanhos[tamanhoMaisComum],
      detalhes: detalhesLinhas,
      primeiraLinha: linhas[0],
      ultimaLinha: linhas[linhas.length - 1],
      consistencia: {
        todasIguais: Object.keys(tamanhos).length === 1,
        percentualMaisComum: (tamanhos[tamanhoMaisComum] / linhas.length) * 100
      }
    };
  }

  /**
   * Determina o formato baseado na análise das linhas
   * @param {Object} analise - Análise das linhas
   * @returns {Object} Formato identificado
   */
  static determinarFormato(analise) {
    const tamanho = analise.tamanhoMaisComum;

    // Verificar formatos conhecidos
    if (tamanho === 240) {
      return {
        ...this.FORMATOS.CNAB_240,
        confianca: this.calcularConfianca(analise, 240),
        motivo: 'Linhas com 240 caracteres identificadas'
      };
    }

    if (tamanho === 400) {
      return {
        ...this.FORMATOS.CNAB_400,
        confianca: this.calcularConfianca(analise, 400),
        motivo: 'Linhas com 400 caracteres identificadas'
      };
    }

    // Formato não reconhecido
    throw new Error(
      `Formato CNAB não reconhecido. Tamanho de linha mais comum: ${tamanho} caracteres. ` +
      `Formatos suportados: 240 ou 400 caracteres.`
    );
  }

  /**
   * Calcula o nível de confiança da detecção
   * @param {Object} analise - Análise das linhas
   * @param {number} tamanhoEsperado - Tamanho esperado para o formato
   * @returns {number} Nível de confiança (0-100)
   */
  static calcularConfianca(analise, tamanhoEsperado) {
    const linhasCorretas = analise.tamanhos[tamanhoEsperado] || 0;
    const percentualCorreto = (linhasCorretas / analise.totalLinhas) * 100;

    // Ajustes na confiança baseados em outros fatores
    let confianca = percentualCorreto;

    // Reduzir confiança se há muitos tamanhos diferentes
    const variedadeTamanhos = Object.keys(analise.tamanhos).length;
    if (variedadeTamanhos > 2) {
      confianca -= (variedadeTamanhos - 2) * 5; // -5% para cada tamanho adicional
    }

    // Aumentar confiança se arquivo tem estrutura típica de CNAB
    if (analise.totalLinhas >= 3) { // Mínimo: header, detalhe, trailer
      confianca += 5;
    }

    return Math.max(0, Math.min(100, Math.round(confianca)));
  }

  /**
   * Valida a consistência do formato detectado
   * @param {Object} analise - Análise das linhas
   * @param {Object} formato - Formato detectado
   * @returns {Object} Resultado da validação de consistência
   */
  static validarConsistencia(analise, formato) {
    const erros = [];
    const avisos = [];
    const linhasIncorretas = [];

    // Verificar linhas com tamanho incorreto
    analise.detalhes.forEach(linha => {
      if (linha.tamanho !== formato.tamanhoLinha) {
        linhasIncorretas.push({
          numero: linha.numero,
          tamanhoEsperado: formato.tamanhoLinha,
          tamanhoEncontrado: linha.tamanho,
          diferenca: linha.tamanho - formato.tamanhoLinha
        });
      }
    });

    if (linhasIncorretas.length > 0) {
      if (linhasIncorretas.length === analise.totalLinhas) {
        erros.push(`Todas as ${analise.totalLinhas} linhas têm tamanho incorreto para ${formato.nome}`);
      } else if (linhasIncorretas.length > analise.totalLinhas * 0.1) { // Mais de 10%
        erros.push(`${linhasIncorretas.length} de ${analise.totalLinhas} linhas têm tamanho incorreto`);
      } else {
        avisos.push(`${linhasIncorretas.length} linha(s) com tamanho incorreto encontrada(s)`);
      }
    }

    // Verificar estrutura mínima
    if (analise.totalLinhas < 3) {
      avisos.push('Arquivo tem menos de 3 linhas, pode não ser um CNAB completo');
    }

    return {
      consistente: erros.length === 0,
      erros,
      avisos,
      linhasIncorretas,
      percentualCorreto: ((analise.totalLinhas - linhasIncorretas.length) / analise.totalLinhas) * 100,
      detalhesValidacao: {
        totalLinhas: analise.totalLinhas,
        linhasCorretas: analise.totalLinhas - linhasIncorretas.length,
        linhasIncorretas: linhasIncorretas.length
      }
    };
  }

  /**
   * Gera recomendação baseada na detecção e validação
   * @param {Object} formato - Formato detectado
   * @param {Object} validacao - Resultado da validação
   * @returns {Object} Recomendação para o usuário
   */
  static gerarRecomendacao(formato, validacao) {
    if (validacao.consistente && formato.confianca >= 90) {
      return {
        tipo: 'SUCESSO',
        mensagem: `Arquivo identificado como ${formato.nome} com alta confiança`,
        acao: 'PROCESSAR',
        servicoRecomendado: formato.servicoProcessamento
      };
    }

    if (validacao.consistente && formato.confianca >= 70) {
      return {
        tipo: 'AVISO',
        mensagem: `Arquivo provavelmente é ${formato.nome}, mas com algumas inconsistências`,
        acao: 'PROCESSAR_COM_CUIDADO',
        servicoRecomendado: formato.servicoProcessamento
      };
    }

    if (!validacao.consistente) {
      return {
        tipo: 'ERRO',
        mensagem: `Arquivo possui inconsistências significativas para ${formato.nome}`,
        acao: 'REVISAR_ARQUIVO',
        detalhes: validacao.erros.concat(validacao.avisos)
      };
    }

    return {
      tipo: 'INCERTO',
      mensagem: 'Não foi possível determinar o formato com certeza',
      acao: 'ESPECIFICAR_FORMATO_MANUALMENTE'
    };
  }

  /**
   * Retorna informações sobre os formatos suportados
   * @returns {Object} Lista de formatos suportados
   */
  static getFormatosSuportados() {
    return {
      formatos: Object.values(this.FORMATOS),
      total: Object.keys(this.FORMATOS).length,
      descricao: 'Formatos CNAB suportados pelo sistema de detecção automática'
    };
  }

  /**
   * Valida se um formato específico é suportado
   * @param {string} formato - Código do formato (ex: 'CNAB_240')
   * @returns {boolean} Se o formato é suportado
   */
  static isFormatoSuportado(formato) {
    return Object.keys(this.FORMATOS).includes(formato);
  }

  /**
   * Obter configuração de um formato específico
   * @param {string} formato - Código do formato
   * @returns {Object|null} Configuração do formato ou null se não encontrado
   */
  static getConfiguracaoFormato(formato) {
    return this.FORMATOS[formato] || null;
  }
}

export default FormatDetectorService; 