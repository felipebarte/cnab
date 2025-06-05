import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Payment } from "@/lib/types";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  SortDesc,
  FileText,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
//import { getCNABFile, getCNABFileForDownload } from "@/lib/api";

interface PaymentsTableProps {
  payments: Payment[];
}

const PaymentsTable = ({ payments }: PaymentsTableProps) => {
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState < Payment["status"] | "todos" > ("todos");

  // Baixar CNAB relacionado
  const handleDownloadCNAB = (cnabFileId?: string) => {
    if (!cnabFileId) {
      toast.error("Nenhum arquivo CNAB associado a este pagamento");
      return;
    }

    const fileData = {
      blob: null,
      filename: ''
    };

    if (!fileData) {
      toast.error("Arquivo não encontrado para download");
      return;
    }

    // Criar um link temporário para download
    const url = URL.createObjectURL(fileData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.filename;
    document.body.appendChild(a);
    a.click();

    // Limpar recursos
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);

    toast.success("Download iniciado");
  };

  // Filtragem de pagamentos
  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      searchText === "" ||
      payment.clientName.toLowerCase().includes(searchText.toLowerCase()) ||
      payment.clientEmail.toLowerCase().includes(searchText.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchText.toLowerCase());

    const matchesStatus = filterStatus === "todos" || payment.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Renderizar status do pagamento com ícone apropriado
  const renderStatus = (status: Payment["status"]) => {
    const statusConfig = {
      pendente: {
        icon: <Clock className="h-4 w-4 text-yellow-500" />,
        text: "Pendente",
        class: "bg-yellow-50 text-yellow-700 border-yellow-200",
      },
      aprovado: {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        text: "Aprovado",
        class: "bg-green-50 text-green-700 border-green-200",
      },
      rejeitado: {
        icon: <XCircle className="h-4 w-4 text-red-500" />,
        text: "Rejeitado",
        class: "bg-red-50 text-red-700 border-red-200",
      },
      processando: {
        icon: <Clock className="h-4 w-4 text-blue-500" />,
        text: "Processando",
        class: "bg-blue-50 text-blue-700 border-blue-200",
      },
      cancelado: {
        icon: <XCircle className="h-4 w-4 text-gray-500" />,
        text: "Cancelado",
        class: "bg-gray-50 text-gray-700 border-gray-200",
      },
      pago: {
        icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
        text: "Pago",
        class: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
    };

    const config = statusConfig[status] || statusConfig.pendente;

    return (
      <Badge
        variant="outline"
        className={cn("flex gap-1 items-center whitespace-nowrap", config.class)}
      >
        {config.icon}
        <span>{config.text}</span>
      </Badge>
    );
  };

  // Obter detalhes do CNAB se houver
  const getCNABDetails = (payment: Payment) => {
    if (!payment.cnabFileId) return null;
    return {
      filename: ''
    };
    //return getCNABFile(payment.cnabFileId);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="relative rounded-md shadow-sm max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Buscar pagamentos..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center">
                <Filter className="h-3.5 w-3.5 mr-1" />
                Status: {filterStatus === "todos" ? "Todos" : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilterStatus("todos")}>
                Todos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("pendente")}>
                Pendente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("aprovado")}>
                Aprovado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("pago")}>
                Pago
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("rejeitado")}>
                Rejeitado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("cancelado")}>
                Cancelado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="flex items-center">
            <SortDesc className="h-3.5 w-3.5 mr-1" />
            Ordenar
          </Button>
        </div>
      </div>

      <div className="rounded-md border shadow-sm bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[180px]">CNAB / Aprovação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="h-8 w-8 text-gray-300" />
                    <h3 className="font-medium text-gray-600">
                      Nenhum pagamento encontrado
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {searchText || filterStatus !== "todos"
                        ? "Tente ajustar seus filtros para encontrar resultados."
                        : "Não há nenhum pagamento cadastrado no sistema."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => {
                const cnabFile = payment.cnabFileId ? getCNABDetails(payment) : null;

                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">
                          {payment.clientName}
                        </p>
                        <p className="text-gray-500 text-sm">{payment.clientEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {payment.paymentType === "boleto"
                          ? "Boleto"
                          : payment.paymentType === "pix"
                            ? "PIX"
                            : payment.paymentType === "cartao"
                              ? "Cartão"
                              : "Transferência"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {payment.amount.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.dueDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{renderStatus(payment.status)}</TableCell>
                    <TableCell>
                      {cnabFile ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs text-blue-600">
                            <FileText className="h-3 w-3 mr-1" />
                            <span>{cnabFile.filename}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 p-0 ml-1"
                              onClick={() => handleDownloadCNAB(payment.cnabFileId)}
                            >
                              <Download className="h-3 w-3 text-blue-600" />
                            </Button>
                          </div>
                          {payment.approvedBy && (
                            <div className="text-xs text-gray-500 mt-1">
                              Aprovado por {payment.approvedBy}
                              <br />
                              em {new Date(payment.approvedAt!).toLocaleDateString("pt-BR")}
                            </div>
                          )}
                        </div>
                      ) : payment.approvedBy ? (
                        <div className="text-xs text-gray-500">
                          Aprovado por {payment.approvedBy}
                          <br />
                          em {new Date(payment.approvedAt!).toLocaleDateString("pt-BR")}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Não aplicável</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-7">
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PaymentsTable;
