import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TemporalidadeBadge } from "./TemporalidadeBadge";

interface KpiCardProps {
  titulo: string; valor: string; sub?: string;
  temporalidade: "mes" | "snapshot"; mes: string;
  delta?: { valor: string; positivo: boolean };
  icone?: React.ReactNode; onClick?: () => void;
}

export function KpiCard({ titulo, valor, sub, temporalidade, mes, delta, icone, onClick }: KpiCardProps) {
  return (
    <Card
      className={cn("transition-shadow", onClick && "cursor-pointer hover:shadow-md")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{titulo}</span>
          {icone}
        </div>
        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{valor}</div>
        <div className="mt-1 flex items-center gap-2">
          <TemporalidadeBadge tipo={temporalidade} mes={mes} />
          {delta && (
            <span className={cn("text-[11px] font-medium", delta.positivo ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {delta.valor}
            </span>
          )}
        </div>
        {sub && <div className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{sub}</div>}
      </CardContent>
    </Card>
  );
}
