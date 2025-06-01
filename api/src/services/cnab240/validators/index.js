/**
 * Índice dos validadores CNAB 240
 * 
 * Este arquivo exporta todos os validadores especializados para
 * validação avançada de arquivos CNAB 240 por código de operação.
 */

import EstruturaValidator from './estruturaValidator.js';
import IntegridadeValidator from './integridadeValidator.js';
import NegocioValidator from './negocioValidator.js';
import BancoValidator from './bancoValidator.js';
import OperacaoValidator from './operacaoValidator.js';

/**
 * Validador principal que orquestra todas as validações
 */
class Cnab240ValidatorSuite {
  /**
   * Executa validação completa do arquivo CNAB 240
   * @param {Object} dadosProcessados - Dados estruturados do arquivo CNAB
   * @param {Object} configuracaoBanco - Configuração específica do banco
   * @returns {Object} Resultado consolidado das validações
   */
  static async validarCompleto(dadosProcessados, configuracaoBanco) {
    const resultados = {
      valido: true,
      erros: [],
      avisos: [],
      validacoes: {
        estrutura: null,
        integridade: null,
        negocio: null,
        banco: null,
        operacoes: []
      }
    };

    try {
      // 1. Validação de Estrutura
      console.log('🔍 Executando validação de estrutura...');
      resultados.validacoes.estrutura = EstruturaValidator.validar(dadosProcessados);

      // 2. Validação de Integridade
      console.log('🔢 Executando validação de integridade...');
      resultados.validacoes.integridade = IntegridadeValidator.validar(dadosProcessados);

      // 3. Validação de Negócio
      console.log('💼 Executando validação de negócio...');
      resultados.validacoes.negocio = NegocioValidator.validar(dadosProcessados);

      // 4. Validação por Banco
      console.log('🏦 Executando validação específica do banco...');
      if (configuracaoBanco) {
        resultados.validacoes.banco = BancoValidator.validar(dadosProcessados, configuracaoBanco);
      }

      // 5. Validação por Operação
      console.log('⚙️ Executando validação por código de operação...');
      if (dadosProcessados.lotes) {
        for (const lote of dadosProcessados.lotes) {
          if (lote.header && lote.header.codigoConvenio) {
            const validacaoOperacao = OperacaoValidator.validar(lote, configuracaoBanco);
            resultados.validacoes.operacoes.push(validacaoOperacao);
          }
        }
      }

      // Consolidar resultados
      const todasValidacoes = [
        resultados.validacoes.estrutura,
        resultados.validacoes.integridade,
        resultados.validacoes.negocio,
        resultados.validacoes.banco,
        ...resultados.validacoes.operacoes
      ].filter(Boolean);

      // Agregar erros e avisos
      todasValidacoes.forEach(validacao => {
        if (validacao.erros) {
          resultados.erros.push(...validacao.erros);
        }
        if (validacao.avisos) {
          resultados.avisos.push(...validacao.avisos);
        }
        if (!validacao.valido) {
          resultados.valido = false;
        }
      });

      console.log(`✅ Validação completa: ${resultados.valido ? 'SUCESSO' : 'FALHOU'}`);
      console.log(`📊 ${resultados.erros.length} erro(s), ${resultados.avisos.length} aviso(s)`);

      return resultados;

    } catch (error) {
      console.error('❌ Erro durante validação:', error);
      return {
        valido: false,
        erros: [`Erro interno de validação: ${error.message}`],
        avisos: [],
        validacoes: resultados.validacoes
      };
    }
  }

  /**
   * Executa validação rápida (apenas estrutura e integridade)
   * @param {Object} dadosProcessados - Dados estruturados do arquivo CNAB
   * @returns {Object} Resultado da validação rápida
   */
  static validarRapido(dadosProcessados) {
    const resultados = {
      valido: true,
      erros: [],
      avisos: []
    };

    // Validação de estrutura
    const estrutura = EstruturaValidator.validar(dadosProcessados);
    if (!estrutura.valido) {
      resultados.valido = false;
      resultados.erros.push(...estrutura.erros);
    }
    resultados.avisos.push(...(estrutura.avisos || []));

    // Validação de integridade
    const integridade = IntegridadeValidator.validar(dadosProcessados);
    if (!integridade.valido) {
      resultados.valido = false;
      resultados.erros.push(...integridade.erros);
    }
    resultados.avisos.push(...(integridade.avisos || []));

    return resultados;
  }

  /**
   * Executa validação específica por tipo
   * @param {string} tipo - Tipo de validação (estrutura, integridade, negocio, banco, operacao)
   * @param {Object} dadosProcessados - Dados estruturados do arquivo CNAB
   * @param {Object} opcoes - Opções específicas da validação
   * @returns {Object} Resultado da validação específica
   */
  static validarPorTipo(tipo, dadosProcessados, opcoes = {}) {
    switch (tipo.toLowerCase()) {
      case 'estrutura':
        return EstruturaValidator.validar(dadosProcessados);

      case 'integridade':
        return IntegridadeValidator.validar(dadosProcessados);

      case 'negocio':
        return NegocioValidator.validar(dadosProcessados);

      case 'banco':
        return BancoValidator.validar(dadosProcessados, opcoes.configuracaoBanco);

      case 'operacao':
        return OperacaoValidator.validar(opcoes.lote, opcoes.configuracaoBanco);

      default:
        throw new Error(`Tipo de validação '${tipo}' não reconhecido`);
    }
  }
}

export {
  Cnab240ValidatorSuite,
  EstruturaValidator,
  IntegridadeValidator,
  NegocioValidator,
  BancoValidator,
  OperacaoValidator
};

export default Cnab240ValidatorSuite; 