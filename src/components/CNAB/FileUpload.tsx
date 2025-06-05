import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Send } from "lucide-react";
import { useState, useRef } from "react";
import { processarCNABAutoUpload, processarCNABEEnviarWebhook, CNABUploadResponse } from "@/lib/api";
import { UploadingFile, CNABApiProcessingResponse, UploadProgress } from "@/lib/types";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CNAB_QUERY_KEYS } from "@/hooks/useCNABData";

interface FileUploadProps {
  onFileProcessed?: (response: CNABApiProcessingResponse) => void;
  webhookUrl?: string; // URL opcional para webhook automático
}

const FileUpload = ({ onFileProcessed, webhookUrl }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState < UploadingFile[] > ([]);
  const fileInputRef = useRef < HTMLInputElement > (null);
  const queryClient = useQueryClient();

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files);

    // Validar tipo de arquivo
    const validFiles = fileArray.filter(file => {
      const isValid = file.name.toLowerCase().endsWith('.txt') ||
        file.name.toLowerCase().endsWith('.cnab') ||
        file.name.toLowerCase().endsWith('.rem') ||
        file.name.toLowerCase().endsWith('.ret');

      if (!isValid) {
        toast.error(`Arquivo ${file.name} não é um formato válido (deve ser .txt, .cnab, .rem ou .ret)`);
      }
      return isValid;
    });

    if (validFiles.length === 0) return;

    // Criar entradas de upload para cada arquivo
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Processar cada arquivo
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];

      try {
        // Atualizar status para processando
        setUploadingFiles(prev =>
          prev.map(uf =>
            uf.name === file.name && uf.file === file
              ? { ...uf, status: 'processing' as const }
              : uf
          )
        );

        let resultado: CNABUploadResponse;

        if (webhookUrl) {
          // Processar e enviar webhook
          resultado = await processarCNABEEnviarWebhook(
            file,
            webhookUrl,
            {
              onUploadProgress: (progressEvent: UploadProgress) => {
                setUploadingFiles(prev =>
                  prev.map(uf =>
                    uf.name === file.name && uf.file === file
                      ? { ...uf, progress: progressEvent.percentage }
                      : uf
                  )
                );
              }
            }
          );
        } else {
          // Processar normalmente
          resultado = await processarCNABAutoUpload(
            file,
            {
              onUploadProgress: (progressEvent: UploadProgress) => {
                setUploadingFiles(prev =>
                  prev.map(uf =>
                    uf.name === file.name && uf.file === file
                      ? { ...uf, progress: progressEvent.percentage }
                      : uf
                  )
                );
              }
            }
          );
        }

        // Atualizar status para sucesso
        setUploadingFiles(prev =>
          prev.map(uf =>
            uf.name === file.name && uf.file === file
              ? { ...uf, status: 'success' as const, resultado }
              : uf
          ) as UploadingFile[]
        );

        // Invalidar cache do React Query para atualizar a lista
        queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.lists() });
        queryClient.invalidateQueries({ queryKey: CNAB_QUERY_KEYS.statistics() });

        // Callback opcional
        if (onFileProcessed) {
          onFileProcessed(resultado as unknown as CNABApiProcessingResponse);
        }

        if (resultado.sucesso) {
          toast.success(`✅ Arquivo ${file.name} processado com sucesso!`);
        } else {
          toast.error(`❌ Erro ao processar ${file.name}: ${resultado.erro || resultado.mensagem}`);
        }

      } catch (error) {
        console.error('Erro no upload:', error);

        setUploadingFiles(prev =>
          prev.map(uf =>
            uf.name === file.name && uf.file === file
              ? {
                ...uf,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
              }
              : uf
          )
        );

        toast.error(`❌ Erro ao processar ${file.name}`);
      }
    }

    // Limpar arquivos em upload após 3 segundos
    setTimeout(() => {
      setUploadingFiles(prev =>
        prev.filter(uf => !validFiles.some(vf => vf === uf.file))
      );
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeUploadingFile = (fileName: string) => {
    setUploadingFiles(prev => prev.filter(file => file.name !== fileName));
  };

  const clearAllFiles = () => {
    setUploadingFiles([]);
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'sending':
        return <Send className="h-4 w-4 text-purple-500" />;
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Enviando...';
      case 'processing':
        return 'Processando...';
      case 'success':
        return 'Processado';
      case 'error':
        return 'Erro';
      case 'sending':
        return 'Enviando webhook...';
      case 'sent':
        return 'Webhook enviado';
      default:
        return 'Aguardando';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload de Arquivos CNAB
        </CardTitle>
        <CardDescription>
          Faça upload de arquivos CNAB 240 ou 400 para processamento automático.
          Formatos aceitos: .txt, .cnab, .rem, .ret
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
            }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium mb-2">
            Arraste arquivos aqui ou clique para selecionar
          </h3>
          <p className="text-gray-500 mb-4">
            Você pode enviar múltiplos arquivos CNAB simultaneamente
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="mb-2"
          >
            Selecionar Arquivos
          </Button>
          {webhookUrl && (
            <p className="text-xs text-blue-600 mt-2">
              📡 Webhook configurado: Os arquivos serão enviados automaticamente após processamento
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.cnab,.rem,.ret"
            onChange={handleChange}
            className="hidden"
          />
        </div>

        {/* Lista de arquivos sendo processados */}
        {uploadingFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Arquivos em Processamento</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFiles}
              >
                Limpar Lista
              </Button>
            </div>
            <div className="space-y-3">
              {uploadingFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {getStatusIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{getStatusText(file.status)}</span>
                      <span>•</span>
                      <span>{(file.size / 1024).toFixed(1)} KB</span>
                      {file.progress !== undefined && file.progress > 0 && (
                        <>
                          <span>•</span>
                          <span>{Math.round(file.progress)}%</span>
                        </>
                      )}
                    </div>
                    {file.error && (
                      <p className="text-sm text-red-600 mt-1">{file.error}</p>
                    )}
                    {file.resultado && !file.resultado.sucesso && (
                      <p className="text-sm text-red-600 mt-1">
                        {file.resultado.erro || file.resultado.mensagem}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadingFile(file.name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;
