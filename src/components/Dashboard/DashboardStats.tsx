import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, AlertCircle, CheckCircle, FileText } from "lucide-react";
import { DashboardStats as DashboardStatsType } from "@/lib/types";

interface DashboardStatsProps {
  stats: DashboardStatsType;
}

const DashboardStats = ({ stats }: DashboardStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Total de Pagamentos</CardTitle>
          <FileText className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalPagamentos}</div>
          <p className="text-xs text-gray-500 mt-1">
            R$ {stats.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || "0,00"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Pagamentos Pendentes</CardTitle>
          <DollarSign className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pagamentosPendentes}</div>
          <p className="text-xs text-gray-500 mt-1">
            R$ {stats.valorPendente?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || "0,00"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Pagamentos Aprovados</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pagamentosAprovados}</div>
          <p className="text-xs text-gray-500 mt-1">
            R$ {stats.valorAprovado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || "0,00"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Pagamentos Rejeitados</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pagamentosRejeitados}</div>
          <p className="text-xs text-gray-500 mt-1">
            Necessitam de atenção
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
