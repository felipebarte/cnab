import { useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
//import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, FileText, X, CheckCircle, AlertCircle, FileUp } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const FileUploadComponent = ({ paymentType }: { paymentType: 'boleto' | 'pix' }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState < {
    name: string;
    size: number;
    status: 'uploading' | 'success' | 'error' | 'converted';
    cnabFormat?: '240' | '400';
  }[] > ([]);
  const fileInputRef = useRef < HTMLInputElement > (null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    // Aciona o clique no input de arquivo
    fileInputRef.current?.click();
  };

  const handleFiles = (files: FileList) => {
    const newFiles = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
    }));

    setUploadedFiles([...uploadedFiles, ...newFiles]);

    // Simulação do processo de upload e conversão para CNAB
    newFiles.forEach((file, index) => {
      // Simulação de upload
      setTimeout(() => {
        setUploadedFiles(prev =>
          prev.map((f) =>
            f.name === file.name && f.status === 'uploading'
              ? { ...f, status: Math.random() > 0.2 ? 'success' : 'error' }
              : f
          )
        );

        // Se o upload for bem-sucedido, converter para CNAB após alguns segundos
        setTimeout(() => {
          setUploadedFiles(prev =>
            prev.map((f) =>
              f.name === file.name && f.status === 'success'
                ? { ...f, status: 'converted', cnabFormat: Math.random() > 0.5 ? '240' : '400' }
                : f
            )
          );

          toast({
            title: "Arquivo processado com sucesso",
            description: `O arquivo ${file.name} foi convertido para o formato CNAB.`,
          });
        }, 3000);
      }, (index + 1) * 1500);
    });
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles(uploadedFiles.filter(file => file.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getStatusInfo = (file: typeof uploadedFiles[number]) => {
    switch (file.status) {
      case 'uploading':
        return {
          icon: <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />,
          text: "Processando...",
          textColor: "text-blue-500"
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-5 w-5 text-yellow-500" />,
          text: "Convertendo para CNAB...",
          textColor: "text-yellow-500"
        };
      case 'converted':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          text: `Convertido para CNAB ${file.cnabFormat}`,
          textColor: "text-green-500"
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          text: "Erro no processamento",
          textColor: "text-red-500"
        };
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          {paymentType === 'boleto' ? (
            <FileText className="h-5 w-5 text-gray-600" />
          ) : (
            <FileUp className="h-5 w-5 text-gray-600" />
          )}
          Upload de {paymentType === 'boleto' ? 'Boletos' : 'PIX'}
        </CardTitle>
        <CardDescription>
          Faça upload de arquivos de {paymentType === 'boleto' ? 'boletos' : 'PIX'} para processamento e conversão para formato CNAB
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleChange}
            multiple
            accept={paymentType === 'boleto' ? ".pdf,.png,.jpg" : ".txt,.csv"}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="bg-gray-100 rounded-full p-3">
              <Upload className="h-8 w-8 text-gray-500" />
            </div>
            <p className="text-lg font-medium text-gray-700">
              Arraste e solte arquivos aqui
            </p>
            <p className="text-sm text-gray-500">
              ou
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 font-medium border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              onClick={triggerFileInput}
              type="button"
            >
              Selecionar arquivos
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              {paymentType === 'boleto' ?
                "Formatos suportados: PDF, PNG, JPG" :
                "Formatos suportados: TXT, CSV (com informações de PIX)"}
            </p>
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium">Arquivos ({uploadedFiles.length})</h3>
              {uploadedFiles.some(f => f.status === 'converted') && (
                <Button variant="default" size="sm" className="text-xs h-8">
                  Enviar ao banco
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => {
                const statusInfo = getStatusInfo(file);

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center">
                        {statusInfo.icon}
                        <span className={`ml-1 text-xs ${statusInfo.textColor}`}>{statusInfo.text}</span>
                      </div>
                      <button
                        onClick={() => removeFile(file.name)}
                        className="p-1 rounded-full hover:bg-gray-200"
                        aria-label="Remover arquivo"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      {uploadedFiles.some(f => f.status === 'converted') && (
        <CardFooter className="pt-0 pb-4 flex justify-end">
          <Button
            variant="link"
            size="sm"
            className="text-gray-600 flex items-center gap-1"
          >
            Ver histórico de uploads <ArrowLeft className="h-3 w-3 rotate-180" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

const NovoPagamento = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" asChild className="mr-3">
                <Link to="/" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold text-gray-800">Cadastro de Novo Pagamento</h1>
            </div>
          </div>

          <div className="mb-8 max-w-4xl">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <div className="mt-1 text-blue-500">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 6.66667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 13.3333H10.0083" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-800 mb-1">Instruções</h3>
                    <p className="text-sm text-blue-700">
                      Selecione o tipo de pagamento e faça upload dos arquivos correspondentes.
                      Os arquivos serão convertidos automaticamente para o formato CNAB
                      (padrões 240/400) para envio posterior ao banco.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-5xl">
            <Tabs defaultValue="boleto" className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <TabsList className="grid grid-cols-2 w-64">
                  <TabsTrigger value="boleto">Boletos</TabsTrigger>
                  <TabsTrigger value="pix">PIX</TabsTrigger>
                </TabsList>

                <Button variant="secondary" size="sm" className="text-xs" asChild>
                  <Link to="/">Ver pagamentos cadastrados</Link>
                </Button>
              </div>

              <TabsContent value="boleto" className="mt-2">
                <FileUploadComponent paymentType="boleto" />
              </TabsContent>
              <TabsContent value="pix" className="mt-2">
                <FileUploadComponent paymentType="pix" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovoPagamento; 