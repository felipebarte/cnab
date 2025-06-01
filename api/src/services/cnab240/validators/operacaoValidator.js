/**
 * Validador por Código de Operação CNAB 240
 * 
 * Responsável por aplicar validações específicas baseadas no
 * código de operação/convênio, garantindo que os dados estejam
 * corretos para cada tipo de transação.
 */

import { BANCOS_240 } from '../../../config/bancos240.js';

class OperacaoValidator {
  /**
   * Valida um lote específico baseado no código de operação
   * @param {Object} lote - Lote a ser validado
   * @param {Object} configuracaoBanco - Configuração específica do banco
   * @returns {Object} Resultado da validação por operação
   */
  static validar(lote, configuracaoBanco) {
    const resultado = {
      valido: true,
      erros: [],
      avisos: [],
      detalhes: {
        numeroLote: lote.header?.numeroLote,
        codigoOperacao: lote.header?.codigoConvenio,
        tipoOperacao: null,
        validacoesAplicadas: [],
        configOperacao: null
      }
    };

    try {
      const codigoOperacao = lote.header?.codigoConvenio;

      if (!codigoOperacao) {
        resultado.erros.push('Código de operação não encontrado no header do lote');
        resultado.valido = false;
        return resultado;
      }

      // 1. Identificar tipo de operação
      resultado.detalhes.tipoOperacao = this.identificarTipoOperacao(codigoOperacao);

      // 2. Buscar configuração específica da operação
      resultado.detalhes.configOperacao = this.buscarConfiguracaoOperacao(
        codigoOperacao,
        configuracaoBanco
      );

      // 3. Validar operação contra configuração do banco
      this.validarOperacaoSuportada(codigoOperacao, configuracaoBanco, resultado);

      // 4. Aplicar validações específicas por tipo de operação
      this.aplicarValidacoesEspecificas(lote, resultado);

      // 5. Validar formato de dados específicos da operação
      this.validarFormatoDadosOperacao(lote, resultado);

      // 6. Validar regras de negócio específicas
      this.validarRegrasNegocioOperacao(lote, resultado);

    } catch (error) {
      resultado.valido = false;
      resultado.erros.push(`Erro interno de validação por operação: ${error.message}`);
    }

    return resultado;
  }

  /**
   * Identifica o tipo de operação baseado no código
   */
  static identificarTipoOperacao(codigoOperacao) {
    const codigo = codigoOperacao?.toString();

    // PIX
    if (codigo?.match(/^204[5-7]/)) {
      if (codigo.startsWith('2045')) return 'PIX_TRANSFERENCIA';
      if (codigo.startsWith('2046')) return 'PIX_SAQUE';
      if (codigo.startsWith('2047')) return 'PIX_PAGAMENTO';
      return 'PIX';
    }

    // Cobrança
    if (codigo?.startsWith('2031')) {
      if (codigo === '203101') return 'COBRANCA_SIMPLES';
      if (codigo === '203102') return 'COBRANCA_VINCULADA';
      if (codigo === '203103') return 'COBRANCA_CAUCIONADA';
      if (codigo === '203104') return 'COBRANCA_DESCONTADA';
      return 'COBRANCA';
    }

    // Transferência
    if (codigo?.startsWith('2041') || codigo?.startsWith('2043')) {
      if (codigo.startsWith('2041')) return 'TRANSFERENCIA_CREDITO_CONTA';
      if (codigo.startsWith('2043')) return 'TRANSFERENCIA_DOC_TED';
      return 'TRANSFERENCIA';
    }

    // Pagamento
    if (codigo?.startsWith('2030') || codigo?.startsWith('2020')) {
      if (codigo.startsWith('2030')) return 'PAGAMENTO_FORNECEDOR';
      if (codigo.startsWith('2020')) return 'PAGAMENTO_TRIBUTO';
      return 'PAGAMENTO';
    }

    // Débito
    if (codigo?.startsWith('2050')) {
      return 'DEBITO_AUTOMATICO';
    }

    return 'DESCONHECIDO';
  }

