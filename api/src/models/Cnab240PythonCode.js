/**
 * Modelo para códigos de barras extraídos com lógica Python
 * 
 * Este modelo representa os códigos de barras extraídos
 * dos arquivos CNAB240 usando posições específicas do parser Python
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Cnab240PythonCode = sequelize.define('Cnab240PythonCode', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Referências
  python_result_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Referência ao resultado Python'
  },
  
  cnab240_segment_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'Referência ao segmento original (se aplicável)'
  },
  
  operation_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'ID da operação'
  },
  
  // Dados do código de barras
  codigo_barras: {
    type: DataTypes.STRING(60),
    allowNull: false,
    comment: 'Código de barras extraído'
  },
  
  tipo_codigo: {
    type: DataTypes.ENUM('titulo', 'tributo', 'pix', 'outro'),
    defaultValue: 'titulo',
    comment: 'Tipo do código'
  },
  
  segmento_origem: {
    type: DataTypes.CHAR(1),
    defaultValue: 'J',
    comment: 'Segmento de origem (J, O, etc.)'
  },
  
  // Dados do pagamento
  favorecido: {
    type: DataTypes.STRING(100),
    comment: 'Nome do favorecido'
  },
  
  pagador: {
    type: DataTypes.STRING(100),
    comment: 'Nome do pagador'
  },
  
  valor: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Valor do pagamento'
  },
  
  data_vencimento: {
    type: DataTypes.STRING(8),
    comment: 'Data de vencimento (DDMMAAAA)'
  },
  
  data_pagamento: {
    type: DataTypes.STRING(8),
    comment: 'Data de pagamento (DDMMAAAA)'
  },
  
  // Metadados da extração Python
  linha_origem: {
    type: DataTypes.INTEGER,
    comment: 'Linha de origem no arquivo CNAB'
  },
  
  posicao_inicio: {
    type: DataTypes.INTEGER,
    comment: 'Posição inicial do código na linha'
  },
  
  posicao_fim: {
    type: DataTypes.INTEGER,
    comment: 'Posição final do código na linha'
  },
  
  extraction_method: {
    type: DataTypes.STRING(50),
    defaultValue: 'python_position_based',
    comment: 'Método de extração'
  },
  
  // Status e validação
  status: {
    type: DataTypes.ENUM('extracted', 'validated', 'processed', 'sent', 'error'),
    defaultValue: 'extracted'
  },
  
  validation_status: {
    type: DataTypes.ENUM('valid', 'invalid', 'warning'),
    defaultValue: 'valid'
  },
  
  validation_details: {
    type: DataTypes.JSON,
    comment: 'Detalhes da validação do código'
  },
  
  // Timestamps
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
  
}, {
  tableName: 'cnab240_python_codes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: 'Códigos de barras extraídos com lógica Python posicional',
  
  indexes: [
    {
      fields: ['python_result_id']
    },
    {
      fields: ['cnab240_segment_id']
    },
    {
      fields: ['operation_id']
    },
    {
      fields: ['codigo_barras']
    },
    {
      fields: ['tipo_codigo']
    },
    {
      fields: ['favorecido']
    },
    {
      fields: ['valor']
    },
    {
      fields: ['status']
    },
    {
      fields: ['validation_status']
    }
  ]
});

// ============================================================================
// HOOKS E VALIDAÇÕES
// ============================================================================

// Hook para validar código de barras
Cnab240PythonCode.addHook('beforeSave', (instance) => {
  // Validar tamanho do código de barras
  if (instance.codigo_barras && instance.codigo_barras.length < 10) {
    instance.validation_status = 'invalid';
    instance.validation_details = {
      error: 'Código de barras muito curto',
      length: instance.codigo_barras.length
    };
  }
  
  // Validar se contém apenas números
  if (instance.codigo_barras && !/^\d+$/.test(instance.codigo_barras)) {
    instance.validation_status = 'warning';
    instance.validation_details = {
      warning: 'Código de barras contém caracteres não numéricos'
    };
  }
});

// ============================================================================
// MÉTODOS DE INSTÂNCIA
// ============================================================================

// Método para formatar valor monetário
Cnab240PythonCode.prototype.getFormattedValue = function() {
  return `R$ ${parseFloat(this.valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

// Método para formatar data
Cnab240PythonCode.prototype.getFormattedDate = function(dateField = 'data_pagamento') {
  const dateString = this[dateField];
  if (!dateString || dateString === '00000000') return 'Não informado';
  
  try {
    // CNAB date format: DDMMAAAA
    if (dateString.length === 8) {
      const day = dateString.substring(0, 2);
      const month = dateString.substring(2, 4);
      const year = dateString.substring(4, 8);
      return `${day}/${month}/${year}`;
    }
    return dateString;
  } catch {
    return 'Data inválida';
  }
};

// Método para obter resumo do código
Cnab240PythonCode.prototype.getSummary = function() {
  return {
    id: this.id,
    codigo: this.codigo_barras,
    tipo: this.tipo_codigo,
    favorecido: this.favorecido,
    valor: parseFloat(this.valor),
    valorFormatado: this.getFormattedValue(),
    dataPagamento: this.getFormattedDate('data_pagamento'),
    dataVencimento: this.getFormattedDate('data_vencimento'),
    status: this.status,
    validacao: this.validation_status
  };
};

// ============================================================================
// MÉTODOS ESTÁTICOS
// ============================================================================

// Método para buscar códigos por resultado Python
Cnab240PythonCode.findByPythonResult = function(pythonResultId, options = {}) {
  const queryOptions = {
    where: { python_result_id: pythonResultId },
    order: [['linha_origem', 'ASC']],
    ...options
  };
  
  return this.findAll(queryOptions);
};

// Método para buscar códigos por operação
Cnab240PythonCode.findByOperationId = function(operationId, options = {}) {
  const queryOptions = {
    where: { operation_id: operationId },
    order: [['created_at', 'DESC']],
    ...options
  };
  
  return this.findAll(queryOptions);
};

// Método para buscar por código específico
Cnab240PythonCode.findByCode = function(codigoBarras) {
  return this.findAll({
    where: { codigo_barras: codigoBarras },
    order: [['created_at', 'DESC']]
  });
};

// Método para estatísticas por tipo
Cnab240PythonCode.getStatsByType = async function() {
  return await this.findAll({
    attributes: [
      'tipo_codigo',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('valor')), 'total_value'],
      [sequelize.fn('AVG', sequelize.col('valor')), 'average_value']
    ],
    group: ['tipo_codigo'],
    raw: true
  });
};

// Método para buscar códigos por status
Cnab240PythonCode.findByStatus = function(status, limit = 100) {
  return this.findAll({
    where: { status },
    limit,
    order: [['created_at', 'DESC']]
  });
};

// Método para buscar códigos inválidos
Cnab240PythonCode.findInvalid = function() {
  return this.findAll({
    where: { 
      validation_status: ['invalid', 'warning'] 
    },
    order: [['created_at', 'DESC']]
  });
};

// Método para criar códigos em lote
Cnab240PythonCode.createBatch = async function(codesData, transaction = null) {
  const t = transaction || await sequelize.transaction();
  
  try {
    const codes = await this.bulkCreate(codesData, { 
      transaction: t,
      validate: true
    });
    
    if (!transaction) {
      await t.commit();
    }
    
    return codes;
  } catch (error) {
    if (!transaction) {
      await t.rollback();
    }
    throw error;
  }
};

export default Cnab240PythonCode;