/**
 * Arquivo principal de modelos
 * 
 * Este arquivo importa todos os modelos Sequelize, configura as associações
 * entre eles e exporta tudo para uso na aplicação.
 */

import sequelize from '../config/database.js';
import { Op } from 'sequelize';

// Importar todos os modelos
import Operation from './Operation.js';
import File from './File.js';
import CnabHeader from './CnabHeader.js';
import CnabRecord from './CnabRecord.js';
import Cnab240File from './Cnab240File.js';

// Objeto para armazenar todos os modelos
const models = {
  Operation,
  File,
  CnabHeader,
  CnabRecord,
  Cnab240File,
  sequelize,
  Op
};

// ============================================================================
// CONFIGURAR ASSOCIAÇÕES ENTRE MODELOS
// ============================================================================

// Associações da tabela Operation (operações)
Operation.hasMany(File, {
  foreignKey: 'operation_id',
  sourceKey: 'operation_id',
  as: 'files'
});

Operation.hasMany(CnabHeader, {
  foreignKey: 'operation_id',
  sourceKey: 'operation_id',
  as: 'cnabHeaders'
});

Operation.hasMany(CnabRecord, {
  foreignKey: 'operation_id',
  sourceKey: 'operation_id',
  as: 'cnabRecords'
});

Operation.hasMany(Cnab240File, {
  foreignKey: 'operation_id',
  sourceKey: 'operation_id',
  as: 'cnab240File'
});

// Associações da tabela File (arquivos)
File.hasOne(CnabHeader, {
  foreignKey: 'file_id',
  as: 'cnabHeader'
});

File.hasMany(CnabRecord, {
  foreignKey: 'file_id',
  as: 'cnabRecords'
});

File.hasOne(Cnab240File, {
  foreignKey: 'file_id',
  as: 'cnab240File'
});

// Associações da tabela CnabHeader (cabeçalhos CNAB 400)
CnabHeader.hasMany(CnabRecord, {
  foreignKey: 'header_id',
  as: 'records'
});

// Configurar hooks globais para auditoria automática
const setupGlobalHooks = () => {
  // Hook global para todas as criações
  sequelize.addHook('afterCreate', (instance, options) => {
    const modelName = instance.constructor.name;
    console.log(`[AUDIT] Registro criado em ${modelName}: ID ${instance.id}`);
  });

  // Hook global para todas as atualizações
  sequelize.addHook('afterUpdate', (instance, options) => {
    const modelName = instance.constructor.name;
    const changedFields = Object.keys(instance.changed() || {});
    console.log(`[AUDIT] Registro atualizado em ${modelName}: ID ${instance.id}, Campos: ${changedFields.join(', ')}`);
  });

  // Hook global para todas as exclusões
  sequelize.addHook('afterDestroy', (instance, options) => {
    const modelName = instance.constructor.name;
    console.log(`[AUDIT] Registro excluído em ${modelName}: ID ${instance.id}`);
  });
};

// Executar configuração de hooks
setupGlobalHooks();

// ============================================================================
// FUNÇÕES UTILITÁRIAS PARA OPERAÇÕES COM MÚLTIPLOS MODELOS
// ============================================================================

/**
 * Função para criar uma operação completa com arquivo
 */
const createOperationWithFile = async (operationData, fileData, transaction = null) => {
  const t = transaction || await sequelize.transaction();

  try {
    // Criar operação
    const operation = await Operation.create(operationData, { transaction: t });

    // Criar arquivo vinculado à operação
    const file = await File.create({
      ...fileData,
      operation_id: operation.operation_id
    }, { transaction: t });

    // Commit da transação se não foi passada
    if (!transaction) {
      await t.commit();
    }

    return { operation, file };
  } catch (error) {
    // Rollback da transação se não foi passada
    if (!transaction) {
      await t.rollback();
    }
    throw error;
  }
};

/**
 * Função para processar arquivo CNAB 400 completo
 */
const processCnab400File = async (operationId, fileId, headerData, recordsData, transaction = null) => {
  const t = transaction || await sequelize.transaction();

  try {
    // Criar cabeçalho
    const header = await CnabHeader.create({
      ...headerData,
      operation_id: operationId,
      file_id: fileId
    }, { transaction: t });

    // Criar registros em batch
    const records = [];
    for (const recordData of recordsData) {
      const record = await CnabRecord.create({
        ...recordData,
        operation_id: operationId,
        file_id: fileId,
        header_id: header.id
      }, { transaction: t });
      records.push(record);
    }

    // Commit da transação se não foi passada
    if (!transaction) {
      await t.commit();
    }

    return { header, records };
  } catch (error) {
    // Rollback da transação se não foi passada
    if (!transaction) {
      await t.rollback();
    }
    throw error;
  }
};

/**
 * Função para processar arquivo CNAB 240 completo
 */
const processCnab240File = async (operationId, fileId, cnab240Data, transaction = null) => {
  const t = transaction || await sequelize.transaction();

  try {
    // Criar arquivo CNAB 240
    const cnab240File = await Cnab240File.create({
      ...cnab240Data,
      operation_id: operationId,
      file_id: fileId
    }, { transaction: t });

    // Commit da transação se não foi passada
    if (!transaction) {
      await t.commit();
    }

    return { cnab240File };
  } catch (error) {
    // Rollback da transação se não foi passada
    if (!transaction) {
      await t.rollback();
    }
    throw error;
  }
};

/**
 * Função para buscar dados completos de uma operação
 */
const getCompleteOperation = async (operationId) => {
  return await Operation.findOne({
    where: { operation_id: operationId },
    include: [
      {
        model: File,
        as: 'files',
        include: [
          {
            model: CnabHeader,
            as: 'cnabHeader',
            include: [
              {
                model: CnabRecord,
                as: 'records'
              }
            ]
          },
          {
            model: Cnab240File,
            as: 'cnab240File'
          }
        ]
      }
    ]
  });
};

/**
 * Função para estatísticas gerais do banco
 */
const getDatabaseStats = async () => {
  const [operationsCount, filesCount, cnabRecordsCount, cnab240FilesCount] = await Promise.all([
    Operation.count(),
    File.count(),
    CnabRecord.count(),
    Cnab240File.count()
  ]);

  return {
    operations: operationsCount,
    files: filesCount,
    cnab_records: cnabRecordsCount,
    cnab240_files: cnab240FilesCount,
    timestamp: new Date().toISOString()
  };
};

/**
 * Função para verificar saúde do banco de dados
 */
const checkDatabaseHealth = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      message: 'Conexão com banco de dados ativa',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Erro na conexão: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

export {
  // Modelos individuais
  Operation,
  File,
  CnabHeader,
  CnabRecord,
  Cnab240File,

  // Instância do Sequelize
  sequelize,

  // Operadores do Sequelize
  Op,

  // Funções utilitárias
  createOperationWithFile,
  processCnab400File,
  processCnab240File,
  getCompleteOperation,
  getDatabaseStats,
  checkDatabaseHealth
};

// Export default com todos os modelos
export default models; 