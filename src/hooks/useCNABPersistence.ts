import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  listarCNABPersistidos,
  buscarCNABPersistido,
  buscarPagamentosCNAB,
  obterEstatisticasCNABPersistidos,
  atualizarStatusCNAB,
  aprovarCNABLote,
  exportarCNABDados
} from '@/lib/api';
import { 
  CNABPersistedListResponse,
  CNABPersistedData, 
  CNABPersistedFilters, 
  CNABPersistedStats,
  CNABPaymentData 
} from '@/lib/types';
import { toast } from 'sonner';

// Chaves para o React Query - dados persistidos
export const CNAB_PERSISTENCE_QUERY_KEYS = {
  all: ['cnab-persistence'] as const,
  lists: () => [...CNAB_PERSISTENCE_QUERY_KEYS.all, 'list'] as const,
  list: (filters: CNABPersistedFilters) => [...CNAB_PERSISTENCE_QUERY_KEYS.lists(), filters] as const,
  details: () => [...CNAB_PERSISTENCE_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...CNAB_PERSISTENCE_QUERY_KEYS.details(), id] as const,
  payments: (cnabId: number, filters?: any) => [...CNAB_PERSISTENCE_QUERY_KEYS.all, 'payments', cnabId, filters] as const,
  statistics: (periodo?: any) => [...CNAB_PERSISTENCE_QUERY_KEYS.all, 'statistics', periodo] as const,
};

// Hook para listar dados CNAB persistidos
export const useCNABPersistedList = (filters: CNABPersistedFilters = {}) => {
  return useQuery<CNABPersistedListResponse>({
    queryKey: CNAB_PERSISTENCE_QUERY_KEYS.list(filters),
    queryFn: () => listarCNABPersistidos(filters),
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Hook para buscar detalhes de um CNAB persistido específico
export const useCNABPersistedDetail = (id: number, enabled: boolean = true) => {
  return useQuery<CNABPersistedData>({
    queryKey: CNAB_PERSISTENCE_QUERY_KEYS.detail(id),
    queryFn: () => buscarCNABPersistido(id),
    enabled: enabled && !!id && id > 0,
    staleTime: 120000, // 2 minutos
    refetchOnWindowFocus: false,
  });
};

// Hook para buscar pagamentos de um CNAB específico
export const useCNABPayments = (
  cnabId: number, 
  filters?: { page?: number; limit?: number; search?: string },
  enabled: boolean = true
) => {
  return useQuery<{ pagamentos: CNABPaymentData[]; total: number; page: number; totalPages: number }>({
    queryKey: CNAB_PERSISTENCE_QUERY_KEYS.payments(cnabId, filters),
    queryFn: () => buscarPagamentosCNAB(cnabId, filters),
    enabled: enabled && !!cnabId && cnabId > 0,
    staleTime: 300000, // 5 minutos
    refetchOnWindowFocus: false,
  });
};

// Hook para estatísticas de dados persistidos
export const useCNABPersistedStatistics = (periodo?: { startDate?: string; endDate?: string }) => {
  return useQuery<CNABPersistedStats>({
    queryKey: CNAB_PERSISTENCE_QUERY_KEYS.statistics(periodo),
    queryFn: () => obterEstatisticasCNABPersistidos(periodo),
    staleTime: 300000, // 5 minutos
    refetchOnWindowFocus: false,
  });
};

// Hook para atualizar status de CNAB
export const useCNABStatusUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      status, 
      observacoes 
    }: { 
      id: number; 
      status: 'pending' | 'processed' | 'approved' | 'rejected' | 'sent';
      observacoes?: string;
    }) => {
      return atualizarStatusCNAB(id, status, observacoes);
    },
    onSuccess: (data, variables) => {
      // Invalidar cache relevante
      queryClient.invalidateQueries({ queryKey: CNAB_PERSISTENCE_QUERY_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: CNAB_PERSISTENCE_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CNAB_PERSISTENCE_QUERY_KEYS.statistics() });
      
      toast.success(`Status atualizado para: ${variables.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
};

// Hook para aprovação em lote
export const useCNABBatchApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      ids, 
      observacoes 
    }: { 
      ids: number[]; 
      observacoes?: string;
    }) => {
      return aprovarCNABLote(ids, observacoes);
    },
    onSuccess: (data) => {
      // Invalidar todo o cache para refletir as mudanças
      queryClient.invalidateQueries({ queryKey: CNAB_PERSISTENCE_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CNAB_PERSISTENCE_QUERY_KEYS.statistics() });
      
      // Invalidar detalhes dos items específicos
      data.aprovados.forEach(id => {
        queryClient.invalidateQueries({ queryKey: CNAB_PERSISTENCE_QUERY_KEYS.detail(id) });
      });
      
      toast.success(
        `Aprovação em lote concluída: ${data.aprovados.length} aprovados, ${data.rejeitados.length} rejeitados`
      );
      
      if (data.erros.length > 0) {
        data.erros.forEach(erro => toast.error(`Erro: ${erro}`));
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro na aprovação em lote: ${error.message}`);
    },
  });
};

