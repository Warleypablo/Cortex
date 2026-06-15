import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Percent, TrendingDown, UserX, DollarSign } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { Overview } from "./types";

function Kpi({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({ data }: { data: Overview }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={Users} label="Jornadas pontorrente" value={String(data.jornadas)} />
      <Kpi icon={Percent} label="Retenção até a última entrega" value={`${data.retencaoUltima}%`} />
      <Kpi icon={TrendingDown} label="Drop-off médio / degrau" value={`${data.dropMedio}%`} />
      <Kpi icon={UserX} label="Contratos cancelados" value={String(data.churnConfirmado)} />
      <Kpi icon={DollarSign} label="Valor pontual perdido" value={formatCurrencyNoDecimals(data.valorpPerdido)} />
    </div>
  );
}
