import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { TrendingDown, DollarSign, Hash } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Celula {
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: number;
  mrr_perdido: number;
  ticket_medio: number;
  pct_dentro_produto: number;
  pct_total: number;
}

interface ProdutoMotivoData {
  produtos: string[];
  motivos: string[];
  celulas: Celula[];
  totais: { cancelamentos: number; mrr_perdido: number; ticket_medio: number };
}

interface SquadCelula {
  squad: string;
  motivo_cancelamento: string;
  cancelamentos: number;
  mrr_perdido: number;
  pct_dentro_squad: number;
}

interface SquadMotivoData {
  squads: string[];
  motivos: string[];
  celulas: SquadCelula[];
}

function heatColor(pct: number, maxPct: number, isDark: boolean): string {
  if (maxPct === 0 || pct === 0) return "transparent";
  const t = Math.min(pct / maxPct, 1);
  if (isDark) {
    const r = Math.round(24 + t * (49 - 24));
    const g = Math.round(24 + t * (46 - 24));
    const b = Math.round(27 + t * (129 - 27));
    return `rgb(${r},${g},${b})`;
  }
  const r = Math.round(245 - t * (245 - 109));
  const g = Math.round(243 - t * (243 - 40));
  const b = Math.round(255 - t * (255 - 217));
  return `rgb(${r},${g},${b})`;
}

function heatTextClass(pct: number, maxPct: number): string {
  const t = maxPct > 0 ? Math.min(pct / maxPct, 1) : 0;
  return t > 0.55 ? "text-white" : "text-gray-800 dark:text-zinc-200";
}

const DRILL_COLORS = ["#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#f5f3ff"];

function toMonthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStrBack(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months + 1);
  return toMonthStr(d);
}

const PRESETS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
] as const;