// Hook para exportação de dados
export const useCNABExport = () => {
  return useMutation({
    mutationFn: ({ 
      ids, 
      formato 
    }: { 
      ids: number[]; 
      formato: 'excel' | 'csv' | 'pdf';
    }) => {
      return exportarCNABDados(ids, formato);
    },
    onSuccess: (blob, variables) => {
      // Criar URL do blob e fazer download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = variables.formato === 'excel' ? 'xlsx' : variables.formato;
      link.download = `cnab_export_${timestamp}.${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Dados exportados em ${variables.formato.toUpperCase()}`);
    },
    onError: (error: Error) => {
      toast.error(`Erro na exportação: ${error.message}`);
    },
  });
};

// Hook combinado para ações de gerenciamento
export const useCNABPersistedActions = () => {
  const statusUpdate = useCNABStatusUpdate();
  const batchApproval = useCNABBatchApproval();
  const exportData = useCNABExport();

  return {
    // Atualização de status
    updateStatus: statusUpdate.mutateAsync,
    isUpdatingStatus: statusUpdate.isPending,
    
    // Aprovação em lote
    batchApprove: batchApproval.mutateAsync,
    isBatchApproving: batchApproval.isPending,
    
    // Exportação
    exportData: exportData.mutateAsync,
    isExporting: exportData.isPending,
    
    // Estados combinados
    isLoading: statusUpdate.isPending || batchApproval.isPending || exportData.isPending,
  };
};

// Hook para dashboard com dados combinados
export const useCNABPersistedDashboard = (filters?: CNABPersistedFilters) => {
  const listQuery = useCNABPersistedList(filters);
  const statsQuery = useCNABPersistedStatistics();

  return {
    // Dados da lista
    files: listQuery.data?.dados || [],
    pagination: listQuery.data?.paginacao,
    
    // Estatísticas
    statistics: statsQuery.data,
    
    // Estados de carregamento
    isLoadingFiles: listQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    isLoading: listQuery.isLoading || statsQuery.isLoading,
    
    // Erros
    error: listQuery.error || statsQuery.error,
    
    // Funções de refetch
    refetchFiles: listQuery.refetch,
    refetchStats: statsQuery.refetch,
    refetchAll: async () => {
      await Promise.all([listQuery.refetch(), statsQuery.refetch()]);
    },
  };
};

// Hook para transformar dados persistidos para componentes existentes
export const useCNABPersistedDataTransform = () => {
  const transformPersistedToCNABData = (persistedData: CNABPersistedData) => {
    return {
      sucesso: true,
      mensagem: 'Dados persistidos carregados',
      operationId: persistedData.operationId,
      dataProcessamento: persistedData.createdAt,
      arquivo: {
        nome: `${persistedData.empresa_nome}_${persistedData.arquivo_sequencia}.cnab`,
        tamanho: 0, // Não disponível nos dados persistidos
        tipo: 'text/plain'
      },
      formatoDetectado: {
        codigo: 'CNAB_240' as const,
        nome: 'CNAB 240',
        confianca: 1.0
      },
      dados: {
        somatorias: {
          totalLotes: persistedData.total_lotes,
          totalRegistros: persistedData.total_registros,
          valorTotal: persistedData.valor_total
        },
        dadosEstruturados: {
          header: {
            codigoBanco: persistedData.banco_codigo,
            nomeBanco: persistedData.banco_nome,
            dataGeracao: persistedData.data_geracao,
            sequencialArquivo: persistedData.arquivo_sequencia
          },
          lotes: [],
          trailers: []
        },
        informacoesArquivo: {
          encoding: 'UTF-8',
          linhas: persistedData.total_registros,
          tamanho: 0,
          formato: 'CNAB 240'
        },
        validacao: {
          valido: persistedData.status !== 'rejected',
          erros: [],
          avisos: []
        }
      }
    };
  };

  return { transformPersistedToCNABData };
};