/**
 * Modelo para segmentos CNAB240 com suporte à lógica Python
 * 
 * Este modelo representa segmentos individuais (A, B, J, O) de arquivos CNAB240
 * com suporte completo para dados extraídos com lógica Python
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Cnab240Segment = sequelize.define('Cnab240Segment', {
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
    comment: 'ID da operação'
  },
  
  // Dados básicos do segmento
  numero_sequencial: {
    type: DataTypes.INTEGER,
    comment: 'Número sequencial do registro'
  },
  
  segmento_codigo: {
    type: DataTypes.CHAR(1),
    comment: 'Código do segmento (A, B, J, O)'
  },
  
  lote_numero: {
    type: DataTypes.INTEGER,
    comment: 'Número do lote'
  },
  
  // Dados de pagamento
  valor_pagamento: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Valor do pagamento'
  },
  
  data_pagamento: {
    type: DataTypes.STRING(8),
    comment: 'Data do pagamento (DDMMAAAA)'
  },
  
  codigo_barras: {
    type: DataTypes.STRING(60),
    comment: 'Código de barras'
  },
  
  // Dados do beneficiário
  beneficiario_nome: {
    type: DataTypes.STRING(100),
    comment: 'Nome do beneficiário/favorecido'
  },
  
  beneficiario_documento: {
    type: DataTypes.STRING(20),
    comment: 'CNPJ/CPF do beneficiário'
  },
  
  beneficiario_banco: {
    type: DataTypes.STRING(10),
    comment: 'Código do banco do beneficiário'
  },
  
  beneficiario_agencia: {
    type: DataTypes.STRING(10),
    comment: 'Agência do beneficiário'
  },
  
  beneficiario_conta: {
    type: DataTypes.STRING(20),
    comment: 'Conta do beneficiário'
  },
  
  // Dados de endereço (Segmento B)
  endereco_logradouro: {
    type: DataTypes.STRING(100),
    comment: 'Logradouro'
  },
  
  endereco_numero: {
    type: DataTypes.STRING(20),
    comment: 'Número do endereço'
  },
  
  endereco_complemento: {
    type: DataTypes.STRING(50),
    comment: 'Complemento'
  },
  
  endereco_bairro: {
    type: DataTypes.STRING(50),
    comment: 'Bairro'
  },
  
  endereco_cidade: {
    type: DataTypes.STRING(50),
    comment: 'Cidade'
  },
  
  endereco_cep: {
    type: DataTypes.STRING(10),
    comment: 'CEP'
  },
  
  endereco_uf: {
    type: DataTypes.CHAR(2),
    comment: 'Estado (UF)'
  },
  
  // ============================================================================
  // CAMPOS ESPECÍFICOS DA LÓGICA PYTHON
  // ============================================================================
  
  // Dados do pagador (segunda linha J do parser Python)
  pagador_nome: {
    type: DataTypes.STRING(100),
    comment: 'Nome do pagador extraído da segunda linha J'
  },
  
  pagador_documento: {
    type: DataTypes.STRING(20),
    comment: 'CNPJ/CPF do pagador da segunda linha J'
  },
  
  // Dados de endereço completo (segmento B formatado)
  endereco_completo: {
    type: DataTypes.TEXT,
    comment: 'Endereço completo formatado pelo parser Python'
  },
  
  email: {
    type: DataTypes.STRING(255),
    comment: 'Email extraído do segmento B'
  },
  
  // Metadados do parser Python
  parsing_method: {
    type: DataTypes.ENUM('traditional', 'python_logic', 'hybrid'),
    defaultValue: 'traditional',
    comment: 'Método de parsing utilizado'
  },
  
  segment_sequence: {
    type: DataTypes.JSON,
    comment: 'Sequência de segmentos relacionados (J+J, J+B)'
  },
  
  python_parsing_metadata: {
    type: DataTypes.JSON,
    comment: 'Metadados específicos do parser Python'
  },
  
  // Campos adicionais do parser Python
  codigo_movimento: {
    type: DataTypes.STRING(20),
    comment: 'Código de movimento extraído'
  },
  
  codigo_camara: {
    type: DataTypes.STRING(10),
    comment: 'Código da câmara de compensação'
  },
  
  documento: {
    type: DataTypes.STRING(50),
    comment: 'Documento/referência do pagamento'
  },
  
  descontos: {
    type: DataTypes.STRING(20),
    comment: 'Valor de descontos'
  },
  
  acrescimos: {
    type: DataTypes.STRING(20),
    comment: 'Valor de acréscimos'
  },
  
  informacoes: {
    type: DataTypes.TEXT,
    comment: 'Informações adicionais'
  },
  
  // Campos PIX (se aplicável)
  pix_chave: {
    type: DataTypes.STRING(255),
    comment: 'Chave PIX'
  },
  
  pix_tipo_chave: {
    type: DataTypes.STRING(20),
    comment: 'Tipo da chave PIX'
  },
  
  // Metadados gerais
  dados_originais: {
    type: DataTypes.JSON,
    comment: 'Dados originais completos do segmento'
  },
  
  validation_status: {
    type: DataTypes.ENUM('valid', 'invalid', 'warning'),
    defaultValue: 'valid',
    comment: 'Status de validação'
  },
  
  validation_details: {
    type: DataTypes.JSON,
    comment: 'Detalhes da validação'
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
  tableName: 'cnab240_segments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: 'Segmentos CNAB240 com suporte à lógica Python',
  
  indexes: [
    {
      fields: ['cnab240_file_id']
    },
    {
      fields: ['operation_id']
    },
    {
      fields: ['segmento_codigo']
    },
    {
      fields: ['codigo_barras']
    },
    {
      fields: ['beneficiario_nome']
    },
    {
      fields: ['pagador_nome']
    },
    {
      fields: ['pagador_documento']
    },
    {
      fields: ['email']
    },
    {
      fields: ['parsing_method']
    },
    {
      fields: ['codigo_movimento']
    },
    {
      fields: ['valor_pagamento']
    }
  ]
});

// ============================================================================
// HOOKS E VALIDAÇÕES
// ============================================================================

// Hook para formatação automática de dados
Cnab240Segment.addHook('beforeSave', (instance) => {
  // Formatar endereço completo se não existe e temos dados individuais
  if (!instance.endereco_completo && instance.endereco_logradouro) {
    const enderecoPartes = [
      instance.endereco_logradouro,
      instance.endereco_numero,
      instance.endereco_complemento,
      instance.endereco_bairro,
      instance.endereco_cidade,
      instance.endereco_uf,
      instance.endereco_cep ? `CEP: ${instance.endereco_cep}` : ''
    ].filter(parte => parte && parte.trim()).join(', ');
    
    instance.endereco_completo = enderecoPartes;
  }
  
  // Validar código de barras
  if (instance.codigo_barras && instance.codigo_barras.length < 10) {
    instance.validation_status = 'warning';
    instance.validation_details = {
      warning: 'Código de barras parece estar incompleto'
    };
  }
});

// ============================================================================
// MÉTODOS DE INSTÂNCIA
// ============================================================================

// Método para obter dados Python formatados
Cnab240Segment.prototype.getPythonData = function() {
  return {
    favorecido_nome: this.beneficiario_nome,
    pagador_nome: this.pagador_nome,
    cnpj_pagador: this.pagador_documento,
    cnpj_favorecido: this.beneficiario_documento,
    banco_favorecido: this.beneficiario_banco,
    valor: parseFloat(this.valor_pagamento || 0),
    data_pagamento: this.data_pagamento,
    documento: this.documento,
    codigo_banco: this.beneficiario_banco,
    codigo_lote: this.lote_numero?.toString(),
    tipo_registro: '3',
    numero_registro: this.numero_sequencial?.toString(),
    segmento: this.segmento_codigo,
    codigo_movimento: this.codigo_movimento,
    codigo_camara: this.codigo_camara,
    informacoes: this.informacoes,
    descontos: this.descontos,
    acrescimos: this.acrescimos,
    codigo_barras: this.codigo_barras,
    endereco_completo: this.endereco_completo,
    logradouro: this.endereco_logradouro,
    numero_endereco: this.endereco_numero,
    complemento: this.endereco_complemento,
    bairro: this.endereco_bairro,
    cidade: this.endereco_cidade,
    cep: this.endereco_cep,
    uf: this.endereco_uf,
    email: this.email
  };
};

// Método para obter resumo do segmento
Cnab240Segment.prototype.getSummary = function() {
  return {
    id: this.id,
    segmento: this.segmento_codigo,
    favorecido: this.beneficiario_nome,
    pagador: this.pagador_nome,
    valor: parseFloat(this.valor_pagamento || 0),
    codigoBarras: this.codigo_barras,
    parsingMethod: this.parsing_method,
    pythonEnabled: this.parsing_method !== 'traditional'
  };
};

// ============================================================================
// MÉTODOS ESTÁTICOS
// ============================================================================

// Buscar segmentos por arquivo
Cnab240Segment.findByFileId = function(fileId, options = {}) {
  return this.findAll({
    where: { cnab240_file_id: fileId },
    order: [['numero_sequencial', 'ASC']],
    ...options
  });
};

// Buscar segmentos Python por arquivo
Cnab240Segment.findPythonSegmentsByFileId = function(fileId, options = {}) {
  return this.findAll({
    where: { 
      cnab240_file_id: fileId,
      parsing_method: ['python_logic', 'hybrid']
    },
    order: [['numero_sequencial', 'ASC']],
    ...options
  });
};

// Buscar segmentos por operação
Cnab240Segment.findByOperationId = function(operationId, options = {}) {
  return this.findAll({
    where: { operation_id: operationId },
    order: [['numero_sequencial', 'ASC']],
    ...options
  });
};

// Buscar por código de barras
Cnab240Segment.findByCodigoBarras = function(codigoBarras) {
  return this.findAll({
    where: { codigo_barras: codigoBarras },
    order: [['created_at', 'DESC']]
  });
};

// Estatísticas por método de parsing
Cnab240Segment.getStatsByParsingMethod = async function() {
  return await this.findAll({
    attributes: [
      'parsing_method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('valor_pagamento')), 'total_value']
    ],
    group: ['parsing_method'],
    raw: true
  });
};

// Criar segmentos em lote com dados Python
Cnab240Segment.createPythonSegments = async function(segmentsData, transaction = null) {
  const t = transaction || await sequelize.transaction();
  
  try {
    const segments = await this.bulkCreate(
      segmentsData.map(data => ({
        ...data,
        parsing_method: 'python_logic'
      })), 
      { 
        transaction: t,
        validate: true
      }
    );
    
    if (!transaction) {
      await t.commit();
    }
    
    return segments;
  } catch (error) {
    if (!transaction) {
      await t.rollback();
    }
    throw error;
  }
};

export default Cnab240Segment;