  /**
   * Busca configuração específica da operação
   */
  static buscarConfiguracaoOperacao(codigoOperacao, configuracaoBanco) {
    if (!configuracaoBanco?.operacoesSuportadas) {
      return null;
    }

    return configuracaoBanco.operacoesSuportadas.find(
      op => op.codigo === codigoOperacao.toString()
    );
  }

  /**
   * Valida se a operação é suportada pelo banco
   */
  static validarOperacaoSuportada(codigoOperacao, configuracaoBanco, resultado) {
    if (!configuracaoBanco?.operacoesSuportadas) {
      resultado.avisos.push('Configuração de operações suportadas não fornecida');
      return;
    }

    const operacaoSuportada = configuracaoBanco.operacoesSuportadas.find(
      op => op.codigo === codigoOperacao.toString()
    );

    if (!operacaoSuportada) {
      resultado.erros.push(
        `Operação ${codigoOperacao} não está configurada como suportada pelo banco`
      );
      resultado.valido = false;
    } else {
      resultado.detalhes.validacoesAplicadas.push(
        `Operação ${codigoOperacao} validada contra configuração: ${operacaoSuportada.nome}`
      );
    }
  }

  /**
   * Aplica validações específicas por tipo de operação
   */
  static aplicarValidacoesEspecificas(lote, resultado) {
    const tipoOperacao = resultado.detalhes.tipoOperacao;

    switch (tipoOperacao) {
      case 'PIX':
      case 'PIX_TRANSFERENCIA':
      case 'PIX_PAGAMENTO':
        this.validarOperacaoPIX(lote, resultado);
        break;

      case 'PIX_SAQUE':
        this.validarOperacaoPixSaque(lote, resultado);
        break;

      case 'COBRANCA':
      case 'COBRANCA_SIMPLES':
      case 'COBRANCA_VINCULADA':
      case 'COBRANCA_CAUCIONADA':
      case 'COBRANCA_DESCONTADA':
        this.validarOperacaoCobranca(lote, resultado);
        break;

      case 'TRANSFERENCIA':
      case 'TRANSFERENCIA_CREDITO_CONTA':
      case 'TRANSFERENCIA_DOC_TED':
        this.validarOperacaoTransferencia(lote, resultado);
        break;

      case 'PAGAMENTO':
      case 'PAGAMENTO_FORNECEDOR':
      case 'PAGAMENTO_TRIBUTO':
        this.validarOperacaoPagamento(lote, resultado);
        break;

      case 'DEBITO_AUTOMATICO':
        this.validarOperacaoDebitoAutomatico(lote, resultado);
        break;

      default:
        resultado.avisos.push(`Validações específicas não implementadas para: ${tipoOperacao}`);
        break;
    }
  }

