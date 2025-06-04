/**
 * Validador Específico por Banco CNAB 240
 * 
 * Responsável por aplicar validações específicas de cada banco,
 * baseado nas particularidades e regras próprias de cada instituição.
 */

import { BANCOS_240 } from '../../../config/bancos240.js';

class BancoValidator {
  /**
   * Valida dados conforme regras específicas do banco
   * @param {Object} dadosProcessados - Dados estruturados do arquivo
   * @param {Object} configuracaoBanco - Configuração específica do banco
   * @returns {Object} Resultado da validação específica do banco
   */
  static validar(dadosProcessados, configuracaoBanco) {
    const resultado = {
      valido: true,
      erros: [],
      avisos: [],
      detalhes: {
        banco: null,
        regrasAplicadas: [],
        validacoesEspecificas: {
          formatoCampos: true,
          regrasConvenio: true,
          limitesOperacionais: true,
          configuracoesEspeciais: true
        }
      }
    };

    try {
      // Identificar o banco
      const codigoBanco = dadosProcessados.headerArquivo?.codigoBanco;

      if (!codigoBanco) {
        resultado.erros.push('Código do banco não encontrado no header do arquivo');
        resultado.valido = false;
        return resultado;
      }

      resultado.detalhes.banco = {
        codigo: codigoBanco,
        nome: this.obterNomeBanco(codigoBanco),
        configuracao: configuracaoBanco
      };

      // 1. Validar configuração específica do banco
      this.validarConfiguracaoBanco(codigoBanco, configuracaoBanco, resultado);

      // 2. Aplicar validações específicas por banco
      this.aplicarValidacoesEspecificas(codigoBanco, dadosProcessados, configuracaoBanco, resultado);

      // 3. Validar formatos específicos do banco
      this.validarFormatosEspecificos(codigoBanco, dadosProcessados, resultado);

      // 4. Validar regras de convênio/operação
      this.validarRegrasConvenio(codigoBanco, dadosProcessados, configuracaoBanco, resultado);

      // 5. Validar limites operacionais
      this.validarLimitesOperacionais(codigoBanco, dadosProcessados, resultado);

    } catch (error) {
      resultado.valido = false;
      resultado.erros.push(`Erro interno de validação específica do banco: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Obtém o nome do banco pelo código
   */
  static obterNomeBanco(codigoBanco) {
    const nomesBancos = {
      '001': 'Banco do Brasil',
      '104': 'Caixa Econômica Federal',
      '237': 'Bradesco',
      '341': 'Itaú Unibanco',
      '033': 'Banco Santander',
      '756': 'Banco Cooperativo do Brasil (Bancoob)',
      '748': 'Banco Cooperativo Sicredi',
      '260': 'Nu Pagamentos',
      '077': 'Banco Inter'
    };

    return nomesBancos[codigoBanco] || `Banco ${codigoBanco}`;
  }

  /**
   * Valida se a configuração do banco está adequada
   */
  static validarConfiguracaoBanco(codigoBanco, configuracaoBanco, resultado) {
    if (!configuracaoBanco) {
      resultado.avisos.push('Configuração específica do banco não fornecida, usando validações genéricas');
      return;
    }

    // Validar se o código do banco na configuração confere
    if (configuracaoBanco.codigo && configuracaoBanco.codigo !== codigoBanco) {
      resultado.erros.push(
        `Código do banco na configuração (${configuracaoBanco.codigo}) ` +
        `não confere com o arquivo (${codigoBanco})`
      );
      resultado.valido = false;
    }

    // Validar campos obrigatórios da configuração
    const camposObrigatorios = ['operacoesSuportadas'];

    camposObrigatorios.forEach(campo => {
      if (!configuracaoBanco[campo]) {
        resultado.avisos.push(`Campo '${campo}' não encontrado na configuração do banco`);
      }
    });
  }

  /**
   * Aplica validações específicas por banco
   */
  static aplicarValidacoesEspecificas(codigoBanco, dadosProcessados, configuracaoBanco, resultado) {
    switch (codigoBanco) {
    case '001': // Banco do Brasil
      this.validarBancoBrasil(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '104': // Caixa Econômica Federal
      this.validarCaixaEconomica(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '237': // Bradesco
      this.validarBradesco(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '341': // Itaú Unibanco
      this.validarItau(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '033': // Santander
      this.validarSantander(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '756': // Bancoob
      this.validarBancoob(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '748': // Sicredi
      this.validarSicredi(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '260': // Nu Pagamentos
      this.validarNubank(dadosProcessados, configuracaoBanco, resultado);
      break;

    case '077': // Banco Inter
      this.validarBancoInter(dadosProcessados, configuracaoBanco, resultado);
      break;

    default:
      resultado.avisos.push(`Validações específicas não implementadas para o banco ${codigoBanco}`);
      break;
    }
  }

  /**
   * Validações específicas do Banco do Brasil
   */
  static validarBancoBrasil(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Banco do Brasil');

    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      // BB: Validar formato do convênio (6 ou 7 dígitos)
      if (lote.header?.codigoConvenio) {
        const convenio = lote.header.codigoConvenio.toString();
        if (convenio.length < 6 || convenio.length > 7) {
          resultado.erros.push(
            `Lote ${numeroLote}: Convênio BB deve ter 6 ou 7 dígitos (encontrado: ${convenio.length})`
          );
          resultado.valido = false;
          resultado.detalhes.validacoesEspecificas.regrasConvenio = false;
        }
      }

      // BB: Validar carteira de cobrança se aplicável
      if (lote.detalhes) {
        lote.detalhes.forEach((detalhe, detIndex) => {
          if (detalhe.segmento === 'A' && detalhe.carteira) {
            const carteirasValidas = ['11', '12', '15', '16', '17', '18', '31', '51'];
            if (!carteirasValidas.includes(detalhe.carteira)) {
              resultado.avisos.push(
                `Lote ${numeroLote}, Detalhe ${detIndex + 1}: ` +
                `Carteira ${detalhe.carteira} pode não ser válida para BB`
              );
            }
          }
        });
      }
    });
  }

  /**
   * Validações específicas da Caixa Econômica Federal
   */
  static validarCaixaEconomica(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Caixa Econômica Federal');

    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      // CEF: Validar código do beneficiário
      if (lote.header?.codigoBeneficiario) {
        const beneficiario = lote.header.codigoBeneficiario.toString();
        if (beneficiario.length !== 7) {
          resultado.erros.push(
            `Lote ${numeroLote}: Código do beneficiário CEF deve ter 7 dígitos`
          );
          resultado.valido = false;
          resultado.detalhes.validacoesEspecificas.regrasConvenio = false;
        }
      }

      // CEF: Validar modalidade da carteira
      if (lote.detalhes) {
        lote.detalhes.forEach((detalhe, detIndex) => {
          if (detalhe.segmento === 'A' && detalhe.modalidadeCarteira) {
            const modalidadesValidas = ['01', '02', '03', '04', '05', '06', '07'];
            if (!modalidadesValidas.includes(detalhe.modalidadeCarteira)) {
              resultado.avisos.push(
                `Lote ${numeroLote}, Detalhe ${detIndex + 1}: ` +
                `Modalidade de carteira ${detalhe.modalidadeCarteira} pode não ser válida para CEF`
              );
            }
          }
        });
      }
    });
  }

  /**
   * Validações específicas do Bradesco
   */
  static validarBradesco(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Bradesco');

    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      // Bradesco: Validar formato da agência (4 dígitos + DV)
      if (lote.header?.agencia) {
        const agencia = lote.header.agencia.toString().replace(/\D/g, '');
        if (agencia.length < 4 || agencia.length > 5) {
          resultado.avisos.push(
            `Lote ${numeroLote}: Formato de agência Bradesco incomum (${lote.header.agencia})`
          );
        }
      }

      // Bradesco: Validar carteiras específicas
      if (lote.detalhes) {
        lote.detalhes.forEach((detalhe, detIndex) => {
          if (detalhe.segmento === 'A' && detalhe.carteira) {
            const carteirasValidas = ['03', '06', '09', '19', '21', '22', '25', '26'];
            if (!carteirasValidas.includes(detalhe.carteira)) {
              resultado.avisos.push(
                `Lote ${numeroLote}, Detalhe ${detIndex + 1}: ` +
                `Carteira ${detalhe.carteira} pode não ser válida para Bradesco`
              );
            }
          }
        });
      }
    });
  }

  /**
   * Validações específicas do Itaú Unibanco
   */
  static validarItau(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Itaú Unibanco');

    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      // Itaú: Validar formato do nosso número
      if (lote.detalhes) {
        lote.detalhes.forEach((detalhe, detIndex) => {
          if (detalhe.segmento === 'A' && detalhe.nossoNumero) {
            const nossoNumero = detalhe.nossoNumero.toString();

            // Itaú geralmente usa 8 dígitos + DV
            if (nossoNumero.length < 8 || nossoNumero.length > 10) {
              resultado.avisos.push(
                `Lote ${numeroLote}, Detalhe ${detIndex + 1}: ` +
                `Formato de nosso número Itaú incomum (${nossoNumero.length} dígitos)`
              );
            }
          }
        });
      }
    });
  }

  /**
   * Validações específicas do Santander
   */
  static validarSantander(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Santander');

    // Santander: validações específicas podem ser implementadas aqui
    resultado.avisos.push('Validações específicas do Santander em desenvolvimento');
  }

  /**
   * Validações específicas do Bancoob
   */
  static validarBancoob(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Bancoob');

    // Bancoob: validações específicas podem ser implementadas aqui
    resultado.avisos.push('Validações específicas do Bancoob em desenvolvimento');
  }

  /**
   * Validações específicas do Sicredi
   */
  static validarSicredi(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Sicredi');

    // Sicredi: validações específicas podem ser implementadas aqui
    resultado.avisos.push('Validações específicas do Sicredi em desenvolvimento');
  }

  /**
   * Validações específicas do Nubank
   */
  static validarNubank(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Nu Pagamentos');

    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      // Nubank: Focado em PIX, validar operações suportadas
      const codigoOperacao = lote.header?.codigoConvenio;
      if (codigoOperacao && !codigoOperacao.toString().startsWith('204')) {
        resultado.avisos.push(
          `Lote ${numeroLote}: Nubank focado em operações PIX, verificar operação ${codigoOperacao}`
        );
      }
    });
  }

  /**
   * Validações específicas do Banco Inter
   */
  static validarBancoInter(dadosProcessados, configuracaoBanco, resultado) {
    resultado.detalhes.regrasAplicadas.push('Banco Inter');

    // Banco Inter: validações específicas podem ser implementadas aqui
    resultado.avisos.push('Validações específicas do Banco Inter em desenvolvimento');
  }

  /**
   * Valida formatos específicos de campos por banco
   */
  static validarFormatosEspecificos(codigoBanco, dadosProcessados, resultado) {
    if (!dadosProcessados.lotes) return;

    dadosProcessados.lotes.forEach((lote, loteIndex) => {
      if (!lote.detalhes) return;

      lote.detalhes.forEach((detalhe, detIndex) => {
        // Validar formato de agência/conta conforme padrão do banco
        this.validarFormatoAgenciaConta(codigoBanco, detalhe, loteIndex + 1, detIndex + 1, resultado);

        // Validar formato de documentos específicos
        this.validarFormatoDocumentos(codigoBanco, detalhe, loteIndex + 1, detIndex + 1, resultado);
      });
    });
  }

  /**
   * Valida formato de agência/conta específico do banco
   */
  static validarFormatoAgenciaConta(codigoBanco, detalhe, numeroLote, numeroDetalhe, resultado) {
    const padroes = {
      '001': { agencia: 4, conta: [8, 9] }, // Banco do Brasil
      '104': { agencia: 4, conta: [8, 11] }, // CEF
      '237': { agencia: 4, conta: 7 }, // Bradesco
      '341': { agencia: 4, conta: [5, 6] }, // Itaú
      '033': { agencia: 4, conta: [8, 9] }  // Santander
    };

    const padrao = padroes[codigoBanco];
    if (!padrao) return;

    // Validar agência
    if (detalhe.agenciaFavorecido) {
      const agencia = detalhe.agenciaFavorecido.toString().replace(/\D/g, '');
      if (agencia.length !== padrao.agencia) {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `Formato de agência incomum para ${this.obterNomeBanco(codigoBanco)} ` +
          `(esperado: ${padrao.agencia} dígitos, encontrado: ${agencia.length})`
        );
        resultado.detalhes.validacoesEspecificas.formatoCampos = false;
      }
    }

    // Validar conta
    if (detalhe.contaFavorecido) {
      const conta = detalhe.contaFavorecido.toString().replace(/\D/g, '');
      const tamanhosConta = Array.isArray(padrao.conta) ? padrao.conta : [padrao.conta];

      if (!tamanhosConta.includes(conta.length)) {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `Formato de conta incomum para ${this.obterNomeBanco(codigoBanco)} ` +
          `(esperado: ${tamanhosConta.join(' ou ')} dígitos, encontrado: ${conta.length})`
        );
        resultado.detalhes.validacoesEspecificas.formatoCampos = false;
      }
    }
  }

  /**
   * Valida formato de documentos específicos do banco
   */
  static validarFormatoDocumentos(codigoBanco, detalhe, numeroLote, numeroDetalhe, resultado) {
    // Validações genéricas de formato de documentos
    if (detalhe.cpfCnpjFavorecido) {
      const documento = detalhe.cpfCnpjFavorecido.toString().replace(/\D/g, '');

      if (documento.length !== 11 && documento.length !== 14) {
        resultado.erros.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `CPF/CNPJ deve ter 11 ou 14 dígitos (encontrado: ${documento.length})`
        );
        resultado.valido = false;
        resultado.detalhes.validacoesEspecificas.formatoCampos = false;
      }
    }
  }

  /**
   * Valida regras de convênio específicas do banco
   */
  static validarRegrasConvenio(codigoBanco, dadosProcessados, configuracaoBanco, resultado) {
    if (!configuracaoBanco?.operacoesSuportadas) return;

    dadosProcessados.lotes?.forEach((lote, index) => {
      const numeroLote = index + 1;
      const codigoOperacao = lote.header?.codigoConvenio;

      if (codigoOperacao) {
        const operacaoSuportada = configuracaoBanco.operacoesSuportadas.find(
          op => op.codigo === codigoOperacao.toString()
        );

        if (!operacaoSuportada) {
          resultado.avisos.push(
            `Lote ${numeroLote}: Operação ${codigoOperacao} não encontrada ` +
            `na configuração do banco ${codigoBanco}`
          );
          resultado.detalhes.validacoesEspecificas.regrasConvenio = false;
        }
      }
    });
  }

  /**
   * Valida limites operacionais específicos do banco
   */
  static validarLimitesOperacionais(codigoBanco, dadosProcessados, resultado) {
    const limitesPorBanco = {
      '260': { // Nubank
        valorMaximoPIX: 20000000, // R$ 200.000,00
        transacoesPorLote: 1000
      },
      '077': { // Banco Inter
        valorMaximoPIX: 50000000, // R$ 500.000,00
        transacoesPorLote: 5000
      }
      // Adicionar outros bancos conforme necessário
    };

    const limites = limitesPorBanco[codigoBanco];
    if (!limites) return;

    dadosProcessados.lotes?.forEach((lote, index) => {
      const numeroLote = index + 1;

      // Validar quantidade de transações por lote
      if (lote.detalhes && limites.transacoesPorLote) {
        if (lote.detalhes.length > limites.transacoesPorLote) {
          resultado.avisos.push(
            `Lote ${numeroLote}: Quantidade de transações (${lote.detalhes.length}) ` +
            `excede limite recomendado para ${this.obterNomeBanco(codigoBanco)} ` +
            `(${limites.transacoesPorLote})`
          );
          resultado.detalhes.validacoesEspecificas.limitesOperacionais = false;
        }
      }

      // Validar valores máximos
      if (lote.detalhes && limites.valorMaximoPIX) {
        lote.detalhes.forEach((detalhe, detIndex) => {
          if (detalhe.valor && detalhe.valor > limites.valorMaximoPIX) {
            resultado.avisos.push(
              `Lote ${numeroLote}, Detalhe ${detIndex + 1}: ` +
              `Valor (${detalhe.valor / 100}) excede limite PIX para ` +
              `${this.obterNomeBanco(codigoBanco)} (${limites.valorMaximoPIX / 100})`
            );
            resultado.detalhes.validacoesEspecificas.limitesOperacionais = false;
          }
        });
      }
    });
  }
}

export default BancoValidator; 