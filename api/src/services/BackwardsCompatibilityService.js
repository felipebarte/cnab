/**
 * BackwardsCompatibilityService - Serviço de Compatibilidade com Versões Anteriores
 * 
 * Garante que todos os endpoints legacy continuem funcionando perfeitamente
 * mesmo com as atualizações e melhorias na API CNAB.
 * 
 * Funcionalidades:
 * - Mapeamento de formatos de resposta entre versões
 * - Adaptação de parâmetros de entrada
 * - Preservação de compatibilidade de contratos de API
 * - Zero breaking changes
 */

export class BackwardsCompatibilityService {
  constructor(config = {}) {
    this.config = {
      preserveLegacyFormat: true,
      enableVersionDetection: true,
      strictCompatibility: true,
      logCompatibilityIssues: true,
      ...config
    };

    this.legacyEndpoints = new Map();
    this.formatAdapters = new Map();
    this.deprecationWarnings = new Map();

    // Inicializar mapeamentos de endpoints legacy
    this._initializeLegacyEndpointMappings();
    this._initializeFormatAdapters();
    this._initializeDeprecationWarnings();
  }

  /**
   * Inicializa mapeamentos de endpoints legacy
   */
  _initializeLegacyEndpointMappings() {
    // CNAB 400 Legacy Routes
    this.legacyEndpoints.set('/api/v1/cnab/info', {
      type: 'cnab400',
      operation: 'info',
      newEndpoint: '/api/v1/cnab/universal/info',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab400InfoAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab/processar', {
      type: 'cnab400',
      operation: 'process',
      newEndpoint: '/api/v1/cnab/universal/processar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab400ProcessAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab/upload', {
      type: 'cnab400',
      operation: 'upload',
      newEndpoint: '/api/v1/cnab/universal/upload',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab400UploadAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab/validar', {
      type: 'cnab400',
      operation: 'validate',
      newEndpoint: '/api/v1/cnab/universal/validar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab400ValidateAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab/codigos-barras', {
      type: 'cnab400',
      operation: 'extractBarcodes',
      newEndpoint: '/api/v1/cnab/universal/processar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab400BarcodesAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab/linhas-digitaveis', {
      type: 'cnab400',
      operation: 'extractDigitableLines',
      newEndpoint: '/api/v1/cnab/universal/processar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab400DigitableLinesAdapter'
    });

    // CNAB 240 Legacy Routes
    this.legacyEndpoints.set('/api/v1/cnab240/info', {
      type: 'cnab240',
      operation: 'info',
      newEndpoint: '/api/v1/cnab/universal/info',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab240InfoAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab240/processar', {
      type: 'cnab240',
      operation: 'process',
      newEndpoint: '/api/v1/cnab/universal/processar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab240ProcessAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab240/validar', {
      type: 'cnab240',
      operation: 'validate',
      newEndpoint: '/api/v1/cnab/universal/validar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'cnab240ValidateAdapter'
    });

    // CNAB Unified Routes (já parcialmente modernos)
    this.legacyEndpoints.set('/api/v1/cnab/info-auto', {
      type: 'unified',
      operation: 'autoInfo',
      newEndpoint: '/api/v1/cnab/universal/info',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'unifiedInfoAdapter'
    });

    this.legacyEndpoints.set('/api/v1/cnab/processar-auto', {
      type: 'unified',
      operation: 'autoProcess',
      newEndpoint: '/api/v1/cnab/universal/processar',
      deprecatedSince: '2.0.0',
      removeIn: '3.0.0',
      adapter: 'unifiedProcessAdapter'
    });
  }

  /**
   * Inicializa adaptadores de formato
   */
  _initializeFormatAdapters() {
    // Adaptador para info CNAB 400
    this.formatAdapters.set('cnab400InfoAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        versao: modernResponse.data?.version || '1.0.0',
        api: 'CNAB 400 API',
        descricao: 'API para processamento de arquivos CNAB 400',
        recursos: [
          'Processamento de arquivos CNAB 400',
          'Validação de estrutura',
          'Extração de códigos de barras',
          'Extração de linhas digitáveis',
          'Integração via webhook'
        ],
        timestamp: modernResponse.timestamp
      };
    });

    // Adaptador para processamento CNAB 400
    this.formatAdapters.set('cnab400ProcessAdapter', (modernResponse) => {
      if (!modernResponse.success) {
        return {
          sucesso: false,
          erro: modernResponse.error?.message || 'Erro no processamento',
          detalhes: modernResponse.error?.details || {}
        };
      }

      return {
        sucesso: true,
        arquivo: {
          nome: modernResponse.data?.file?.name || 'arquivo.txt',
          tamanho: modernResponse.data?.file?.size || 0,
          formato: 'CNAB 400'
        },
        processamento: {
          registrosProcessados: modernResponse.data?.parsing?.metadata?.totalLines || 0,
          registrosValidos: modernResponse.data?.parsing?.metadata?.validLines || 0,
          registrosComErro: modernResponse.data?.parsing?.metadata?.errorLines || 0,
          tempoProcessamento: modernResponse.metadata?.timing?.total || '0ms'
        },
        dados: modernResponse.data?.parsing?.data || {},
        erros: modernResponse.data?.parsing?.errors || [],
        warnings: modernResponse.data?.parsing?.warnings || []
      };
    });

    // Adaptador para upload CNAB 400
    this.formatAdapters.set('cnab400UploadAdapter', (modernResponse) => {
      const processedResponse = this.formatAdapters.get('cnab400ProcessAdapter')(modernResponse);

      if (processedResponse.arquivo) {
        processedResponse.upload = {
          status: 'concluido',
          timestamp: modernResponse.timestamp
        };
      }

      return processedResponse;
    });

    // Adaptador para validação CNAB 400
    this.formatAdapters.set('cnab400ValidateAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        valido: modernResponse.data?.validation?.isValid || false,
        score: modernResponse.data?.validation?.score || 0,
        erros: modernResponse.data?.validation?.errors || [],
        warnings: modernResponse.data?.validation?.warnings || [],
        detalhes: {
          formato: 'CNAB 400',
          linhasAnalisadas: modernResponse.data?.validation?.metadata?.totalLines || 0,
          estruturaValida: modernResponse.data?.validation?.structure?.valid || false
        }
      };
    });

    // Adaptador para códigos de barras CNAB 400
    this.formatAdapters.set('cnab400BarcodesAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        codigosBarras: modernResponse.data?.parsing?.data?.payments?.map(payment =>
          payment.barcode
        ).filter(Boolean) || [],
        total: modernResponse.data?.parsing?.data?.payments?.length || 0,
        processamento: {
          tempoProcessamento: modernResponse.metadata?.timing?.total || '0ms'
        }
      };
    });

    // Adaptador para linhas digitáveis CNAB 400
    this.formatAdapters.set('cnab400DigitableLinesAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        linhasDigitaveis: modernResponse.data?.parsing?.data?.payments?.map(payment =>
          payment.digitableLine
        ).filter(Boolean) || [],
        total: modernResponse.data?.parsing?.data?.payments?.length || 0,
        processamento: {
          tempoProcessamento: modernResponse.metadata?.timing?.total || '0ms'
        }
      };
    });

    // Adaptador para info CNAB 240
    this.formatAdapters.set('cnab240InfoAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        versao: modernResponse.data?.version || '1.0.0',
        api: 'CNAB 240 API',
        descricao: 'API para processamento de arquivos CNAB 240',
        recursos: [
          'Processamento de arquivos CNAB 240',
          'Validação de estrutura',
          'Suporte a múltiplos bancos',
          'Integração via webhook',
          'Detecção automática de formato'
        ],
        bancos: modernResponse.data?.supportedBanks || [],
        timestamp: modernResponse.timestamp
      };
    });

    // Adaptador para processamento CNAB 240
    this.formatAdapters.set('cnab240ProcessAdapter', (modernResponse) => {
      if (!modernResponse.success) {
        return {
          sucesso: false,
          erro: modernResponse.error?.message || 'Erro no processamento',
          detalhes: modernResponse.error?.details || {}
        };
      }

      return {
        sucesso: true,
        arquivo: {
          nome: modernResponse.data?.file?.name || 'arquivo.txt',
          tamanho: modernResponse.data?.file?.size || 0,
          formato: 'CNAB 240',
          banco: modernResponse.data?.detection?.bankCode || 'N/A'
        },
        processamento: {
          registrosProcessados: modernResponse.data?.parsing?.metadata?.totalLines || 0,
          lotes: modernResponse.data?.parsing?.metadata?.batches || 0,
          segmentos: modernResponse.data?.parsing?.metadata?.segments || {},
          tempoProcessamento: modernResponse.metadata?.timing?.total || '0ms'
        },
        dados: modernResponse.data?.parsing?.data || {},
        erros: modernResponse.data?.parsing?.errors || [],
        warnings: modernResponse.data?.parsing?.warnings || []
      };
    });

    // Adaptador para validação CNAB 240
    this.formatAdapters.set('cnab240ValidateAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        valido: modernResponse.data?.validation?.isValid || false,
        score: modernResponse.data?.validation?.score || 0,
        banco: modernResponse.data?.detection?.bankCode || 'N/A',
        erros: modernResponse.data?.validation?.errors || [],
        warnings: modernResponse.data?.validation?.warnings || [],
        detalhes: {
          formato: 'CNAB 240',
          estruturaValida: modernResponse.data?.validation?.structure?.valid || false,
          sequenciaLotes: modernResponse.data?.validation?.batches?.valid || false,
          segmentosValidos: modernResponse.data?.validation?.segments?.valid || false
        }
      };
    });

    // Adaptadores para rotas unified
    this.formatAdapters.set('unifiedInfoAdapter', (modernResponse) => {
      return {
        sucesso: modernResponse.success,
        versao: modernResponse.data?.version || '1.0.0',
        api: 'CNAB Unified API',
        descricao: 'API unificada com detecção automática de formato CNAB',
        recursos: [
          'Detecção automática de formato',
          'Processamento CNAB 240 e 400',
          'Validação inteligente',
          'Suporte a múltiplos bancos'
        ],
        formatosSuportados: ['CNAB 240', 'CNAB 400'],
        deteccaoAutomatica: true,
        timestamp: modernResponse.timestamp
      };
    });

    this.formatAdapters.set('unifiedProcessAdapter', (modernResponse) => {
      if (!modernResponse.success) {
        return {
          sucesso: false,
          erro: modernResponse.error?.message || 'Erro no processamento',
          detalhes: modernResponse.error?.details || {}
        };
      }

      return {
        sucesso: true,
        formatoDetectado: modernResponse.data?.detection?.format || 'Desconhecido',
        banco: modernResponse.data?.detection?.bankCode || 'N/A',
        confianca: modernResponse.data?.detection?.confidence || 0,
        arquivo: {
          nome: modernResponse.data?.file?.name || 'arquivo.txt',
          tamanho: modernResponse.data?.file?.size || 0,
          formato: modernResponse.data?.detection?.format || 'Desconhecido'
        },
        processamento: {
          registrosProcessados: modernResponse.data?.parsing?.metadata?.totalLines || 0,
          tempoProcessamento: modernResponse.metadata?.timing?.total || '0ms',
          metodo: 'deteccao-automatica'
        },
        dados: modernResponse.data?.parsing?.data || {},
        validacao: modernResponse.data?.validation || null,
        erros: modernResponse.data?.parsing?.errors || [],
        warnings: modernResponse.data?.parsing?.warnings || []
      };
    });
  }

  /**
   * Inicializa avisos de deprecação
   */
  _initializeDeprecationWarnings() {
    this.deprecationWarnings.set('/api/v1/cnab/info',
      'Este endpoint está depreciado desde v2.0.0 e será removido em v3.0.0. Use /api/v1/cnab/universal/info'
    );

    this.deprecationWarnings.set('/api/v1/cnab/processar',
      'Este endpoint está depreciado desde v2.0.0 e será removido em v3.0.0. Use /api/v1/cnab/universal/processar'
    );

    this.deprecationWarnings.set('/api/v1/cnab240/info',
      'Este endpoint está depreciado desde v2.0.0 e será removido em v3.0.0. Use /api/v1/cnab/universal/info'
    );

    this.deprecationWarnings.set('/api/v1/cnab240/processar',
      'Este endpoint está depreciado desde v2.0.0 e será removido em v3.0.0. Use /api/v1/cnab/universal/processar'
    );
  }

  /**
   * Verifica se um endpoint é legacy
   */
  isLegacyEndpoint(path) {
    return this.legacyEndpoints.has(path);
  }

  /**
   * Obtém informações sobre um endpoint legacy
   */
  getLegacyEndpointInfo(path) {
    return this.legacyEndpoints.get(path);
  }

  /**
   * Adapta resposta moderna para formato legacy
   */
  adaptResponse(path, modernResponse) {
    const endpointInfo = this.legacyEndpoints.get(path);

    if (!endpointInfo || !endpointInfo.adapter) {
      return modernResponse;
    }

    const adapter = this.formatAdapters.get(endpointInfo.adapter);

    if (!adapter) {
      console.warn(`Adaptador não encontrado: ${endpointInfo.adapter}`);
      return modernResponse;
    }

    try {
      const adaptedResponse = adapter(modernResponse);

      // Adicionar aviso de deprecação se configurado
      if (this.config.enableVersionDetection) {
        const warning = this.deprecationWarnings.get(path);
        if (warning) {
          adaptedResponse._deprecationWarning = warning;
          adaptedResponse._newEndpoint = endpointInfo.newEndpoint;
        }
      }

      return adaptedResponse;
    } catch (error) {
      console.error(`Erro ao adaptar resposta para ${path}:`, error);
      return modernResponse;
    }
  }

  /**
   * Adapta parâmetros de entrada para novo formato
   */
  adaptRequestParams(path, params) {
    const endpointInfo = this.legacyEndpoints.get(path);

    if (!endpointInfo) {
      return params;
    }

    // Mapeamentos de parâmetros específicos
    const adaptedParams = { ...params };

    // Mapear campos comuns
    if (params.conteudo && !params.content) {
      adaptedParams.content = params.conteudo;
    }

    if (params.arquivo && !params.file) {
      adaptedParams.file = params.arquivo;
    }

    if (params.opcoes && !params.options) {
      adaptedParams.options = params.opcoes;
    }

    return adaptedParams;
  }

  /**
   * Obtém estatísticas de uso de endpoints legacy
   */
  getUsageStats() {
    return {
      totalLegacyEndpoints: this.legacyEndpoints.size,
      adaptersMapped: this.formatAdapters.size,
      deprecationWarnings: this.deprecationWarnings.size,
      configEnabled: this.config.preserveLegacyFormat
    };
  }

  /**
   * Lista todos os endpoints legacy e seus substitutos
   */
  listLegacyEndpoints() {
    const endpoints = [];

    for (const [path, info] of this.legacyEndpoints.entries()) {
      endpoints.push({
        legacyPath: path,
        newPath: info.newEndpoint,
        type: info.type,
        operation: info.operation,
        deprecatedSince: info.deprecatedSince,
        removeIn: info.removeIn,
        hasAdapter: !!info.adapter
      });
    }

    return endpoints;
  }

  /**
   * Middleware para adicionar headers de compatibilidade
   */
  addCompatibilityHeaders(req, res, next) {
    const path = req.path;

    if (this.isLegacyEndpoint(path)) {
      const endpointInfo = this.getLegacyEndpointInfo(path);

      // Adicionar headers de deprecação
      res.set('X-API-Deprecated', 'true');
      res.set('X-API-Deprecated-Since', endpointInfo.deprecatedSince);
      res.set('X-API-Remove-In', endpointInfo.removeIn);
      res.set('X-API-New-Endpoint', endpointInfo.newEndpoint);
      res.set('X-API-Compatibility-Mode', 'legacy');
    } else {
      res.set('X-API-Compatibility-Mode', 'modern');
    }

    next();
  }
}

export default BackwardsCompatibilityService; 