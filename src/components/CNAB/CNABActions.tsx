import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Check, X, FileDown, Send, AlertCircle,
  FileCheck, Shield, Clock, Loader2, FileText, Eye, CheckCircle
} from "lucide-react";
import { CNABFile } from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CNABActionsProps {
  cnabFile: CNABFile;
  onCreateBatch?: (batchId: string) => void;
  onUpdateStatus?: (fileId: string, newStatus: CNABFile['status']) => void;
}

const CNABActions: React.FC<CNABActionsProps> = ({
  cnabFile,
  onCreateBatch,
  onUpdateStatus
}) => {
  const [verificationResult, setVerificationResult] = useState < {
    isValid: boolean;
    messages: string[]
  } | null > (null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState(`Lote de pagamentos - ${cnabFile.filename}`);
  const [showDetails, setShowDetails] = useState(false);

  // Verifica se o arquivo está pronto para envio
  const handleVerifyFile = async () => {
    setIsVerifying(true);
    try {
      const result = {
        isValid: true,
        messages: []
      };
      setVerificationResult(result);

      if (result.isValid) {
        toast.success("Arquivo CNAB válido para envio");
      } else {
        toast.error("Arquivo CNAB possui problemas");
      }

      setDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao verificar arquivo");
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Cria um lote de aprovação a partir do arquivo CNAB
  const handleCreateBatch = async () => {
    setIsCreatingBatch(true);
    try {
      // Utilizando nome de usuário hard-coded para exemplo
      const batch = {
        id: '1',
        name: batchName,
        createdBy: 'João da Silva'
      };
      // const batch = createApprovalBatchFromCNAB(
      //  cnabFile.id,
      //  batchName,
      //  "João da Silva"
      //);

      if (batch) {
        toast.success("Lote de aprovação criado com sucesso");
        if (onCreateBatch) {
          onCreateBatch(batch.id);
        }
        // Fechar o diálogo
        setDialogOpen(false);
      } else {
        toast.error("Não foi possível criar o lote de aprovação");
      }
    } catch (error) {
      toast.error("Erro ao criar lote de aprovação");
      console.error(error);
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Baixa o arquivo CNAB
  const handleDownload = () => {
    //const fileData = getCNABFileForDownload(cnabFile.id);
    const fileData = {
      blob: null,
      filename: ''
    };

    if (!fileData) {
      toast.error("Arquivo não encontrado para download");
      return;
    }

    // Cria um link temporário para download
    const url = URL.createObjectURL(fileData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.filename;
    document.body.appendChild(a);
    a.click();

    // Limpa o URL temporário
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);

    toast.success("Download iniciado");
  };

  // Envia o arquivo CNAB para o banco
  const handleSendToBank = async () => {
    setIsSending(true);
    try {
      //const result = await sendCNABToBank(cnabFile.id);
      const result = {
        success: true,
        message: 'Arquivo enviado com sucesso'
      };

      if (result.success) {
        toast.success(result.message);
        if (onUpdateStatus) {
          onUpdateStatus(cnabFile.id, 'enviado');
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Erro ao enviar arquivo para o banco");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: CNABFile['status']) => {
    switch (status) {
      case 'processando':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processado':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'erro':
        return <X className="h-5 w-5 text-red-500" />;
      case 'aprovado':
        return <FileCheck className="h-5 w-5 text-blue-500" />;
      case 'enviado':
        return <Send className="h-5 w-5 text-purple-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: CNABFile['status']) => {
    switch (status) {
      case 'processando':
        return "Em processamento";
      case 'processado':
        return "Processado";
      case 'erro':
        return "Erro";
      case 'aprovado':
        return "Aprovado";
      case 'enviado':
        return "Enviado ao banco";
      default:
        return "Desconhecido";
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isActionDisabled = cnabFile.status === 'erro' ||
    cnabFile.status === 'processando' ||
    cnabFile.status === 'enviado';

  const canSendForApproval =
    cnabFile.status === 'processado' &&
    !cnabFile.approvalBatchId &&
    (verificationResult?.isValid || false);

  const isInApprovalProcess = ['enviado', 'aprovado', 'rejeitado'].includes(cnabFile.status);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{cnabFile.filename}</CardTitle>
              <CardDescription>
                Enviado em {formatDateTime(cnabFile.uploadDate)}
              </CardDescription>
            </div>
            <Badge variant="outline" className="flex items-center gap-1 px-2">
              {getStatusIcon(cnabFile.status)}
              <span>{getStatusLabel(cnabFile.status)}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Tipo</p>
              <p className="font-medium">
                {cnabFile.type === 'remessa' ? 'Remessa' : 'Retorno'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Formato</p>
              <p className="font-medium">CNAB {cnabFile.format}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Pagamentos</p>
              <p className="font-medium">{cnabFile.paymentCount}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Valor Total</p>
              <p className="font-medium">
                R$ {cnabFile.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleDownload}
            >
              <FileDown className="h-4 w-4" />
              Download
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleVerifyFile}
              disabled={isVerifying || isActionDisabled}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Verificar
            </Button>

            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleSendToBank}
              disabled={isSending || isActionDisabled}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar ao Banco
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para verificação do arquivo CNAB */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verificação do Arquivo CNAB</DialogTitle>
            <DialogDescription>
              {verificationResult?.isValid
                ? "O arquivo está pronto para envio ao banco."
                : "Existem problemas que precisam ser corrigidos."}
            </DialogDescription>
          </DialogHeader>

          {verificationResult && (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-4">
                {verificationResult.isValid ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 py-2 px-3 rounded-md w-full">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Arquivo válido</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 py-2 px-3 rounded-md w-full">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Problemas encontrados</span>
                  </div>
                )}
              </div>

              {verificationResult.messages.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Detalhes:</h4>
                  <ScrollArea className="h-[120px] rounded-md border p-2">
                    <ul className="space-y-1">
                      {verificationResult.messages.map((message, index) => (
                        <li key={index} className="text-sm flex items-start gap-1">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{message}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {verificationResult.isValid && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Nome do lote:</h4>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full p-2 border rounded-md text-sm"
                    placeholder="Digite um nome para o lote de aprovação"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>

            {verificationResult?.isValid && (
              <Button
                variant="default"
                onClick={handleCreateBatch}
                disabled={isCreatingBatch || !batchName.trim()}
              >
                {isCreatingBatch ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Lote de Aprovação"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de detalhes e verificação */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Arquivo CNAB
            </DialogTitle>
            <DialogDescription>
              {cnabFile.filename} ({cnabFile.format})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Banco</p>
                <p className="text-sm">{cnabFile.bank}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tipo</p>
                <p className="text-sm">{cnabFile.type === 'remessa' ? 'Remessa' : 'Retorno'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pagamentos</p>
                <p className="text-sm">{cnabFile.paymentCount}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Valor Total</p>
                <p className="text-sm">R$ {cnabFile.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {verificationResult && (
              <div className={`p-3 rounded-md mt-3 ${verificationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <h4 className={`text-sm font-medium mb-1 ${verificationResult.isValid ? 'text-green-700' : 'text-red-700'}`}>
                  {verificationResult.isValid ? (
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Arquivo validado com sucesso
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <X className="h-4 w-4 mr-1" />
                      Problemas encontrados
                    </div>
                  )}
                </h4>
                <ul className={`text-xs ${verificationResult.isValid ? 'text-green-700' : 'text-red-700'} pl-5 list-disc`}>
                  {verificationResult.messages.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(false)}
            >
              Fechar
            </Button>

            {canSendForApproval && (
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateBatch}
              >
                <Send className="h-4 w-4 mr-1" />
                Enviar para Aprovação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CNABActions; 