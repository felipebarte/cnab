import { asyncHandler } from '../utils/asyncHandler.js';

// @desc    Verificação de saúde da aplicação
// @route   GET /health
// @access  Public
export const getHealthStatus = asyncHandler(async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used:
        Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total:
        Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
    },
  };

  // Verificações adicionais podem ser adicionadas aqui
  // como conexão com banco de dados, APIs externas, etc.

  res.status(200).json({
    success: true,
    data: healthCheck,
  });
});
