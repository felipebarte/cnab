/**
 * Configuração do banco de dados MySQL usando Sequelize
 * 
 * Este arquivo configura a conexão com o MySQL e define
 * as configurações de pool de conexões e outras otimizações.
 */

import { Sequelize, Transaction } from 'sequelize';
import Logger from '../utils/logger.js';

// Configurações do banco de dados a partir das variáveis de ambiente
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'cnab_database',
  username: process.env.DB_USER || 'cnab_user',
  password: process.env.DB_PASSWORD || 'cnab_pass_2024',
  charset: process.env.DB_CHARSET || 'utf8mb4',
  timezone: process.env.DB_TIMEZONE || '+00:00',

  // Configurações do pool de conexões
  pool: {
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    max: parseInt(process.env.DB_POOL_MAX) || 50,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
    idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
  }
};

// Configuração do Sequelize
const sequelizeConfig = {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: 'mysql',
  charset: dbConfig.charset,
  timezone: dbConfig.timezone,

  // Pool de conexões
  pool: dbConfig.pool,

  // Configurações de logging
  logging: (msg) => {
    if (process.env.NODE_ENV === 'development') {
      Logger.debug('Database Query', { query: msg });
    }
  },

  // Configurações adicionais
  define: {
    timestamps: true,
    underscored: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    freezeTableName: true, // Não pluralizar nomes das tabelas
  },

  // Configurações específicas do MySQL
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timezone: 'local',
    dateStrings: true,
    typeCast: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  },

  // Retry automático em caso de falha
  retry: {
    max: 3,
    backoffBase: 1000,
    backoffExponent: 1.5,
  },

  // Configurações de transação removidas para evitar erro SQL
  // transactionType: Transaction.TYPES.IMMEDIATE,
  // isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
};

// Criar instância do Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  sequelizeConfig
);

/**
 * Testa a conexão com o banco de dados
 */
export async function testConnection() {
  try {
    await sequelize.authenticate();
    Logger.info('Database connection established successfully', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      username: dbConfig.username
    });
    return true;
  } catch (error) {
    Logger.error('Unable to connect to the database', {
      error: error.message,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database
    });
    return false;
  }
}

/**
 * Sincroniza os modelos com o banco de dados
 * ATENÇÃO: Use alter: true em produção para evitar perda de dados
 */
export async function syncModels(options = {}) {
  try {
    const defaultOptions = {
      force: process.env.NODE_ENV === 'development' && process.env.DB_FORCE_SYNC === 'true',
      alter: process.env.NODE_ENV !== 'development',
      logging: (sql) => Logger.debug('Database Sync', { sql })
    };

    const syncOptions = { ...defaultOptions, ...options };

    await sequelize.sync(syncOptions);

    Logger.info('Database models synchronized successfully', syncOptions);
    return true;
  } catch (error) {
    Logger.error('Failed to synchronize database models', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Fecha a conexão com o banco de dados
 */
export async function closeConnection() {
  try {
    await sequelize.close();
    Logger.info('Database connection closed successfully');
  } catch (error) {
    Logger.error('Error closing database connection', {
      error: error.message
    });
  }
}

/**
 * Executa uma transação
 */
export async function transaction(callback) {
  return await sequelize.transaction(callback);
}

/**
 * Obtém estatísticas do pool de conexões
 */
export function getPoolStatus() {
  const pool = sequelize.connectionManager.pool;
  return {
    size: pool.size,
    available: pool.available,
    using: pool.using,
    waiting: pool.waiting
  };
}

/**
 * Configurações exportadas
 */
export const config = dbConfig;
export default sequelize; 