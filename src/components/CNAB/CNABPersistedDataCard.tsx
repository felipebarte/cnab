import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CNABPersistedData } from "@/lib/types";
import {
  FileText,
  Calendar,
  Building2,
  Hash,
  DollarSign,
  FileStack,
  ListChecks,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  UserCheck,
  XCircle,
  Send
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CNABPersistedDataCardProps {
  cnabData: CNABPersistedData;
  onViewDetails?: (id: number) => void;
  onViewPayments?: (id: number) => void;
  onUpdateStatus?: (id: number, status: CNABPersistedData['status']) => void;
  onExport?: (id: number) => void;
  className?: string;
  showActions?: boolean;
}

const CNABPersistedDataCard = ({
  cnabData,
  onViewDetails,
  onViewPayments,
  onUpdateStatus,
  onExport,
  className = "",
  showActions = true
}: CNABPersistedDataCardProps) => {

  // Funções utilitárias para formatação
  const formatCurrency = (value: number): string => {
    return `R$ ${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const getStatusIcon = (status: CNABPersistedData['status']) => {
    const statusIcons = {
      pending: <Clock className="h-4 w-4" />,
      processed: <FileText className="h-4 w-4" />,
      approved: <CheckCircle className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />,
      sent: <Send className="h-4 w-4" />
    };
    return statusIcons[status] || <AlertCircle className="h-4 w-4" />;
  };

  const getStatusColor = (status: CNABPersistedData['status']) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      processed: "bg-blue-100 text-blue-800 border-blue-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
      sent: "bg-purple-100 text-purple-800 border-purple-200"
    };
    return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusLabel = (status: CNABPersistedData['status']) => {
    const statusLabels = {
      pending: "Pendente",
      processed: "Processado",
      approved: "Aprovado",
      rejected: "Rejeitado",
      sent: "Enviado"
    };
    return statusLabels[status] || status;
  };

  return (
    <Card className={`hover:shadow-md transition-all duration-200 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {cnabData.empresa_nome}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                ID: {cnabData.id} • Operation: {cnabData.operationId.slice(0, 8)}...
              </p>
            </div>
          </div>
          <Badge 
            className={`flex items-center gap-1 ${getStatusColor(cnabData.status)}`}
            variant="outline"
          >
            {getStatusIcon(cnabData.status)}
            {getStatusLabel(cnabData.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações bancárias */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Banco</p>
              <p className="text-sm font-medium">
                {cnabData.banco_codigo} - {cnabData.banco_nome}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Sequencial</p>
              <p className="text-sm font-medium">#{cnabData.arquivo_sequencia}</p>
            </div>
          </div>
        </div>

        {/* Informações da empresa */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">CNPJ/CPF</p>
            <p className="text-sm font-medium">{cnabData.empresa_documento}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tipo Pessoa</p>
            <p className="text-sm font-medium">
              {cnabData.empresa_tipo_pessoa === '1' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Valor Total</p>
            <p className="text-sm font-semibold text-green-600">
              {formatCurrency(cnabData.valor_total)}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <FileStack className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Lotes</p>
            <p className="text-sm font-semibold text-blue-600">
              {cnabData.total_lotes}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ListChecks className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500">Registros</p>
            <p className="text-sm font-semibold text-purple-600">
              {cnabData.total_registros}
            </p>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Geração</p>
              <p className="font-medium">{formatDate(cnabData.data_geracao)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Criado em</p>
              <p className="font-medium">{formatDate(cnabData.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Ações */}
        {showActions && (
          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8"
              onClick={() => onViewDetails?.(cnabData.id)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Detalhes
            </Button>
            
            {cnabData.payments && cnabData.payments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8"
                onClick={() => onViewPayments?.(cnabData.id)}
              >
                <ListChecks className="h-3 w-3 mr-1" />
                Pagamentos
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport?.(cnabData.id)}
            >
              <Download className="h-3 w-3" />
            </Button>

            {/* Ações de status */}
            {cnabData.status === 'processed' && (
              <Button
                size="sm"
                className="h-8 bg-green-600 hover:bg-green-700"
                onClick={() => onUpdateStatus?.(cnabData.id, 'approved')}
              >
                <UserCheck className="h-3 w-3 mr-1" />
                Aprovar
              </Button>
            )}

            {cnabData.status === 'approved' && (
              <Button
                size="sm"
                className="h-8 bg-purple-600 hover:bg-purple-700"
                onClick={() => onUpdateStatus?.(cnabData.id, 'sent')}
              >
                <Send className="h-3 w-3 mr-1" />
                Enviar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CNABPersistedDataCard;