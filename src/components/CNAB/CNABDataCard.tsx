import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CNABApiProcessingResponse } from "@/lib/types";
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
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CNABDataCardProps {
  cnabData: CNABApiProcessingResponse;
  onViewDetails?: (operationId: string) => void;
  className?: string;
}

const CNABDataCard = ({
  cnabData,
  onViewDetails,
  className = ""
}: CNABDataCardProps) => {

  // Funções utilitárias para formatação
  const formatCurrency = (value: number | undefined): string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return "R$ 0,00";
    }
    return `R$ ${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadgeVariant = (success: boolean): "default" | "destructive" | "outline" | "secondary" => {
    return success ? "default" : "destructive";
  };

  const getStatusText = (success: boolean): string => {
    return success ? "Processado" : "Erro";
  };

  // Extrair informações dos dados CNAB
  const filename = cnabData.arquivo?.nome || "Arquivo CNAB";
  const fileSize = cnabData.arquivo?.tamanho || 0;
  const operationId = cnabData.operationId;
  const processedDate = cnabData.dataProcessamento ? new Date(cnabData.dataProcessamento) : new Date();
  const formatDetected = cnabData.formatoDetectado?.nome || "CNAB";
  //const confidence = cnabData.formatoDetectado?.confianca || 0;

  // Informações de somatorias
  const totalLotes = cnabData.dados?.somatorias?.totalLotes || 0;
  const totalRegistros = cnabData.dados?.somatorias?.totalRegistros || 0;
  const valorTotal = cnabData.dados?.somatorias?.valorTotal || 0;

  // Informações bancárias do header
  const bankCode = cnabData.dados?.dadosEstruturados?.header?.codigoBanco || "---";
  const bankName = cnabData.dados?.dadosEstruturados?.header?.nomeBanco || "Banco não identificado";

  return (
    <Card className={`transition-all duration-200 hover:shadow-lg border-l-4 ${cnabData.sucesso ? 'border-l-green-500 hover:border-l-green-600' : 'border-l-red-500 hover:border-l-red-600'
      } ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                {filename}
              </CardTitle>
              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(processedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <span>{formatFileSize(fileSize)}</span>
                <span>{formatDetected}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={getStatusBadgeVariant(cnabData.sucesso)} className="flex items-center space-x-1">
              {getStatusIcon(cnabData.sucesso)}
              <span>{getStatusText(cnabData.sucesso)}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Informações do banco */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Building2 className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Informações Bancárias</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Código:</span>
              <span className="ml-1 font-medium">{bankCode}</span>
            </div>
            <div>
              <span className="text-gray-500">Banco:</span>
              <span className="ml-1 font-medium">{bankName}</span>
            </div>
          </div>
        </div>

        {/* Grid de informações principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* Total de Lotes */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <FileStack className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Lotes</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{totalLotes.toLocaleString('pt-BR')}</p>
          </div>

          {/* Total de Registros */}
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <ListChecks className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Registros</span>
            </div>
            <p className="text-xl font-bold text-green-900">{totalRegistros.toLocaleString('pt-BR')}</p>
          </div>

          {/* Valor Total */}
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Total</span>
            </div>
            <p className="text-lg font-bold text-emerald-900">{formatCurrency(valorTotal)}</p>
          </div>

          {/* Operation ID */}
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Hash className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 uppercase tracking-wide">Operation</span>
            </div>
            <p className="text-sm font-mono text-purple-900 truncate" title={operationId}>
              {operationId.substring(0, 8)}...
            </p>
          </div>
        </div>


        {/* Mensagens de erro */}
        {!cnabData.sucesso && cnabData.erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 mb-1">Erro no processamento</p>
                <p className="text-sm text-red-700">{cnabData.erro}</p>
              </div>
            </div>
          </div>
        )}

        {/* Avisos de validação */}
        {cnabData.dados?.validacao?.avisos && cnabData.dados.validacao.avisos.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <Clock className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-1">Avisos de validação</p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {cnabData.dados.validacao.avisos.slice(0, 3).map((aviso, index) => (
                    <li key={index} className="list-disc list-inside">{aviso}</li>
                  ))}
                  {cnabData.dados.validacao.avisos.length > 3 && (
                    <li className="text-xs italic">... e mais {cnabData.dados.validacao.avisos.length - 3} avisos</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Botão de ação */}
        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails?.(operationId)}
            className="flex items-center space-x-2 hover:bg-blue-50 hover:border-blue-300"
          >
            <Eye className="h-4 w-4" />
            <span>Ver Detalhes</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CNABDataCard; 