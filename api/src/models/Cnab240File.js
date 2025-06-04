/**
 * Modelo de Arquivos CNAB 240
 * 
 * Esta tabela armazena informações dos arquivos CNAB 240 completos,
 * incluindo headers, totalizadores e dados da empresa.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Operation from './Operation.js';
import File from './File.js';

const Cnab240File = sequelize.define('Cnab240File', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    comment: 'ID único do arquivo CNAB 240'
  },

  file_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Referência ao arquivo base',
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

  // Dados do header do arquivo
  banco_codigo: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Código do banco (341, 001, etc.)',
    validate: {
      len: [0, 10]
    }
  },

  banco_nome: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nome do banco',
    validate: {
      len: [0, 100]
    }
  },

  arquivo_sequencia: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Sequência do arquivo',
    validate: {
      isInt: true,
      min: 0
    }
  },

  data_geracao: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de geração do arquivo',
    validate: {
      isDate: true
    }
  },

  hora_geracao: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Hora de geração do arquivo'
  },

  versao_layout: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Versão do layout CNAB 240',
    validate: {
      len: [0, 10]
    }
  },

  densidade: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Densidade do arquivo',
    validate: {
      len: [0, 20]
    }
  },

  // Dados da empresa
  empresa_tipo_pessoa: {
    type: DataTypes.CHAR(1),
    allowNull: true,
    comment: '1=Pessoa Física, 2=Pessoa Jurídica',
    validate: {
      len: [1, 1],
      is: /^[12]$/
    }
  },

  empresa_documento: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'CPF/CNPJ da empresa',
    validate: {
      len: [0, 20]
    }
  },

  empresa_nome: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nome/Razão social da empresa',
    validate: {
      len: [0, 100]
    }
  },

  empresa_codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Código da empresa no banco',
    validate: {
      len: [0, 20]
    }
  },

  // Totalizadores e resumos
  total_lotes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total de lotes no arquivo',
    validate: {
      isInt: true,
      min: 0
    }
  },

  total_registros: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total de registros no arquivo',
    validate: {
      isInt: true,
      min: 0
    }
  },

  valor_total: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Valor total do arquivo',
    validate: {
      isDecimal: true,
      min: 0
    }
  },

  // Dados completos do header e trailer
  header_dados: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados completos do header do arquivo',
    validate: {
      isValidJSON(value) {
        if (value !== null && typeof value !== 'object') {
          throw new Error('header_dados deve ser um objeto JSON válido');
        }
      }
    }
  },

  trailer_dados: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados completos do trailer do arquivo',
    validate: {
      isValidJSON(value) {
        if (value !== null && typeof value !== 'object') {
          throw new Error('trailer_dados deve ser um objeto JSON válido');
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
  tableName: 'cnab240_files',
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
      name: 'idx_banco_codigo',
      fields: ['banco_codigo']
    },
    {
      name: 'idx_empresa_documento',
      fields: ['empresa_documento']
    },
    {
      name: 'idx_data_geracao',
      fields: ['data_geracao']
    }
  ],

  // Hooks
  hooks: {
    afterCreate: (cnab240File, options) => {
      console.log(`Arquivo CNAB 240 criado - Banco: ${cnab240File.banco_codigo}, Lotes: ${cnab240File.total_lotes}, Valor: ${cnab240File.valor_total}`);
    },
    beforeUpdate: (cnab240File, options) => {
      // Recalcular totalizadores se necessário
      if (cnab240File.changed('total_lotes') || cnab240File.changed('total_registros')) {
        console.log(`Totalizadores atualizados - Lotes: ${cnab240File.total_lotes}, Registros: ${cnab240File.total_registros}`);
      }
    }
  }
});

// Definir associações
Cnab240File.belongsTo(File, {
  foreignKey: 'file_id',
  as: 'file'
});

Cnab240File.belongsTo(Operation, {
  foreignKey: 'operation_id',
  targetKey: 'operation_id',
  as: 'operation'
});

// Métodos de classe
Cnab240File.findByFile = function (fileId) {
  return this.findOne({
    where: { file_id: fileId },
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: Operation,
        as: 'operation'
      }
    ]
  });
};

Cnab240File.findByOperation = function (operationId) {
  return this.findOne({
    where: { operation_id: operationId },
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: Operation,
        as: 'operation'
      }
    ]
  });
};

Cnab240File.findByBanco = function (bancoCode, limit = 100) {
  return this.findAll({
    where: { banco_codigo: bancoCode },
    order: [['data_geracao', 'DESC']],
    limit,
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: Operation,
        as: 'operation'
      }
    ]
  });
};

Cnab240File.findByEmpresa = function (empresaDocumento, limit = 100) {
  return this.findAll({
    where: { empresa_documento: empresaDocumento },
    order: [['data_geracao', 'DESC']],
    limit,
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: Operation,
        as: 'operation'
      }
    ]
  });
};

Cnab240File.findByDateRange = function (startDate, endDate, limit = 100) {
  const whereClause = {};

  if (startDate) {
    whereClause.data_geracao = {
      [sequelize.Op.gte]: startDate
    };
  }

  if (endDate) {
    whereClause.data_geracao = {
      ...whereClause.data_geracao,
      [sequelize.Op.lte]: endDate
    };
  }

  return this.findAll({
    where: whereClause,
    order: [['data_geracao', 'DESC']],
    limit,
    include: [
      {
        model: File,
        as: 'file'
      },
      {
        model: Operation,
        as: 'operation'
      }
    ]
  });
};

Cnab240File.getStatsByPeriod = function (startDate, endDate) {
  return this.findAll({
    where: {
      data_geracao: {
        [sequelize.Op.between]: [startDate, endDate]
      }
    },
    attributes: [
      'banco_codigo',
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_arquivos'],
      [sequelize.fn('SUM', sequelize.col('total_lotes')), 'total_lotes'],
      [sequelize.fn('SUM', sequelize.col('total_registros')), 'total_registros'],
      [sequelize.fn('SUM', sequelize.col('valor_total')), 'valor_total']
    ],
    group: ['banco_codigo'],
    order: [[sequelize.fn('SUM', sequelize.col('valor_total')), 'DESC']]
  });
};

// Métodos de instância
Cnab240File.prototype.getFormattedData = function () {
  return {
    id: this.id,
    arquivo: {
      sequencia: this.arquivo_sequencia,
      data_geracao: this.data_geracao,
      hora_geracao: this.hora_geracao,
      versao_layout: this.versao_layout,
      densidade: this.densidade
    },
    banco: {
      codigo: this.banco_codigo,
      nome: this.banco_nome
    },
    empresa: {
      tipo_pessoa: this.empresa_tipo_pessoa,
      documento: this.empresa_documento,
      nome: this.empresa_nome,
      codigo: this.empresa_codigo
    },
    totalizadores: {
      total_lotes: this.total_lotes,
      total_registros: this.total_registros,
      valor_total: this.valor_total
    },
    header_dados: this.header_dados,
    trailer_dados: this.trailer_dados,
    created_at: this.created_at
  };
};

Cnab240File.prototype.updateTotalizadores = function (totalLotes, totalRegistros, valorTotal) {
  return this.update({
    total_lotes: totalLotes,
    total_registros: totalRegistros,
    valor_total: valorTotal
  });
};

Cnab240File.prototype.addHeaderDados = function (headerDados) {
  const dadosAtuais = this.header_dados || {};
  const dadosAtualizados = {
    ...dadosAtuais,
    ...headerDados,
    updated_at: new Date().toISOString()
  };

  return this.update({
    header_dados: dadosAtualizados
  });
};

Cnab240File.prototype.addTrailerDados = function (trailerDados) {
  const dadosAtuais = this.trailer_dados || {};
  const dadosAtualizados = {
    ...dadosAtuais,
    ...trailerDados,
    updated_at: new Date().toISOString()
  };

  return this.update({
    trailer_dados: dadosAtualizados
  });
};

// Método estático para extrair dados do header CNAB 240
Cnab240File.extractFromHeaderLine = function (headerLine) {
  if (!headerLine || headerLine.length < 240) {
    throw new Error('Linha de header CNAB 240 inválida');
  }

  // Extrair campos básicos conforme layout CNAB 240
  return {
    banco_codigo: headerLine.substring(0, 3).trim(),
    arquivo_sequencia: parseInt(headerLine.substring(157, 163)) || null,
    data_geracao: this.parseDate(headerLine.substring(143, 151)),
    hora_geracao: this.parseTime(headerLine.substring(151, 157)),
    versao_layout: headerLine.substring(163, 166).trim(),
    densidade: headerLine.substring(166, 171).trim(),
    empresa_tipo_pessoa: headerLine.substring(17, 18),
    empresa_documento: headerLine.substring(18, 32).trim(),
    empresa_nome: headerLine.substring(72, 102).trim(),
    empresa_codigo: headerLine.substring(58, 72).trim(),
    header_dados: {
      linha_completa: headerLine,
      parsed_at: new Date().toISOString()
    }
  };
};

// Método estático para extrair dados do trailer CNAB 240
Cnab240File.extractFromTrailerLine = function (trailerLine) {
  if (!trailerLine || trailerLine.length < 240) {
    throw new Error('Linha de trailer CNAB 240 inválida');
  }

  return {
    total_lotes: parseInt(trailerLine.substring(17, 23)) || 0,
    total_registros: parseInt(trailerLine.substring(23, 29)) || 0,
    trailer_dados: {
      linha_completa: trailerLine,
      parsed_at: new Date().toISOString()
    }
  };
};

// Método auxiliar para converter data CNAB 240 (DDMMAAAA) para Date
Cnab240File.parseDate = function (dateString) {
  if (!dateString || dateString.length !== 8) return null;

  const day = dateString.substring(0, 2);
  const month = dateString.substring(2, 4);
  const year = dateString.substring(4, 8);

  try {
    return new Date(`${year}-${month}-${day}`);
  } catch (error) {
    return null;
  }
};

// Método auxiliar para converter hora CNAB 240 (HHMMSS) para TIME
Cnab240File.parseTime = function (timeString) {
  if (!timeString || timeString.length !== 6) return null;

  const hour = timeString.substring(0, 2);
  const minute = timeString.substring(2, 4);
  const second = timeString.substring(4, 6);

  try {
    return `${hour}:${minute}:${second}`;
  } catch (error) {
    return null;
  }
};

export default Cnab240File; 