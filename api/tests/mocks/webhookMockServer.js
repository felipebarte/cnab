import express from 'express';
import http from 'http';

/**
 * Mock server para simular webhook externo durante testes
 */
class WebhookMockServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 0;
    this.requests = [];
    this.responses = {};

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));

    // Middleware para capturar todas as requisições
    this.app.use((req, res, next) => {
      this.requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString()
      });
      next();
    });
  }

  setupRoutes() {
    // Endpoint padrão de sucesso
    this.app.post('/webhook/cnab', (req, res) => {
      const config = this.responses['/webhook/cnab'] || { status: 200, delay: 0 };

      setTimeout(() => {
        res.status(config.status).json(config.response || {
          success: true,
          message: 'Dados CNAB recebidos com sucesso',
          timestamp: new Date().toISOString(),
          dataReceived: {
            totalRegistros: req.body.resumo?.totalRegistros,
            arquivo: req.body.arquivo?.nome
          }
        });
      }, config.delay);
    });

    // Endpoint que sempre retorna erro 500
    this.app.post('/webhook/error', (req, res) => {
      const config = this.responses['/webhook/error'] || { status: 500, delay: 0 };

      setTimeout(() => {
        res.status(config.status).json({
          error: 'Internal Server Error',
          message: 'Erro simulado do webhook',
          timestamp: new Date().toISOString()
        });
      }, config.delay);
    });

    // Endpoint que simula timeout (nunca responde)
    this.app.post('/webhook/timeout', (req, res) => {
      // Nunca responde para simular timeout
      const config = this.responses['/webhook/timeout'] || { delay: 60000 };

      setTimeout(() => {
        res.status(200).json({ delayed: true });
      }, config.delay);
    });

    // Endpoint que retorna erro de autenticação
    this.app.post('/webhook/unauthorized', (req, res) => {
      const config = this.responses['/webhook/unauthorized'] || { status: 401, delay: 0 };

      setTimeout(() => {
        res.status(config.status).json({
          error: 'Unauthorized',
          message: 'Token de autenticação inválido',
          timestamp: new Date().toISOString()
        });
      }, config.delay);
    });

    // Endpoint configurável para testes específicos
    this.app.post('/webhook/custom', (req, res) => {
      const config = this.responses['/webhook/custom'] || { status: 200, delay: 0 };

      setTimeout(() => {
        res.status(config.status).json(config.response || {
          success: true,
          custom: true,
          timestamp: new Date().toISOString()
        });
      }, config.delay);
    });

    // Endpoint que falha nas primeiras tentativas e depois funciona
    this.app.post('/webhook/retry', (req, res) => {
      const tentativa = parseInt(req.headers['x-tentativa'] || '1');
      const config = this.responses['/webhook/retry'] || { successAfter: 3, delay: 0 };

      setTimeout(() => {
        if (tentativa < config.successAfter) {
          res.status(500).json({
            error: 'Temporary Error',
            message: `Falha temporária - tentativa ${tentativa}`,
            retry: true,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(200).json({
            success: true,
            message: `Sucesso na tentativa ${tentativa}`,
            retriesRequired: tentativa - 1,
            timestamp: new Date().toISOString()
          });
        }
      }, config.delay);
    });

    // Endpoint para verificar health do mock server
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        server: 'Webhook Mock Server',
        uptime: process.uptime(),
        requestsReceived: this.requests.length,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Inicia o servidor mock
   * @param {number} port - Porta opcional (0 para porta aleatória)
   * @returns {Promise<number>} Porta em que o servidor está rodando
   */
  async start(port = 0) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);

      this.server.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          this.port = this.server.address().port;
          console.log(`🎯 Webhook Mock Server rodando na porta ${this.port}`);
          resolve(this.port);
        }
      });
    });
  }

  /**
   * Para o servidor mock
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Webhook Mock Server parado');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Obtém a URL base do servidor mock
   * @returns {string} URL base
   */
  getBaseUrl() {
    return `http://localhost:${this.port}`;
  }

  /**
   * Obtém URL completa para um endpoint
   * @param {string} path - Caminho do endpoint
   * @returns {string} URL completa
   */
  getUrl(path) {
    return `${this.getBaseUrl()}${path}`;
  }

  /**
   * Configura resposta para um endpoint específico
   * @param {string} path - Caminho do endpoint
   * @param {Object} config - Configuração da resposta
   * @param {number} config.status - Status HTTP a retornar
   * @param {Object} config.response - Objeto de resposta
   * @param {number} config.delay - Delay em ms antes de responder
   * @param {number} config.successAfter - Para endpoint retry, sucesso após N tentativas
   */
  setResponse(path, config) {
    this.responses[path] = config;
  }

  /**
   * Limpa todas as requisições capturadas
   */
  clearRequests() {
    this.requests = [];
  }

  /**
   * Obtém todas as requisições capturadas
   * @returns {Array} Lista de requisições
   */
  getRequests() {
    return [...this.requests];
  }

  /**
   * Obtém a última requisição capturada
   * @returns {Object|null} Última requisição ou null
   */
  getLastRequest() {
    return this.requests.length > 0 ? this.requests[this.requests.length - 1] : null;
  }

  /**
   * Obtém requisições para um endpoint específico
   * @param {string} path - Caminho do endpoint
   * @returns {Array} Requisições filtradas
   */
  getRequestsForPath(path) {
    return this.requests.filter(req => req.url === path);
  }

  /**
   * Conta requisições para um endpoint específico
   * @param {string} path - Caminho do endpoint
   * @returns {number} Número de requisições
   */
  countRequestsForPath(path) {
    return this.getRequestsForPath(path).length;
  }

  /**
   * Reset completo do servidor (limpa requisições e configurações)
   */
  reset() {
    this.clearRequests();
    this.responses = {};
  }

  /**
   * Aguarda até receber uma quantidade específica de requisições
   * @param {number} count - Número de requisições esperadas
   * @param {number} timeout - Timeout em ms (padrão: 10000)
   * @returns {Promise<boolean>} True se recebeu o número esperado
   */
  async waitForRequests(count, timeout = 10000) {
    const startTime = Date.now();

    while (this.requests.length < count) {
      if (Date.now() - startTime > timeout) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return true;
  }

  /**
   * Aguarda até receber uma requisição em um endpoint específico
   * @param {string} path - Caminho do endpoint
   * @param {number} timeout - Timeout em ms (padrão: 5000)
   * @returns {Promise<Object|null>} Requisição recebida ou null se timeout
   */
  async waitForRequestOnPath(path, timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const requests = this.getRequestsForPath(path);
      if (requests.length > 0) {
        return requests[requests.length - 1];
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }
}

export default WebhookMockServer; 