import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CNABPaymentData } from "@/lib/types";
import { useCNABPayments } from "@/hooks/useCNABPersistence";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Building2,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  CreditCard,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CNABPaymentsTableProps {
  cnabId: number;
  className?: string;
  pageSize?: number;
}

const CNABPaymentsTable = ({
  cnabId,
  className = "",
  pageSize = 10
}: CNABPaymentsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  });

  const {
    data: paymentsData,
    isLoading,
    error,
    refetch
  } = useCNABPayments(cnabId, {
    page: currentPage,
    limit: pageSize,
    search: debouncedSearchTerm
  });

  const payments = paymentsData?.pagamentos || [];
  const totalPayments = paymentsData?.total || 0;
  const totalPages = paymentsData?.totalPages || 1;

  // Funções utilitárias
  const formatCurrency = (value: number): string => {
    return `R$ ${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString || dateString === "00000000") return "Não informado";
    
    try {
      // CNAB date format: DDMMAAAA
      if (dateString.length === 8) {
        const day = dateString.substring(0, 2);
        const month = dateString.substring(2, 4);
        const year = dateString.substring(4, 8);
        const date = new Date(`${year}-${month}-${day}`);
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      }
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const formatDocument = (document: string): string => {
    if (!document) return "Não informado";
    
    // Format CNPJ: XX.XXX.XXX/XXXX-XX
    if (document.length === 14) {
      return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    // Format CPF: XXX.XXX.XXX-XX
    if (document.length === 11) {
      return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    return document;
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            <p>Erro ao carregar pagamentos: {error.message}</p>
            <Button onClick={() => refetch()} className="mt-2">
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamentos CNAB
            {totalPayments > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalPayments} pagamentos
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por favorecido, pagador ou código..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando pagamentos...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhum pagamento encontrado</p>
            {searchTerm && (
              <p className="text-sm mt-2">
                Tente uma busca diferente ou limpe o filtro
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Favorecido</TableHead>
                    <TableHead className="w-[200px]">Pagador</TableHead>
                    <TableHead className="w-[120px]">Valor</TableHead>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[80px]">Banco</TableHead>
                    <TableHead className="w-[150px]">Código de Barras</TableHead>
                    <TableHead className="w-[200px]">Endereço</TableHead>
                    <TableHead className="w-[150px]">Email</TableHead>
                    <TableHead className="w-[120px]">Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment, index) => (
                    <TableRow key={`${payment.codigo_barras}-${index}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {payment.favorecido_nome}
                          </p>
                          {payment.cnpj_favorecido && (
                            <p className="text-xs text-gray-500">
                              CNPJ: {formatDocument(payment.cnpj_favorecido)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {payment.pagador_nome}
                          </p>
                          {payment.cnpj_pagador && (
                            <p className="text-xs text-gray-500">
                              CNPJ: {formatDocument(payment.cnpj_pagador)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {formatCurrency(payment.valor)}
                          </p>
                          {payment.descontos && parseFloat(payment.descontos) > 0 && (
                            <p className="text-xs text-gray-500">
                              Desc: {formatCurrency(parseFloat(payment.descontos) / 100)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">
                            {formatDate(payment.data_pagamento)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          <span className="text-sm font-mono">
                            {payment.banco_favorecido}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[150px]">
                          <p className="text-xs font-mono break-all">
                            {payment.codigo_barras}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          {payment.endereco_completo ? (
                            <div className="flex items-start gap-1">
                              <MapPin className="h-3 w-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-600 line-clamp-2">
                                {payment.endereco_completo}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Não informado</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[150px]">
                          {payment.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-blue-600 truncate">
                                {payment.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Não informado</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {payment.documento || "Não informado"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Página {currentPage} de {totalPages} • {totalPayments} pagamentos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        const start = Math.max(1, currentPage - 2);
                        pageNum = start + i;
                        if (pageNum > totalPages) pageNum = totalPages - (5 - 1 - i);
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CNABPaymentsTable;