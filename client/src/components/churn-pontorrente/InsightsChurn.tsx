import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, AlertTriangle, Percent, Flag, TrendingUp, Target } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { cancelamentosDe, rotuloDim } from "./utils";
import type { Jornada } from "./types";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function InsightsChurn({ jornadas }: { jornadas: Jornada[] }) {
  const canc = cancelamentosDe(jornadas);
  const totalCanc = canc.length;
  const valorPerdido = canc.reduce((a, c) => a + c.valorp, 0);
  const totalContratos = jornadas.reduce((a, j) => a + j.entregas.length, 0);

  const maxNivel = jornadas.length ? Math.max(1, ...jornadas.flatMap((j) => j.entregas.map((e) => e.nivel))) : 4;
  const porEntrega = Array.from({ length: maxNivel }, (_, i) => i + 1).map((n) => {
    let total = 0, qtd = 0, valor = 0;
    for (const j of jornadas) for (const e of j.entregas) if (e.nivel === n) { total += 1; if (e.situacao === "churn") { qtd += 1; valor += e.valorp; } }
    return { n, total, qtd, valor, taxa: total > 0 ? Math.round((qtd / total) * 1000) / 10 : 0 };
  });
  const taxa1 = porEntrega[0]?.taxa ?? 0;
  const taxaUlt = porEntrega[porEntrega.length - 1]?.taxa ?? 0;
  const maiorValor = porEntrega.reduce((a, b) => (b.valor > a.valor ? b : a), porEntrega[0] ?? { n: 0, valor: 0 });

  const reached = (n: number) => jornadas.filter((j) => j.nivelMax >= n).length;
  const base = reached(1) || 1;
  const retUlt = Math.round((reached(maxNivel) / base) * 1000) / 10;

  const motivoMap = new Map<string, { label: string; qtd: number; valor: number }>();
  for (const c of canc) {
    const label = rotuloDim(c.motivo);
    const cur = motivoMap.get(label) ?? { label, qtd: 0, valor: 0 };
    cur.qtd += 1; cur.valor += c.valorp; motivoMap.set(label, cur);
  }
  const topMotivo = Array.from(motivoMap.values()).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor)[0];
  const pctTopMotivo = topMotivo && totalCanc > 0 ? Math.round((topMotivo.qtd / totalCanc) * 100) : 0;

  if (jornadas.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-50/60 to-transparent dark:from-red-950/20 dark:to-transparent border-gray-200 dark:border-zinc-700/50">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-zinc-200">Resumo &amp; insights</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Hero icon={DollarSign} tone="red" value={formatCurrencyNoDecimals(valorPerdido)} label="perdido em churn" sub={`${totalCanc} contratos cancelados`} />
          <Hero icon={AlertTriangle} tone="red" value={`${totalCanc}`} label="contratos cancelados" sub={`de ${totalContratos} contratos`} />
          <Hero icon={Percent} tone="amber" value={pct1(retUlt)} label={`chegam à ${maxNivel}ª entrega`} sub={`${reached(maxNivel)} de ${base} jornadas`} />
          <Hero icon={Flag} tone="indigo" value={topMotivo?.label ?? "—"} label="principal motivo" sub={topMotivo ? `${pctTopMotivo}% · ${formatCurrencyNoDecimals(topMotivo.valor)}` : ""} small />
        </div>

        <ul className="mt-5 space-y-2 text-sm text-gray-700 dark:text-zinc-300">
          <li className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>O churn <strong>cresce a cada entrega</strong>: de <strong>{pct1(taxa1)}</strong> na 1ª para <strong>{pct1(taxaUlt)}</strong> na {maxNivel}ª entrega.</span>
          </li>
          <li className="flex items-start gap-2">
            <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>A <strong>{maiorValor.n}ª entrega</strong> concentra a maior perda: <strong>{formatCurrencyNoDecimals(maiorValor.valor)}</strong>.</span>
          </li>
          {topMotivo && (
            <li className="flex items-start gap-2">
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span><strong>{topMotivo.label}</strong> é o motivo nº 1: <strong>{topMotivo.qtd}</strong> cancelamentos ({pctTopMotivo}% do total), <strong>{formatCurrencyNoDecimals(topMotivo.valor)}</strong>.</span>
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function Hero({
  icon: Icon, value, label, sub, tone, small,
}: { icon: ElementType; value: string; label: string; sub?: string; tone: "red" | "amber" | "indigo"; small?: boolean }) {
  const toneCls = tone === "red" ? "text-red-600 dark:text-red-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400";
  return (
    <div className="flex items-start gap-3">
      <div className={`rounded-lg bg-white/70 p-2 shadow-sm dark:bg-zinc-900/60 ${toneCls}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className={`${small ? "text-base" : "text-2xl"} font-bold leading-tight text-gray-900 dark:text-white truncate`} title={value}>{value}</p>
        <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-zinc-500">{sub}</p>}
      </div>
    </div>
  );
}
