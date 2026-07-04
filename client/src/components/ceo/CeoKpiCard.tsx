import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { formatValor, atingimentoTom, type CeoUnidade, type CeoDirecao } from "./ceoFormat";

export interface CeoKpi {
  key: string;
  label: string;
  valor: number | null;
  unidade: CeoUnidade;
  meta: number | null;
  atingimentoPct: number | null;
  direcao: CeoDirecao;
  mom: number | null;
  sparkline: number[] | null;
  status: "ok" | "sem_meta" | "em_breve";
  nota?: string;
}

const TOM_CLASSES: Record<string, string> = {
  verde: "text-emerald-600 dark:text-emerald-400",
  ambar: "text-amber-600 dark:text-amber-400",
  vermelho: "text-rose-600 dark:text-rose-400",
  neutro: "text-gray-500 dark:text-zinc-400",
};

const TOM_STROKE: Record<string, string> = {
  verde: "#10b981",
  ambar: "#f59e0b",
  vermelho: "#f43f5e",
  neutro: "#a1a1aa",
};

export function CeoKpiCard({ kpi }: { kpi: CeoKpi }) {
  const emBreve = kpi.status === "em_breve";
  const tom = atingimentoTom(kpi.atingimentoPct, kpi.direcao);
  const spark = kpi.sparkline?.map((v, i) => ({ i, v })) ?? null;

  return (
    <div
      className={[
        "rounded-xl border p-4 flex flex-col gap-2 min-h-[120px]",
        "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700",
        emBreve ? "opacity-50" : "",
      ].join(" ")}
      title={kpi.nota}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-zinc-400">{kpi.label}</span>
        {emBreve && (
          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
            Em breve
          </span>
        )}
      </div>

      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
        {emBreve ? "—" : formatValor(kpi.valor, kpi.unidade)}
      </div>

      {/* Badge de comparação: atingimento (com meta) ou MoM (sem meta). */}
      {!emBreve && kpi.atingimentoPct !== null && (
        <div className={`text-xs font-medium ${TOM_CLASSES[tom]}`}>
          {Math.round(kpi.atingimentoPct)}% da meta
          <span className="text-gray-400 dark:text-zinc-500">
            {" "}· meta {formatValor(kpi.meta, kpi.unidade)}
          </span>
        </div>
      )}
      {!emBreve && kpi.atingimentoPct === null && kpi.mom !== null && (
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          {kpi.mom >= 0 ? "▲" : "▼"} {Math.abs(kpi.mom)}% vs mês anterior
        </div>
      )}

      {spark && spark.length > 1 && (
        <div className="h-8 -mx-1 mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={TOM_STROKE[tom]}
                fill={TOM_STROKE[tom]}
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
