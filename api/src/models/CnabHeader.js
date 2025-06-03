/**
 * Modelo de Cabeçalhos CNAB 400
 * 
 * Esta tabela armazena informações dos cabeçalhos (registro tipo 0)
 * dos arquivos CNAB 400, principalmente do Itaú.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Operation from './Operation.js';
import File from './File.js';

const CnabHeader = sequelize.define('CnabHeader', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    comment: 'ID único do cabeçalho'
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

  banco_codigo: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Código do banco (ex: 341 para Itaú)',
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

  empresa_codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Código da empresa no banco',
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

  arquivo_sequencia: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Número sequencial do arquivo',
    validate: {
      isInt: true,
      min: 0
    }
  },

  data_arquivo: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de geração do arquivo',
    validate: {
      isDate: true
    }
  },

  versao_layout: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Versão do layout CNAB',
    validate: {
      len: [0, 10]
    }
  },

  registro_tipo: {
    type: DataTypes.CHAR(1),
    allowNull: false,
    defaultValue: '0',
    comment: 'Tipo do registro (sempre 0 para cabeçalho)',
    validate: {
      len: [1, 1],
      is: /^[0]$/ // Só aceita '0'
    }
  },

  dados_completos: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Todos os dados do cabeçalho em formato JSON',
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
  tableName: 'cnab_headers',
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
      name: 'idx_data_arquivo',
      fields: ['data_arquivo']
    }
  ],

  // Hooks
  hooks: {
    afterCreate: (header, options) => {
      console.log(`Cabeçalho CNAB criado - Banco: ${header.banco_codigo}, Data: ${header.data_arquivo}`);
    }
  }
});

// Definir associações
CnabHeader.belongsTo(File, {
  foreignKey: 'file_id',
  as: 'file'
});

CnabHeader.belongsTo(Operation, {
  foreignKey: 'operation_id',
  targetKey: 'operation_id',
  as: 'operation'
});

// Métodos de classe
CnabHeader.findByFile = function (fileId) {
  return this.findAll({
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

CnabHeader.findByOperation = function (operationId) {
  return this.findAll({
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

CnabHeader.findByBanco = function (bancoCode, limit = 100) {
  return this.findAll({
    where: { banco_codigo: bancoCode },
    order: [['data_arquivo', 'DESC']],
    limit: limit,
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

CnabHeader.findByDateRange = function (startDate, endDate, limit = 100) {
  const whereClause = {};

  if (startDate) {
    whereClause.data_arquivo = {
      [sequelize.Op.gte]: startDate
    };
  }

  if (endDate) {
    whereClause.data_arquivo = {
      ...whereClause.data_arquivo,
      [sequelize.Op.lte]: endDate
    };
  }

  return this.findAll({
    where: whereClause,
    order: [['data_arquivo', 'DESC']],
    limit: limit,
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

// Métodos de instância
CnabHeader.prototype.getFormattedData = function () {
  return {
    id: this.id,
    banco: {
      codigo: this.banco_codigo,
      nome: this.banco_nome
    },
    empresa: {
      codigo: this.empresa_codigo,
      nome: this.empresa_nome
    },
    arquivo: {
      sequencia: this.arquivo_sequencia,
      data: this.data_arquivo,
      versao_layout: this.versao_layout
    },
    dados_completos: this.dados_completos,
    created_at: this.created_at
  };
};

CnabHeader.prototype.updateDadosCompletos = function (novosDados) {
  const dadosAtuais = this.dados_completos || {};
  const dadosAtualizados = {
    ...dadosAtuais,
    ...novosDados,
    updated_at: new Date().toISOString()
  };

  return this.update({
    dados_completos: dadosAtualizados
  });
};

// Método estático para extrair dados do cabeçalho CNAB 400
CnabHeader.extractFromCnabLine = function (cnabLine) {
  if (!cnabLine || cnabLine.length < 240) {
    throw new Error('Linha CNAB inválida para cabeçalho');
  }

  // Extrair campos básicos conforme layout CNAB 400 (exemplo Itaú)
  return {
    registro_tipo: cnabLine.substring(0, 1),
    banco_codigo: cnabLine.substring(76, 79).trim(),
    arquivo_sequencia: parseInt(cnabLine.substring(157, 163)) || null,
    data_arquivo: this.parseDate(cnabLine.substring(94, 100)),
    // Adicionar mais campos conforme necessário
    dados_completos: {
      linha_completa: cnabLine,
      parsed_at: new Date().toISOString()
    }
  };
};

// Método auxiliar para converter data CNAB (DDMMAA) para Date
CnabHeader.parseDate = function (dateString) {
  if (!dateString || dateString.length !== 6) return null;

  const day = dateString.substring(0, 2);
  const month = dateString.substring(2, 4);
  const year = '20' + dateString.substring(4, 6); // Assumindo anos 20XX

  try {
    return new Date(`${year}-${month}-${day}`);
  } catch (error) {
    return null;
  }
};

export default CnabHeader; 