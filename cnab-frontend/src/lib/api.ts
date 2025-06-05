import axios, { AxiosResponse, AxiosProgressEvent } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// API base URL (can be configured via environment variable)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Criar instância do axios com configurações padrão
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interfaces para tipagem
export interface CNABUploadResponse {
  sucesso: boolean;
  mensagem: string;
  dados?: {
    dadosEstruturados: Record<string, unknown>;
    validacao: Record<string, unknown>;
    somatorias?: Record<string, unknown>;
    resumoProcessamento?: Record<string, unknown>;
    informacoesArquivo: Record<string, unknown>;
  };
  formatoDetectado?: {
    codigo: string;
    nome: string;
    confianca: number;
  };
  deteccao?: Record<string, unknown>;
  arquivo: {
    nome: string;
    tamanho: number;
    tipo: string;
  };
  operationId: string;
  dataProcessamento: string;
  erro?: string;
  codigo?: string;
}

export interface CNABFormatDetectionResponse {
  sucesso: boolean;
  formatoDetectado: {
    codigo: string;
    nome: string;
    confianca: number;
    descricao: string;
  };
  deteccao: {
    detectado: boolean;
    confianca: number;
    detalhes: Record<string, unknown>;
  };
  operationId: string;
}

// Interfaces para os endpoints de resultados
export interface CNABResultadoResponse {
  sucesso: boolean;
  mensagem: string;
  dados: {
    operationId: string;
    operationType: string;
    status: string;
    processedAt: string;
    updatedAt: string;
    processingTimeMs: number;
    requestData: Record<string, unknown>;
    responseData: Record<string, unknown>;
    errorDetails?: string;
    file?: {
      id: number;
      name: string;
      hash: string;
      size: number;
      validationStatus: string;
      createdAt: string;
    };
    header?: {
      banco: {
        codigo: string;
        nome: string;
      };
      empresa: {
        documento: string;
        nome: string;
      };
      arquivo: {
        dataGeracao: string;
        numeroSequencial: number;
      };
      totals: {
        valorTotal: number;
        quantidadeRegistros: number;
      };
    };
    registros: Array<{
      id: number;
      sequencia: number;
      tipo: string;
      conteudo: string;
      dadosEstruturados: Record<string, unknown>;
      validationStatus: string;
    }>;
    estatisticas: {
      totalRegistros: number;
      registrosMostrados: number;
      temMaisRegistros: boolean;
      percentualProcessado: number;
    };
    metadata: {
      userAgent: string;
      ipAddress: string;
      hasError: boolean;
      isComplete: boolean;
    };
  };
  operationId: string;
}

export interface CNABListaResultadosResponse {
  sucesso: boolean;
  dados: Array<{
    operationId: string;
    operationType: string;
    status: string;
    processedAt: string;
    updatedAt: string;
    processingTimeMs: number | null;
    file?: {
      id: string;
      name: string;
      hash: string;
      size: string;
      validationStatus: string;
    };
    banco?: {
      codigo: string;
      nome: string;
    } | null;
    empresa?: {
      documento: string;
      nome: string;
    } | null;
    totals: {
      registros: number;
      valorTotal: number;
    };
    metadata: {
      userAgent: string | null;
      ipAddress: string | null;
      hasError: boolean;
    };
    errorDetails?: string;
  }>;
  paginacao: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filtros: {
    startDate?: string;
    endDate?: string;
    status?: string;
    operationType?: string;
    sortBy: string;
    sortOrder: string;
  };
  operationId: string;
}

export interface CNABEstatisticasResponse {
  sucesso: boolean;
  dados: {
    porTipo: Array<{
      operation_type: string;
      status: string;
      total: number;
    }>;
    recentes: Array<{
      data: string;
      total: number;
    }>;
    performance: {
      tempoMedioProcessamento: number;
      unidade: string;
    };
    periodo: {
      inicio: string;
      fim: string;
    };
  };
  operationId: string;
}

/**
 * Detecta o formato de um arquivo CNAB sem processá-lo
 */
export const detectarFormatoCNAB = async (arquivo: File): Promise<CNABFormatDetectionResponse> => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  try {
    const response: AxiosResponse<CNABFormatDetectionResponse> = await api.post(
      '/api/v1/cnab/detectar-formato',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao detectar formato do arquivo');
    }
    throw new Error('Erro de conexão ao detectar formato');
  }
};

/**
 * Processa um arquivo CNAB com detecção automática de formato
 */
