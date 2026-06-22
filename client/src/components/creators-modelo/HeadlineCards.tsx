// client/src/components/creators-modelo/HeadlineCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { CreatorsModeloPayload, Grupo, Agregador } from "./types";

function pick(g: Grupo | undefined, campo: "ltv" | "lt" | "ent", agg: Agregador): number {
  if (!g) return 0;
  const m = g.metricas;
  if (campo === "ltv") return agg === "media" ? m.ltvMedia : m.ltvMediana;
  if (campo === "lt") return agg === "media" ? m.ltMesesMedia : m.ltMesesMediana;
  return agg === "media" ? m.nEntregasMedia : m.nEntregasMediana;
}

function find(grupos: Grupo[], modelo: string, estado: string) {
  return grupos.find((g) => g.modelo === modelo && g.estado === estado);
}

export function HeadlineCards({
  data, agregador,
}: {
  data: CreatorsModeloPayload; agregador: Agregador;
}) {
  // O header é sempre um resumo POR CLIENTE (unidade de negócio): "Clientes" e
  // "Nº entregas média" só fazem sentido por cliente. O toggle cliente/contrato
  // afeta apenas a tabela detalhada, não este resumo.
  const grupos = data.tabela.cliente;
  const recTotal = find(grupos, "recorrente", "total");
  const pontTotal = find(grupos, "pontual", "total");
  const recCanc = find(grupos, "recorrente", "cancelado");
  const ltvRec = pick(recTotal, "ltv", agregador);
  const ltvPont = pick(pontTotal, "ltv", agregador);

  // churn recorrente = % cancelado
  const churnRec = recTotal && recTotal.metricas.n
    ? Math.round(((recCanc?.metricas.n ?? 0) / recTotal.metricas.n) * 1000) / 10 : 0;
  // % que não chega à 4ª (sequenciados, base entregue)
  const fe = data.funilEntregue;
  const n1 = fe.find((f) => f.nivel === 1)?.atingiram ?? 0;
  const n4 = fe.find((f) => f.nivel === 4)?.atingiram ?? 0;
  const naoChega4 = n1 ? Math.round((1 - n4 / n1) * 1000) / 10 : 0;

  const melhor = ltvPont === ltvRec ? "empate" : ltvPont > ltvRec ? "Pontual" : "Recorrente";
  const delta = Math.abs(ltvPont - ltvRec);

  const cardCls = "bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";
  const linha = (label: string, valor: string) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-zinc-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-white">{valor}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className={cardCls}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-sky-600 dark:text-sky-400">Recorrente</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {linha("Clientes", String(recTotal?.metricas.n ?? 0))}
          {linha(`LTV ${agregador}`, formatCurrencyNoDecimals(ltvRec))}
          {linha(`LT ${agregador} (meses)`, String(pick(recTotal, "lt", agregador)))}
          {linha("Churn (% cancelado)", `${churnRec}%`)}
        </CardContent>
      </Card>
      <Card className={cardCls}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-indigo-600 dark:text-indigo-400">Pontual</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {linha("Clientes", String(pontTotal?.metricas.n ?? 0))}
          {linha(`LTV ${agregador}`, formatCurrencyNoDecimals(ltvPont))}
          {linha(`Nº entregas ${agregador}`, String(pick(pontTotal, "ent", agregador)))}
          {linha("Não chega à 4ª entrega", `${naoChega4}%`)}
        </CardContent>
      </Card>
      <Card className={cardCls}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-gray-700 dark:text-zinc-200">Δ Comparação</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {linha("Maior LTV/cliente", melhor)}
          {linha("Diferença", formatCurrencyNoDecimals(delta))}
          <p className="pt-1 text-xs text-gray-500 dark:text-zinc-400">
            {data.coorte.avisoMaturidade
              ? "⚠️ Maturidades diferentes — compare com cautela."
              : "Maturidades comparáveis."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
