import { TrendingUp, TrendingDown, Package, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { useRelatorioSemanal } from "./relatorio-semanal/useRelatorioSemanal";
import type { KpiData } from "./relatorio-semanal/types";

const fmtBRL = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtDiaMes = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

// Cor semântica: positivo é bom quando betterDirection==="up"; ruim quando "down".
function corVariacao(pct: number | null, dir: "up" | "down"): string {
  if (pct == null || pct === 0) return "text-gray-400 dark:text-zinc-500";
  const positivo = pct > 0;
  const bom = dir === "up" ? positivo : !positivo;
  return bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function KpiCard({
  label,
  icon: Icon,
  valorFormatado,
  kpi,
  refFormatado,
  subValor,
}: {
  label: string;
  icon: typeof TrendingUp;
  valorFormatado: string;
  kpi: KpiData;
  refFormatado: string;
  subValor?: string;
}) {
  const pct = kpi.variacaoPct;
  const Seta = pct != null && pct < 0 ? ArrowDown : ArrowUp;
  const pctTxt =
    pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-zinc-400">
        <Icon className="h-4 w-4" />
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{valorFormatado}</div>
      {subValor && <div className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{subValor}</div>}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className={`flex items-center gap-0.5 font-semibold ${corVariacao(pct, kpi.betterDirection)}`}>
          {pct != null && <Seta className="h-3.5 w-3.5" />}
          {pctTxt}
        </span>
        <span className="text-gray-400 dark:text-zinc-500">vs {refFormatado}</span>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
      <div className="mt-4 h-8 w-40 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function RelatorioSemanal() {
  const { data, isLoading, error } = useRelatorioSemanal();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reporte Semanal</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Desempenho da empresa na semana</p>
        </div>
        {data && (
          <div className="text-sm text-gray-500 dark:text-zinc-400">
            Semana {fmtDiaMes(data.periodo.atual.inicio)}–{fmtDiaMes(data.periodo.atual.fim)}
            <span className="mx-1">·</span>
            vs {fmtDiaMes(data.periodo.anterior.inicio)}–{fmtDiaMes(data.periodo.anterior.fim)}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          Não foi possível carregar o reporte: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading || !data ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="MRR Ativo"
              icon={TrendingUp}
              valorFormatado={fmtBRL(data.kpis.mrrAtivo.atual)}
              kpi={data.kpis.mrrAtivo}
              refFormatado={fmtBRL(data.kpis.mrrAtivo.anterior)}
            />
            <KpiCard
              label="Churn"
              icon={TrendingDown}
              valorFormatado={fmtBRL(data.kpis.churn.atual)}
              kpi={data.kpis.churn}
              refFormatado={fmtBRL(data.kpis.churn.anterior)}
            />
            <KpiCard
              label="Entregas Pontuais"
              icon={Package}
              valorFormatado={fmtBRL(data.kpis.entregasPontuais.atual)}
              kpi={data.kpis.entregasPontuais}
              refFormatado={fmtBRL(data.kpis.entregasPontuais.anterior)}
              subValor={
                data.kpis.entregasPontuais.qtdAtual != null
                  ? `${data.kpis.entregasPontuais.qtdAtual} entregas`
                  : undefined
              }
            />
            <KpiCard
              label="Churn Pontual"
              icon={AlertTriangle}
              valorFormatado={fmtBRL(data.kpis.churnPontual.atual)}
              kpi={data.kpis.churnPontual}
              refFormatado={fmtBRL(data.kpis.churnPontual.anterior)}
              subValor={
                data.kpis.churnPontual.qtdAtual != null
                  ? `${data.kpis.churnPontual.qtdAtual} cancelamentos`
                  : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
