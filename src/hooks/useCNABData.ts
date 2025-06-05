import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  listarResultadosCNAB, 
  buscarResultadoCNAB, 
  processarCNABAutoUpload,
  detectarFormatoCNAB,
  obterEstatisticasCNAB,
  CNABListaResultadosResponse,
  CNABResultadoResponse,
} from '@/lib/api';
import { CNABApiProcessingResponse } from '@/lib/types';
import { AxiosProgressEvent } from 'axios';

// Chaves para o React Query
export const CNAB_QUERY_KEYS = {
  all: ['cnab'] as const,
  lists: () => [...CNAB_QUERY_KEYS.all, 'list'] as const,
  list: (filters: CNABListOptions) => [...CNAB_QUERY_KEYS.lists(), filters] as const,
  details: () => [...CNAB_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CNAB_QUERY_KEYS.details(), id] as const,
  statistics: () => [...CNAB_QUERY_KEYS.all, 'statistics'] as const,
};

// Opções para listagem de resultados CNAB
export interface CNABListOptions {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  operationType?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Hook para listar resultados CNAB
export const useCNABList = (options: CNABListOptions = {}) => {
  return useQuery<CNABListaResultadosResponse>({
    queryKey: CNAB_QUERY_KEYS.list(options),
    queryFn: () => listarResultadosCNAB(options),
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Hook para buscar detalhes de um resultado CNAB específico
export const useCNABDetail = (operationId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: CNAB_QUERY_KEYS.detail(operationId),
    queryFn: () => buscarResultadoCNAB(operationId),
    enabled: enabled && !!operationId,
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: false,
  });
};

// Hook para estatísticas CNAB
export const useCNABStatistics = () => {
  return useQuery({
    queryKey: CNAB_QUERY_KEYS.statistics(),
    queryFn: obterEstatisticasCNAB,
    staleTime: 300000, // 5 minutos
    refetchOnWindowFocus: false,
  });
};

// Hook para upload e processamento de arquivo CNAB
export const useCNABUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      file, 
      options, 
      onProgress 
    }: { 
      file: File; 
      options?: Record<string, unknown>; 
      onProgress?: (progressEvent: AxiosProgressEvent) => void;
    }) => {
      return processarCNABAutoUpload(file, options, onProgress);
    },
    onSuccess: () => {
      // Invalidar cache da lista para refletir o novo upload
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.statistics() });
    },
  });
};

// Hook para detecção de formato
export const useCNABFormatDetection = () => {
  return useMutation({
    mutationFn: (file: File) => detectarFormatoCNAB(file),
  });
};

// Hook personalizado para transformar dados da API para o formato esperado pelos componentes
export const useCNABDataTransform = () => {
  const transformApiResponseToCNABData = (apiResponse: CNABResultadoResponse): CNABApiProcessingResponse => {
    const { dados } = apiResponse;
    
    // Calcular totais mais precisos
    const totalRegistrosCalculado = dados.estatisticas?.totalRegistros || dados.header?.totals?.quantidadeRegistros || 0;
    const valorTotalCalculado = dados.header?.totals?.valorTotal || 0;
    const totalLotesCalculado = Math.max(1, Math.ceil(totalRegistrosCalculado / 50)); // Estimativa baseada em registros
    
    // Criar lotes simulados baseados nos dados disponíveis
    const lotesSimulados = Array.from({ length: Math.min(totalLotesCalculado, 10) }, (_, index) => ({
      numeroLote: index + 1,
      tipoOperacao: dados.operationType === 'cnab240' ? 'Pagamento' : 'Transferência',
      tipoServico: 'PIX/TED',
      registros: []
    }));
    
    return {
      mensagem: apiResponse.mensagem || 'Sucesso',
      operationId: dados.operationId,
      sucesso: apiResponse.sucesso && dados.status === 'success',
      erro: dados.errorDetails || null,
      dataProcessamento: dados.processedAt || new Date().toISOString(),
      arquivo: {
        nome: dados.file?.name || 'Arquivo CNAB',
        tamanho: dados.file?.size || 0,
        tipo: 'text/plain'
      },
      formatoDetectado: {
        nome: dados.operationType === 'cnab240' ? 'CNAB 240' : dados.operationType === 'cnab400' ? 'CNAB 400' : 'CNAB',
        codigo: dados.operationType === 'cnab240' ? 'CNAB_240' as const : 'CNAB_400' as const,
        confianca: dados.file?.validationStatus === 'valid' ? 0.95 : 0.7
      },
      dados: {
        somatorias: {
          totalLotes: totalLotesCalculado,
          totalRegistros: totalRegistrosCalculado,
          valorTotal: valorTotalCalculado
        },
        dadosEstruturados: {
          header: {
            codigoBanco: dados.header?.banco?.codigo || '---',
            nomeBanco: dados.header?.banco?.nome || 'Banco não identificado',
            agencia: '0001', // Valor padrão
            conta: '000000-0', // Valor padrão
            dataGeracao: dados.header?.arquivo?.dataGeracao || dados.processedAt,
            sequencialArquivo: dados.header?.arquivo?.numeroSequencial || 1
          },
          lotes: lotesSimulados,
          trailers: []
        },
        informacoesArquivo: {
          encoding: 'UTF-8',
          linhas: totalRegistrosCalculado,
          tamanho: dados.file?.size || 0,
          formato: dados.operationType === 'cnab240' ? 'CNAB 240' : 'CNAB 400'
        },
        validacao: {
          valido: dados.file?.validationStatus === 'valid',
          erros: dados.errorDetails ? [dados.errorDetails] : [],
          avisos: []
        }
      }
    };
  };

  return { transformApiResponseToCNABData };
};

