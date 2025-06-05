import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  FileText,
  Loader2,
  RefreshCw,
  Download,
  CheckSquare,
  Search,
  Filter,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  FileStack
} from "lucide-react";
import CNABPersistedDataCard from "./CNABPersistedDataCard";
import CNABPaymentsTable from "./CNABPaymentsTable";
import {
  useCNABPersistedDashboard,
  useCNABPersistedActions,
  CNABPersistedFilters
} from "@/hooks/useCNABPersistence";
import { CNABPersistedData } from "@/lib/types";
import { toast } from "sonner";

interface CNABPersistenceManagerProps {
  className?: string;
}

const CNABPersistenceManager = ({ className = "" }: CNABPersistenceManagerProps) => {
  // Estados locais
  const [filters, setFilters] = useState<CNABPersistedFilters>({
    page: 1,
    limit: 12,
    sortBy: 'createdAt',
    sortOrder: 'DESC'
  });
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [showPaymentsDialog, setShowPaymentsDialog] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Hooks para dados e ações
  const {
    files,
    pagination,
    statistics,
    isLoading,
    error,
    refetchAll
  } = useCNABPersistedDashboard(filters);

  const {
    updateStatus,
    batchApprove,
    exportData,
    isLoading: isActionsLoading
  } = useCNABPersistedActions();

  // Funções utilitárias
  const formatCurrency = (value: number): string => {
    return `R$ ${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusCount = (status: string) => {
    return statistics?.byStatus[status]?.count || 0;
  };

  const getStatusValue = (status: string) => {
    return statistics?.byStatus[status]?.value || 0;
  };

  // Handlers
  const handleFilterChange = (newFilters: Partial<CNABPersistedFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleFileSelect = (fileId: number, selected: boolean) => {
    setSelectedFiles(prev => 
      selected 
        ? [...prev, fileId]
        : prev.filter(id => id !== fileId)
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(file => file.id));
    }
  };

  const handleStatusUpdate = async (id: number, status: CNABPersistedData['status']) => {
    try {
      await updateStatus({ id, status });
      toast.success(`Status atualizado para: ${status}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleBatchApproval = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecione pelo menos um arquivo');
      return;
    }

    try {
      await batchApprove({ ids: selectedFiles });
      setSelectedFiles([]);
    } catch (error) {
      toast.error('Erro na aprovação em lote');
    }
  };

  const handleExport = async (fileIds: number[]) => {
    try {
      await exportData({ ids: fileIds, formato: 'excel' });
    } catch (error) {
      toast.error('Erro na exportação');
    }
  };

  const handleViewPayments = (cnabId: number) => {
    setShowPaymentsDialog(cnabId);
  };

  if (error) {
    return (
      <Alert className={`border-red-200 ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar dados: {error.message}
          <Button onClick={refetchAll} className="ml-2" size="sm">
            Tentar Novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileStack className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de Arquivos</p>
                <p className="text-2xl font-bold">{statistics?.totalFiles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(statistics?.totalValue || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de Pagamentos</p>
                <p className="text-2xl font-bold">{statistics?.totalPayments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Valor Médio</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(statistics?.averageValue || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['pending', 'processed', 'approved', 'rejected', 'sent'].map(status => (
          <Card key={status} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <div className="text-center">
                <Badge 
                  variant="outline" 
                  className="mb-2"
                >
                  {status === 'pending' && 'Pendente'}
                  {status === 'processed' && 'Processado'}
                  {status === 'approved' && 'Aprovado'}
                  {status === 'rejected' && 'Rejeitado'}
                  {status === 'sent' && 'Enviado'}
                </Badge>
                <p className="text-lg font-bold">{getStatusCount(status)}</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(getStatusValue(status))}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controles e filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Arquivos CNAB Persistidos
              {pagination && (
                <Badge variant="secondary">
                  {pagination.total} arquivos
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedFiles.length > 0 && (
                <Button
                  onClick={handleBatchApproval}
                  disabled={isActionsLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Aprovar Selecionados ({selectedFiles.length})
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button
                variant="outline"
                onClick={refetchAll}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Filtros expansíveis */}
        {showFilters && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Buscar</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Empresa, banco..."
                    value={filters.empresa || ''}
                    onChange={(e) => handleFilterChange({ empresa: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) => handleFilterChange({ status: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processed">Processado</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ordenar por</label>
                <Select
                  value={filters.sortBy || 'createdAt'}
                  onValueChange={(value) => handleFilterChange({ sortBy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Data de Criação</SelectItem>
                    <SelectItem value="valor_total">Valor Total</SelectItem>
                    <SelectItem value="empresa_nome">Nome da Empresa</SelectItem>
                    <SelectItem value="banco_nome">Banco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ordem</label>
                <Select
                  value={filters.sortOrder || 'DESC'}
                  onValueChange={(value) => handleFilterChange({ sortOrder: value as 'ASC' | 'DESC' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESC">Decrescente</SelectItem>
                    <SelectItem value="ASC">Crescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Lista de arquivos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-3" />
          <span className="text-lg">Carregando arquivos...</span>
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">Nenhum arquivo encontrado</h3>
            <p className="text-gray-500">
              Não há arquivos CNAB persistidos ou nenhum arquivo corresponde aos filtros aplicados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Seleção de todos */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={selectedFiles.length === files.length}
              onChange={handleSelectAll}
              className="rounded"
            />
            <label className="text-sm">
              Selecionar todos ({files.length} arquivos)
            </label>
          </div>

          {/* Grid de cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {files.map((file) => (
              <div key={file.id} className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file.id)}
                    onChange={(e) => handleFileSelect(file.id, e.target.checked)}
                    className="rounded"
                  />
                </div>
                <CNABPersistedDataCard
                  cnabData={file}
                  onViewPayments={handleViewPayments}
                  onUpdateStatus={handleStatusUpdate}
                  onExport={(id) => handleExport([id])}
                  className="ml-8"
                />
              </div>
            ))}
          </div>

          {/* Paginação */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Página {pagination.page} de {pagination.totalPages} • {pagination.total} arquivos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog para visualizar pagamentos */}
      <Dialog open={!!showPaymentsDialog} onOpenChange={() => setShowPaymentsDialog(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Pagamentos do Arquivo CNAB</DialogTitle>
            <DialogDescription>
              Visualize todos os pagamentos extraídos deste arquivo CNAB.
            </DialogDescription>
          </DialogHeader>
          {showPaymentsDialog && (
            <div className="overflow-auto max-h-[70vh]">
              <CNABPaymentsTable cnabId={showPaymentsDialog} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CNABPersistenceManager;