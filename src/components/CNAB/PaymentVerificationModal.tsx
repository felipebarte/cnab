import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CNABApiProcessingResponse } from "@/lib/types";
import {
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Hash,
  FileStack,
  ListChecks,
  User,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  AlertCircle,
  Clock,
  Copy,
  Download,
  Send,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

interface PaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cnabData: CNABApiProcessingResponse;
  onApprove?: (operationId: string) => void;
  onReject?: (operationId: string, reason: string) => void;
  onSendToBank?: (operationId: string) => void;
}

const PaymentVerificationModal = ({
  isOpen,
  onClose,
  cnabData,
  onApprove,
  onReject,
  onSendToBank
}: PaymentVerificationModalProps) => {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Funções utilitárias
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  };

  // Extrair informações dos dados CNAB
  const filename = cnabData.arquivo?.nome || "Arquivo CNAB";
  const fileSize = cnabData.arquivo?.tamanho || 0;
  const operationId = cnabData.operationId;
  const processedDate = cnabData.dataProcessamento ? new Date(cnabData.dataProcessamento) : new Date();
  const formatDetected = cnabData.formatoDetectado?.nome || "CNAB";
  const confidence = cnabData.formatoDetectado?.confianca || 0;

  // Informações de somatorias
  const totalLotes = cnabData.dados?.somatorias?.totalLotes || 0;
  const totalRegistros = cnabData.dados?.somatorias?.totalRegistros || 0;
  const valorTotal = cnabData.dados?.somatorias?.valorTotal || 0;

  // Informações bancárias
  const bankCode = cnabData.dados?.dadosEstruturados?.header?.codigoBanco || "---";
  const bankName = cnabData.dados?.dadosEstruturados?.header?.nomeBanco || "Banco não identificado";
  const agencia = cnabData.dados?.dadosEstruturados?.header?.agencia || "---";
  const conta = cnabData.dados?.dadosEstruturados?.header?.conta || "---";

  // Informações de arquivo
  const fileInfo = cnabData.dados?.informacoesArquivo;
  const encoding = fileInfo?.encoding || "UTF-8";
  const linhas = fileInfo?.linhas || 0;

  // Lotes detalhados
  const lotes = cnabData.dados?.dadosEstruturados?.lotes || [];

  // Handlers para ações
  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove?.(operationId);
      onClose();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;

    setIsProcessing(true);
    try {
      await onReject?.(operationId, rejectionReason);
      onClose();
    } catch (error) {
      console.error("Erro ao rejeitar:", error);
    } finally {
      setIsProcessing(false);
      setRejectionReason("");
      setShowRejectionInput(false);
    }
  };

  const handleSendToBank = async () => {
    setIsProcessing(true);
    try {
      await onSendToBank?.(operationId);
      onClose();
    } catch (error) {
      console.error("Erro ao enviar:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Verificação de Pagamento CNAB</span>
            <Badge variant={cnabData.sucesso ? "default" : "destructive"} className="ml-2">
              {getStatusIcon(cnabData.sucesso)}
              <span className="ml-1">{cnabData.sucesso ? "Processado" : "Erro"}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Arquivo: {filename} • Processado em {format(processedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Informações do Arquivo */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-800">Informações do Arquivo</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Nome:</span>
                  <p className="font-medium truncate" title={filename}>{filename}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tamanho:</span>
                  <p className="font-medium">{formatFileSize(fileSize)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Formato:</span>
                  <p className="font-medium">{formatDetected}</p>
                </div>
                {/*<div>
                  <span className="text-gray-500">Linhas:</span>
                  <p className="font-medium">{linhas.toLocaleString('pt-BR')}</p>
                </div>*/}
                {/*<div>
                  <span className="text-gray-500">Encoding:</span>
                  <p className="font-medium">{encoding}</p>
                </div>*/}
                {/*<div>
                  <span className="text-gray-500">Confiança:</span>
                  <p className="font-medium">{Math.round(confidence * 100)}%</p>
                </div>*/}
                <div className="col-span-2">
                  <span className="text-gray-500">Operation ID:</span>
                  <div className="flex items-center space-x-2">
                    <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{operationId}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(operationId)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações Bancárias */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Building2 className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-800">Informações Bancárias</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-blue-600">Código:</span>
                  <p className="font-medium text-blue-900">{bankCode}</p>
                </div>
                <div>
                  <span className="text-blue-600">Banco:</span>
                  <p className="font-medium text-blue-900">{bankName}</p>
                </div>
                <div>
                  <span className="text-blue-600">Agência:</span>
                  <p className="font-medium text-blue-900">{agencia}</p>
                </div>
                <div>
                  <span className="text-blue-600">Conta:</span>
                  <p className="font-medium text-blue-900">{conta}</p>
                </div>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-800">Resumo Financeiro</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <FileStack className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-emerald-600 font-medium">LOTES</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-900">{totalLotes.toLocaleString('pt-BR')}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <ListChecks className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-emerald-600 font-medium">REGISTROS</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-900">{totalRegistros.toLocaleString('pt-BR')}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-emerald-600 font-medium">VALOR TOTAL</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-900">{formatCurrency(valorTotal)}</p>
                </div>
              </div>
            </div>

            {/* Detalhes dos Lotes */}
            {lotes.length > 0 && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <FileStack className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-800">Detalhes dos Lotes</h3>
                </div>
                <div className="space-y-3">
                  {lotes.slice(0, 5).map((lote, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Número:</span>
                          <p className="font-medium">{lote.numeroLote || index + 1}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Operação:</span>
                          <p className="font-medium">{lote.tipoOperacao || "---"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Serviço:</span>
                          <p className="font-medium">{lote.tipoServico || "---"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Registros:</span>
                          <p className="font-medium">{lote.registros?.length || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {lotes.length > 5 && (
                    <p className="text-xs text-gray-500 text-center">
                      ... e mais {lotes.length - 5} lotes
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Lista de Pagamentos */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-800">Pagamentos Identificados</h3>
                </div>
                <Badge variant="outline" className="text-purple-600 border-purple-200">
                  {totalRegistros > 0 ? `${totalRegistros} registros` : 'Nenhum registro'}
                </Badge>
              </div>

              {totalRegistros > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {/* Simulação de pagamentos baseada nos registros CNAB */}
                  {Array.from({ length: Math.min(totalRegistros, 10) }, (_, index) => {
                    // Simulação de dados de pagamento baseados na estrutura CNAB
                    const pagamentoValor = valorTotal > 0 ? (valorTotal / totalRegistros) : (Math.random() * 1000 + 100);
                    const tipoServico = ['PIX', 'TED', 'Boleto', 'DOC'][Math.floor(Math.random() * 4)];
                    const status = ['Pendente', 'Aprovado', 'Processando'][Math.floor(Math.random() * 3)];
                    const beneficiario = `Beneficiário ${index + 1}`;
                    const documento = `${String(Math.floor(Math.random() * 90000000000) + 10000000000)}`;

                    return (
                      <div key={index} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <User className="h-3 w-3 text-purple-600" />
                              <span className="text-sm font-medium text-purple-900">{beneficiario}</span>
                            </div>
                            <div className="text-xs text-purple-700 space-y-1">
                              <div className="flex items-center space-x-1">
                                <Hash className="h-3 w-3" />
                                <span>CPF/CNPJ: {documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.**$4')}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <CreditCard className="h-3 w-3" />
                                <span>Tipo: {tipoServico}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-purple-900 mb-1">
                              {formatCurrency(pagamentoValor)}
                            </div>
                            <Badge
                              variant={status === 'Aprovado' ? 'default' : status === 'Pendente' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {status}
                            </Badge>
                          </div>
                        </div>

                        <div className="border-t border-purple-200 pt-2 mt-2">
                          <div className="grid grid-cols-2 gap-2 text-xs text-purple-600">
                            <div>
                              <span className="text-purple-500">Registro:</span>
                              <span className="ml-1 font-medium">#{(index + 1).toString().padStart(3, '0')}</span>
                            </div>
                            <div>
                              <span className="text-purple-500">Data:</span>
                              <span className="ml-1 font-medium">
                                {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {totalRegistros > 10 && (
                    <div className="text-center py-3 border-t border-purple-100">
                      <p className="text-xs text-purple-600">
                        Mostrando 10 de {totalRegistros.toLocaleString('pt-BR')} pagamentos
                      </p>
                      <Button variant="ghost" size="sm" className="text-xs mt-1 text-purple-600 hover:text-purple-800">
                        <Download className="h-3 w-3 mr-1" />
                        Baixar lista completa
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhum pagamento identificado no arquivo</p>
                  <p className="text-xs text-gray-400">Verifique se o arquivo está no formato correto</p>
                </div>
              )}
            </div>

            {/* Mensagens de Erro */}
            {!cnabData.sucesso && cnabData.erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-1">Erro no Processamento</h4>
                    <p className="text-sm text-red-700">{cnabData.erro}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Avisos de Validação */}
            {cnabData.dados?.validacao?.avisos && cnabData.dados.validacao.avisos.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">Avisos de Validação</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {cnabData.dados.validacao.avisos.map((aviso, index) => (
                        <li key={index} className="flex items-start space-x-1">
                          <span className="text-yellow-500 mt-1">•</span>
                          <span>{aviso}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Campo de rejeição */}
            {showRejectionInput && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">Motivo da Rejeição</h4>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Digite o motivo da rejeição..."
                  className="w-full h-24 p-3 border border-red-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            <X className="h-4 w-4 mr-1" />
            Fechar
          </Button>

          <div className="flex space-x-2">
            {cnabData.sucesso && (
              <>
                {!showRejectionInput ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectionInput(true)}
                    disabled={isProcessing}
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Rejeitar
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isProcessing || !rejectionReason.trim()}
                  >
                    {isProcessing ? (
                      <div className="h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mr-1" />
                    )}
                    Confirmar Rejeição
                  </Button>
                )}

                <Button
                  variant="default"
                  onClick={handleApprove}
                  disabled={isProcessing || showRejectionInput}
                >
                  {isProcessing ? (
                    <div className="h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Aprovar
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleSendToBank}
                  disabled={isProcessing || showRejectionInput}
                >
                  {isProcessing ? (
                    <div className="h-4 w-4 mr-1 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Enviar ao Banco
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentVerificationModal; 