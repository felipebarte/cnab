// Tipos de status para pagamentos
export type PaymentStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'processando' | 'cancelado' | 'pago';

// Tipos de pagamento
export type PaymentType = 'boleto' | 'pix' | 'transferencia' | 'cartao';

// Interface para informações de cabeçalho CNAB
export interface CNABHeaderInfo {
  codigoBanco?: string;
  nomeBanco?: string;
  dataArquivo?: string;
  numeroSequencial?: string;
  versaoLayout?: string;
  [key: string]: any;
}

// Interface para informações de trailer CNAB
export interface CNABTrailerInfo {
  totalRegistros?: number;
  totalLotes?: number;
  valorTotal?: number;
  [key: string]: any;
}

// Interface para lotes CNAB
export interface CNABLote {
  numeroLote?: number;
  tipoOperacao?: string;
  tipoServico?: string;
  registros?: CNABRegistro[];
  [key: string]: any;
}

// Interface para registros CNAB
export interface CNABRegistro {
  tipoRegistro?: string;
  numeroSequencial?: number;
  dados?: Record<string, any>;
  [key: string]: any;
}

// Interface para detalhes de detecção
export interface CNABDetectionDetails {
  motivoDeteccao?: string;
  caracteristicasEncontradas?: string[];
  confiancaPorCriterio?: Record<string, number>;
  [key: string]: any;
}

// Interface para dados estruturados CNAB
export interface CNABDadosEstruturados {
  header?: CNABHeaderInfo;
  lotes?: CNABLote[];
  trailer?: CNABTrailerInfo;
  registros?: CNABRegistro[];
  [key: string]: any;
}

// Interface para segmentos CNAB
export interface CNABSegmentos {
  [segmento: string]: number;
}

// Interface para estatísticas de processamento
export interface CNABEstatisticas {
  totalLotes?: number;
  totalRegistros?: number;
  valorTotal?: number;
  tiposRegistro?: Record<string, number>;
  [key: string]: any;
}

// Interface para informações bancárias
export interface BankInfo {
  codigo?: string;
  nome?: string;
  agencia?: string;
  conta?: string;
  [key: string]: any;
}

// Interface para resultados de validação
export interface ValidationResults {
  estrutural?: {
    valido: boolean;
    erros: string[];
  };
  conteudo?: {
    valido: boolean;
    avisos: string[];
  };
  [key: string]: any;
}

// Interface para resposta de webhook
export interface WebhookData {
  status?: string;
  message?: string;
  data?: Record<string, any>;
  timestamp?: string;
  [key: string]: any;
}

// Interface para pagamentos
export interface Payment {
  id: string;
  clientName: string;
  clientEmail: string;
  clientDocument: string;
  description: string;
  amount: number;
  paymentType: PaymentType;
  status: PaymentStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cnabFileId?: string;
  pixKey?: string;
  bankAccount?: {
    bank: string;
    agency: string;
    account: string;
    accountType: 'corrente' | 'poupanca';
  };
}

// Status do arquivo CNAB
export type CNABFileStatus = 'processando' | 'processado' | 'erro' | 'aprovado' | 'enviado' | 'rejeitado';

// Tipo do arquivo CNAB
export type CNABFileType = 'remessa' | 'retorno';

// Interface para arquivos CNAB
export interface CNABFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: CNABFileType;
  format: '240' | '400';
  bank: string;
  bankCode: string;
  status: CNABFileStatus;
  uploadDate: string;
  processedDate?: string;
  paymentCount: number;
  totalAmount: number;
  approvalBatchId?: string;
  errorMessage?: string;
  validationErrors?: string[];
  metadata?: {
    headerInfo?: CNABHeaderInfo;
    trailerInfo?: CNABTrailerInfo;
    lotes?: CNABLote[];
  };
}

// Status do lote de aprovação
export type ApprovalBatchStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'processando';

// Interface para lotes de aprovação
export interface ApprovalBatch {
  id: string;
  description: string;
  cnabFileId: string;
  payments: Payment[];
  paymentsCount: number;
  totalAmount: number;
  status: ApprovalBatchStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  metadata?: {
    bankInfo?: BankInfo;
    validationResults?: ValidationResults;
  };
}

// Interface para estatísticas do dashboard
export interface DashboardStats {
  totalPagamentos: number;
  pagamentosPendentes: number;
  pagamentosAprovados: number;
  pagamentosRejeitados: number;
  valorTotal: number;
  valorPendente: number;
  valorAprovado: number;
  pagamentosPorTipo: Array<{
    tipo: string;
    quantidade: number;
    valor: number;
  }>;
  pagamentosRecentes: Payment[];
}

// Interface para resposta de verificação CNAB
export interface CNABVerificationResult {
  canSubmit: boolean;
  isValid: boolean;
  messages: string[];
  errors?: string[];
  warnings?: string[];
}

// Interface para dados de webhook
export interface WebhookResponse {
  success: boolean;
  status: number;
  data?: WebhookData;
  error?: string;
  timestamp: string;
}

// Interface para resposta de processamento de arquivo
export interface FileProcessingResult {
  success: boolean;
  data?: CNABFile;
  error?: string;
  validationErrors?: string[];
}

// ================================
// TIPOS PARA DADOS DA PERSISTÊNCIA CNAB (PYTHON LOGIC)
// ================================

