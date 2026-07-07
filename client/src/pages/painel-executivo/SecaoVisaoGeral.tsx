import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrencyCompact, formatCurrencyNoDecimals, formatPercent } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { EmBreveCard } from "./EmBreveCard";
import { useReportsMensal, useLtLtvOverview, useCeoDashboard } from "./hooks";

export function SecaoVisaoGeral({ mes }: { mes: string }) {
  const rm = useReportsMensal(mes);
  const ltv = useLtLtvOverview();
  const ceo = useCeoDashboard(mes);

  if (rm.isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> Falha ao carregar os dados do mês. Tente recarregar.
        </CardContent>
      </Card>
    );
  }
  if (rm.isLoading || !rm.data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const tm = rm.data.turboMetrics;
  // kpis é um array (CeoKpi[]), não um mapa por chave — buscar pelo campo `key`.
  const receitaCabeca = (ceo.data as any)?.kpis?.find((k: any) => k.key === "receita_cabeca")?.valor;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard mes={mes} temporalidade="mes" titulo="MRR Ativo" valor={formatCurrencyNoDecimals(tm.mrrAtivo)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Nova Receita MRR" valor={formatCurrencyNoDecimals(tm.mrrAdicionado)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Churn MRR" valor={formatCurrencyNoDecimals(tm.churnMrr)} sub={`${tm.churnCount} contratos`} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Cross-sell / Upsell" valor={formatCurrencyNoDecimals(tm.crosssellMrr + tm.crosssellPontual)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Entregas Pontuais" valor={formatCurrencyNoDecimals(rm.data.pontualData.entregasMes.total)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Entregas Tech" valor={String(rm.data.techData.kpis.entregues)} />
        <KpiCard mes={mes} temporalidade="snapshot" titulo="LTV médio/cliente" valor={ltv.data ? formatCurrencyNoDecimals((ltv.data as any).ltvMedioCliente) : "—"} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Receita / Cabeça" valor={receitaCabeca != null ? formatCurrencyNoDecimals(receitaCabeca) : "—"} sub={ceo.isError ? "sem permissão" : "meta R$ 20k"} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Receita × Churn — 12 meses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={tm.receitaChurnSeries}>
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis yAxisId="l" tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip
                formatter={(v: number, n) => n === "Churn %" ? formatPercent(v) : formatCurrencyNoDecimals(v)}
                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }}
              />
              <Legend />
              <Bar yAxisId="l" dataKey="mrr" name="MRR" fill="#14b8a6" stackId="a" />
              <Bar yAxisId="l" dataKey="pontual" name="Pontual" fill="#0ea5e9" stackId="a" />
              <Line yAxisId="r" dataKey="churnPct" name="Churn %" stroke="#ef4444" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EmBreveCard titulo="NPS" motivo="Fase 2 — requer fonte cortex_core.nps_clientes" />
        <EmBreveCard titulo="Margem de Contribuição" motivo="Fase 2 — receita − custos de operação por squad" />
      </div>
    </div>
  );
}
