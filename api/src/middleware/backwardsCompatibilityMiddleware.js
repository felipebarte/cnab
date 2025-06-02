/**
 * Backwards Compatibility Middleware
 * 
 * Middleware que aplica automaticamente compatibilidade com versões anteriores
 * para endpoints legacy, garantindo zero breaking changes.
 */

import BackwardsCompatibilityService from '../services/BackwardsCompatibilityService.js';

// Instância global do serviço de compatibilidade
const compatibilityService = new BackwardsCompatibilityService();

/**
 * Middleware principal de compatibilidade
 * Intercepta requests e responses para endpoints legacy
 */
export const backwardsCompatibilityMiddleware = (req, res, next) => {
  const originalSend = res.send;
  const requestPath = req.path;

  // Adicionar headers de compatibilidade
  compatibilityService.addCompatibilityHeaders(req, res, () => { });

  // Se não é endpoint legacy, continuar normalmente
  if (!compatibilityService.isLegacyEndpoint(requestPath)) {
    return next();
  }

  console.log(`[BackwardsCompatibility] Interceptando endpoint legacy: ${requestPath}`);

  // Adaptar parâmetros de entrada se necessário
  if (req.body) {
    req.body = compatibilityService.adaptRequestParams(requestPath, req.body);
  }

  // Interceptar response.send para adaptar o formato
  res.send = function (data) {
    try {
      let responseData = data;

      // Se é uma string, tentar fazer parse para JSON
      if (typeof data === 'string') {
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          // Se não é JSON válido, manter como string
          return originalSend.call(this, data);
        }
      }

      // Adaptar resposta para formato legacy
      const adaptedResponse = compatibilityService.adaptResponse(requestPath, responseData);

      // Enviar resposta adaptada
      return originalSend.call(this, JSON.stringify(adaptedResponse));
    } catch (error) {
      console.error('Erro no middleware de compatibilidade:', error);
      // Em caso de erro, enviar resposta original
      return originalSend.call(this, data);
    }
  };

  next();
};

/**
 * Middleware para logging de uso de endpoints legacy
 */
export const legacyUsageLoggingMiddleware = (req, res, next) => {
  const requestPath = req.path;

  if (compatibilityService.isLegacyEndpoint(requestPath)) {
    const endpointInfo = compatibilityService.getLegacyEndpointInfo(requestPath);

    console.warn(`[LEGACY_ENDPOINT_USAGE] ${req.method} ${requestPath}`, {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
      deprecatedSince: endpointInfo.deprecatedSince,
      removeIn: endpointInfo.removeIn,
      newEndpoint: endpointInfo.newEndpoint,
      operationId: req.operationId
    });
  }

  next();
};

/**
 * Middleware para forçar avisos de deprecação em headers
 */
export const deprecationWarningMiddleware = (req, res, next) => {
  const requestPath = req.path;

  if (compatibilityService.isLegacyEndpoint(requestPath)) {
    const endpointInfo = compatibilityService.getLegacyEndpointInfo(requestPath);

    // Adicionar avisos mais visíveis
    res.set('Warning', `299 - "Deprecated API endpoint. Use ${endpointInfo.newEndpoint} instead."`);
    res.set('Sunset', endpointInfo.removeIn); // RFC 8594 - Header para indicar quando será removido
    res.set('Link', `<${endpointInfo.newEndpoint}>; rel="successor-version"`); // RFC 5988
  }

  next();
};

/**
 * Middleware para estatísticas de uso
 */
export const compatibilityStatsMiddleware = (req, res, next) => {
  // Adicionar metadados de compatibilidade ao request
  req.compatibilityMode = compatibilityService.isLegacyEndpoint(req.path) ? 'legacy' : 'modern';

  // Adicionar estatísticas do serviço se solicitado
  if (req.query.includeCompatibilityStats === 'true') {
    req.compatibilityStats = compatibilityService.getUsageStats();
  }

  next();
};

/**
 * Middleware combinado - aplica todos os middlewares de compatibilidade
 */
export const fullBackwardsCompatibilityMiddleware = [
  legacyUsageLoggingMiddleware,
  deprecationWarningMiddleware,
  compatibilityStatsMiddleware,
  backwardsCompatibilityMiddleware
];

/**
 * Endpoint de informações sobre compatibilidade
 */
export const compatibilityInfoEndpoint = (req, res) => {
  const stats = compatibilityService.getUsageStats();
  const endpoints = compatibilityService.listLegacyEndpoints();

  res.json({
    success: true,
    operation: 'backwards-compatibility-info',
    timestamp: new Date().toISOString(),
    data: {
      stats,
      legacyEndpoints: endpoints,
      currentMode: req.compatibilityMode || 'unknown',
      service: {
        version: '1.0.0',
        enabled: true,
        preserveLegacyFormat: true
      }
    },
    metadata: {
      version: '1.0.0',
      processedBy: 'backwards-compatibility-service'
    }
  });
};

/**
 * Função helper para verificar se um endpoint é legacy
 */
export const isLegacyEndpoint = (path) => {
  return compatibilityService.isLegacyEndpoint(path);
};

/**
 * Função helper para obter informações de um endpoint legacy
 */
export const getLegacyEndpointInfo = (path) => {
  return compatibilityService.getLegacyEndpointInfo(path);
};

export default {
  backwardsCompatibilityMiddleware,
  legacyUsageLoggingMiddleware,
  deprecationWarningMiddleware,
  compatibilityStatsMiddleware,
  fullBackwardsCompatibilityMiddleware,
  compatibilityInfoEndpoint,
  isLegacyEndpoint,
  getLegacyEndpointInfo
}; 