// Interface para pagamentos extraídos com lógica Python
export interface CNABPaymentData {
  favorecido_nome: string;
  pagador_nome: string;
  cnpj_pagador: string;
  banco_favorecido: string;
  valor: number;
  data_pagamento: string;
  documento: string;
  codigo_banco: string;
  codigo_lote: string;
  tipo_registro: string;
  numero_registro: string;
  segmento: string;
  codigo_movimento: string;
  codigo_camara: string;
  informacoes: string;
  descontos: string;
  acrescimos: string;
  codigo_barras: string;
  endereco_completo: string;
  logradouro: string;
  numero_endereco: string;
  complemento: string;
  bairro: string;
  cidade: string;
  cep: string;
  uf: string;
  email: string;
  cnpj_favorecido: string;
}

// Interface para resposta da API com lógica Python
export interface CNABPythonProcessingResponse {
  sucesso: boolean;
  valido: boolean;
  pythonLogicEnabled: boolean;
  dados: {
    pagamentos: CNABPaymentData[];
    resumo: {
      totalPagamentos: number;
      valorTotal: number;
      valorMedio: number;
    };
  };
  processamento: {
    linhasProcessadas: number;
    segmentosJ: number;
    metodologia: string;
  };
  codigosBarras?: {
    total: number;
    lista: Array<{
      tipo: string;
      segmento: string;
      codigo: string;
      favorecido: string;
      valor: number;
      dataVencimento: string;
      dataPagamento: string;
    }>;
  };
  operationId?: string;
  dataProcessamento?: string;
}

// Interface para dados persistidos no banco
export interface CNABPersistedData {
  id: number;
  operationId: string;
  banco_codigo: string;
  banco_nome: string;
  arquivo_sequencia: number;
  data_geracao: string;
  hora_geracao: string;
  empresa_tipo_pessoa: string;
  empresa_documento: string;
  empresa_nome: string;
  empresa_codigo: string;
  total_lotes: number;
  total_registros: number;
  valor_total: number;
  header_dados: Record<string, any>;
  trailer_dados: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  payments?: CNABPaymentData[];
  status: 'pending' | 'processed' | 'approved' | 'rejected' | 'sent';
}

// Interface para filtros de pesquisa de dados persistidos
export interface CNABPersistedFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  banco?: string;
  empresa?: string;
  minValue?: number;
  maxValue?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Interface para estatísticas de dados persistidos
export interface CNABPersistedStats {
  totalFiles: number;
  totalPayments: number;
  totalValue: number;
  averageValue: number;
  byStatus: {
    [status: string]: {
      count: number;
      value: number;
    };
  };
  byBank: {
    [bankCode: string]: {
      bankName: string;
      count: number;
      value: number;
    };
  };
  recent: CNABPersistedData[];
  trends: {
    period: string;
    count: number;
    value: number;
  }[];
}

// Interface para resposta da listagem de dados persistidos
export interface CNABPersistedListResponse {
  sucesso: boolean;
  dados: CNABPersistedData[];
  paginacao: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filtros: CNABPersistedFilters;
  estatisticas: CNABPersistedStats;
  operationId: string;
}

// ================================
// NOVOS TIPOS PARA API REAL
// ================================

// Formato detectado do CNAB
export interface CNABFormatDetected {
  codigo: 'CNAB_240' | 'CNAB_400';
  nome: string;
  confianca: number;
  descricao?: string;
}

// Detalhes da detecção de formato
export interface CNABFormatDetection {
  detectado: boolean;
  confianca: number;
  detalhes: CNABDetectionDetails;
  motivo?: string;
  erro?: string;
}

// Resposta de processamento da API
export interface CNABApiProcessingResponse {
  sucesso: boolean;
  mensagem: string;
  dados?: {
    dadosEstruturados: CNABDadosEstruturados;
    validacao: {
      valido: boolean;
      erros: string[];
      avisos: string[];
      detalhes?: ValidationResults;
    };
    somatorias?: {
      totalLotes: number;
      totalRegistros: number;
      valorTotal: number;
      quantidadeSegmentos?: CNABSegmentos;
    };
    resumoProcessamento?: {
      lotes: CNABLote[];
      registros: CNABRegistro[];
      estatisticas: CNABEstatisticas;
    };
    informacoesArquivo: {
      tamanho: number;
      linhas: number;
      encoding: string;
      formato: string;
    };
  };
  formatoDetectado?: CNABFormatDetected;
  deteccao?: CNABFormatDetection;
  arquivo: {
    nome: string;
    tamanho: number;
    tipo: string;
  };
  operationId: string;
  dataProcessamento: string;
  erro?: string;
  codigo?: string;
  tipo?: string;
}

// Status de upload de arquivo
export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error' | 'sending' | 'sent';

// Interface para arquivo em upload
export interface UploadingFile {
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress?: number;
  error?: string;
  resultado?: CNABApiProcessingResponse;
  webhookResponse?: WebhookData;
}

// Progresso de upload
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Opções de processamento CNAB
export interface CNABProcessingOptions {
  validarEstrutura?: boolean;
  incluirDetalhes?: boolean;
  gerarRelatorio?: boolean;
  webhookUrl?: string;
  timeout?: number;
}

// Resposta de validação CNAB
export interface CNABValidationResponse {
  sucesso: boolean;
  valido: boolean;
  formatoDetectado?: CNABFormatDetected;
  validacao: {
    estrutural: {
      valido: boolean;
      erros: string[];
    };
    conteudo: {
      valido: boolean;
      avisos: string[];
      detalhes: ValidationResults;
    };
  };
  operationId: string;
} 