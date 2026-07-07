import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { DrillSheet } from "./DrillSheet";
import { useReportsMensal, useGestaoReceitaDetalhe } from "./hooks";
import { paramsParaMes, labelMes } from "./temporalidade";

// Tipos válidos aceitos por /api/gestao/receita/detalhe (server/routes/gestaoReceita.detalhe.ts,
// const TIPOS). "venda"/"churn" (soltos) NÃO existem — usar "venda_mrr"/"venda_pontual" e
// "churn_motivo"/"churn_vendedor" (que exigem uma chave específica, não "total").
export function SecaoReceita({ mes }: { mes: string }) {
  const rm = useReportsMensal(mes);
  const [detalheParams, setDetalheParams] = useState<Record<string, string> | null>(null);
  const detalhe = useGestaoReceitaDetalhe(detalheParams);
  const [drillAberto, setDrillAberto] = useState(false);

  function abrirDrill(tipo: string, chave: string) {
    const { de, ate } = paramsParaMes(mes).deAte;
    setDetalheParams({ de, ate, tipo, chave });
    setDrillAberto(true);
  }

  if (rm.isError) return <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"><CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" /> Falha ao carregar receita.</CardContent></Card>;
  if (rm.isLoading || !rm.data) return <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  const tm = rm.data.turboMetrics;
  const p = rm.data.pontualData;
  const grupos = (detalhe.data as any)?.grupos ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">MRR</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {/* Receita MRR = ESTOQUE de MRR ativo (ClickUp/cup_data_hist). Não há endpoint que
             componha esse número; venda_mrr lista a VENDA do mês (fluxo, Bitrix) e NÃO reconcilia
             com o estoque → card não clicável (mesma regra de Churn/Pausado/Cross-sell). */}
          <KpiCard mes={mes} temporalidade="mes" titulo="Receita MRR" valor={formatCurrencyNoDecimals(tm.mrrAtivo)} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Nova receita" valor={formatCurrencyNoDecimals(tm.mrrAdicionado)} onClick={() => abrirDrill("venda_mrr", "mrr")} />
          {/* Churn: sem tipo "total" no backend (só churn_motivo/churn_vendedor com chave específica) — não clicável, mesma regra do Pausado/Cross-sell abaixo. */}
          <KpiCard mes={mes} temporalidade="mes" titulo="Churn" valor={formatCurrencyNoDecimals(tm.churnMrr)} sub={`${tm.churnCount} contratos`} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Pausado/Reativado" valor={formatCurrencyNoDecimals(tm.pausadosMrr)} sub={`${tm.pausadosCount} contratos`} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Cross-sell" valor={formatCurrencyNoDecimals(tm.crosssellMrr)} />
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Pontual</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard mes={mes} temporalidade="mes" titulo="Nova receita" valor={formatCurrencyNoDecimals(p.aquisicao.valor)} sub={`${p.aquisicao.contratos} contratos`} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Entregue" valor={formatCurrencyNoDecimals(p.entregasMes.total)} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Cross-sell" valor={formatCurrencyNoDecimals(tm.crosssellPontual)} />
          <KpiCard mes={mes} temporalidade="snapshot" titulo="Em aberto (estoque)" valor={formatCurrencyNoDecimals(p.emAberto.valor)} sub={`${p.emAberto.contratos} itens`} />
        </div>
      </section>

      <DrillSheet
        open={drillAberto}
        onClose={() => setDrillAberto(false)}
        titulo={(detalhe.data as any)?.titulo ?? "Detalhe"}
        subtitulo={`${(detalhe.data as any)?.subtitulo ?? ""} · ${labelMes(mes)}`}
        colunas={[{ chave: "titulo", label: "Grupo", tipo: "text" }, { chave: "total", label: "Valor", tipo: "brl" }]}
        linhas={grupos}
        carregando={detalhe.isLoading}
        erro={detalhe.isError}
      />
    </div>
  );
}
