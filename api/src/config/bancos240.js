/**
 * Configurações específicas para CNAB 240 por banco
 * 
 * Este arquivo contém as configurações e validações específicas
 * para cada banco que suporta o formato CNAB 240.
 * 
 * Baseado na análise dos arquivos de exemplo, identificamos principalmente:
 * - Itaú (341) - principal banco dos exemplos
 * - Suporte a múltiplos códigos de operação e tipos PIX
 */

/**
 * Validadores de chave PIX por tipo
 */
const VALIDADORES_PIX = {
  CPF: (chave) => {
    // Remover formatação e verificar se restam apenas dígitos
    const cpf = chave.replace(/[.\-]/g, ''); // Remove pontos e hífens de formatação
    return cpf.length === 11 && /^\d{11}$/.test(cpf);
  },

  CNPJ: (chave) => {
    // Remover formatação e verificar se restam apenas dígitos
    const cnpj = chave.replace(/[.\-\/]/g, ''); // Remove pontos, hífens e barras de formatação
    return cnpj.length === 14 && /^\d{14}$/.test(cnpj);
  },

  EMAIL: (chave) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(chave) && chave.length <= 77;
  },

  TELEFONE: (chave) => {
    // Remover formatação e verificar se restam apenas dígitos
    const telefone = chave.replace(/[\s\(\)\-\+]/g, ''); // Remove espaços, parênteses, hífens e plus
    return telefone.length >= 10 && telefone.length <= 13 && /^\d+$/.test(telefone);
  },

  UUID: (chave) => {
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
    return uuidRegex.test(chave);
  }
};

/**
 * Validadores específicos por banco
 */
const VALIDADORES_BANCO = {
  '001': {
    // Banco do Brasil
    validarAgencia: (agencia) => {
      const ag = agencia.replace(/\D/g, '');
      return ag.length === 4 && /^\d{4}$/.test(ag);
    },

    validarConta: (conta) => {
      const ct = conta.replace(/\D/g, '');
      return ct.length >= 8 && ct.length <= 12 && /^\d+$/.test(ct);
    },

    validarDigitoVerificador: (agencia, conta, dv) => {
      // Implementação específica do BB (simplificada)
      return /^[0-9X]$/.test(dv);
    }
  },

  '341': {
    // Itaú Unibanco
    validarAgencia: (agencia) => {
      const ag = agencia.replace(/\D/g, '');
      return ag.length === 4 && /^\d{4}$/.test(ag);
    },

    validarConta: (conta) => {
      // Verificar se é apenas números, sem formatação adicional
      const ct = conta.replace(/[\-]/g, ''); // Remove apenas hífens de formatação
      return ct.length >= 5 && ct.length <= 12 && /^\d+$/.test(ct);
    },

    validarDigitoVerificador: (agencia, conta, dv) => {
      // Implementação específica do Itaú (simplificada)
      return /^[0-9]$/.test(dv);
    }
  },

  '033': {
    // Santander
    validarAgencia: (agencia) => {
      const ag = agencia.replace(/\D/g, '');
      return ag.length === 4 && /^\d{4}$/.test(ag);
    },

    validarConta: (conta) => {
      const ct = conta.replace(/\D/g, '');
      return ct.length >= 7 && ct.length <= 12 && /^\d+$/.test(ct);
    },

    validarDigitoVerificador: (agencia, conta, dv) => {
      // Implementação específica do Santander (simplificada)
      return /^[0-9]$/.test(dv);
    }
  },

  '104': {
    // Caixa
    validarAgencia: (agencia) => {
      const ag = agencia.replace(/\D/g, '');
      return ag.length === 4 && /^\d{4}$/.test(ag);
    },

    validarConta: (conta) => {
      const ct = conta.replace(/\D/g, '');
      return ct.length >= 8 && ct.length <= 11 && /^\d+$/.test(ct);
    },

    validarDigitoVerificador: (agencia, conta, dv) => {
      // Implementação específica da Caixa (simplificada)
      return /^[0-9]$/.test(dv);
    }
  },

  '237': {
    // Bradesco
    validarAgencia: (agencia) => {
      const ag = agencia.replace(/\D/g, '');
      return ag.length === 4 && /^\d{4}$/.test(ag);
    },

    validarConta: (conta) => {
      const ct = conta.replace(/\D/g, '');
      return ct.length === 7 && /^\d{7}$/.test(ct);
    },

    validarDigitoVerificador: (agencia, conta, dv) => {
      // Implementação específica do Bradesco (simplificada)
      return /^[0-9]$/.test(dv);
    }
  }
};

