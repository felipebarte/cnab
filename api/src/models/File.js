/**
 * Modelo de Arquivos - Informações sobre arquivos processados
 * 
 * Esta tabela armazena metadados sobre todos os arquivos processados,
 * incluindo hash para verificação de duplicatas e informações de validação.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Operation from './Operation.js';

const File = sequelize.define('File', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    comment: 'ID único do arquivo'
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

  file_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: 'Hash SHA-256 do conteúdo do arquivo',
    validate: {
      notEmpty: true,
      len: [64, 64], // SHA-256 sempre tem 64 caracteres
      is: /^[a-fA-F0-9]{64}$/ // Validar formato hexadecimal
    }
  },

  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nome original do arquivo',
    validate: {
      len: [0, 255]
    }
  },

  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'Tamanho do arquivo em bytes',
    validate: {
      isInt: true,
      min: 0
    }
  },

  file_type: {
    type: DataTypes.ENUM('cnab400', 'cnab240'),
    allowNull: false,
    comment: 'Tipo do arquivo CNAB',
    validate: {
      isIn: [['cnab400', 'cnab240']]
    }
  },

  content_preview: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Primeiras linhas do arquivo para visualização'
  },

  validation_status: {
    type: DataTypes.ENUM('valid', 'invalid', 'warning'),
    allowNull: false,
    defaultValue: 'valid',
    comment: 'Status da validação do arquivo',
    validate: {
      isIn: [['valid', 'invalid', 'warning']]
    }
  },

  validation_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Detalhes da validação (erros, avisos, etc.)'
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
  tableName: 'files',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      name: 'unique_file_hash',
      fields: ['file_hash']
    },
    {
      name: 'idx_operation_id',
      fields: ['operation_id']
    },
    {
      name: 'idx_file_type',
      fields: ['file_type']
    },
    {
      name: 'idx_validation_status',
      fields: ['validation_status']
    }
  ],

  // Hooks para auditoria
  hooks: {
    beforeCreate: async (file, options) => {
      // Verificar se o hash já existe
      const existingFile = await File.findOne({
        where: { file_hash: file.file_hash }
      });

      if (existingFile) {
        throw new Error(`Arquivo já processado anteriormente. Hash: ${file.file_hash}`);
      }
    },
    afterCreate: (file, options) => {
      console.log(`Novo arquivo registrado: ${file.file_name} (${file.file_type})`);
    }
  }
});

// Definir associações
File.belongsTo(Operation, {
  foreignKey: 'operation_id',
  targetKey: 'operation_id',
  as: 'operation'
});

// Métodos de classe
File.findByHash = function (fileHash) {
  return this.findOne({
    where: { file_hash: fileHash },
    include: [{
      model: Operation,
      as: 'operation'
    }]
  });
};

File.findByType = function (fileType, limit = 100) {
  return this.findAll({
    where: { file_type: fileType },
    order: [['created_at', 'DESC']],
    limit: limit,
    include: [{
      model: Operation,
      as: 'operation'
    }]
  });
};

File.findByValidationStatus = function (status, limit = 100) {
  return this.findAll({
    where: { validation_status: status },
    order: [['created_at', 'DESC']],
    limit: limit,
    include: [{
      model: Operation,
      as: 'operation'
    }]
  });
};

File.findByOperation = function (operationId) {
  return this.findAll({
    where: { operation_id: operationId },
    include: [{
      model: Operation,
      as: 'operation'
    }]
  });
};

// Métodos de instância
File.prototype.markAsValid = function (validationDetails = null) {
  return this.update({
    validation_status: 'valid',
    validation_details: validationDetails
  });
};

File.prototype.markAsInvalid = function (validationDetails = null) {
  return this.update({
    validation_status: 'invalid',
    validation_details: validationDetails
  });
};

File.prototype.markAsWarning = function (validationDetails = null) {
  return this.update({
    validation_status: 'warning',
    validation_details: validationDetails
  });
};

File.prototype.addValidationDetail = function (detail) {
  const currentDetails = this.validation_details || {};
  const updatedDetails = {
    ...currentDetails,
    ...detail,
    updated_at: new Date().toISOString()
  };

  return this.update({
    validation_details: updatedDetails
  });
};

// Método estático para gerar preview do conteúdo
File.generatePreview = function (content, lines = 5) {
  if (!content) return null;

  const contentLines = content.split('\n');
  const preview = contentLines.slice(0, lines).join('\n');

  return preview + (contentLines.length > lines ? '\n...' : '');
};

export default File; 