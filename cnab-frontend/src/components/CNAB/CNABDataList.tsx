import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CNABDataCard from "./CNABDataCard";
import PaymentVerificationModal from "./PaymentVerificationModal";
import {
  useCNABDataList,
  useCNABDataForCard,
  useCNABActions,
  CNABListOptions
} from "@/hooks/useCNABData";
import {
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CNABDataListProps {
  className?: string;
  initialFilters?: CNABListOptions;
}

const CNABDataList = ({ className = "", initialFilters = {} }: CNABDataListProps) => {
  const [filters, setFilters] = useState < CNABListOptions > ({
    page: 1,
    limit: 10,
    sortBy: 'processedAt',
    sortOrder: 'DESC',
    ...initialFilters
  });

  const [selectedOperationId, setSelectedOperationId] = useState < string | null > (null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hooks para dados
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

  const { approve, reject, sendToBank, isApproving, isRejecting, isSending } = useCNABActions();

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
      // Refetch para atualizar a lista
      refetchList();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
    }
  };

  const handleReject = async (operationId: string, reason: string) => {
    try {
      await reject({ operationId, reason });
      // Refetch para atualizar a lista
      refetchList();
    } catch (error) {
      console.error("Erro ao rejeitar:", error);
    }
  };

  const handleSendToBank = async (operationId: string) => {
    try {
      await sendToBank(operationId);
      // Refetch para atualizar a lista
      refetchList();
    } catch (error) {
      console.error("Erro ao enviar:", error);
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (newFilters: Partial<CNABListOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleRefresh = () => {
    refetchList();
  };

  // Renderização de loading
  if (isLoadingList) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Dados CNAB Processados</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Renderização de erro
  if (listError) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar dados CNAB: {listError.message}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  const results = listData?.transformedResults ?? [];
  const pagination = listData?.paginacao;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Dados CNAB Processados</span>
              {pagination && (
                <Badge variant="secondary" className="ml-2">
                  {pagination.total} resultados
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Atualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros básicos */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={filters.status === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange({ status: undefined })}
            >
              Todos
            </Button>
            <Button
              variant={filters.status === "success" ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange({ status: "success" })}
            >
              Concluídos
            </Button>
            <Button
              variant={filters.status === "processing" ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange({ status: "processing" })}
            >
              Processando
            </Button>
            <Button
              variant={filters.status === "error" ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange({ status: "error" })}
            >
              Com Erro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de resultados */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum resultado encontrado</p>
              <p className="text-sm">
                Não há dados CNAB processados com os filtros selecionados.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {results.map((cnabData) => (
            <CNABDataCard
              key={cnabData.operationId}
              cnabData={cnabData}
              onViewDetails={handleViewDetails}
              className="transition-all hover:shadow-md"
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.total > pagination.limit && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Página {pagination.page} de {Math.ceil(pagination.total / pagination.limit)}
                {' '}• {pagination.total} resultados
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de verificação de pagamento */}
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

      {/* Loading overlay para ações */}
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
    </div>
  );
};

export default CNABDataList; 