const BANCOS_240 = {
  // Banco do Brasil
  '001': {
    nome: 'Banco do Brasil',
    codigo: '001',
    versaoLayout: '10.7',
    segmentosSuportados: ['A', 'B', 'J', 'O'],
    operacoesSuportadas: [
      '201303', // Pagamento de Tributos
      '203003', // Cobrança
      '204504', // PIX Transferência
      '204704'  // PIX Programado
    ],
    validacoes: {
      agencia: 4,
      conta: 12,
      digitoVerificador: true,
      validador: VALIDADORES_BANCO['001']
    },
    pix: {
      tiposChaveSuportados: ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'UUID'],
      segmentosBSuportados: ['B01', 'B02', 'B03', 'B04'],
      limites: {
        simples: {
          diario: 1000000, // R$ 1.000.000,00
          mensal: 5000000, // R$ 5.000.000,00
          porTransacao: 500000 // R$ 500.000,00
        },
        programado: {
          diario: 500000, // R$ 500.000,00
          mensal: 2000000, // R$ 2.000.000,00
          porTransacao: 100000 // R$ 100.000,00
        },
        lote: {
          diario: 2000000, // R$ 2.000.000,00
          mensal: 10000000, // R$ 10.000.000,00
          porTransacao: 1000000 // R$ 1.000.000,00
        }
      },
      validadores: VALIDADORES_PIX
    }
  },

  // Itaú Unibanco - Principal banco dos exemplos
  '341': {
    nome: 'Itaú Unibanco',
    codigo: '341',
    versaoLayout: '10.7',
    segmentosSuportados: ['A', 'B', 'J', 'O'],
    operacoesSuportadas: [
      '201303', // Pagamento de Tributos
      '203003', // Cobrança (Títulos)
      '203103', // Cobrança com Complemento
      '204504', // PIX Transferência
      '204704', // PIX Programado
      '221903', // Operação Especial
      '229103'  // Diversos
    ],
    validacoes: {
      agencia: 4,
      conta: 12,
      digitoVerificador: true,
      validador: VALIDADORES_BANCO['341']
    },
    pix: {
      tiposChaveSuportados: ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'UUID'],
      segmentosBSuportados: ['B01', 'B02', 'B03', 'B04'],
      limites: {
        simples: {
          diario: 1000000, // R$ 1.000.000,00
          mensal: 5000000, // R$ 5.000.000,00
          porTransacao: 500000 // R$ 500.000,00
        },
        programado: {
          diario: 500000, // R$ 500.000,00
          mensal: 2000000, // R$ 2.000.000,00
          porTransacao: 100000 // R$ 100.000,00
        },
        lote: {
          diario: 2000000, // R$ 2.000.000,00
          mensal: 10000000, // R$ 10.000.000,00
          porTransacao: 1000000 // R$ 1.000.000,00
        }
      },
      validadores: VALIDADORES_PIX
    }
  },

  // Santander
  '033': {
    nome: 'Banco Santander',
    codigo: '033',
    versaoLayout: '10.7',
    segmentosSuportados: ['A', 'B', 'J', 'O'],
    operacoesSuportadas: [
      '201303', // Pagamento de Tributos
      '203003', // Cobrança
      '204504', // PIX Transferência
      '204704'  // PIX Programado
    ],
    validacoes: {
      agencia: 4,
      conta: 12,
      digitoVerificador: true,
      validador: VALIDADORES_BANCO['033']
    },
    pix: {
      tiposChaveSuportados: ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'UUID'],
      segmentosBSuportados: ['B01', 'B02', 'B03', 'B04'],
      limites: {
        simples: {
          diario: 500000, // R$ 500.000,00
          mensal: 2000000, // R$ 2.000.000,00
          porTransacao: 200000 // R$ 200.000,00
        },
        programado: {
          diario: 250000, // R$ 250.000,00
          mensal: 1000000, // R$ 1.000.000,00
          porTransacao: 50000 // R$ 50.000,00
        },
        lote: {
          diario: 1000000, // R$ 1.000.000,00
          mensal: 5000000, // R$ 5.000.000,00
          porTransacao: 500000 // R$ 500.000,00
        }
      },
      validadores: VALIDADORES_PIX
    }
  },

  // Caixa Econômica Federal
  '104': {
    nome: 'Caixa Econômica Federal',
    codigo: '104',
    versaoLayout: '10.7',
    segmentosSuportados: ['A', 'B', 'J', 'O'],
    operacoesSuportadas: [
      '201303', // Pagamento de Tributos
      '203003', // Cobrança
      '204504', // PIX Transferência
      '204704'  // PIX Programado
    ],
    validacoes: {
      agencia: 4,
      conta: 11,
      digitoVerificador: true,
      validador: VALIDADORES_BANCO['104']
    },
    pix: {
      tiposChaveSuportados: ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'UUID'],
      segmentosBSuportados: ['B01', 'B02', 'B03', 'B04'],
      limites: {
        simples: {
          diario: 750000, // R$ 750.000,00
          mensal: 3000000, // R$ 3.000.000,00
          porTransacao: 300000 // R$ 300.000,00
        },
        programado: {
          diario: 300000, // R$ 300.000,00
          mensal: 1500000, // R$ 1.500.000,00
          porTransacao: 75000 // R$ 75.000,00
        },
        lote: {
          diario: 1500000, // R$ 1.500.000,00
          mensal: 7500000, // R$ 7.500.000,00
          porTransacao: 750000 // R$ 750.000,00
        }
      },
      validadores: VALIDADORES_PIX
    }
  },

  // Bradesco
  '237': {
    nome: 'Banco Bradesco',
    codigo: '237',
    versaoLayout: '10.7',
    segmentosSuportados: ['A', 'B', 'J', 'O'],
    operacoesSuportadas: [
      '201303', // Pagamento de Tributos
      '203003', // Cobrança
      '204504', // PIX Transferência
      '204704'  // PIX Programado
    ],
    validacoes: {
      agencia: 4,
      conta: 7,
      digitoVerificador: true,
      validador: VALIDADORES_BANCO['237']
    },
    pix: {
      tiposChaveSuportados: ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'UUID'],
      segmentosBSuportados: ['B01', 'B02', 'B03', 'B04'],
      limites: {
        simples: {
          diario: 800000, // R$ 800.000,00
          mensal: 4000000, // R$ 4.000.000,00
          porTransacao: 400000 // R$ 400.000,00
        },
        programado: {
          diario: 400000, // R$ 400.000,00
          mensal: 1800000, // R$ 1.800.000,00
          porTransacao: 80000 // R$ 80.000,00
        },
        lote: {
          diario: 1600000, // R$ 1.600.000,00
          mensal: 8000000, // R$ 8.000.000,00
          porTransacao: 800000 // R$ 800.000,00
        }
      },
      validadores: VALIDADORES_PIX
    }
  }
};