export const processarCNABAutoUpload = async (
  arquivo: File,
  opcoes?: Record<string, unknown>,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<CNABUploadResponse> => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  
  if (opcoes) {
    formData.append('opcoes', JSON.stringify(opcoes));
  }

  try {
    const response: AxiosResponse<CNABUploadResponse> = await api.post(
      '/api/v1/cnab/processar-auto/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao processar arquivo CNAB');
    }
    throw new Error('Erro de conexão ao processar arquivo');
  }
};

/**
 * Processa arquivo CNAB e envia para webhook com detecção automática
 */
export const processarCNABEEnviarWebhook = async (
  arquivo: File,
  webhookUrl?: string,
  opcoes?: Record<string, unknown>,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<CNABUploadResponse> => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  
  if (webhookUrl) {
    formData.append('webhookUrl', webhookUrl);
  }
  
  if (opcoes) {
    formData.append('opcoes', JSON.stringify(opcoes));
  }

  try {
    const response: AxiosResponse<CNABUploadResponse> = await api.post(
      '/api/v1/cnab/webhook-auto/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao processar e enviar para webhook');
    }
    throw new Error('Erro de conexão ao processar e enviar arquivo');
  }
};

/**
 * Valida um arquivo CNAB automaticamente
 */
export const validarCNABAuto = async (arquivo: File): Promise<Record<string, unknown>> => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  try {
    const response = await api.post('/api/v1/cnab/validar-auto', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao validar arquivo CNAB');
    }
    throw new Error('Erro de conexão ao validar arquivo');
  }
};

/**
 * Lista todos os resultados de operações CNAB com paginação e filtros
 */
export const listarResultadosCNAB = async (
  opcoes?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    operationType?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }
): Promise<CNABListaResultadosResponse> => {
  try {
    const params = new URLSearchParams();
    
    if (opcoes?.page) params.append('page', opcoes.page.toString());
    if (opcoes?.limit) params.append('limit', opcoes.limit.toString());
    if (opcoes?.startDate) params.append('startDate', opcoes.startDate);
    if (opcoes?.endDate) params.append('endDate', opcoes.endDate);
    if (opcoes?.status) params.append('status', opcoes.status);
    if (opcoes?.operationType) params.append('operationType', opcoes.operationType);
    if (opcoes?.sortBy) params.append('sortBy', opcoes.sortBy);
    if (opcoes?.sortOrder) params.append('sortOrder', opcoes.sortOrder);
    
    const response: AxiosResponse<CNABListaResultadosResponse> = await api.get(
      `/api/v1/cnab/resultados?${params.toString()}`
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao listar resultados CNAB');
    }
    throw new Error('Erro de conexão ao listar resultados');
  }
};

/**
 * Busca resultado específico de uma operação CNAB por operationId
 */
export const buscarResultadoCNAB = async (operationId: string): Promise<CNABResultadoResponse> => {
  try {
    const response: AxiosResponse<CNABResultadoResponse> = await api.get(
      `/api/v1/cnab/resultados/${operationId}`
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao buscar resultado CNAB');
    }
    throw new Error('Erro de conexão ao buscar resultado');
  }
};

/**
 * Obtém estatísticas gerais dos resultados CNAB
 */
export const obterEstatisticasCNAB = async (): Promise<CNABEstatisticasResponse> => {
  try {
    const response: AxiosResponse<CNABEstatisticasResponse> = await api.get(
      '/api/v1/cnab/resultados/estatisticas'
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao obter estatísticas CNAB');
    }
    throw new Error('Erro de conexão ao obter estatísticas');
  }
};

// ================================
// NOVOS ENDPOINTS PARA DADOS DA PERSISTÊNCIA CNAB
// ================================

import { 
  CNABPersistedListResponse, 
  CNABPersistedData, 
  CNABPersistedFilters, 
  CNABPersistedStats,
  CNABPaymentData 
} from './types';

/**
 * Lista dados CNAB persistidos no banco com filtros avançados
 */
export const listarCNABPersistidos = async (
  filtros?: CNABPersistedFilters
): Promise<CNABPersistedListResponse> => {
  try {
    const params = new URLSearchParams();
    
    if (filtros?.page) params.append('page', filtros.page.toString());
    if (filtros?.limit) params.append('limit', filtros.limit.toString());
    if (filtros?.startDate) params.append('startDate', filtros.startDate);
    if (filtros?.endDate) params.append('endDate', filtros.endDate);
    if (filtros?.status) params.append('status', filtros.status);
    if (filtros?.banco) params.append('banco', filtros.banco);
    if (filtros?.empresa) params.append('empresa', filtros.empresa);
    if (filtros?.minValue) params.append('minValue', filtros.minValue.toString());
    if (filtros?.maxValue) params.append('maxValue', filtros.maxValue.toString());
    if (filtros?.sortBy) params.append('sortBy', filtros.sortBy);
    if (filtros?.sortOrder) params.append('sortOrder', filtros.sortOrder);
    
    const response: AxiosResponse<CNABPersistedListResponse> = await api.get(
      `/api/v1/cnab/persistidos?${params.toString()}`
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao listar dados CNAB persistidos');
    }
    throw new Error('Erro de conexão ao listar dados persistidos');
  }
};

