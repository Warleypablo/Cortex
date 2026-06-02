import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, Users, TrendingDown, AlertTriangle } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { OverviewData } from "./types";

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({ data }: { data: OverviewData }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Kpi icon={DollarSign} label="MRR Ativo" value={formatCurrencyNoDecimals(data.mrrAtivo)} />
      <Kpi
        icon={Clock}
        label="LT Médio (ativos)"
        value={`${data.ltMedioAtivo} m`}
        sub={`Cancelados: ${data.ltMedioCancelado} m`}
      />
      <Kpi
        icon={Users}
        label="LTV Médio / Cliente"
        value={formatCurrencyNoDecimals(data.ltvMedioCliente)}
      />
      <Kpi
        icon={TrendingDown}
        label="Recorrentes"
        value={String(data.totalRecorrentes)}
      />
      <Kpi
        icon={AlertTriangle}
        label="Datas inconsistentes"
        value={String(data.totalInconsistentes)}
        sub="excluídos do LT"
      />
    </div>
  );
}