export function ChurnProdutoMotivo() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const today = new Date();
  const [inicio, setInicio] = useState(() => monthStrBack(12));
  const [fim, setFim] = useState(() => toMonthStr(today));
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);

  function aplicarPreset(months: number) {
    setInicio(monthStrBack(months));
    setFim(toMonthStr(today));
    setProdutoSelecionado(null);
  }

  const { data, isLoading, isError } = useQuery<ProdutoMotivoData>({
    queryKey: ["/api/churn/produto-motivo", inicio, fim],
    queryFn: () =>
      fetch(`/api/churn/produto-motivo?dataInicio=${inicio}&dataFim=${fim}`).then(r => r.json()),
    enabled: !!inicio && !!fim && inicio <= fim,
  });

  const { data: squadMotivoData } = useQuery<SquadMotivoData>({
    queryKey: ["/api/churn/squad-motivo", produtoSelecionado, inicio, fim],
    queryFn: () =>
      fetch(`/api/churn/squad-motivo?produto=${encodeURIComponent(produtoSelecionado!)}&dataInicio=${inicio}&dataFim=${fim}`)
        .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); }),
    enabled: !!produtoSelecionado && !!inicio && !!fim,
  });

  const maxPct = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.celulas.map(c => c.pct_dentro_produto));
  }, [data]);

  const celulaMap = useMemo(() => {
    if (!data) return new Map<string, Celula>();
    const m = new Map<string, Celula>();
    data.celulas.forEach(c => m.set(`${c.produto}|||${c.motivo_cancelamento}`, c));
    return m;
  }, [data]);

  const drillDown = useMemo(() => {
    if (!data || !produtoSelecionado) return [];
    return data.celulas
      .filter(c => c.produto === produtoSelecionado)
      .sort((a, b) => b.cancelamentos - a.cancelamentos);
  }, [data, produtoSelecionado]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Não foi possível carregar os dados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Presets rápidos */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
          {PRESETS.map(opt => (
            <button
              key={opt.label}
              onClick={() => aplicarPreset(opt.months)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                monthStrBack(opt.months) === inicio && toMonthStr(today) === fim
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Inputs de intervalo personalizado */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">De</span>
          <input
            type="month"
            value={inicio}
            max={fim}
            onChange={e => { setInicio(e.target.value); setProdutoSelecionado(null); }}
            className="text-xs px-2 py-1 rounded-md border border-border/60 bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="month"
            value={fim}
            min={inicio}
            max={toMonthStr(today)}
            onChange={e => { setFim(e.target.value); setProdutoSelecionado(null); }}
            className="text-xs px-2 py-1 rounded-md border border-border/60 bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Total Cancelamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.totais.cancelamentos}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              MRR Perdido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.totais.mrr_perdido)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.totais.ticket_medio)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">
            Distribuição por Produto × Motivo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            % de cancelamentos do produto atribuídos ao motivo. Clique num produto para ver o detalhe.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 font-semibold text-gray-700 dark:text-zinc-300 min-w-[140px]">
                  Produto
                </th>
                {data.motivos.map(m => (
                  <th
                    key={m}
                    className="text-center p-2 font-medium text-gray-600 dark:text-zinc-400 min-w-[80px] max-w-[100px]"
                  >
                    <span className="block truncate" title={m}>{m}</span>
                  </th>
                ))}
                <th className="text-right p-2 font-semibold text-gray-700 dark:text-zinc-300 min-w-[80px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.produtos.map(produto => {
                const isSelected = produtoSelecionado === produto;
                const prodTotal = data.celulas
                  .filter(c => c.produto === produto)
                  .reduce((a, c) => a + c.cancelamentos, 0);
                const prodMrr = data.celulas
                  .filter(c => c.produto === produto)
                  .reduce((a, c) => a + c.mrr_perdido, 0);

                return (
                  <tr
                    key={produto}
                    onClick={() => setProdutoSelecionado(isSelected ? null : produto)}
                    className={`cursor-pointer border-t border-gray-100 dark:border-zinc-800 transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <td className="p-2 font-medium text-gray-900 dark:text-zinc-100">{produto}</td>
                    {data.motivos.map(motivo => {
                      const celula = celulaMap.get(`${produto}|||${motivo}`);
                      const pct = celula?.pct_dentro_produto ?? 0;
                      return (
                        <td key={motivo} className="p-1 text-center">
                          {pct > 0 ? (
                            <div
                              className={`rounded px-1 py-1.5 text-xs font-medium ${heatTextClass(pct, maxPct)}`}
                              style={{ backgroundColor: heatColor(pct, maxPct, isDark) }}
                              title={`${celula?.cancelamentos ?? 0} churns · ${formatCurrencyNoDecimals(celula?.mrr_perdido ?? 0)}`}
                            >
                              {pct.toFixed(0)}%
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right">
                      <div className="font-semibold text-gray-900 dark:text-zinc-100">{prodTotal}</div>
                      <div className="text-gray-500 dark:text-zinc-500 text-[10px]">
                        {formatCurrencyNoDecimals(prodMrr)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Drill-down por produto */}
      {produtoSelecionado && drillDown.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-white">
              Motivos de churn — {produtoSelecionado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, drillDown.length * 44)}>
              <BarChart
                data={drillDown}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="motivo_cancelamento"
                  width={170}
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#374151" }}
                />
                <Tooltip
                  formatter={(value: number) => [value, "Cancelamentos"]}
                  contentStyle={{
                    background: isDark ? "#18181b" : "#fff",
                    border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="cancelamentos" radius={[0, 4, 4, 0]}>
                  {drillDown.map((_, i) => (
                    <Cell key={i} fill={DRILL_COLORS[Math.min(i, DRILL_COLORS.length - 1)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {drillDown.map(c => (
                <div key={c.motivo_cancelamento} className="flex justify-between text-xs text-muted-foreground">
                  <span>{c.motivo_cancelamento}</span>
                  <span>
                    {c.cancelamentos} churns · {formatCurrencyNoDecimals(c.mrr_perdido)} · {c.pct_dentro_produto.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Squad × Motivo drill-down */}
      {produtoSelecionado && Array.isArray(squadMotivoData?.squads) && squadMotivoData!.squads.length > 0 && Array.isArray(squadMotivoData?.celulas) && (() => {
        const smData = squadMotivoData;
        const smMax = Math.max(...smData.celulas.map(c => c.pct_dentro_squad), 1);
        const smMap = new Map(smData.celulas.map(c => [`${c.squad}|||${c.motivo_cancelamento}`, c]));
        return (
          <Card className="bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800">
            <CardHeader>
              <CardTitle className="text-base text-gray-900 dark:text-white">
                Squad × Motivo — {produtoSelecionado}
              </CardTitle>
              <p className="text-xs text-muted-foreground">% de cancelamentos do squad atribuídos ao motivo</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-700 dark:text-zinc-300 min-w-[160px]">Squad</th>
                    {smData.motivos.map(m => (
                      <th key={m} className="text-center p-2 font-medium text-gray-600 dark:text-zinc-400 min-w-[80px] max-w-[110px]">
                        <span className="block truncate" title={m}>{m}</span>
                      </th>
                    ))}
                    <th className="text-right p-2 font-semibold text-gray-700 dark:text-zinc-300 min-w-[60px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {smData.squads.map(squad => {
                    const squadTotal = smData.celulas.filter(c => c.squad === squad).reduce((a, c) => a + c.cancelamentos, 0);
                    return (
                      <tr key={squad} className="border-t border-gray-100 dark:border-zinc-800">
                        <td className="p-2 font-medium text-gray-900 dark:text-zinc-100 truncate max-w-[160px]" title={squad}>{squad}</td>
                        {smData.motivos.map(motivo => {
                          const c = smMap.get(`${squad}|||${motivo}`);
                          const pct = c?.pct_dentro_squad ?? 0;
                          return (
                            <td key={motivo} className="p-1 text-center">
                              {pct > 0 ? (
                                <div
                                  className={`rounded px-1 py-1.5 text-xs font-medium ${heatTextClass(pct, smMax)}`}
                                  style={{ backgroundColor: heatColor(pct, smMax, isDark) }}
                                  title={`${c?.cancelamentos ?? 0} churns · ${formatCurrencyNoDecimals(c?.mrr_perdido ?? 0)}`}
                                >
                                  {pct.toFixed(0)}%
                                </div>
                              ) : (
                                <span className="text-gray-300 dark:text-zinc-700">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-right font-semibold text-gray-900 dark:text-zinc-100">{squadTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })()}

    </div>
  );
}