/**
 * Busca dados CNAB persistidos específicos por ID
 */
export const buscarCNABPersistido = async (id: number): Promise<CNABPersistedData> => {
  try {
    const response: AxiosResponse<{ sucesso: boolean; dados: CNABPersistedData }> = await api.get(
      `/api/v1/cnab/persistidos/${id}`
    );

    return response.data.dados;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao buscar dados CNAB persistidos');
    }
    throw new Error('Erro de conexão ao buscar dados persistidos');
  }
};

/**
 * Busca pagamentos específicos de um arquivo CNAB persistido
 */
export const buscarPagamentosCNAB = async (
  cnabId: number,
  filtros?: { page?: number; limit?: number; search?: string }
): Promise<{ pagamentos: CNABPaymentData[]; total: number; page: number; totalPages: number }> => {
  try {
    const params = new URLSearchParams();
    
    if (filtros?.page) params.append('page', filtros.page.toString());
    if (filtros?.limit) params.append('limit', filtros.limit.toString());
    if (filtros?.search) params.append('search', filtros.search);
    
    const response = await api.get(
      `/api/v1/cnab/persistidos/${cnabId}/pagamentos?${params.toString()}`
    );

    return response.data.dados;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao buscar pagamentos CNAB');
    }
    throw new Error('Erro de conexão ao buscar pagamentos');
  }
};

/**
 * Obtém estatísticas dos dados CNAB persistidos
 */
export const obterEstatisticasCNABPersistidos = async (
  periodo?: { startDate?: string; endDate?: string }
): Promise<CNABPersistedStats> => {
  try {
    const params = new URLSearchParams();
    
    if (periodo?.startDate) params.append('startDate', periodo.startDate);
    if (periodo?.endDate) params.append('endDate', periodo.endDate);
    
    const response: AxiosResponse<{ sucesso: boolean; dados: CNABPersistedStats }> = await api.get(
      `/api/v1/cnab/persistidos/estatisticas?${params.toString()}`
    );

    return response.data.dados;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao obter estatísticas persistidas');
    }
    throw new Error('Erro de conexão ao obter estatísticas persistidas');
  }
};

/**
 * Atualiza status de um arquivo CNAB persistido
 */
export const atualizarStatusCNAB = async (
  id: number, 
  status: 'pending' | 'processed' | 'approved' | 'rejected' | 'sent',
  observacoes?: string
): Promise<CNABPersistedData> => {
  try {
    const response: AxiosResponse<{ sucesso: boolean; dados: CNABPersistedData }> = await api.patch(
      `/api/v1/cnab/persistidos/${id}/status`,
      { status, observacoes }
    );

    return response.data.dados;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao atualizar status CNAB');
    }
    throw new Error('Erro de conexão ao atualizar status');
  }
};

/**
 * Aprova múltiplos arquivos CNAB em lote
 */
export const aprovarCNABLote = async (
  ids: number[],
  observacoes?: string
): Promise<{ aprovados: number[]; rejeitados: number[]; erros: string[] }> => {
  try {
    const response = await api.post('/api/v1/cnab/persistidos/aprovar-lote', {
      ids,
      observacoes
    });

    return response.data.dados;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.erro || 'Erro ao aprovar CNAB em lote');
    }
    throw new Error('Erro de conexão ao aprovar em lote');
  }
};

/**
 * Exporta dados CNAB para diferentes formatos
 */
export const exportarCNABDados = async (
  ids: number[],
  formato: 'excel' | 'csv' | 'pdf' = 'excel'
): Promise<Blob> => {
  try {
    const response = await api.post(
      '/api/v1/cnab/persistidos/exportar',
      { ids, formato },
      { responseType: 'blob' }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error('Erro ao exportar dados CNAB');
    }
    throw new Error('Erro de conexão ao exportar dados');
  }
};

// Interceptor para adicionar logs de requisição
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 Requisição ${config.method?.toUpperCase()} para ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Erro na requisição:', error);
    return Promise.reject(error);
  }
);

// Interceptor para logs de resposta
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Resposta ${response.status} de ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ Erro ${error.response?.status} de ${error.config?.url}:`, error.response?.data);
    return Promise.reject(error);
  }
);

export { API_BASE_URL, api };