  /**
   * Validações específicas para operações PIX
   */
  static validarOperacaoPIX(lote, resultado) {
    resultado.detalhes.validacoesAplicadas.push('Validação PIX');

    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push('Operação PIX deve conter detalhes');
      resultado.valido = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      if (detalhe.segmento === 'A') {
        // Validar chave PIX obrigatória
        if (!detalhe.chavePix || detalhe.chavePix.trim() === '') {
          resultado.erros.push(`Detalhe ${index + 1}: Chave PIX é obrigatória`);
          resultado.valido = false;
        } else {
          // Validar formato da chave PIX
          this.validarFormatoChavePIX(detalhe.chavePix, index + 1, resultado);
        }

        // Validar valor PIX
        if (!detalhe.valor || detalhe.valor <= 0) {
          resultado.erros.push(`Detalhe ${index + 1}: Valor PIX deve ser maior que zero`);
          resultado.valido = false;
        }

        // Validar dados do favorecido
        if (!detalhe.nomeFavorecido || detalhe.nomeFavorecido.trim() === '') {
          resultado.erros.push(`Detalhe ${index + 1}: Nome do favorecido é obrigatório para PIX`);
          resultado.valido = false;
        }

        if (!detalhe.cpfCnpjFavorecido) {
          resultado.erros.push(`Detalhe ${index + 1}: CPF/CNPJ do favorecido é obrigatório para PIX`);
          resultado.valido = false;
        }
      }

      if (detalhe.segmento === 'B') {
        // Validar informações complementares do PIX
        if (detalhe.finalidadePix && !this.validarCodigoFinalidadePIX(detalhe.finalidadePix)) {
          resultado.erros.push(
            `Detalhe ${index + 1}: Código de finalidade PIX inválido: ${detalhe.finalidadePix}`
          );
          resultado.valido = false;
        }
      }
    });
  }

  /**
   * Validações específicas para PIX Saque
   */
  static validarOperacaoPixSaque(lote, resultado) {
    resultado.detalhes.validacoesAplicadas.push('Validação PIX Saque');

    // PIX Saque tem regras específicas diferentes do PIX normal
    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push('Operação PIX Saque deve conter detalhes');
      resultado.valido = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      if (detalhe.segmento === 'A') {
        // Para PIX Saque, a chave pode ser opcional em alguns casos
        if (detalhe.chavePix) {
          this.validarFormatoChavePIX(detalhe.chavePix, index + 1, resultado);
        }

        // Validar valor do saque
        if (!detalhe.valor || detalhe.valor <= 0) {
          resultado.erros.push(`Detalhe ${index + 1}: Valor do saque deve ser maior que zero`);
          resultado.valido = false;
        }

        // Validar limites de saque PIX
        if (detalhe.valor > 50000) { // R$ 500,00 limite padrão PIX Saque
          resultado.avisos.push(
            `Detalhe ${index + 1}: Valor do saque (R$ ${(detalhe.valor / 100).toFixed(2)}) ` +
            `excede limite padrão PIX Saque (R$ 500,00)`
          );
        }
      }
    });
  }

  /**
   * Validações específicas para operações de cobrança
   */
  static validarOperacaoCobranca(lote, resultado) {
    resultado.detalhes.validacoesAplicadas.push('Validação Cobrança');

    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push('Operação de cobrança deve conter detalhes');
      resultado.valido = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      if (detalhe.segmento === 'A') {
        // Validar nosso número obrigatório
        if (!detalhe.nossoNumero || detalhe.nossoNumero.trim() === '') {
          resultado.erros.push(`Detalhe ${index + 1}: Nosso número é obrigatório para cobrança`);
          resultado.valido = false;
        }

        // Validar data de vencimento
        if (!detalhe.dataVencimento) {
          resultado.erros.push(`Detalhe ${index + 1}: Data de vencimento é obrigatória`);
          resultado.valido = false;
        } else {
          this.validarDataVencimento(detalhe.dataVencimento, index + 1, resultado);
        }

        // Validar valor do título
        if (!detalhe.valorTitulo || detalhe.valorTitulo <= 0) {
          resultado.erros.push(`Detalhe ${index + 1}: Valor do título deve ser maior que zero`);
          resultado.valido = false;
        }

        // Validar carteira
        if (!detalhe.carteira) {
          resultado.erros.push(`Detalhe ${index + 1}: Carteira é obrigatória para cobrança`);
          resultado.valido = false;
        }

        // Validar dados do sacado
        if (!detalhe.nomeSacado || detalhe.nomeSacado.trim() === '') {
          resultado.erros.push(`Detalhe ${index + 1}: Nome do sacado é obrigatório`);
          resultado.valido = false;
        }

        if (!detalhe.cpfCnpjSacado) {
          resultado.erros.push(`Detalhe ${index + 1}: CPF/CNPJ do sacado é obrigatório`);
          resultado.valido = false;
        }
      }
    });
  }

  /**
   * Validações específicas para transferências
   */
  static validarOperacaoTransferencia(lote, resultado) {
    resultado.detalhes.validacoesAplicadas.push('Validação Transferência');

    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push('Operação de transferência deve conter detalhes');
      resultado.valido = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      if (detalhe.segmento === 'A') {
        // Validar dados bancários do favorecido
        if (!detalhe.bancoFavorecido || detalhe.bancoFavorecido.length !== 3) {
          resultado.erros.push(
            `Detalhe ${index + 1}: Código do banco favorecido deve ter 3 dígitos`
          );
          resultado.valido = false;
        }

        if (!detalhe.agenciaFavorecido) {
          resultado.erros.push(`Detalhe ${index + 1}: Agência do favorecido é obrigatória`);
          resultado.valido = false;
        }

        if (!detalhe.contaFavorecido) {
          resultado.erros.push(`Detalhe ${index + 1}: Conta do favorecido é obrigatória`);
          resultado.valido = false;
        }

        // Validar valor da transferência
        if (!detalhe.valor || detalhe.valor <= 0) {
          resultado.erros.push(`Detalhe ${index + 1}: Valor da transferência deve ser maior que zero`);
          resultado.valido = false;
        }

        // Validar dados do favorecido
        if (!detalhe.nomeFavorecido || detalhe.nomeFavorecido.trim() === '') {
          resultado.erros.push(`Detalhe ${index + 1}: Nome do favorecido é obrigatório`);
          resultado.valido = false;
        }

        if (!detalhe.cpfCnpjFavorecido) {
          resultado.erros.push(`Detalhe ${index + 1}: CPF/CNPJ do favorecido é obrigatório`);
          resultado.valido = false;
        }

        // Validar tipo de conta
        if (detalhe.tipoContaFavorecido &&
          !['01', '02', '03', '13'].includes(detalhe.tipoContaFavorecido)) {
          resultado.avisos.push(
            `Detalhe ${index + 1}: Tipo de conta ${detalhe.tipoContaFavorecido} pode não ser válido`
          );
        }
      }
    });
  }

  /**
   * Validações específicas para pagamentos
   */
  static validarOperacaoPagamento(lote, resultado) {
    resultado.detalhes.validacoesAplicadas.push('Validação Pagamento');

    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push('Operação de pagamento deve conter detalhes');
      resultado.valido = false;
      return;
    }

    lote.detalhes.forEach((detalhe, index) => {
      if (detalhe.segmento === 'A') {
        // Validar código de barras OU linha digitável
        if (!detalhe.codigoBarras && !detalhe.linhaDigitavel) {
          resultado.erros.push(
            `Detalhe ${index + 1}: Código de barras ou linha digitável é obrigatório`
          );
          resultado.valido = false;
        }

        // Validar formato do código de barras se presente
        if (detalhe.codigoBarras) {
          this.validarFormatoCodigoBarras(detalhe.codigoBarras, index + 1, resultado);
        }

        // Validar valor do pagamento
        if (!detalhe.valor || detalhe.valor <= 0) {
          resultado.erros.push(`Detalhe ${index + 1}: Valor do pagamento deve ser maior que zero`);
          resultado.valido = false;
        }

        // Validar data de pagamento
        if (!detalhe.dataPagamento) {
          resultado.erros.push(`Detalhe ${index + 1}: Data de pagamento é obrigatória`);
          resultado.valido = false;
        }
      }
    });
  }

  /**
   * Validações específicas para débito automático
   */
  static validarOperacaoDebitoAutomatico(lote, resultado) {
    resultado.detalhes.validacoesAplicadas.push('Validação Débito Automático');

    if (!lote.detalhes || lote.detalhes.length === 0) {
      resultado.erros.push('Operação de débito automático deve conter detalhes');
      resultado.valido = false;
      return;
    }

    // Validações específicas para débito automático
    resultado.avisos.push('Validações específicas para débito automático em desenvolvimento');
  }

  /**
   * Valida formato de dados específicos da operação
   */
  static validarFormatoDadosOperacao(lote, resultado) {
    // Implementar validações de formato específicas conforme necessário
    lote.detalhes?.forEach((detalhe, index) => {
      // Validar formatos básicos
      if (detalhe.cpfCnpjFavorecido) {
        const documento = detalhe.cpfCnpjFavorecido.toString().replace(/\D/g, '');
        if (documento.length !== 11 && documento.length !== 14) {
          resultado.erros.push(
            `Detalhe ${index + 1}: CPF deve ter 11 dígitos ou CNPJ 14 dígitos`
          );
          resultado.valido = false;
        }
      }
    });
  }

  /**
   * Valida regras de negócio específicas da operação
   */
  static validarRegrasNegocioOperacao(lote, resultado) {
    const tipoOperacao = resultado.detalhes.tipoOperacao;

    // Regras específicas por tipo
    if (tipoOperacao?.includes('PIX')) {
      // PIX: valor mínimo R$ 0,01
      lote.detalhes?.forEach((detalhe, index) => {
        if (detalhe.valor && detalhe.valor < 1) {
          resultado.erros.push(`Detalhe ${index + 1}: Valor PIX mínimo é R$ 0,01`);
          resultado.valido = false;
        }
      });
    }

    if (tipoOperacao?.includes('COBRANCA')) {
      // Cobrança: validar se data de vencimento não é muito no passado
      lote.detalhes?.forEach((detalhe, index) => {
        if (detalhe.dataVencimento) {
          const vencimento = new Date(detalhe.dataVencimento);
          const hoje = new Date();
          const diffDias = (vencimento - hoje) / (1000 * 60 * 60 * 24);

          if (diffDias < -30) { // Mais de 30 dias vencido
            resultado.avisos.push(
              `Detalhe ${index + 1}: Título com vencimento há mais de 30 dias`
            );
          }
        }
      });
    }
  }

  /**
   * Valida formato da chave PIX
   */
  static validarFormatoChavePIX(chavePix, numeroDetalhe, resultado) {
    const chave = chavePix.toString().trim();

    // CPF: 11 dígitos
    if (chave.match(/^\d{11}$/)) {
      return; // CPF válido
    }

    // CNPJ: 14 dígitos
    if (chave.match(/^\d{14}$/)) {
      return; // CNPJ válido
    }

    // Email: formato básico
    if (chave.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return; // Email válido
    }

    // Telefone: +5511999999999 ou 11999999999
    if (chave.match(/^(\+55)?\d{10,11}$/)) {
      return; // Telefone válido
    }

    // Chave aleatória: 32 caracteres
    if (chave.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
      return; // UUID válido
    }

    resultado.avisos.push(
      `Detalhe ${numeroDetalhe}: Formato de chave PIX não reconhecido: ${chave}`
    );
  }

  /**
   * Valida código de finalidade PIX
   */
  static validarCodigoFinalidadePIX(finalidade) {
    const finalidadesValidas = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'
    ];

    return finalidadesValidas.includes(finalidade?.toString());
  }

  /**
   * Valida data de vencimento
   */
  static validarDataVencimento(dataVencimento, numeroDetalhe, resultado) {
    try {
      const data = new Date(dataVencimento);

      if (isNaN(data.getTime())) {
        resultado.erros.push(`Detalhe ${numeroDetalhe}: Data de vencimento inválida`);
        return;
      }

      // Verificar se não é muito antiga (mais de 5 anos)
      const hoje = new Date();
      const diffAnos = (hoje - data) / (1000 * 60 * 60 * 24 * 365);

      if (diffAnos > 5) {
        resultado.avisos.push(
          `Detalhe ${numeroDetalhe}: Data de vencimento muito antiga (${dataVencimento})`
        );
      }
    } catch (error) {
      resultado.erros.push(`Detalhe ${numeroDetalhe}: Erro ao validar data de vencimento`);
    }
  }

  /**
   * Valida formato do código de barras
   */
  static validarFormatoCodigoBarras(codigoBarras, numeroDetalhe, resultado) {
    const codigo = codigoBarras.toString().replace(/\D/g, '');

    // Código de barras deve ter 44 dígitos
    if (codigo.length !== 44) {
      resultado.erros.push(
        `Detalhe ${numeroDetalhe}: Código de barras deve ter 44 dígitos (encontrado: ${codigo.length})`
      );
      return;
    }

    // Validar dígito verificador (implementação simplificada)
    const banco = codigo.substring(0, 3);
    const moeda = codigo.substring(3, 4);

    if (moeda !== '9') {
      resultado.avisos.push(
        `Detalhe ${numeroDetalhe}: Código de moeda não reconhecido: ${moeda}`
      );
    }

    // Validar se é banco conhecido
    const bancosConhecidos = ['001', '104', '237', '341', '033', '070', '077', '260', '756', '748'];
    if (!bancosConhecidos.includes(banco)) {
      resultado.avisos.push(
        `Detalhe ${numeroDetalhe}: Código do banco não reconhecido: ${banco}`
      );
    }
  }
}

export default OperacaoValidator; 