/**
 * Modelo de Operações - Auditoria de todas as operações do sistema
 * 
 * Esta tabela registra todas as operações realizadas no sistema,
 * incluindo processamento CNAB, validações, webhooks, etc.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Operation = sequelize.define('Operation', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    comment: 'ID único da operação'
  },

  operation_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'ID único da operação (UUID)',
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },

  operation_type: {
    type: DataTypes.ENUM('cnab400', 'cnab240', 'validation', 'webhook'),
    allowNull: false,
    comment: 'Tipo de operação',
    validate: {
      isIn: [['cnab400', 'cnab240', 'validation', 'webhook']]
    }
  },

  status: {
    type: DataTypes.ENUM('started', 'processing', 'success', 'error'),
    allowNull: false,
    defaultValue: 'started',
    comment: 'Status da operação',
    validate: {
      isIn: [['started', 'processing', 'success', 'error']]
    }
  },

  request_data: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados da requisição (metadata)'
  },

  response_data: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados da resposta'
  },

  error_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Detalhes de erro se houver'
  },

  processing_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tempo de processamento em millisegundos',
    validate: {
      isInt: true,
      min: 0
    }
  },

  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent da requisição'
  },

  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: 'IP da requisição (IPv4 ou IPv6)',
    validate: {
      isIP: true
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
  tableName: 'operations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_operation_id',
      fields: ['operation_id']
    },
    {
      name: 'idx_operation_type',
      fields: ['operation_type']
    },
    {
      name: 'idx_status',
      fields: ['status']
    },
    {
      name: 'idx_created_at',
      fields: ['created_at']
    }
  ],

  // Hooks para auditoria
  hooks: {
    afterCreate: (operation, options) => {
      console.log(`Nova operação criada: ${operation.operation_id} (${operation.operation_type})`);
    },
    afterUpdate: (operation, options) => {
      console.log(`Operação atualizada: ${operation.operation_id} - Status: ${operation.status}`);
    }
  }
});

// Métodos de classe
Operation.findByOperationId = function (operationId) {
  return this.findOne({
    where: { operation_id: operationId }
  });
};

Operation.findByType = function (operationType, limit = 100) {
  return this.findAll({
    where: { operation_type: operationType },
    order: [['created_at', 'DESC']],
    limit: limit
  });
};

Operation.findByStatus = function (status, limit = 100) {
  return this.findAll({
    where: { status: status },
    order: [['created_at', 'DESC']],
    limit: limit
  });
};

// Métodos de instância
Operation.prototype.markAsProcessing = function () {
  return this.update({ status: 'processing' });
};

Operation.prototype.markAsSuccess = function (responseData = null) {
  return this.update({
    status: 'success',
    response_data: responseData
  });
};

Operation.prototype.markAsError = function (errorDetails = null) {
  return this.update({
    status: 'error',
    error_details: errorDetails
  });
};

Operation.prototype.setProcessingTime = function (startTime) {
  const processingTime = Date.now() - startTime;
  return this.update({ processing_time_ms: processingTime });
};

export default Operation; 