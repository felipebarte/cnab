import { asyncHandler } from '../utils/asyncHandler.js';

// @desc    Mensagem de boas-vindas da API
// @route   GET /api/v1
// @access  Public
export const getWelcome = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bem-vindo à API Node.js!',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      documentation: '/api/v1/docs', // Para implementar futuramente
    },
  });
});

// @desc    Status da API
// @route   GET /api/v1/status
// @access  Public
export const getStatus = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API funcionando corretamente!',
    timestamp: new Date().toISOString(),
    data: {
      server: 'online',
      database: 'não configurado', // Atualizar quando conectar ao banco
      cache: 'não configurado', // Atualizar quando configurar cache
    },
  });
});
