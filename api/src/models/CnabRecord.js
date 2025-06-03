/**
 * Modelo de Registros CNAB 400
 * 
 * Esta tabela armazena os registros de detalhe (tipo 1) e trailer (tipo 9)
 * dos arquivos CNAB 400, com informações detalhadas dos boletos/pagamentos.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Operation from './Operation.js';
import File from './File.js';
import CnabHeader from './CnabHeader.js';

const CnabRecord = sequelize.define('CnabRecord', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    comment: 'ID único do registro'
  },

  file_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Referência ao arquivo',
    validate: {
      isInt: true,
      min: 1
    }
  },

  operation_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Referência à operação',
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },

  header_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Referência ao cabeçalho',
    validate: {
      isInt: true,
      min: 1
    }
  },

  registro_sequencia: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Sequência do registro no arquivo',
    validate: {
      isInt: true,
      min: 0
    }
  },

  registro_tipo: {
    type: DataTypes.CHAR(1),
    allowNull: true,
    comment: 'Tipo do registro (1=detalhe, 9=trailer)',
    validate: {
      len: [1, 1],
      is: /^[19]$/ // Só aceita '1' ou '9'
    }
  },

  // Dados principais do boleto/pagamento
  nosso_numero: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nosso número do boleto',
    validate: {
      len: [0, 50]
    }
  },

  seu_numero: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Número do documento/seu número',
    validate: {
      len: [0, 50]
    }
  },

  codigo_barras: {
    type: DataTypes.STRING(60),
    allowNull: true,
    comment: 'Código de barras do boleto',
    validate: {
      len: [0, 60]
    }
  },

  linha_digitavel: {
    type: DataTypes.STRING(60),
    allowNull: true,
    comment: 'Linha digitável do boleto',
    validate: {
      len: [0, 60]
    }
  },

  valor_titulo: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Valor do título/boleto',
    validate: {
      isDecimal: true,
      min: 0
    }
  },

  valor_pago: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Valor efetivamente pago',
    validate: {
      isDecimal: true,
      min: 0
    }
  },

  data_vencimento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de vencimento do título',
    validate: {
      isDate: true
    }
  },

  data_pagamento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data do pagamento efetivo',
    validate: {
      isDate: true
    }
  },

  // Dados do pagador
  pagador_nome: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nome do pagador/sacado',
    validate: {
      len: [0, 100]
    }
  },

  pagador_documento: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'CPF/CNPJ do pagador',
    validate: {
      len: [0, 20]
    }
  },

  // Status e códigos
  codigo_ocorrencia: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Código da ocorrência bancária',
    validate: {
      len: [0, 10]
    }
  },

  descricao_ocorrencia: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Descrição da ocorrência',
    validate: {
      len: [0, 200]
    }
  },

  codigo_banco: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Código do banco',
    validate: {
      len: [0, 10]
    }
  },

  agencia: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Agência bancária',
    validate: {
      len: [0, 10]
    }
  },

  conta: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Conta bancária',
    validate: {
      len: [0, 20]
    }
  },

  // Dados completos em JSON
  dados_completos: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Todos os dados do registro em formato JSON',
    validate: {
      isValidJSON(value) {
        if (value !== null && typeof value !== 'object') {
          throw new Error('dados_completos deve ser um objeto JSON válido');
        }
      }
    }
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de criação do registro'
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data da última atualização'
  }
}, {
  tableName: 'cnab_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_file_id',
      fields: ['file_id']
    },
    {
      name: 'idx_operation_id',
      fields: ['operation_id']
    },
    {
      name: 'idx_header_id',
      fields: ['header_id']
    },
    {
      name: 'idx_nosso_numero',
      fields: ['nosso_numero']
    },
    {
      name: 'idx_seu_numero',
      fields: ['seu_numero']
    },
    {
      name: 'idx_codigo_barras',
      fields: ['codigo_barras']
    },
    {
      name: 'idx_data_vencimento',
      fields: ['data_vencimento']
    },
    {
      name: 'idx_data_pagamento',
      fields: ['data_pagamento']
    },
    {
      name: 'idx_codigo_ocorrencia',
      fields: ['codigo_ocorrencia']
    }
  ],

  // Hooks
  hooks: {
    afterCreate: (record, options) => {
      console.log(`Registro CNAB criado - Nosso Número: ${record.nosso_numero}, Valor: ${record.valor_titulo}`);
    }
  }
});

// Definir associações
CnabRecord.belongsTo(File, {
  foreignKey: 'file_id',
  as: 'file'
});

CnabRecord.belongsTo(Operation, {
  foreignKey: 'operation_id',
  targetKey: 'operation_id',
  as: 'operation'
});

CnabRecord.belongsTo(CnabHeader, {
  foreignKey: 'header_id',
  as: 'header'
});

// Métodos de classe
CnabRecord.findByFile = function (fileId, includeRelations = true) {
  const options = {
    where: { file_id: fileId },
    order: [['registro_sequencia', 'ASC']]
  };

  if (includeRelations) {
    options.include = [
      {
        model: File,
        as: 'file'
      },
      {
        model: Operation,
        as: 'operation'
      },
      {
        model: CnabHeader,
        as: 'header'
      }
    ];
  }

  return this.findAll(options);
};

CnabRecord.findByNossoNumero = function (nossoNumero) {
  return this.findAll({
    where: { nosso_numero: nossoNumero },
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: CnabHeader,
        as: 'header'
      }
    ]
  });
};

CnabRecord.findBySeuNumero = function (seuNumero) {
  return this.findAll({
    where: { seu_numero: seuNumero },
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: CnabHeader,
        as: 'header'
      }
    ]
  });
};

CnabRecord.findByCodigoBarras = function (codigoBarras) {
  return this.findOne({
    where: { codigo_barras: codigoBarras },
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: CnabHeader,
        as: 'header'
      }
    ]
  });
};

CnabRecord.findByDateRange = function (startDate, endDate, dateField = 'data_pagamento', limit = 100) {
  const whereClause = {};

  if (startDate) {
    whereClause[dateField] = {
      [sequelize.Op.gte]: startDate
    };
  }

  if (endDate) {
    whereClause[dateField] = {
      ...whereClause[dateField],
      [sequelize.Op.lte]: endDate
    };
  }

  return this.findAll({
    where: whereClause,
    order: [[dateField, 'DESC']],
    limit: limit,
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: CnabHeader,
        as: 'header'
      }
    ]
  });
};

CnabRecord.findByCodigoOcorrencia = function (codigoOcorrencia, limit = 100) {
  return this.findAll({
    where: { codigo_ocorrencia: codigoOcorrencia },
    order: [['created_at', 'DESC']],
    limit: limit,
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: CnabHeader,
        as: 'header'
      }
    ]
  });
};

// Métodos de instância
CnabRecord.prototype.getFormattedData = function () {
  return {
    id: this.id,
    registro: {
      sequencia: this.registro_sequencia,
      tipo: this.registro_tipo
    },
    boleto: {
      nosso_numero: this.nosso_numero,
      seu_numero: this.seu_numero,
      codigo_barras: this.codigo_barras,
      linha_digitavel: this.linha_digitavel,
      valor_titulo: this.valor_titulo,
      valor_pago: this.valor_pago,
      data_vencimento: this.data_vencimento,
      data_pagamento: this.data_pagamento
    },
    pagador: {
      nome: this.pagador_nome,
      documento: this.pagador_documento
    },
    ocorrencia: {
      codigo: this.codigo_ocorrencia,
      descricao: this.descricao_ocorrencia
    },
    bancario: {
      banco: this.codigo_banco,
      agencia: this.agencia,
      conta: this.conta
    },
    dados_completos: this.dados_completos,
    created_at: this.created_at
  };
};

CnabRecord.prototype.isPaid = function () {
  // Códigos de ocorrência que indicam pagamento (exemplo Itaú)
  const codigosPagamento = ['06', '17', '19'];
  return codigosPagamento.includes(this.codigo_ocorrencia);
};

CnabRecord.prototype.calculateDaysLate = function () {
  if (!this.data_vencimento || !this.data_pagamento) return null;

  const vencimento = new Date(this.data_vencimento);
  const pagamento = new Date(this.data_pagamento);

  if (pagamento <= vencimento) return 0;

  const diffTime = Math.abs(pagamento - vencimento);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Método estático para extrair dados do registro CNAB 400
CnabRecord.extractFromCnabLine = function (cnabLine, sequencia) {
  if (!cnabLine || cnabLine.length < 240) {
    throw new Error('Linha CNAB inválida para registro');
  }

  // Extrair campos básicos conforme layout CNAB 400 (exemplo Itaú)
  return {
    registro_sequencia: sequencia,
    registro_tipo: cnabLine.substring(0, 1),
    nosso_numero: cnabLine.substring(85, 93).trim(),
    seu_numero: cnabLine.substring(116, 126).trim(),
    data_vencimento: this.parseDate(cnabLine.substring(120, 126)),
    valor_titulo: this.parseValue(cnabLine.substring(126, 139)),
    codigo_ocorrencia: cnabLine.substring(108, 110),
    data_pagamento: this.parseDate(cnabLine.substring(110, 116)),
    valor_pago: this.parseValue(cnabLine.substring(253, 266)),
    dados_completos: {
      linha_completa: cnabLine,
      parsed_at: new Date().toISOString()
    }
  };
};

// Método auxiliar para converter data CNAB (DDMMAA) para Date
CnabRecord.parseDate = function (dateString) {
  if (!dateString || dateString.length !== 6 || dateString === '000000') return null;

  const day = dateString.substring(0, 2);
  const month = dateString.substring(2, 4);
  const year = '20' + dateString.substring(4, 6);

  try {
    return new Date(`${year}-${month}-${day}`);
  } catch (error) {
    return null;
  }
};

// Método auxiliar para converter valor CNAB (sem vírgula) para decimal
CnabRecord.parseValue = function (valueString) {
  if (!valueString || valueString.trim() === '' || valueString === '0000000000000') return null;

  try {
    const cleanValue = valueString.replace(/\D/g, '');
    return parseFloat(cleanValue) / 100; // Dividir por 100 para obter centavos
  } catch (error) {
    return null;
  }
};

export default CnabRecord; 