/**
 * Códigos de operação CNAB 240 identificados nos exemplos
 */
const CODIGOS_OPERACAO = {
  '201303': {
    nome: 'Pagamento de Tributos',
    descricao: 'Pagamento de impostos, taxas e contribuições',
    segmentosObrigatorios: ['A'],
    segmentosOpcionais: ['O']
  },
  '203003': {
    nome: 'Cobrança (Títulos)',
    descricao: 'Cobrança de títulos e boletos',
    segmentosObrigatorios: ['A'],
    segmentosOpcionais: ['J']
  },
  '203103': {
    nome: 'Cobrança com Complemento',
    descricao: 'Cobrança de títulos com informações complementares',
    segmentosObrigatorios: ['A', 'B'],
    segmentosOpcionais: ['J']
  },
  '204504': {
    nome: 'PIX Transferência',
    descricao: 'Transferência via PIX',
    segmentosObrigatorios: ['A', 'B'],
    segmentosOpcionais: [],
    pix: true
  },
  '204704': {
    nome: 'PIX Programado',
    descricao: 'PIX com agendamento',
    segmentosObrigatorios: ['A', 'B'],
    segmentosOpcionais: [],
    pix: true
  },
  '221903': {
    nome: 'Operação Especial',
    descricao: 'Operações específicas do banco',
    segmentosObrigatorios: ['A'],
    segmentosOpcionais: ['B']
  },
  '229103': {
    nome: 'Diversos',
    descricao: 'Outras operações diversas',
    segmentosObrigatorios: ['A'],
    segmentosOpcionais: ['B']
  }
};

/**
 * Tipos de registro CNAB 240
 */
const TIPOS_REGISTRO = {
  '0': 'Header de Arquivo',
  '1': 'Header de Lote',
  '3': 'Detalhe',
  '5': 'Trailer de Lote',
  '9': 'Trailer de Arquivo'
};

/**
 * Segmentos para registros de detalhe
 */
const SEGMENTOS = {
  'A': 'Dados principais do pagamento/crédito',
  'B': 'Dados complementares',
  'J': 'Dados de títulos de cobrança',
  'O': 'Dados de pagamento de tributos'
};

/**
 * Subtipos do Segmento B (identificados nos exemplos)
 */
