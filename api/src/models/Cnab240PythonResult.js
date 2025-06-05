/**
 * Modelo para resultados do processamento CNAB240 com lógica Python
 * 
 * Este modelo representa os dados resumidos e estatísticas
 * do processamento de arquivos CNAB240 usando a lógica Python
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Cnab240PythonResult = sequelize.define('Cnab240PythonResult', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Referências
  cnab240_file_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Referência ao arquivo CNAB240'
  },
  
  operation_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'ID da operação que gerou este resultado'
  },
  
  // Estatísticas do processamento Python
  total_pagamentos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de pagamentos extraídos com lógica Python'
  },
  
  valor_total: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Valor total de todos os pagamentos'
  },
  
  valor_medio: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Valor médio por pagamento'
  },
  
  // Metadados do processamento
  metodologia: {
    type: DataTypes.STRING(50),
    defaultValue: 'Python Sequential Logic',
    comment: 'Metodologia de parsing utilizada'
  },
  
  linhas_processadas: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de linhas processadas'
  },
  
  segmentos_j_processados: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de segmentos J processados'
  },
  
  segmentos_b_processados: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de segmentos B processados'
  },
  
  python_logic_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Se a lógica Python estava habilitada'
  },
  
  // Detalhes do processamento
  processing_summary: {
    type: DataTypes.JSON,
    comment: 'Resumo completo do processamento Python'
  },
  
  validation_results: {
    type: DataTypes.JSON,
    comment: 'Resultados de validação específicos'
  },
  
  extraction_metadata: {
    type: DataTypes.JSON,
    comment: 'Metadados da extração (posições, sequências)'
  },
  
  // Controle de qualidade
  success_rate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 100.00,
    comment: 'Taxa de sucesso na extração (%)'
  },
  
  warnings_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de avisos durante o processamento'
  },
  
  errors_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de erros durante o processamento'
  },
  
  // Timestamps
  processing_started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Início do processamento Python'
  },
  
  processing_completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fim do processamento Python'
  },
  
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
  
}, {
  tableName: 'cnab240_python_results',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: 'Resultados resumidos do processamento CNAB240 com lógica Python',
  
  indexes: [
    {
      fields: ['cnab240_file_id']
    },
    {
      fields: ['operation_id']
    },
    {
      fields: ['python_logic_enabled']
    },
    {
      fields: ['metodologia']
    },
    {
      fields: ['valor_total']
    },
    {
      fields: ['total_pagamentos']
    },
    {
      fields: ['created_at']
    }
  ]
});

// ============================================================================
// HOOKS E VALIDAÇÕES
// ============================================================================

// Hook para calcular valor médio automaticamente
Cnab240PythonResult.addHook('beforeSave', (instance) => {
  if (instance.total_pagamentos > 0) {
    instance.valor_medio = parseFloat(instance.valor_total) / instance.total_pagamentos;
  } else {
    instance.valor_medio = 0.00;
  }
});

// Hook para atualizar timestamp de processamento
Cnab240PythonResult.addHook('beforeCreate', (instance) => {
  if (!instance.processing_started_at) {
    instance.processing_started_at = new Date();
  }
});

// Hook para marcar processamento como concluído
Cnab240PythonResult.addHook('afterCreate', (instance) => {
  if (!instance.processing_completed_at) {
    instance.processing_completed_at = new Date();
    instance.save();
  }
});

// ============================================================================
// MÉTODOS DE INSTÂNCIA
// ============================================================================

// Método para calcular duração do processamento
Cnab240PythonResult.prototype.getProcessingDuration = function() {
  if (this.processing_started_at && this.processing_completed_at) {
    return this.processing_completed_at - this.processing_started_at;
  }
  return null;
};

// Método para obter resumo formatado
Cnab240PythonResult.prototype.getFormattedSummary = function() {
  return {
    id: this.id,
    operationId: this.operation_id,
    totalPayments: this.total_pagamentos,
    totalValue: parseFloat(this.valor_total),
    averageValue: parseFloat(this.valor_medio),
    methodology: this.metodologia,
    successRate: parseFloat(this.success_rate),
    processingDuration: this.getProcessingDuration(),
    pythonEnabled: this.python_logic_enabled,
    quality: {
      warnings: this.warnings_count,
      errors: this.errors_count
    }
  };
};

// Método para atualizar estatísticas
Cnab240PythonResult.prototype.updateStats = function(pagamentos) {
  this.total_pagamentos = pagamentos.length;
  this.valor_total = pagamentos.reduce((sum, pag) => sum + (pag.valor || 0), 0);
  this.valor_medio = this.total_pagamentos > 0 ? this.valor_total / this.total_pagamentos : 0;
  
  return this.save();
};

// ============================================================================
// MÉTODOS ESTÁTICOS
// ============================================================================

// Método para buscar resultados por arquivo
Cnab240PythonResult.findByFileId = function(fileId) {
  return this.findAll({
    where: { cnab240_file_id: fileId },
    order: [['created_at', 'DESC']]
  });
};

// Método para buscar resultados por operação
Cnab240PythonResult.findByOperationId = function(operationId) {
  return this.findOne({
    where: { operation_id: operationId }
  });
};

// Método para estatísticas gerais
Cnab240PythonResult.getOverallStats = async function() {
  const stats = await this.findAll({
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalResults'],
      [sequelize.fn('SUM', sequelize.col('total_pagamentos')), 'totalPayments'],
      [sequelize.fn('SUM', sequelize.col('valor_total')), 'totalValue'],
      [sequelize.fn('AVG', sequelize.col('valor_medio')), 'averageValue'],
      [sequelize.fn('AVG', sequelize.col('success_rate')), 'averageSuccessRate']
    ],
    raw: true
  });
  
  return stats[0];
};

export default Cnab240PythonResult;