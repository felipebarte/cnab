/**
 * Middleware para gerar operationId único para cada requisição
 * 
 * Adiciona um ID único a cada requisição para rastreamento e logs.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Gera um operationId único para a requisição
 * @param {Object} req - Request object
 * @param {Object} res - Response object  
 * @param {Function} next - Next middleware function
 */
const operationIdMiddleware = (req, res, next) => {
  // Gerar ID único se não existir
  if (!req.operationId) {
    req.operationId = uuidv4();
  }

  // Adicionar ao headers de resposta para rastreamento
  res.setHeader('X-Operation-Id', req.operationId);

  next();
};

export default operationIdMiddleware; 