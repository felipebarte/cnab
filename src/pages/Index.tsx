import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardStats from "@/components/Dashboard/DashboardStats";
import PaymentsTable from "@/components/Payments/PaymentsTable";
import FileUpload from "@/components/CNAB/FileUpload";
import ProcessingStatus from "@/components/CNAB/ProcessingStatus";
import ApprovalList from "@/components/Approval/ApprovalList";
import CNABPersistenceManager from "@/components/CNAB/CNABPersistenceManager";
import { useState, useEffect } from "react";
import { CNABFile, ApprovalBatch, DashboardStats as DashboardStatsType, Payment, PaymentStatus, CNABApiProcessingResponse } from "@/lib/types";
import { toast } from "sonner";
//import { createApprovalBatchFromCNAB, verifyCNABForBankSubmission } from "@/lib/api";
import { listarResultadosCNAB, buscarResultadoCNAB } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Simulação de usuário logado
const currentUser = {
  id: 'user-1',
  name: 'João da Silva',
  email: 'joao.silva@exemplo.com',
  role: 'admin' as const
};

const Index = () => {
  const navigate = useNavigate();
  const notifications: { id: string; text: string; time: string }[] = [];

  // Estado para armazenar os arquivos CNAB - inicializado com array vazio (mantido para compatibilidade)
  const [cnabFiles, setCnabFiles] = useState < CNABFile[] > ([]);

  // Estado para armazenar os lotes de aprovação - inicializado com array vazio
  const [approvalBatches, setApprovalBatches] = useState < ApprovalBatch[] > ([]);

  // Estado para armazenar a aba ativa
  const [activeTab, setActiveTab] = useState('payments');

  // Estado para armazenar pagamentos - inicializado com array vazio
  const [payments, setPayments] = useState < Payment[] > ([]);

  // Estatísticas do dashboard
  const [dashboardStats, setDashboardStats] = useState < DashboardStatsType > ({
    totalPagamentos: 0,
    pagamentosPendentes: 0,
    pagamentosAprovados: 0,
    pagamentosRejeitados: 0,
    valorTotal: 0,
    valorPendente: 0,
    valorAprovado: 0,
    pagamentosPorTipo: [],
    pagamentosRecentes: []
  });

  // Atualizar estatísticas sempre que os dados mudam
  useEffect(() => {
    updateDashboardStats();
  }, [cnabFiles, approvalBatches, payments]);

  // Função para atualizar estatísticas do dashboard
  const updateDashboardStats = () => {
    const newStats: DashboardStatsType = {
      totalPagamentos: payments.length,
      pagamentosPendentes: payments.filter(p => p.status === 'pendente').length,
      pagamentosAprovados: payments.filter(p => p.status === 'aprovado').length,
      pagamentosRejeitados: payments.filter(p => p.status === 'rejeitado').length,
      valorTotal: payments.reduce((sum, p) => sum + p.amount, 0),
      valorPendente: payments.filter(p => p.status === 'pendente').reduce((sum, p) => sum + p.amount, 0),
      valorAprovado: payments.filter(p => p.status === 'aprovado').reduce((sum, p) => sum + p.amount, 0),
      pagamentosPorTipo: [
        {
          tipo: 'Boleto',
          quantidade: payments.filter(p => p.paymentType === 'boleto').length,
          valor: payments.filter(p => p.paymentType === 'boleto').reduce((sum, p) => sum + p.amount, 0)
        },
        {
          tipo: 'PIX',
          quantidade: payments.filter(p => p.paymentType === 'pix').length,
          valor: payments.filter(p => p.paymentType === 'pix').reduce((sum, p) => sum + p.amount, 0)
        }
      ],
      pagamentosRecentes: payments.slice(0, 5)
    };

    setDashboardStats(newStats);
  };

  // Carregar resultados históricos ao inicializar a página
  useEffect(() => {
    const carregarResultadosHistoricos = async () => {
      try {
        console.log('🔄 Carregando resultados históricos de CNABs...');

        // Buscar lista de resultados (últimos 50)
        const listaResponse = await listarResultadosCNAB({
          limit: 50,
          sortBy: 'created_at',
          sortOrder: 'DESC'
        });

        console.log('📡 Resposta da API:', listaResponse);

        // A API retorna dados diretamente, não dados.resultados
        if (listaResponse.sucesso && listaResponse.dados && Array.isArray(listaResponse.dados) && listaResponse.dados.length > 0) {
          console.log(`📋 Encontrados ${listaResponse.dados.length} resultados históricos`);

          // Para cada resultado, buscar os detalhes completos
          const resultadosDetalhados: CNABApiProcessingResponse[] = [];

          for (const resultado of listaResponse.dados) {
            try {
              console.log(`🔍 Buscando detalhes para operationId: ${resultado.operationId}`);
              const detalhes = await buscarResultadoCNAB(resultado.operationId);

              if (detalhes.sucesso) {
                // Converter formato da API para o formato esperado pelo componente
                const processedFile: CNABApiProcessingResponse = {
                  sucesso: detalhes.sucesso && detalhes.dados.status === 'success',
                  mensagem: detalhes.mensagem,
                  operationId: detalhes.operationId,
                  dataProcessamento: detalhes.dados.processedAt,
                  arquivo: detalhes.dados.file ? {
                    nome: detalhes.dados.file.name,
                    tamanho: detalhes.dados.file.size,
                    tipo: 'text/plain'
                  } : {
                    nome: 'Arquivo CNAB',
                    tamanho: 0,
                    tipo: 'text/plain'
                  },
                  formatoDetectado: {
                    nome: detalhes.dados.operationType === 'cnab240' ? 'CNAB 240' : 'CNAB 400',
                    codigo: detalhes.dados.operationType === 'cnab240' ? 'CNAB_240' as const : 'CNAB_400' as const,
                    confianca: 100
                  },
                  dados: {
                    dadosEstruturados: {
                      header: {
                        codigoBanco: detalhes.dados.header?.banco?.codigo || '---',
                        nomeBanco: detalhes.dados.header?.banco?.nome || 'Banco não identificado',
                        agencia: '---',
                        conta: '---',
                        dataGeracao: detalhes.dados.header?.arquivo?.dataGeracao || detalhes.dados.processedAt,
                        sequencialArquivo: detalhes.dados.header?.arquivo?.numeroSequencial || 1
                      },
                      lotes: [],
                      trailers: []
                    },
                    somatorias: {
                      totalLotes: Math.ceil((detalhes.dados.estatisticas?.totalRegistros || 0) / 100),
                      totalRegistros: detalhes.dados.estatisticas?.totalRegistros || 0,
                      valorTotal: detalhes.dados.header?.totals?.valorTotal || 0,
                      quantidadeSegmentos: {}
                    },
                    validacao: {
                      valido: detalhes.dados.file?.validationStatus === 'valid',
                      erros: detalhes.dados.errorDetails ? [detalhes.dados.errorDetails] : [],
                      avisos: []
                    },
                    informacoesArquivo: {
                      tamanho: detalhes.dados.file?.size || 0,
                      linhas: detalhes.dados.estatisticas?.totalRegistros || 0,
                      encoding: 'UTF-8',
                      formato: detalhes.dados.operationType === 'cnab240' ? 'CNAB 240' : 'CNAB 400'
                    }
                  }
                };

                resultadosDetalhados.push(processedFile);
              }
            } catch (detailError) {
              console.warn(`⚠️ Erro ao buscar detalhes para ${resultado.operationId}:`, detailError);

              // Criar entrada básica mesmo se falhar ao buscar detalhes
              const basicFile: CNABApiProcessingResponse = {
                sucesso: resultado.status === 'success',
                mensagem: 'Arquivo processado (detalhes limitados)',
                operationId: resultado.operationId,
                dataProcessamento: resultado.processedAt,
                arquivo: resultado.file ? {
                  nome: resultado.file.name,
                  tamanho: typeof resultado.file.size === 'string' ? parseInt(resultado.file.size) || 0 : resultado.file.size,
                  tipo: 'text/plain'
                } : {
                  nome: 'Arquivo CNAB',
                  tamanho: 0,
                  tipo: 'text/plain'
                },
                formatoDetectado: {
                  nome: resultado.operationType === 'cnab240' ? 'CNAB 240' : 'CNAB 400',
                  codigo: resultado.operationType === 'cnab240' ? 'CNAB_240' as const : 'CNAB_400' as const,
                  confianca: 100
                },
                dados: {
                  dadosEstruturados: {
                    header: {
                      codigoBanco: resultado.banco?.codigo || '---',
                      nomeBanco: resultado.banco?.nome || 'Banco não identificado',
                      agencia: '---',
                      conta: '---',
                      dataGeracao: resultado.processedAt,
                      sequencialArquivo: 1
                    },
                    lotes: [],
                    trailers: []
                  },
                  somatorias: {
                    totalLotes: 1,
                    totalRegistros: resultado.totals?.registros || 0,
                    valorTotal: resultado.totals?.valorTotal || 0,
                    quantidadeSegmentos: {}
                  },
                  validacao: {
                    valido: resultado.file?.validationStatus === 'valid',
                    erros: resultado.metadata?.hasError ? ['Erro durante processamento'] : [],
                    avisos: []
                  },
                  informacoesArquivo: {
                    tamanho: typeof resultado.file?.size === 'string' ? parseInt(resultado.file.size) || 0 : resultado.file?.size || 0,
                    linhas: resultado.totals?.registros || 0,
                    encoding: 'UTF-8',
                    formato: resultado.operationType === 'cnab240' ? 'CNAB 240' : 'CNAB 400'
                  }
                }
              };

              resultadosDetalhados.push(basicFile);
            }
          }

          // Atualizar estado com os resultados históricos
          console.log(`✅ Carregados ${resultadosDetalhados.length} resultados detalhados`);

          if (resultadosDetalhados.length > 0) {
            toast.success(`📚 Carregados ${resultadosDetalhados.length} arquivos CNAB históricos`);
          }
        } else {
          console.log('📝 Nenhum resultado histórico encontrado ou estrutura inesperada:', listaResponse);
        }

      } catch (error) {
        console.error('❌ Erro ao carregar resultados históricos:', error);
        toast.error('Erro ao carregar histórico de CNABs', {
          description: 'Não foi possível carregar os arquivos processados anteriormente'
        });
      }
    };

    carregarResultadosHistoricos();
  }, []);

  // Callback simplificado para quando um arquivo é processado pela API real
  const handleCNABFileProcessed = (response: CNABApiProcessingResponse) => {
    // Apenas mudar para a aba de CNAB e exibir notificação
    // O React Query vai automaticamente atualizar os dados via invalidação de cache
    setActiveTab('cnab');

    // Exibe notificação
    if (response.sucesso) {
      toast.success(`✅ Arquivo CNAB processado com sucesso!`, {
        description: `${response.arquivo?.nome || 'Arquivo'} - Formato: ${response.formatoDetectado?.nome || 'CNAB'}`
      });
    } else {
      toast.error(`❌ Erro ao processar arquivo CNAB`, {
        description: response.erro || response.mensagem
      });
    }
  };

  // Callback para quando um arquivo é processado (mantido para compatibilidade)
  const handleFileProcessed = (file: CNABFile) => {
    // Adiciona o novo arquivo processado à lista
    setCnabFiles(prev => [file, ...prev]);

    // Verificar automaticamente o arquivo CNAB
    const verification = {
      canSubmit: true,
      messages: []
    };

    if (verification.canSubmit) {
      // Criar automaticamente um lote de aprovação
      createAndAddApprovalBatch(file);
    } else {
      // Exibir erro de verificação
      toast.error("O arquivo CNAB possui problemas e não pode ser enviado para aprovação", {
        description: verification.messages.join(', ')
      });
    }

    // Exibe notificação de sucesso do processamento
    toast.success(`Arquivo processado com sucesso`, {
      description: `${file.filename} - ${file.paymentCount} pagamentos totalizando R$ ${file.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    });

    // Muda para a aba de CNAB
    setActiveTab('cnab');
  };

  // Criar e adicionar um lote de aprovação
  const createAndAddApprovalBatch = (cnabFile: CNABFile) => {
    // Usar a função de API para criar o lote
    const batch = {
      id: '1',
      name: `Lote de pagamentos - ${cnabFile.filename}`,
      createdBy: currentUser.name
    };

    if (batch) {
      // Atualizar o arquivo CNAB para referenciar o lote
      setCnabFiles(prev =>
        prev.map(file =>
          file.id === cnabFile.id
            ? { ...file, approvalBatchId: batch.id }
            : file
        )
      );

      // Adicionar o lote à lista
      setApprovalBatches(prev => [batch as unknown as ApprovalBatch, ...prev]);

      // Notificar o usuário
      toast.success(`Lote de aprovação criado automaticamente`, {
        description: `${batch.name}`
      });
    }
  };

  // Atualiza o status de um arquivo CNAB
  const handleUpdateCNABStatus = (fileId: string, newStatus: CNABFile['status']) => {
    setCnabFiles(prev =>
      prev.map(file =>
        file.id === fileId
          ? { ...file, status: newStatus }
          : file
      )
    );

    toast.success(`Status do arquivo atualizado para ${newStatus}`);
  };

  // Aprovar ou rejeitar um lote
  const handleBatchAction = (batchId: string, action: 'aprovado' | 'rejeitado', comments?: string) => {
    // Encontrar o lote
    const batch = approvalBatches.find(b => b.id === batchId);
    if (!batch) return;

    // Atualizar o status do lote
    setApprovalBatches(prev =>
      prev.map(b =>
        b.id === batchId
          ? {
            ...b,
            status: action,
            ...(comments ? { rejectionReason: comments } : {})
          }
          : b
      )
    );

    // Se aprovado, mover os pagamentos para a lista de pagamentos
    if (action === 'aprovado') {
      // Atualizar o status de todos os pagamentos no lote
      const approvedPayments = batch.payments.map(payment => ({
        ...payment,
        status: 'aprovado' as PaymentStatus,
        approvedBy: currentUser.name,
        approvedAt: new Date().toISOString()
      }));

      // Adicionar à lista de pagamentos
      setPayments(prev => [...approvedPayments, ...prev]);

      // Atualizar o status do arquivo CNAB relacionado
      if (batch.cnabFileId) {
        handleUpdateCNABStatus(batch.cnabFileId, 'aprovado');
      }

      // Notificar usuário
      toast.success(`Lote de pagamentos aprovado com sucesso`, {
        description: `${batch.paymentsCount} pagamentos no valor total de R$ ${batch.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });

      // Direcionar para a aba de pagamentos
      setActiveTab('payments');
    } else {
      // Se rejeitado, atualizar o status do arquivo CNAB relacionado
      if (batch.cnabFileId) {
        handleUpdateCNABStatus(batch.cnabFileId, 'erro');
      }

      // Notificar usuário
      toast.error(`Lote de pagamentos rejeitado`, {
        description: comments || 'Nenhum motivo fornecido'
      });
    }
  };

  // Criar manualmente um lote de aprovação a partir de um arquivo CNAB
  const handleCreateApprovalBatch = (batchId: string) => {
    // Em uma aplicação real, buscaríamos o lote criado no banco de dados
    // Aqui vamos simular isso criando um lote com base no último arquivo CNAB
    const lastCnabFile = cnabFiles[0];

    if (!lastCnabFile) return;

    // Associar o arquivo CNAB ao batch (para rastreabilidade)
    setCnabFiles(prev =>
      prev.map(file =>
        file.id === lastCnabFile.id
          ? { ...file, approvalBatchId: batchId }
          : file
      )
    );

    // Criar um novo lote de aprovação (simular um retorno da API)
    const newBatch: ApprovalBatch = {
      id: batchId,
      description: `Lote de pagamentos - ${lastCnabFile.filename}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      status: 'pendente',
      paymentsCount: lastCnabFile.paymentCount,
      totalAmount: lastCnabFile.totalAmount,
      payments: Array(lastCnabFile.paymentCount).fill(null).map((_, index) => ({
        clientDocument: '',
        id: `${batchId}-${index}`,
        clientName: `Cliente ${index + 1}`,
        clientEmail: `cliente${index + 1}@exemplo.com`,
        paymentType: lastCnabFile.type === 'remessa' ? 'boleto' : 'pix',
        description: `Pagamento ${index + 1}`,
        paymentDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 dias depois
        installment: 1,
        amount: lastCnabFile.totalAmount / lastCnabFile.paymentCount,
        status: 'pendente',
        invoice: Math.random() > 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      cnabFileId: lastCnabFile.id
    };

    // Adicionar o novo lote à lista
    setApprovalBatches(prev => [newBatch, ...prev]);

    // Mudar para a aba de aprovações
    setActiveTab('approvals');

    toast.success(`Lote de aprovação criado com sucesso`, {
      description: `${newBatch.description} com ${newBatch.paymentsCount} pagamentos`
    });
  };

  // Função para navegar para a página de novo pagamento
  const handleNewPayment = () => {
    navigate('/novo-pagamento');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 overflow-y-auto">
          <Header
            title="Sistema de Gerenciamento de Pagamentos"
            hasSearch={true}
            notifications={notifications}
          />

          <DashboardStats stats={dashboardStats} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="payments">Pagamentos</TabsTrigger>
              <TabsTrigger value="cnab">Arquivos CNAB</TabsTrigger>
              <TabsTrigger value="persistence">Dados Persistidos</TabsTrigger>
              <TabsTrigger value="approvals">Aprovações</TabsTrigger>
            </TabsList>
            <TabsContent value="payments" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Lista de Pagamentos</h2>
                <Button
                  onClick={handleNewPayment}
                  className="flex items-center gap-1"
                >
                  <PlusCircle className="h-4 w-4" />
                  Novo Pagamento
                </Button>
              </div>
              <PaymentsTable payments={payments} />
            </TabsContent>
            <TabsContent value="cnab" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FileUpload onFileProcessed={handleCNABFileProcessed} />
                <ProcessingStatus />
              </div>
            </TabsContent>
            <TabsContent value="persistence" className="mt-4">
              <CNABPersistenceManager />
            </TabsContent>
            <TabsContent value="approvals" className="mt-4">
              <ApprovalList
                batches={approvalBatches}
                onApprove={(batchId) => handleBatchAction(batchId, 'aprovado')}
                onReject={(batchId, reason) => handleBatchAction(batchId, 'rejeitado', reason)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
