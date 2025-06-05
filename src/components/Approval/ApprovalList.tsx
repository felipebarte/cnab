import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApprovalBatch, CNABFile } from "@/lib/types";
import {
  CheckCircle, XCircle, Clock, FileText, User,
  Calendar, Search, BarChart, AlertCircle, ArrowRight,
  Filter, Download, FileDown
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
//import { getCNABFile, getCNABFileForDownload } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";

interface ApprovalListProps {
  batches: ApprovalBatch[];
  onApprove?: (batchId: string) => void;
  onReject?: (batchId: string, reason: string) => void;
}

const ApprovalList = ({
  batches,
  onApprove,
  onReject
}: ApprovalListProps) => {
  const [selectedBatch, setSelectedBatch] = useState < ApprovalBatch | null > (null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState < "todos" | "pendente" | "aprovado" | "rejeitado" > ("todos");
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [actionType, setActionType] = useState < "approve" | "reject" | null > (null);

  const handleApprove = () => {
    if (selectedBatch && onApprove) {
      onApprove(selectedBatch.id);
      setDialogOpen(false);
      setConfirmationDialogOpen(false);
    } else {
      toast.success(`Lote "${selectedBatch?.description}" aprovado com sucesso`);
      setDialogOpen(false);
      setConfirmationDialogOpen(false);
    }
  };

  const handleReject = () => {
    if (selectedBatch && onReject && rejectionReason.trim()) {
      onReject(selectedBatch.id, rejectionReason);
      setDialogOpen(false);
      setConfirmationDialogOpen(false);
      setRejectionReason("");
    } else {
      toast.error(`Lote "${selectedBatch?.description}" rejeitado`);
      setDialogOpen(false);
      setConfirmationDialogOpen(false);
    }
  };

  const showConfirmationDialog = (type: "approve" | "reject") => {
    setActionType(type);
    setConfirmationDialogOpen(true);
  };

  const handleDownloadCNAB = async (cnabFileId?: string) => {
    if (!cnabFileId) {
      toast.error("Nenhum arquivo CNAB associado a este lote");
      return;
    }

    //const fileData = await getCNABFileForDownload(cnabFileId);
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

  const getStatusIcon = (status: ApprovalBatch["status"]) => {
    switch (status) {
      case "aprovado":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejeitado":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "pendente":
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: ApprovalBatch["status"]) => {
    switch (status) {
      case "aprovado":
        return "Aprovado";
      case "rejeitado":
        return "Rejeitado";
      case "pendente":
        return "Pendente";
    }
  };

  const getStatusClass = (status: ApprovalBatch["status"]) => {
    switch (status) {
      case "aprovado":
        return "text-green-600 bg-green-50 border-green-200";
      case "rejeitado":
        return "text-red-600 bg-red-50 border-red-200";
      case "pendente":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
    }
  };

  // Obter informações do CNAB associado ao lote
  const getCNABDetails = (cnabFileId?: string): CNABFile | null => {
    if (!cnabFileId) return null;
    //return getCNABFile(cnabFileId);
    return null;
  };

  // Filtrar lotes com base no status selecionado
  const filteredBatches = batches.filter(batch =>
    filterStatus === "todos" ? true : batch.status === filterStatus
  );

  const statusCounts = {
    total: batches.length,
    pendente: batches.filter(b => b.status === "pendente").length,
    aprovado: batches.filter(b => b.status === "aprovado").length,
    rejeitado: batches.filter(b => b.status === "rejeitado").length
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="relative rounded-md shadow-sm max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="py-2 pl-10 pr-4 block w-full rounded-md border-gray-300 bg-white text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Buscar lotes por descrição..."
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex gap-2">
              <Badge variant="outline" className={cn("cursor-pointer hover:bg-gray-100", filterStatus === "todos" && "bg-gray-100 border-gray-300")}>
                <button onClick={() => setFilterStatus("todos")} className="px-2">
                  Todos ({statusCounts.total})
                </button>
              </Badge>
              <Badge variant="outline" className={cn("cursor-pointer hover:bg-yellow-50", filterStatus === "pendente" && "bg-yellow-50 border-yellow-200")}>
                <button onClick={() => setFilterStatus("pendente")} className="px-2">
                  Pendentes ({statusCounts.pendente})
                </button>
              </Badge>
              <Badge variant="outline" className={cn("cursor-pointer hover:bg-green-50", filterStatus === "aprovado" && "bg-green-50 border-green-200")}>
                <button onClick={() => setFilterStatus("aprovado")} className="px-2">
                  Aprovados ({statusCounts.aprovado})
                </button>
              </Badge>
              <Badge variant="outline" className={cn("cursor-pointer hover:bg-red-50", filterStatus === "rejeitado" && "bg-red-50 border-red-200")}>
                <button onClick={() => setFilterStatus("rejeitado")} className="px-2">
                  Rejeitados ({statusCounts.rejeitado})
                </button>
              </Badge>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-1" />
                  Filtros
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Por data</DropdownMenuItem>
                <DropdownMenuItem>Por valor</DropdownMenuItem>
                <DropdownMenuItem>Por quantidade</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {filteredBatches.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <AlertCircle className="h-10 w-10 text-gray-400" />
              <h3 className="font-medium text-gray-700">Nenhum lote encontrado</h3>
              <p className="text-gray-500 text-sm max-w-md">
                Não há lotes correspondentes com os filtros selecionados. Tente ajustar seus filtros ou criar um novo lote.
              </p>
              <Button variant="outline" onClick={() => setFilterStatus("todos")} className="mt-2">
                Limpar filtros
              </Button>
            </div>
          </Card>
        ) : (
          filteredBatches.map((batch) => {
            const cnabFile = batch.cnabFileId ? getCNABDetails(batch.cnabFileId) : null;

            return (
              <Card
                key={batch.id}
                className={cn(
                  "border transition-colors hover:shadow-sm",
                  batch.status === "pendente" && "border-l-4 border-l-yellow-400",
                  batch.status === "aprovado" && "border-l-4 border-l-green-400",
                  batch.status === "rejeitado" && "border-l-4 border-l-red-400"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center">
                        {batch.description}
                        <Badge
                          variant="outline"
                          className={cn(
                            "ml-3 text-xs px-2 py-0 h-5 rounded-full border",
                            getStatusClass(batch.status)
                          )}
                        >
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(batch.status)}
                            <span>{getStatusLabel(batch.status)}</span>
                          </div>
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        Criado em {new Date(batch.createdAt).toLocaleDateString("pt-BR")} às {new Date(batch.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-2">
                    <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-md">
                      <div className="bg-blue-100 rounded-full p-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Pagamentos</p>
                        <p className="font-medium text-gray-800">{batch.paymentsCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-md">
                      <div className="bg-violet-100 rounded-full p-2">
                        <User className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Criado por</p>
                        <p className="font-medium text-gray-800">{batch.createdBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-md">
                      <div className="bg-emerald-100 rounded-full p-2">
                        <BarChart className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Valor Total</p>
                        <p className="font-medium text-gray-800">
                          R$ {batch.totalAmount.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exibir informações do CNAB associado se existir */}
                  {cnabFile && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <p className="text-sm font-medium text-blue-700">
                            Arquivo CNAB: {cnabFile.filename}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-blue-600 hover:text-blue-800"
                          onClick={() => handleDownloadCNAB(batch.cnabFileId)}
                        >
                          <FileDown className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-blue-600 grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-blue-500">Tipo:</span> {cnabFile.type === 'remessa' ? 'Remessa' : 'Retorno'}
                        </div>
                        <div>
                          <span className="text-blue-500">Formato:</span> CNAB {cnabFile.format}
                        </div>
                        <div>
                          <span className="text-blue-500">Status:</span> {cnabFile.status}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-2 flex justify-end space-x-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBatch(batch);
                      setDialogOpen(true);
                    }}
                    className="flex items-center"
                  >
                    Ver detalhes
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                  {batch.status === "pendente" && (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedBatch(batch);
                          showConfirmationDialog("reject");
                        }}
                      >
                        Rejeitar
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedBatch(batch);
                          showConfirmationDialog("approve");
                        }}
                      >
                        Aprovar
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            )
          })
        )}
      </div>

      {/* Diálogo de detalhes do lote */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="bg-gray-100 rounded-full p-1.5">
                <FileText className="h-5 w-5 text-gray-700" />
              </div>
              {selectedBatch?.description}
              <Badge
                variant="outline"
                className={cn(
                  "ml-1 text-xs px-2 py-0 h-5 rounded-full border",
                  selectedBatch ? getStatusClass(selectedBatch.status) : ""
                )}
              >
                <div className="flex items-center space-x-1">
                  {selectedBatch && getStatusIcon(selectedBatch.status)}
                  <span>{selectedBatch && getStatusLabel(selectedBatch.status)}</span>
                </div>
              </Badge>
            </DialogTitle>
            <DialogDescription className="pt-1">
              Criado por <span className="font-medium">{selectedBatch?.createdBy}</span> em {selectedBatch && new Date(selectedBatch.createdAt).toLocaleDateString("pt-BR")}

              {/* Adicionar informação do CNAB */}
              {selectedBatch?.cnabFileId && (
                <div className="mt-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-blue-600">
                    Arquivo CNAB: {getCNABDetails(selectedBatch.cnabFileId)?.filename}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-blue-600"
                    onClick={() => handleDownloadCNAB(selectedBatch.cnabFileId)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gray-50 rounded-md p-3">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-full p-2">
                  <BarChart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="font-medium text-gray-800">
                    R$ {selectedBatch?.totalAmount.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-violet-100 rounded-full p-2">
                  <FileText className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pagamentos</p>
                  <p className="font-medium text-gray-800">{selectedBatch?.paymentsCount}</p>
                </div>
              </div>
            </div>

            <div className="border rounded-md">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="text-sm font-medium text-gray-700">Detalhes dos pagamentos no lote</h3>
              </div>
              <div className="max-h-[350px] overflow-auto p-1">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                      <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                      <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedBatch?.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{payment.clientName}</div>
                          <div className="text-xs text-gray-500">{payment.clientEmail}</div>
                        </td>
                        <td className="p-3 text-gray-700">{payment.description}</td>
                        <td className="p-3 text-gray-700">{new Date(payment.dueDate).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3 font-medium text-gray-800 text-right">
                          R$ {payment.amount.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            {selectedBatch?.status === "pendente" && (
              <>
                <Button variant="destructive" onClick={() => showConfirmationDialog("reject")}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Rejeitar
                </Button>
                <Button variant="default" onClick={() => showConfirmationDialog("approve")}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprovar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de aprovação/rejeição */}
      <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Aprovar Lote" : "Rejeitar Lote"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Tem certeza que deseja aprovar este lote para pagamento? Esta ação não poderá ser desfeita."
                : "Por favor, informe o motivo da rejeição do lote de pagamento."}
            </DialogDescription>
          </DialogHeader>

          {actionType === "reject" && (
            <div className="py-3">
              <Textarea
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmationDialogOpen(false)}
            >
              Cancelar
            </Button>

            {actionType === "approve" ? (
              <Button
                variant="default"
                onClick={handleApprove}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirmar Aprovação
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Confirmar Rejeição
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApprovalList;
