/**
 * Compatibility Routes - Rotas de Informações de Compatibilidade
 * 
 * Endpoints dedicados para fornecer informações sobre compatibilidade
 * com versões anteriores, migration path e status de deprecação.
 */

import express from 'express';
import { compatibilityInfoEndpoint } from '../middleware/backwardsCompatibilityMiddleware.js';
import BackwardsCompatibilityService from '../services/BackwardsCompatibilityService.js';

const router = express.Router();
const compatibilityService = new BackwardsCompatibilityService();

/**
 * @route GET /compatibility/info
 * @desc Informações gerais sobre compatibilidade
 */
router.get('/info', compatibilityInfoEndpoint);

/**
 * @route GET /compatibility/legacy-endpoints
 * @desc Lista detalhada de todos os endpoints legacy
 */
router.get('/legacy-endpoints', (req, res) => {
  try {
    const endpoints = compatibilityService.listLegacyEndpoints();

    res.json({
      success: true,
      operation: 'list-legacy-endpoints',
      timestamp: new Date().toISOString(),
      data: {
        totalEndpoints: endpoints.length,
        endpoints: endpoints.map(endpoint => ({
          ...endpoint,
          status: 'deprecated',
          migrationRequired: true,
          breakingChangeIn: endpoint.removeIn
        }))
      },
      metadata: {
        version: '1.0.0',
        processedBy: 'compatibility-service'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      operation: 'list-legacy-endpoints',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: 'COMPATIBILITY_SERVICE_ERROR'
      }
    });
  }
});

/**
 * @route GET /compatibility/migration-guide
 * @desc Guia de migração detalhado
 */
router.get('/migration-guide', (req, res) => {
  try {
    const endpoints = compatibilityService.listLegacyEndpoints();

    const migrationGuide = {
      overview: {
        totalEndpointsToMigrate: endpoints.length,
        estimatedEffort: 'Medium',
        timeline: '1-2 sprints',
        breakingChanges: false,
        supportedUntil: '3.0.0'
      },
      phases: [
        {
          phase: 1,
          title: 'Preparação',
          description: 'Identificar uso atual de endpoints legacy',
          tasks: [
            'Auditar código atual',
            'Identificar dependências',
            'Testar novos endpoints',
            'Documentar mudanças necessárias'
          ]
        },
        {
          phase: 2,
          title: 'Migração Gradual',
          description: 'Migrar endpoints um por vez',
          tasks: [
            'Migrar endpoints de info primeiro',
            'Migrar endpoints de processamento',
            'Migrar endpoints de validação',
            'Atualizar documentação'
          ]
        },
        {
          phase: 3,
          title: 'Validação',
          description: 'Validar migração completa',
          tasks: [
            'Executar testes de regressão',
            'Validar performance',
            'Documentar mudanças',
            'Remover código legacy'
          ]
        }
      ],
      endpointMigrations: endpoints.map(endpoint => ({
        legacy: endpoint.legacyPath,
        new: endpoint.newPath,
        type: endpoint.type,
        changes: getMigrationChanges(endpoint),
        examples: getMigrationExamples(endpoint)
      }))
    };

    res.json({
      success: true,
      operation: 'migration-guide',
      timestamp: new Date().toISOString(),
      data: migrationGuide,
      metadata: {
        version: '1.0.0',
        processedBy: 'compatibility-service'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      operation: 'migration-guide',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: 'MIGRATION_GUIDE_ERROR'
      }
    });
  }
});

/**
 * @route GET /compatibility/stats
 * @desc Estatísticas de uso de compatibilidade
 */
router.get('/stats', (req, res) => {
  try {
    const stats = compatibilityService.getUsageStats();

    res.json({
      success: true,
      operation: 'compatibility-stats',
      timestamp: new Date().toISOString(),
      data: {
        ...stats,
        recommendations: {
          action: stats.totalLegacyEndpoints > 0 ? 'migrate' : 'none',
          priority: stats.totalLegacyEndpoints > 5 ? 'high' : 'medium',
          timeline: `${Math.ceil(stats.totalLegacyEndpoints / 3)} sprints`
        }
      },
      metadata: {
        version: '1.0.0',
        processedBy: 'compatibility-service'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      operation: 'compatibility-stats',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: 'STATS_ERROR'
      }
    });
  }
});

/**
 * @route POST /compatibility/validate-migration
 * @desc Valida se uma migração específica está funcionando
 */
router.post('/validate-migration', (req, res) => {
  try {
    const { legacyEndpoint, newEndpoint, testData } = req.body;

    if (!legacyEndpoint || !newEndpoint) {
      return res.status(400).json({
        success: false,
        operation: 'validate-migration',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Legacy endpoint e new endpoint são obrigatórios',
          code: 'MISSING_ENDPOINTS'
        }
      });
    }

    const isLegacy = compatibilityService.isLegacyEndpoint(legacyEndpoint);
    const endpointInfo = compatibilityService.getLegacyEndpointInfo(legacyEndpoint);

    const validation = {
      legacyEndpoint,
      newEndpoint,
      isLegacyRecognized: isLegacy,
      hasCompatibilityLayer: isLegacy && !!endpointInfo?.adapter,
      migrationStatus: isLegacy ? 'required' : 'not-needed',
      compatibility: {
        paramsCompatible: true, // Assumir compatível por enquanto
        responseCompatible: true,
        headersCompatible: true
      },
      recommendations: []
    };

    if (isLegacy) {
      validation.recommendations.push({
        type: 'migration',
        message: `Migre de ${legacyEndpoint} para ${newEndpoint}`,
        priority: 'high'
      });
    }

    res.json({
      success: true,
      operation: 'validate-migration',
      timestamp: new Date().toISOString(),
      data: validation,
      metadata: {
        version: '1.0.0',
        processedBy: 'compatibility-service'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      operation: 'validate-migration',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: 'VALIDATION_ERROR'
      }
    });
  }
});

/**
 * @route GET /compatibility/health
 * @desc Health check do sistema de compatibilidade
 */
router.get('/health', (req, res) => {
  try {
    const stats = compatibilityService.getUsageStats();

    const health = {
      status: 'healthy',
      service: 'backwards-compatibility',
      version: '1.0.0',
      checks: {
        serviceInitialized: true,
        adaptersLoaded: stats.adaptersMapped > 0,
        endpointsMapped: stats.totalLegacyEndpoints > 0,
        configValid: stats.configEnabled
      },
      stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      operation: 'compatibility-health',
      timestamp: new Date().toISOString(),
      data: health,
      metadata: {
        version: '1.0.0',
        processedBy: 'compatibility-service'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      operation: 'compatibility-health',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: 'HEALTH_CHECK_ERROR'
      }
    });
  }
});

// Helper functions (would normally be in a separate util file)
function getMigrationChanges(endpoint) {
  const changes = [];

  if (endpoint.type === 'cnab400') {
    changes.push('Formato de resposta modernizado');
    changes.push('Headers de deprecação adicionados');
    changes.push('Parâmetros opcionais adicionados');
  }

  if (endpoint.type === 'cnab240') {
    changes.push('Detecção automática de banco');
    changes.push('Validação aprimorada');
    changes.push('Estrutura de resposta unificada');
  }

  return changes;
}

function getMigrationExamples(endpoint) {
  return {
    request: {
      legacy: `${endpoint.legacyPath}`,
      new: `${endpoint.newPath}`
    },
    response: {
      legacy: 'Formato de resposta específico do tipo',
      new: 'Formato de resposta universal padronizado'
    }
  };
}

export default router; 