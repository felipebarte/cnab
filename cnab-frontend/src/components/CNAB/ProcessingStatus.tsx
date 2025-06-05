import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import CNABDataCard from "./CNABDataCard";
import PaymentVerificationModal from "./PaymentVerificationModal";
import {
  useCNABDataList,
  useCNABDataForCard,
  useCNABActions,
  useCNABStatistics,
  CNABListOptions
} from "@/hooks/useCNABData";

interface ProcessingStatusProps {
  onFileAction?: (file: any, action: string) => void;
}

const ProcessingStatus = ({
  onFileAction
}: ProcessingStatusProps) => {
  // Estados para integração da API
  const [filters, setFilters] = useState < CNABListOptions > ({
    page: 1,
    limit: 10, // Aumentar limite para mostrar mais arquivos
    sortBy: 'processedAt',
    sortOrder: 'DESC'
  });
  const [selectedOperationId, setSelectedOperationId] = useState < string | null > (null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hooks para dados da API
  const {
    data: listData,
    isLoading: isLoadingList,
    error: listError,
    refetch: refetchList
  } = useCNABDataList(filters);

  const {
    data: selectedCNABData,
    isLoading: isLoadingDetail
  } = useCNABDataForCard(selectedOperationId || '', !!selectedOperationId);

  const {
    data: statisticsData,
    isLoading: isLoadingStats,
    error: statsError
  } = useCNABStatistics();

  const {
    approve,
    reject,
    sendToBank,
    isApproving,
    isRejecting,
    isSending
  } = useCNABActions();

  // Dados da API
  const apiResults = listData?.transformedResults || [];
  const apiPagination = listData?.paginacao;

  // Loading geral
  const isLoadingData = isLoadingList;

  // Verificações de segurança para estatísticas
  const hasValidStatistics = statisticsData?.dados?.porTipo && Array.isArray(statisticsData.dados.porTipo);
  const statisticsArray = hasValidStatistics ? statisticsData.dados.porTipo : [];

  // Handlers
  const handleViewDetails = (operationId: string) => {
    setSelectedOperationId(operationId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOperationId(null);
  };

  const handleApprove = async (operationId: string) => {
    try {
      await approve(operationId);
      refetchList();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
    }
  };

  const handleReject = async (operationId: string, reason: string) => {
    try {
      await reject({ operationId, reason });
      refetchList();
    } catch (error) {
      console.error("Erro ao rejeitar:", error);
    }
  };

  const handleSendToBank = async (operationId: string) => {
    try {
      await sendToBank(operationId);
      refetchList();
    } catch (error) {
      console.error("Erro ao enviar:", error);
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleRefresh = () => {
    refetchList();
  };

  // Funções auxiliares para estatísticas
  const getTotalCount = () => {
    return statisticsArray.reduce((acc, t) => acc + (t.total || 0), 0);
  };

  const getCompletedCount = () => {
    return statisticsArray.find(t => t.status === 'success')?.total || 0;
  };

  const getErrorCount = () => {
    return statisticsArray.find(t => t.status === 'error')?.total || 0;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              Histórico de Processamento CNAB
              {isLoadingData && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {apiResults.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {apiResults.length} arquivo{apiResults.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoadingData}>
              <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Estatísticas rápidas da API */}
          {hasValidStatistics && !isLoadingStats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Total Processados</p>
                <p className="text-2xl font-bold text-blue-900">
                  {getTotalCount()}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Concluídos</p>
                <p className="text-2xl font-bold text-green-900">
                  {getCompletedCount()}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Com Erro</p>
                <p className="text-2xl font-bold text-red-900">
                  {getErrorCount()}
                </p>
              </div>
            </div>
          )}

          {/* Lista de arquivos */}
          <div className="space-y-4">
            {isLoadingData ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="h-8 w-8 mx-auto mb-3 text-blue-500 animate-spin" />
                <p className="text-lg font-medium">Carregando histórico de arquivos CNAB...</p>
                <p className="text-sm text-gray-400">Aguarde enquanto buscamos os dados processados.</p>
              </div>
            ) : listError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>Erro ao carregar dados CNAB: {listError.message}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      className="ml-3"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Tentar Novamente
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : apiResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Nenhum arquivo CNAB processado ainda</p>
                <p className="text-sm text-gray-400">Faça upload de arquivos CNAB para visualizá-los aqui.</p>
              </div>
            ) : (
              // Usar CNABDataCard para cada arquivo
              apiResults.map((cnabData) => (
                <CNABDataCard
                  key={cnabData.operationId}
                  cnabData={cnabData}
                  onViewDetails={handleViewDetails}
                  className="transition-all hover:shadow-md border border-gray-200 hover:border-blue-300"
                />
              ))
            )}
          </div>

          {/* Paginação para dados da API */}
          {apiPagination && apiPagination.total && apiPagination.limit && apiPagination.total > apiPagination.limit && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                Página {apiPagination.page || 1} de {Math.ceil((apiPagination.total || 0) / (apiPagination.limit || 1))} • {apiPagination.total} arquivo{apiPagination.total !== 1 ? 's' : ''} total
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange((apiPagination.page || 1) - 1)}
                  disabled={!apiPagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange((apiPagination.page || 1) + 1)}
                  disabled={!apiPagination.hasNext}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Verificação de Pagamento */}
      {selectedCNABData && (
        <PaymentVerificationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          cnabData={selectedCNABData}
          onApprove={handleApprove}
          onReject={handleReject}
          onSendToBank={handleSendToBank}
        />
      )}

      {/* Loading Overlay */}
      {(isApproving || isRejecting || isSending || isLoadingDetail) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium">
                {isLoadingDetail && "Carregando detalhes..."}
                {isApproving && "Aprovando operação..."}
                {isRejecting && "Rejeitando operação..."}
                {isSending && "Enviando ao banco..."}
              </span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default ProcessingStatus;
