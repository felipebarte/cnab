import SwapFinancialService from '../services/external/SwapFinancialService.js';
import { getSwapServiceConfig } from '../config/swapConfig.js';

/**
 * Controller para operações da Swap Financial API
 */
class SwapController {
  constructor() {
    this.swapService = null;
    this.initializeService();
  }

  /**
   * Inicializar serviço Swap Financial
   */
  initializeService() {
    try {
      const config = getSwapServiceConfig();
      this.swapService = new SwapFinancialService(config);
    } catch (error) {
      console.error('Failed to initialize Swap Financial service:', error.message);
      this.swapService = null;
    }
  }

  /**
   * Middleware para verificar se o serviço está disponível
   */
  checkServiceAvailability = (req, res, next) => {
    if (!this.swapService) {
      return res.status(503).json({
        error: 'Swap Financial service is not available',
        message: 'Service configuration is invalid or missing'
      });
    }
    next();
  };

  /**
   * Health check da integração Swap Financial
   * GET /api/swap/health
   */
  healthCheck = async (req, res) => {
    try {
      if (!this.swapService) {
        return res.status(503).json({
          status: 'unhealthy',
          service: 'SwapFinancial',
          error: 'Service not initialized'
        });
      }

      const healthData = await this.swapService.healthCheck();
      const config = this.swapService.getConfiguration();

      const response = {
        status: healthData.status,
        service: 'SwapFinancial',
        environment: config.environment,
        timestamp: new Date().toISOString(),
        ...healthData
      };

      const statusCode = healthData.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        service: 'SwapFinancial',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter informações de configuração (sem dados sensíveis)
   * GET /api/swap/config
   */
  getConfiguration = async (req, res) => {
    try {
      if (!this.swapService) {
        return res.status(503).json({
          error: 'Swap Financial service is not available'
        });
      }

      const config = this.swapService.getConfiguration();
      res.json({
        service: 'SwapFinancial',
        timestamp: new Date().toISOString(),
        ...config
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get configuration',
        message: error.message
      });
    }
  };

  /**
   * Verificar autenticação (obter token)
   * POST /api/swap/auth
   */
  authenticate = async (req, res) => {
    try {
      const accessToken = await this.swapService.getAccessToken();

      res.json({
        success: true,
        message: 'Authentication successful',
        hasAccessToken: !!accessToken,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Limpar cache de tokens
   * DELETE /api/swap/auth
   */
  clearAuthCache = async (req, res) => {
    try {
      this.swapService.clearTokenCache();

      res.json({
        success: true,
        message: 'Authentication cache cleared',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to clear auth cache',
        message: error.message
      });
    }
  };

  /**
   * Verificar boleto
   * POST /api/swap/boletos/check
   */
  checkBoleto = async (req, res) => {
    try {
      const { barcode } = req.body;

      if (!barcode) {
        return res.status(400).json({
          error: 'Barcode is required',
          message: 'Please provide a valid barcode in the request body'
        });
      }

      const boletoData = await this.swapService.checkBoleto(barcode);

      res.json({
        success: true,
        data: boletoData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const statusCode = this.getErrorStatusCode(error);

      res.status(statusCode).json({
        error: 'Failed to check boleto',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Verificar múltiplos boletos
   * POST /api/swap/boletos/check-batch
   */
  checkBoletoBatch = async (req, res) => {
    try {
      const { barcodes } = req.body;

      if (!Array.isArray(barcodes) || barcodes.length === 0) {
        return res.status(400).json({
          error: 'Barcodes array is required',
          message: 'Please provide an array of barcodes in the request body'
        });
      }

      if (barcodes.length > 100) {
        return res.status(400).json({
          error: 'Too many barcodes',
          message: 'Maximum 100 barcodes allowed per batch'
        });
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const barcode of barcodes) {
        try {
          const boletoData = await this.swapService.checkBoleto(barcode);
          results.push({
            barcode,
            success: true,
            data: boletoData
          });
          successCount++;
        } catch (error) {
          results.push({
            barcode,
            success: false,
            error: error.message
          });
          errorCount++;
        }
      }

      res.json({
        success: true,
        summary: {
          total: barcodes.length,
          successful: successCount,
          failed: errorCount
        },
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to process batch',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Revalidar configuração e reinicializar serviço
   * POST /api/swap/revalidate
   */
  revalidateService = async (req, res) => {
    try {
      this.initializeService();

      if (!this.swapService) {
        return res.status(503).json({
          success: false,
          message: 'Failed to reinitialize service - configuration is invalid'
        });
      }

      // Testar se a nova configuração funciona
      const config = this.swapService.getConfiguration();

      res.json({
        success: true,
        message: 'Service revalidated and reinitialized successfully',
        configuration: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to revalidate service',
        message: error.message
      });
    }
  };

  /**
   * Obter métricas de circuit breaker
   * GET /api/swap/metrics
   */
  getMetrics = async (req, res) => {
    try {
      if (!this.swapService) {
        return res.status(503).json({
          error: 'Swap Financial service is not available'
        });
      }

      const circuitBreakerStatus = this.swapService.getCircuitBreakerStatus();
      const config = this.swapService.getConfiguration();

      res.json({
        service: 'SwapFinancial',
        metrics: {
          circuitBreaker: circuitBreakerStatus,
          tokenCache: config.tokenCacheStatus
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error.message
      });
    }
  };

  /**
   * Determinar código de status HTTP baseado no tipo de erro
   */
  getErrorStatusCode(error) {
    const message = error.message.toLowerCase();

    if (message.includes('authentication failed') || message.includes('unauthorized')) {
      return 401;
    }

    if (message.includes('invalid barcode format') || message.includes('required')) {
      return 400;
    }

    if (message.includes('business hours') || message.includes('already paid')) {
      return 422;
    }

    if (message.includes('service temporarily unavailable') || message.includes('circuit breaker')) {
      return 503;
    }

    if (message.includes('timeout')) {
      return 504;
    }

    return 500;
  }
}

// Instância singleton do controller
const swapController = new SwapController();

// Exportar métodos bound para uso nas rotas
export const healthCheck = swapController.healthCheck;
export const getConfiguration = swapController.getConfiguration;
export const authenticate = swapController.authenticate;
export const clearAuthCache = swapController.clearAuthCache;
export const checkBoleto = swapController.checkBoleto;
export const checkBoletoBatch = swapController.checkBoletoBatch;
export const revalidateService = swapController.revalidateService;
export const getMetrics = swapController.getMetrics;
export const checkServiceAvailability = swapController.checkServiceAvailability;

export default swapController; 