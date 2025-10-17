import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ContractCardProps {
  module: string;
  service: string;
  type: "Recorrente" | "Pontual";
  value: number;
  startDate?: string;
  status?: "Ativo" | "Onboard" | "Triagem" | "Cancelamento" | "Cancelado";
}

export default function ContractCard({ module, service, type, value, startDate, status = "Ativo" }: ContractCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativo":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "Onboard":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Triagem":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "Cancelamento":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "Cancelado":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "";
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{module}</h4>
          <p className="text-sm text-muted-foreground">{service}</p>
        </div>
        <div className="flex flex-col gap-1 items-end ml-2">
          <Badge variant={type === "Recorrente" ? "default" : "secondary"}>
            {type}
          </Badge>
          <Badge className={getStatusColor(status)} variant="outline">
            {status}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-primary">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </p>
        {startDate && (
          <p className="text-xs text-muted-foreground">
            Início: {new Date(startDate).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
    </Card>
  );
}