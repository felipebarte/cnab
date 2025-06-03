import CNABSwapOrchestrator from '../services/payments/CNABSwapOrchestrator.js';
import multer from 'multer';
import path from 'path';

/**
 * Controller para orquestração CNAB-Swap Financial
 */
class CNABSwapController {
  constructor() {
    this.orchestrator = new CNABSwapOrchestrator();

    // Configurar multer para upload de arquivos
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
      },
      fileFilter: this.fileFilter.bind(this)
    });
  }

  /**
   * Filtro de arquivos para multer
   */
  fileFilter(req, file, cb) {
    const allowedExtensions = ['.ret', '.rem', '.txt', '.cnab', '.240', '.400'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext) || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Use arquivos .ret, .rem, .txt, .cnab, .240 ou .400'), false);
    }
  }

  /**
   * Processar arquivo CNAB com Swap Financial
   * POST /api/cnab-swap/process
   */
  processFile = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Arquivo CNAB é obrigatório',
          message: 'Envie um arquivo CNAB válido'
        });
      }

      const options = {
        validateAll: req.body.validateAll !== 'false',
        batchSize: parseInt(req.body.batchSize) || 10,
        maxConcurrentRequests: parseInt(req.body.maxConcurrentRequests) || 5,
        includeInvalidBarcodes: req.body.includeInvalidBarcodes === 'true'
      };

      this.log('info', 'Processing CNAB file with Swap Financial', {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        options
      });

      const result = await this.orchestrator.processCNABFile(req.file.buffer, options);

      const statusCode = result.success ? 200 : 500;

      res.status(statusCode).json({
        ...result,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype
        },
        stats: this.orchestrator.getStats()
      });

    } catch (error) {
      this.log('error', 'Error processing CNAB file', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro no processamento do arquivo CNAB',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Verificar boletos específicos extraídos de CNAB
   * POST /api/cnab-swap/verify-barcodes
   */
  verifyBarcodes = async (req, res) => {
    try {
      const { barcodes } = req.body;

      if (!Array.isArray(barcodes) || barcodes.length === 0) {
        return res.status(400).json({
          error: 'Array de códigos de barras é obrigatório',
          message: 'Forneça um array com códigos de barras válidos'
        });
      }

      if (barcodes.length > 100) {
        return res.status(400).json({
          error: 'Muitos códigos de barras',
          message: 'Máximo de 100 códigos de barras por requisição'
        });
      }

      // Simular estrutura de boletos CNAB para verificação
      const mockBoletos = barcodes.map((barcode, index) => ({
        id: `cnab_${index + 1}`,
        barcode: barcode,
        type: 'boleto',
        status: 'pending'
      }));

      const result = await this.orchestrator.verifyBoletosWithSwap(mockBoletos);

      res.json({
        success: true,
        data: result,
        stats: this.orchestrator.getStats(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.log('error', 'Error verifying barcodes', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro na verificação dos códigos de barras',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Health check do orquestrador
   * GET /api/cnab-swap/health
   */
  healthCheck = async (req, res) => {
    try {
      const health = await this.orchestrator.healthCheck();
      const stats = this.orchestrator.getStats();

      const overall = health.orchestrator === 'healthy' &&
        health.swapService === 'healthy' &&
        health.paymentExtractor === 'healthy' ? 'healthy' : 'unhealthy';

      const statusCode = overall === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        status: overall,
        components: health,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Obter estatísticas do orquestrador
   * GET /api/cnab-swap/stats
   */
  getStats = async (req, res) => {
    try {
      const stats = this.orchestrator.getStats();

      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Resetar estatísticas
   * POST /api/cnab-swap/reset-stats
   */
  resetStats = async (req, res) => {
    try {
      this.orchestrator.resetStats();

      res.json({
        success: true,
        message: 'Estatísticas resetadas com sucesso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Limpar cache de verificações
   * DELETE /api/cnab-swap/cache
   */
  clearCache = async (req, res) => {
    try {
      this.orchestrator.clearCache();

      res.json({
        success: true,
        message: 'Cache limpo com sucesso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Simular processamento CNAB (para teste sem arquivo)
   * POST /api/cnab-swap/simulate
   */
  simulate = async (req, res) => {
    try {
      const { barcodes = [], mockCnabData = {} } = req.body;

      if (barcodes.length === 0) {
        return res.status(400).json({
          error: 'Códigos de barras são obrigatórios para simulação',
          message: 'Forneça um array de códigos de barras no body'
        });
      }

      // Criar dados CNAB simulados
      const mockCNABContent = this.createMockCNABContent(barcodes, mockCnabData);

      const options = {
        validateAll: req.body.validateAll !== 'false',
        batchSize: parseInt(req.body.batchSize) || 5,
        maxConcurrentRequests: parseInt(req.body.maxConcurrentRequests) || 3
      };

      const result = await this.orchestrator.processCNABFile(mockCNABContent, options);

      res.json({
        ...result,
        simulation: true,
        simulatedData: {
          barcodesCount: barcodes.length,
          mockData: mockCnabData
        },
        stats: this.orchestrator.getStats(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.log('error', 'Error in simulation', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro na simulação',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Criar conteúdo CNAB simulado para testes
   * @param {Array} barcodes - Códigos de barras
   * @param {Object} mockData - Dados simulados adicionais
   * @returns {string} Conteúdo CNAB simulado
   */
  createMockCNABContent(barcodes, mockData = {}) {
    const lines = [];

    // Header do arquivo
    lines.push('0' + '1'.padStart(9, '0') + 'SIMULACAO'.padEnd(20) + 'TESTE'.padEnd(30) + new Date().toISOString().slice(0, 10).replace(/-/g, '').padEnd(190));

    // Registros de detalhes (um para cada código de barras)
    barcodes.forEach((barcode, index) => {
      const value = mockData.value || 10000; // R$ 100,00 em centavos
      const dueDate = mockData.dueDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const detailLine = '1' + // Tipo de registro
        (index + 1).toString().padStart(9, '0') + // Sequencial
        barcode.padEnd(48) + // Código de barras
        value.toString().padStart(15, '0') + // Valor
        dueDate + // Data de vencimento
        'BENEFICIARIO TESTE'.padEnd(30) + // Beneficiário
        ''.padEnd(117); // Demais campos

      lines.push(detailLine.substring(0, 240)); // Garantir 240 caracteres
    });

    // Trailer do arquivo
    const trailerLine = '9' +
      (barcodes.length + 2).toString().padStart(9, '0') + // Total de registros
      ''.padEnd(230);

    lines.push(trailerLine);

    return lines.join('\n');
  }

  /**
   * Método de logging
   */
  log(level, message, metadata = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'CNABSwapController',
      level,
      message,
      ...metadata
    };

    console.log(JSON.stringify(logData));
  }
}

// Instância singleton do controller
const cnabSwapController = new CNABSwapController();

// Exportar métodos bound para uso nas rotas
export const processFile = cnabSwapController.processFile;
export const verifyBarcodes = cnabSwapController.verifyBarcodes;
export const healthCheck = cnabSwapController.healthCheck;
export const getStats = cnabSwapController.getStats;
export const resetStats = cnabSwapController.resetStats;
export const clearCache = cnabSwapController.clearCache;
export const simulate = cnabSwapController.simulate;
export const upload = cnabSwapController.upload;

export default cnabSwapController; 