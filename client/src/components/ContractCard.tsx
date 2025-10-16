import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ContractCardProps {
  module: string;
  service: string;
  type: "Recorrente" | "Pontual";
  value: number;
  startDate?: string;
}

export default function ContractCard({ module, service, type, value, startDate }: ContractCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{module}</h4>
          <p className="text-sm text-muted-foreground">{service}</p>
        </div>
        <Badge variant={type === "Recorrente" ? "default" : "secondary"} className="ml-2">
          {type}
        </Badge>
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