const SEGMENTOS_B = {
  'B01': {
    nome: 'Telefone (contato PIX)',
    descricao: 'Chave PIX do tipo telefone',
    validador: VALIDADORES_PIX.TELEFONE
  },
  'B02': {
    nome: 'Email (contato PIX)',
    descricao: 'Chave PIX do tipo email',
    validador: VALIDADORES_PIX.EMAIL
  },
  'B03': {
    nome: 'CNPJ/CPF (identificação fiscal)',
    descricao: 'Chave PIX do tipo CPF ou CNPJ',
    validador: (chave, tipo) => {
      if (tipo === '1') return VALIDADORES_PIX.CPF(chave);
      if (tipo === '2') return VALIDADORES_PIX.CNPJ(chave);
      return false;
    }
  },
  'B04': {
    nome: 'Chave PIX UUID',
    descricao: 'Chave PIX do tipo UUID (chave aleatória)',
    validador: VALIDADORES_PIX.UUID
  }
};

/**
 * Funções utilitárias para validação
 */
const UTILS_VALIDACAO = {
  /**
   * Valida configuração de banco específico
   * @param {string} codigoBanco - Código do banco (3 dígitos)
   * @param {Object} dados - Dados para validação
   * @returns {Object} Resultado da validação
   */
  validarConfigBanco: (codigoBanco, dados) => {
    const banco = BANCOS_240[codigoBanco];
    if (!banco) {
      return { valido: false, erro: `Banco ${codigoBanco} não configurado` };
    }

    const erros = [];

    // Validar agência
    if (dados.agencia && !banco.validacoes.validador.validarAgencia(dados.agencia)) {
      erros.push(`Formato de agência inválido para ${banco.nome}`);
    }

    // Validar conta
    if (dados.conta && !banco.validacoes.validador.validarConta(dados.conta)) {
      erros.push(`Formato de conta inválido para ${banco.nome}`);
    }

    // Validar dígito verificador
    if (dados.digitoVerificador && dados.agencia && dados.conta) {
      if (!banco.validacoes.validador.validarDigitoVerificador(dados.agencia, dados.conta, dados.digitoVerificador)) {
        erros.push(`Dígito verificador inválido para ${banco.nome}`);
      }
    }

    return {
      valido: erros.length === 0,
      erros,
      banco: banco.nome
    };
  },

  /**
   * Valida chave PIX específica
   * @param {string} chave - Chave PIX
   * @param {string} tipo - Tipo da chave (CPF, CNPJ, EMAIL, etc.)
   * @returns {Object} Resultado da validação
   */
  validarChavePix: (chave, tipo) => {
    const validador = VALIDADORES_PIX[tipo.toUpperCase()];
    if (!validador) {
      return { valido: false, erro: `Tipo de chave PIX '${tipo}' não suportado` };
    }

    const valido = validador(chave);
    return {
      valido,
      erro: valido ? null : `Formato de chave PIX '${tipo}' inválido`
    };
  },

  /**
   * Verifica se operação é suportada pelo banco
   * @param {string} codigoBanco - Código do banco
   * @param {string} codigoOperacao - Código da operação
   * @returns {boolean} Se a operação é suportada
   */
  operacaoSuportada: (codigoBanco, codigoOperacao) => {
    const banco = BANCOS_240[codigoBanco];
    return banco ? banco.operacoesSuportadas.includes(codigoOperacao) : false;
  },

  /**
   * Verifica limites PIX para o banco
   * @param {string} codigoBanco - Código do banco
   * @param {string} tipoOperacao - Tipo da operação (simples, programado, lote)
   * @param {number} valor - Valor da transação em centavos
   * @returns {Object} Resultado da verificação
   */
  verificarLimitePix: (codigoBanco, tipoOperacao, valor) => {
    const banco = BANCOS_240[codigoBanco];
    if (!banco || !banco.pix) {
      return { valido: false, erro: `PIX não configurado para banco ${codigoBanco}` };
    }

    const limites = banco.pix.limites[tipoOperacao];
    if (!limites) {
      return { valido: false, erro: `Tipo de operação PIX '${tipoOperacao}' não configurado` };
    }

    const valorReais = valor / 100;
    if (valorReais > limites.porTransacao) {
      return {
        valido: false,
        erro: `Valor R$ ${valorReais.toFixed(2)} excede limite por transação de R$ ${limites.porTransacao.toFixed(2)}`
      };
    }

    return { valido: true };
  }
};

export {
  BANCOS_240,
  CODIGOS_OPERACAO,
  TIPOS_REGISTRO,
  SEGMENTOS,
  SEGMENTOS_B,
  VALIDADORES_PIX,
  VALIDADORES_BANCO,
  UTILS_VALIDACAO
}; 