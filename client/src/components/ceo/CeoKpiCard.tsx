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

const TOM = {
  verde: { texto: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", barra: "bg-emerald-500", borda: "hover:border-emerald-300 dark:hover:border-emerald-800/70", stroke: "#10b981" },
  ambar: { texto: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", barra: "bg-amber-500", borda: "hover:border-amber-300 dark:hover:border-amber-800/70", stroke: "#f59e0b" },
  vermelho: { texto: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500", barra: "bg-rose-500", borda: "hover:border-rose-300 dark:hover:border-rose-800/70", stroke: "#f43f5e" },
  neutro: { texto: "text-orange-600 dark:text-orange-400", dot: "bg-orange-400", barra: "bg-orange-400", borda: "hover:border-orange-300 dark:hover:border-orange-800/70", stroke: "#f97316" },
} as const;

export function CeoKpiCard({ kpi, onClick }: { kpi: CeoKpi; onClick?: () => void }) {
  const emBreve = kpi.status === "em_breve";
  const clicavel = !emBreve && !!onClick;
  const tomKey = atingimentoTom(kpi.atingimentoPct, kpi.direcao);
  const tom = TOM[tomKey];
  const spark = kpi.sparkline?.map((v, i) => ({ i, v })) ?? null;
  const temMeta = kpi.atingimentoPct !== null;
  const barra = temMeta ? Math.max(0, Math.min(100, kpi.atingimentoPct!)) : 0;
  const gradId = `ceo-spark-${kpi.key}`;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-2 min-h-[148px]",
        "bg-gradient-to-br from-white to-gray-50/60 dark:from-zinc-900 dark:to-zinc-900/40",
        "border-gray-200/80 dark:border-zinc-800",
        emBreve ? "opacity-50" : "",
        clicavel ? `cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-gray-200/60 dark:hover:shadow-black/40 hover:-translate-y-0.5 ${tom.borda}` : "",
      ].join(" ")}
      title={kpi.nota}
      {...(clicavel
        ? {
            onClick,
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); }
            },
          }
        : {})}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500 dark:text-zinc-400">{kpi.label}</span>
        {emBreve ? (
          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">Em breve</span>
        ) : (
          <span className={`h-2 w-2 rounded-full ${tom.dot} shadow-[0_0_0_3px] shadow-current/10`} />
        )}
      </div>

      <div className="text-[26px] leading-none font-bold tabular-nums text-gray-900 dark:text-white">
        {emBreve ? "—" : formatValor(kpi.valor, kpi.unidade)}
      </div>

      {/* Comparação: atingimento (com meta) ou MoM (sem meta). */}
      {!emBreve && temMeta && (
        <div className={`text-xs font-semibold ${tom.texto}`}>
          {Math.round(kpi.atingimentoPct!)}% da meta
          <span className="font-normal text-gray-400 dark:text-zinc-500"> · meta {formatValor(kpi.meta, kpi.unidade)}</span>
        </div>
      )}
      {!emBreve && !temMeta && kpi.mom !== null && (
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          <span className={kpi.mom >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {kpi.mom >= 0 ? "▲" : "▼"} {Math.abs(kpi.mom)}%
          </span> vs mês anterior
        </div>
      )}

      {/* Sparkline com gradiente */}
      {spark && spark.length > 1 && (
        <div className="h-10 -mx-1 mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tom.stroke} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={tom.stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={tom.stroke} fill={`url(#${gradId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Barra de atingimento (base do card) */}
      {!emBreve && temMeta && (
        <div className="mt-1 h-1 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
          <div className={`h-full rounded-full ${tom.barra} transition-all duration-500`} style={{ width: `${barra}%` }} />
        </div>
      )}
    </div>
  );
}
