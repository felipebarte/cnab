/**
 * Validador de Regras de Negócio CNAB 240
 * 
 * Responsável por validar regras específicas de negócio baseadas
 * no tipo de operação, códigos de convênio e contexto dos dados.
 */

import { BANCOS_240 } from '../../../config/bancos240.js';

class NegocioValidator {
  /**
   * Valida regras de negócio do arquivo CNAB 240
   * @param {Object} dadosProcessados - Dados estruturados do arquivo
   * @returns {Object} Resultado da validação de negócio
   */
  static validar(dadosProcessados) {
    const resultado = {
      valido: true,
      erros: [],
      avisos: [],
      detalhes: {
        operacoesValidadas: [],
        regrasNegocio: {
          pix: { validas: true, violacoes: [] },
          cobranca: { validas: true, violacoes: [] },
          transferencia: { validas: true, violacoes: [] },
          pagamento: { validas: true, violacoes: [] }
        },
        limitesOperacionais: {
          respeitados: true,
          violacoes: []
        }
      }
    };

    try {
      // 1. Validar regras de negócio por lote
      if (dadosProcessados.lotes) {
        dadosProcessados.lotes.forEach((lote, index) => {
          this.validarRegrasLote(lote, index + 1, resultado);
        });
      }

      // 2. Validar regras globais do arquivo
      this.validarRegrasGlobais(dadosProcessados, resultado);

      // 3. Validar consistência entre lotes
      this.validarConsistenciaLotes(dadosProcessados, resultado);

      // 4. Validar limites operacionais
      this.validarLimitesOperacionais(dadosProcessados, resultado);

    } catch (error) {
      resultado.valido = false;
      resultado.erros.push(`Erro interno de validação de negócio: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Valida regras de negócio específicas de um lote
   */
  static validarRegrasLote(lote, numeroLote, resultado) {
    const codigoOperacao = lote.header?.codigoConvenio;

    if (!codigoOperacao) {
      resultado.erros.push(`Lote ${numeroLote}: Código de operação não encontrado`);
      resultado.valido = false;
      return;
    }

    // Identificar tipo de operação para aplicar regras específicas
    const tipoOperacao = this.identificarTipoOperacao(codigoOperacao);

    resultado.detalhes.operacoesValidadas.push({
      numeroLote,
      codigoOperacao,
      tipoOperacao
    });

    // Aplicar validações por tipo de operação
    switch (tipoOperacao) {
      case 'PIX':
        this.validarRegrasNegocioPIX(lote, numeroLote, resultado);
        break;
      case 'COBRANCA':
        this.validarRegrasNegocioCobranca(lote, numeroLote, resultado);
        break;
      case 'TRANSFERENCIA':
        this.validarRegrasNegocioTransferencia(lote, numeroLote, resultado);
        break;
      case 'PAGAMENTO':
        this.validarRegrasNegocioPagamento(lote, numeroLote, resultado);
        break;
      default:
        resultado.avisos.push(`Lote ${numeroLote}: Tipo de operação não reconhecido: ${tipoOperacao}`);
    }

    // Validar regras comuns a todos os tipos
    this.validarRegrasComuns(lote, numeroLote, resultado);
  }

  /**
   * Identifica o tipo de operação baseado no código
   */
  static identificarTipoOperacao(codigoOperacao) {
    const codigo = codigoOperacao.toString();

    if (codigo.startsWith('204')) return 'PIX';
    if (codigo.startsWith('2031')) return 'COBRANCA';
    if (codigo.startsWith('2041') || codigo.startsWith('2043')) return 'TRANSFERENCIA';
    if (codigo.startsWith('2030') || codigo.startsWith('2020')) return 'PAGAMENTO';
    if (codigo.startsWith('2050')) return 'DEBITO_AUTOMATICO';

    return 'DESCONHECIDO';
  }

  /**
   * Validações específicas para operações PIX
   */
  static validarRegrasNegocioPIX(lote, numeroLote, resultado) {
    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push(`Lote ${numeroLote}: Operação PIX deve conter detalhes`);
      resultado.valido = false;
      resultado.detalhes.regrasNegocio.pix.validas = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      const numeroDetalhe = index + 1;

      if (detalhe.segmento === 'A') {
        // Regra: PIX deve ter chave válida
        if (!detalhe.chavePix || detalhe.chavePix.trim() === '') {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: PIX sem chave informada`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pix.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pix.validas = false;
        }

        // Regra: Valor PIX deve ser positivo e não pode ser zero
        if (!detalhe.valor || detalhe.valor <= 0) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Valor PIX deve ser maior que zero`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pix.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pix.validas = false;
        }

        // Regra: PIX deve ter dados completos do favorecido
        if (!detalhe.nomeFavorecido || detalhe.nomeFavorecido.trim() === '') {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Nome do favorecido obrigatório para PIX`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pix.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pix.validas = false;
        }

        if (!detalhe.cpfCnpjFavorecido) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: CPF/CNPJ do favorecido obrigatório para PIX`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pix.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pix.validas = false;
        }

        // Regra de negócio: Validar limite PIX noturno/diurno
        this.validarLimitesPIX(detalhe, numeroLote, numeroDetalhe, resultado);

        // Regra: Validar formato da chave PIX
        if (detalhe.chavePix) {
          this.validarFormatoChavePIX(detalhe.chavePix, numeroLote, numeroDetalhe, resultado);
        }
      }

      if (detalhe.segmento === 'B') {
        // Validar informações complementares PIX
        if (detalhe.finalidadePix && !this.validarFinalidadePIX(detalhe.finalidadePix)) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Finalidade PIX inválida: ${detalhe.finalidadePix}`;
          resultado.avisos.push(violacao);
          resultado.detalhes.regrasNegocio.pix.violacoes.push(violacao);
        }
      }
    });
  }

  /**
   * Validações específicas para operações de cobrança
   */
  static validarRegrasNegocioCobranca(lote, numeroLote, resultado) {
    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push(`Lote ${numeroLote}: Operação de cobrança deve conter detalhes`);
      resultado.valido = false;
      resultado.detalhes.regrasNegocio.cobranca.validas = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      const numeroDetalhe = index + 1;

      if (detalhe.segmento === 'A') {
        // Regra: Nosso número é obrigatório
        if (!detalhe.nossoNumero || detalhe.nossoNumero.trim() === '') {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Nosso número obrigatório para cobrança`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.cobranca.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.cobranca.validas = false;
        }

        // Regra: Data de vencimento é obrigatória
        if (!detalhe.dataVencimento) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Data de vencimento obrigatória`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.cobranca.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.cobranca.validas = false;
        } else {
          // Validar se a data não é muito antiga
          this.validarDataVencimentoCobranca(detalhe.dataVencimento, numeroLote, numeroDetalhe, resultado);
        }

        // Regra: Valor do título deve ser positivo
        if (!detalhe.valorTitulo || detalhe.valorTitulo <= 0) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Valor do título deve ser positivo`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.cobranca.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.cobranca.validas = false;
        }

        // Regra: Dados do sacado são obrigatórios
        if (!detalhe.nomeSacado || detalhe.nomeSacado.trim() === '') {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Nome do sacado obrigatório`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.cobranca.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.cobranca.validas = false;
        }

        if (!detalhe.cpfCnpjSacado) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: CPF/CNPJ do sacado obrigatório`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.cobranca.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.cobranca.validas = false;
        }

        // Regra: Carteira deve estar preenchida
        if (!detalhe.carteira) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Carteira obrigatória para cobrança`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.cobranca.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.cobranca.validas = false;
        }
      }
    });
  }

  /**
   * Validações específicas para transferências
   */
  static validarRegrasNegocioTransferencia(lote, numeroLote, resultado) {
    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push(`Lote ${numeroLote}: Operação de transferência deve conter detalhes`);
      resultado.valido = false;
      resultado.detalhes.regrasNegocio.transferencia.validas = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      const numeroDetalhe = index + 1;

      if (detalhe.segmento === 'A') {
        // Regra: Dados bancários completos do favorecido
        if (!detalhe.bancoFavorecido || detalhe.bancoFavorecido.toString().length !== 3) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Código do banco favorecido deve ter 3 dígitos`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.transferencia.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.transferencia.validas = false;
        }

        if (!detalhe.agenciaFavorecido) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Agência do favorecido obrigatória`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.transferencia.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.transferencia.validas = false;
        }

        if (!detalhe.contaFavorecido) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Conta do favorecido obrigatória`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.transferencia.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.transferencia.validas = false;
        }

        // Regra: Valor deve ser positivo
        if (!detalhe.valor || detalhe.valor <= 0) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Valor da transferência deve ser positivo`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.transferencia.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.transferencia.validas = false;
        }

        // Regra: Dados do favorecido obrigatórios
        if (!detalhe.nomeFavorecido || detalhe.nomeFavorecido.trim() === '') {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Nome do favorecido obrigatório`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.transferencia.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.transferencia.validas = false;
        }

        if (!detalhe.cpfCnpjFavorecido) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: CPF/CNPJ do favorecido obrigatório`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.transferencia.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.transferencia.validas = false;
        }

        // Regra de negócio: Validar se não é transferência para a mesma conta (circular)
        this.validarTransferenciaCircular(lote, detalhe, numeroLote, numeroDetalhe, resultado);
      }
    });
  }

  /**
   * Validações específicas para pagamentos
   */
  static validarRegrasNegocioPagamento(lote, numeroLote, resultado) {
    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push(`Lote ${numeroLote}: Operação de pagamento deve conter detalhes`);
      resultado.valido = false;
      resultado.detalhes.regrasNegocio.pagamento.validas = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      const numeroDetalhe = index + 1;

      if (detalhe.segmento === 'A') {
        // Regra: Código de barras OU linha digitável obrigatório
        if (!detalhe.codigoBarras && !detalhe.linhaDigitavel) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Código de barras ou linha digitável obrigatório`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pagamento.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pagamento.validas = false;
        }

        // Regra: Valor deve ser positivo
        if (!detalhe.valor || detalhe.valor <= 0) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Valor do pagamento deve ser positivo`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pagamento.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pagamento.validas = false;
        }

        // Regra: Data de pagamento obrigatória
        if (!detalhe.dataPagamento) {
          const violacao = `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: Data de pagamento obrigatória`;
          resultado.erros.push(violacao);
          resultado.detalhes.regrasNegocio.pagamento.violacoes.push(violacao);
          resultado.valido = false;
          resultado.detalhes.regrasNegocio.pagamento.validas = false;
        }

        // Regra de negócio: Validar se data de pagamento não é anterior à data atual
        if (detalhe.dataPagamento) {
          this.validarDataPagamento(detalhe.dataPagamento, numeroLote, numeroDetalhe, resultado);
        }
      }
    });
  }

  /**
   * Validações comuns a todos os tipos de operação
   */
  static validarRegrasComuns(lote, numeroLote, resultado) {
    // Validar se o lote tem pelo menos um detalhe
    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.avisos.push(`Lote ${numeroLote}: Lote sem detalhes`);
      return;
    }

    // Validar sequencialidade dos detalhes
    lote.detalhes.forEach((detalhe, index) => {
      const numeroEsperado = index + 1;
      if (detalhe.numeroSequencial && detalhe.numeroSequencial !== numeroEsperado) {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${index + 1}: ` +
          `Número sequencial inconsistente (esperado: ${numeroEsperado}, encontrado: ${detalhe.numeroSequencial})`
        );
      }
    });

    // Validar documentos obrigatórios (CPF/CNPJ)
    lote.detalhes.forEach((detalhe, index) => {
      const numeroDetalhe = index + 1;

      // Validar CPF/CNPJ quando presente
      if (detalhe.cpfCnpjFavorecido) {
        this.validarDocumento(detalhe.cpfCnpjFavorecido, 'favorecido', numeroLote, numeroDetalhe, resultado);
      }

      if (detalhe.cpfCnpjSacado) {
        this.validarDocumento(detalhe.cpfCnpjSacado, 'sacado', numeroLote, numeroDetalhe, resultado);
      }
    });
  }

  /**
   * Validar regras globais do arquivo
   */
  static validarRegrasGlobais(dadosProcessados, resultado) {
    // Validar se existe pelo menos um lote
    if (!dadosProcessados.lotes || dadosProcessados.lotes.length === 0) {
      resultado.erros.push('Arquivo deve conter pelo menos um lote');
      resultado.valido = false;
      return;
    }

    // Validar se header e trailer do arquivo existem
    if (!dadosProcessados.headerArquivo) {
      resultado.erros.push('Header do arquivo é obrigatório');
      resultado.valido = false;
    }

    if (!dadosProcessados.trailerArquivo) {
      resultado.erros.push('Trailer do arquivo é obrigatório');
      resultado.valido = false;
    }

    // Validar dados do header
    if (dadosProcessados.headerArquivo) {
      if (!dadosProcessados.headerArquivo.codigoBanco) {
        resultado.erros.push('Código do banco é obrigatório no header');
        resultado.valido = false;
      }

      if (!dadosProcessados.headerArquivo.tipoInscricao || !dadosProcessados.headerArquivo.numeroInscricao) {
        resultado.erros.push('Dados de inscrição da empresa são obrigatórios no header');
        resultado.valido = false;
      }
    }
  }

  /**
   * Validar consistência entre lotes
   */
  static validarConsistenciaLotes(dadosProcessados, resultado) {
    if (!dadosProcessados.lotes || dadosProcessados.lotes.length < 2) {
      return; // Nada a validar se há menos de 2 lotes
    }

    // Validar se todos os lotes são do mesmo banco
    const codigoBanco = dadosProcessados.headerArquivo?.codigoBanco;

    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroLote = index + 1;

      if (lote.header?.codigoBanco && lote.header.codigoBanco !== codigoBanco) {
        resultado.avisos.push(
          `Lote ${numeroLote}: Código do banco (${lote.header.codigoBanco}) ` +
          `difere do header do arquivo (${codigoBanco})`
        );
      }
    });

    // Validar numeração sequencial dos lotes
    dadosProcessados.lotes.forEach((lote, index) => {
      const numeroEsperado = index + 1;
      const numeroLote = lote.header?.numeroLote;

      if (numeroLote && numeroLote !== numeroEsperado) {
        resultado.avisos.push(
          `Lote ${index + 1}: Numeração inconsistente ` +
          `(esperado: ${numeroEsperado}, encontrado: ${numeroLote})`
        );
      }
    });
  }

  /**
   * Validar limites operacionais gerais
   */
  static validarLimitesOperacionais(dadosProcessados, resultado) {
    let totalTransacoes = 0;
    let valorTotal = 0;

    dadosProcessados.lotes?.forEach((lote, index) => {
      const numeroLote = index + 1;

      if (lote.detalhes) {
        totalTransacoes += lote.detalhes.length;

        // Calcular valor total do lote
        const valorLote = lote.detalhes.reduce((soma, detalhe) => {
          return soma + (detalhe.valor || 0);
        }, 0);

        valorTotal += valorLote;

        // Validar limite de transações por lote (10.000 é um limite comum)
        if (lote.detalhes.length > 10000) {
          const violacao = `Lote ${numeroLote}: Muitas transações (${lote.detalhes.length}), limite recomendado: 10.000`;
          resultado.avisos.push(violacao);
          resultado.detalhes.limitesOperacionais.violacoes.push(violacao);
          resultado.detalhes.limitesOperacionais.respeitados = false;
        }

        // Validar valor máximo por lote (R$ 1.000.000,00 = 100.000.000 centavos)
        if (valorLote > 10000000000) { // 100 milhões de centavos
          const violacao = `Lote ${numeroLote}: Valor muito alto (R$ ${(valorLote / 100).toFixed(2)}), verificar limite`;
          resultado.avisos.push(violacao);
          resultado.detalhes.limitesOperacionais.violacoes.push(violacao);
          resultado.detalhes.limitesOperacionais.respeitados = false;
        }
      }
    });

    // Validar totais gerais do arquivo
    if (totalTransacoes > 50000) {
      const violacao = `Arquivo com muitas transações (${totalTransacoes}), verificar performance`;
      resultado.avisos.push(violacao);
      resultado.detalhes.limitesOperacionais.violacoes.push(violacao);
    }

    if (valorTotal > 50000000000) { // 500 milhões de centavos
      const violacao = `Valor total do arquivo muito alto (R$ ${(valorTotal / 100).toFixed(2)}), verificar limite`;
      resultado.avisos.push(violacao);
      resultado.detalhes.limitesOperacionais.violacoes.push(violacao);
    }
  }

  // Métodos auxiliares de validação

  static validarLimitesPIX(detalhe, numeroLote, numeroDetalhe, resultado) {
    if (!detalhe.valor) return;

    // Limite PIX padrão diurno: R$ 20.000,00
    if (detalhe.valor > 2000000) {
      resultado.avisos.push(
        `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
        `Valor PIX (R$ ${(detalhe.valor / 100).toFixed(2)}) acima do limite diurno padrão (R$ 20.000,00)`
      );
    }
  }

  static validarFormatoChavePIX(chavePix, numeroLote, numeroDetalhe, resultado) {
    const chave = chavePix.toString().trim();

    // Validar formatos básicos de chave PIX
    const formatosValidos = [
      /^\d{11}$/, // CPF
      /^\d{14}$/, // CNPJ
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email
      /^(\+55)?\d{10,11}$/, // Telefone
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i // UUID
    ];

    const formatoValido = formatosValidos.some(regex => regex.test(chave));

    if (!formatoValido) {
      resultado.avisos.push(
        `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
        `Formato de chave PIX não reconhecido: ${chave}`
      );
    }
  }

  static validarFinalidadePIX(finalidade) {
    const finalidadesValidas = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'
    ];

    return finalidadesValidas.includes(finalidade?.toString());
  }

  static validarDataVencimentoCobranca(dataVencimento, numeroLote, numeroDetalhe, resultado) {
    try {
      const vencimento = new Date(dataVencimento);
      const hoje = new Date();
      const diffDias = (vencimento - hoje) / (1000 * 60 * 60 * 24);

      // Avisar se título está vencido há mais de 30 dias
      if (diffDias < -30) {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `Título vencido há mais de 30 dias (${dataVencimento})`
        );
      }

      // Avisar se vencimento é muito no futuro (mais de 2 anos)
      if (diffDias > 730) {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `Vencimento muito distante (${dataVencimento})`
        );
      }
    } catch (error) {
      resultado.erros.push(
        `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
        `Data de vencimento inválida: ${dataVencimento}`
      );
      resultado.valido = false;
    }
  }

  static validarDataPagamento(dataPagamento, numeroLote, numeroDetalhe, resultado) {
    try {
      const pagamento = new Date(dataPagamento);
      const hoje = new Date();
      const diffDias = (pagamento - hoje) / (1000 * 60 * 60 * 24);

      // Avisar se data de pagamento é muito anterior
      if (diffDias < -30) {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `Data de pagamento muito anterior (${dataPagamento})`
        );
      }
    } catch (error) {
      resultado.erros.push(
        `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
        `Data de pagamento inválida: ${dataPagamento}`
      );
      resultado.valido = false;
    }
  }

  static validarTransferenciaCircular(lote, detalhe, numeroLote, numeroDetalhe, resultado) {
    // Verificar se não está transferindo para a mesma conta
    const agenciaOrigem = lote.header?.agencia;
    const contaOrigem = lote.header?.conta;
    const bancoOrigem = lote.header?.codigoBanco;

    if (agenciaOrigem && contaOrigem && bancoOrigem &&
      detalhe.agenciaFavorecido && detalhe.contaFavorecido && detalhe.bancoFavorecido) {

      if (bancoOrigem === detalhe.bancoFavorecido &&
        agenciaOrigem === detalhe.agenciaFavorecido &&
        contaOrigem === detalhe.contaFavorecido) {

        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `Possível transferência circular (mesma conta origem e destino)`
        );
      }
    }
  }

  static validarDocumento(documento, tipo, numeroLote, numeroDetalhe, resultado) {
    const doc = documento.toString().replace(/\D/g, '');

    if (doc.length === 11) {
      // Validação básica de CPF
      if (!/^\d{11}$/.test(doc) || doc === '00000000000') {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `CPF do ${tipo} pode ser inválido: ${documento}`
        );
      }
    } else if (doc.length === 14) {
      // Validação básica de CNPJ
      if (!/^\d{14}$/.test(doc) || doc === '00000000000000') {
        resultado.avisos.push(
          `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
          `CNPJ do ${tipo} pode ser inválido: ${documento}`
        );
      }
    } else {
      resultado.erros.push(
        `Lote ${numeroLote}, Detalhe ${numeroDetalhe}: ` +
        `Documento do ${tipo} deve ter 11 (CPF) ou 14 (CNPJ) dígitos: ${documento}`
      );
      resultado.valido = false;
    }
  }
}

export default NegocioValidator; 