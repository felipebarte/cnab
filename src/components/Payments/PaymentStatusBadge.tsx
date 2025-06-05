
import { cn } from "@/lib/utils";
import { PaymentStatus as PaymentStatusType } from "@/lib/types";

interface PaymentStatusBadgeProps {
  status: PaymentStatusType;
}

const PaymentStatusBadge = ({ status }: PaymentStatusBadgeProps) => {
  const getStatusConfig = (status: PaymentStatusType | string) => {
    switch (status) {
      case 'pendente':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' };
      case 'aprovado':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Aprovado' };
      case 'rejeitado':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejeitado' };
      case 'processando':
        return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Processando' };
      case 'erro':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Erro' };
      case 'liquidado':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Liquidado' };
      case 'cancelado':
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelado' };
      case 'agendado':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Agendado' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    }
  };

  const { bg, text, label } = getStatusConfig(status);

  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", bg, text)}>
      {label}
    </span>
  );
};

export default PaymentStatusBadge;