// Hook combinado para buscar e transformar dados CNAB
export const useCNABDataForCard = (operationId: string, enabled: boolean = true) => {
  const { transformApiResponseToCNABData } = useCNABDataTransform();
  
  const query = useCNABDetail(operationId, enabled);
  
  return {
    ...query,
    data: query.data ? transformApiResponseToCNABData(query.data) : undefined,
  };
};

// Hook para ações de aprovação/rejeição (simulado - implementar conforme API real)
export const useCNABActions = () => {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (operationId: string) => {
      // Implementar chamada real para API de aprovação
      console.log('Aprovando operação:', operationId);
      return { success: true, operationId };
    },
    onSuccess: (data) => {
      // Invalidar cache do item específico
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.detail(data.operationId) });
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.lists() });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ operationId, reason }: { operationId: string; reason: string }) => {
      // Implementar chamada real para API de rejeição
      console.log('Rejeitando operação:', operationId, 'Motivo:', reason);
      return { success: true, operationId, reason };
    },
    onSuccess: (data) => {
      // Invalidar cache do item específico
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.detail(data.operationId) });
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.lists() });
    },
  });

  const sendToBankMutation = useMutation({
    mutationFn: async (operationId: string) => {
      // Implementar chamada real para API de envio ao banco
      console.log('Enviando ao banco:', operationId);
      return { success: true, operationId };
    },
    onSuccess: (data) => {
      // Invalidar cache do item específico
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.detail(data.operationId) });
      queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.lists() });
    },
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    sendToBank: sendToBankMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isSending: sendToBankMutation.isPending,
  };
};

// Hook para buscar múltiplos resultados CNAB para exibição em lista
export const useCNABDataList = (options: CNABListOptions = {}) => {
  const { transformApiResponseToCNABData } = useCNABDataTransform();
  
  const query = useCNABList(options);
  
  // Verificar se os dados existem e têm a estrutura esperada
  // A API retorna { sucesso, dados: [...], paginacao: {...} }
  const hasValidData = query.data?.dados && Array.isArray(query.data.dados);
  
  // Transformar cada resultado da lista apenas se existirem dados válidos
  const transformedData = hasValidData ? query.data.dados.map(resultado => {
    // Verificações de segurança para o resultado
    if (!resultado || !resultado.operationId) {
      return null;
    }

    // Criar um objeto compatível com CNABResultadoResponse para transformação
    // Usando a estrutura real retornada pela API
    const mockApiResponse: CNABResultadoResponse = {
      sucesso: true,
      mensagem: 'Sucesso',
      dados: {
        operationId: resultado.operationId,
        operationType: resultado.operationType || 'unknown',
        status: resultado.status || 'pending',
        processedAt: resultado.processedAt || new Date().toISOString(),
        updatedAt: resultado.updatedAt || resultado.processedAt || new Date().toISOString(),
        processingTimeMs: resultado.processingTimeMs || 0,
        requestData: {},
        responseData: {},
        errorDetails: resultado.errorDetails,
        file: resultado.file ? {
          id: parseInt(resultado.file.id) || 1,
          name: resultado.file.name || 'Arquivo CNAB',
          hash: resultado.file.hash || '',
          size: parseInt(resultado.file.size) || 0,
          validationStatus: resultado.file.validationStatus || 'pending',
          createdAt: resultado.processedAt || new Date().toISOString()
        } : undefined,
        header: {
          banco: { 
            codigo: resultado.banco?.codigo || '---', 
            nome: resultado.banco?.nome || 'Banco não identificado' 
          },
          empresa: { 
            documento: resultado.empresa?.documento || '---', 
            nome: resultado.empresa?.nome || '---' 
          },
          arquivo: { 
            dataGeracao: resultado.processedAt || new Date().toISOString(), 
            numeroSequencial: 1 
          },
          totals: { 
            valorTotal: resultado.totals?.valorTotal || 0, 
            quantidadeRegistros: resultado.totals?.registros || 0 
          }
        },
        registros: [],
        estatisticas: {
          totalRegistros: resultado.totals?.registros || 0,
          registrosMostrados: resultado.totals?.registros || 0,
          temMaisRegistros: false,
          percentualProcessado: 100
        },
        metadata: {
          userAgent: resultado.metadata?.userAgent || '',
          ipAddress: resultado.metadata?.ipAddress || '',
          hasError: resultado.metadata?.hasError || !!resultado.errorDetails,
          isComplete: resultado.status === 'success'
        }
      },
      operationId: resultado.operationId
    };
    
    return transformApiResponseToCNABData(mockApiResponse);
  }).filter(Boolean) : []; // Filtrar nulls

  return {
    ...query,
    data: query.data ? {
      ...query.data,
      transformedResults: transformedData || []
    } : undefined,
  };
}; 