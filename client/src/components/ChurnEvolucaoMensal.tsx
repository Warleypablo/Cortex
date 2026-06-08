import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { MousePointerClick } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

interface MensalRow {
  ano_mes: string;
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: number;
  mrr_perdido: number;
  ticket_medio: number;
}

interface MensalResponse {
  rows: MensalRow[];
}

interface TaxaMensalRow {
  mes: string;
  mrr_base: number;
  mrr_churn: number;
  cancelamentos: number;
  taxa: number;
}

const PRODUTO_COLORS = [
  "#6d28d9", "#2563eb", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#65a30d", "#ea580c", "#db2777",
  "#4f46e5", "#0284c7", "#16a34a", "#ca8a04", "#e11d48",
];

const TOP_N_PRODUTOS = 7;

type Metrica = "cancelamentos" | "mrr_perdido" | "taxa_churn";

export function ChurnEvolucaoMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [metrica, setMetrica] = useState<Metrica>("cancelamentos");
  const [metricaLinha, setMetricaLinha] = useState<Metrica>("cancelamentos");
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [highlightProduto, setHighlightProduto] = useState<string | null>(null);
  const [highlightMotivo, setHighlightMotivo] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<MensalResponse>({
    queryKey: ["/api/churn/produto-motivo/mensal"],
    queryFn: () => fetch("/api/churn/produto-motivo/mensal").then(r => r.json()),
  });

  const { data: taxaData } = useQuery<{ rows: TaxaMensalRow[] }>({
    queryKey: ["/api/churn/taxa-mensal"],
    queryFn: () => fetch("/api/churn/taxa-mensal").then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  const { data: taxaProdutoData, isFetching: isFetchingTaxa, isError: isErrorTaxa } = useQuery<{ rows: Array<{ mes: string; produto: string; mrr_base: string; mrr_churn: string; cancelamentos: string; taxa: string }> }>({
    queryKey: ["/api/churn/taxa-por-produto"],
    queryFn: () => fetch("/api/churn/taxa-por-produto").then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    enabled: metricaLinha === "taxa_churn" || metrica === "taxa_churn",
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const { chartData, produtos } = useMemo(() => {
    if (!data?.rows?.length) return { chartData: [], produtos: [] };

    const aggMap = new Map<string, Map<string, { cancelamentos: number; mrr_perdido: number }>>();

    data.rows.forEach(r => {
      if (!aggMap.has(r.ano_mes)) aggMap.set(r.ano_mes, new Map());
      const mesMap = aggMap.get(r.ano_mes)!;
      const cur = mesMap.get(r.produto) || { cancelamentos: 0, mrr_perdido: 0 };
      cur.cancelamentos += Number(r.cancelamentos);
      cur.mrr_perdido += Number(r.mrr_perdido);
      mesMap.set(r.produto, cur);
    });

    const mesesOrdenados = Array.from(aggMap.keys()).sort();

    const produtoTotais = new Map<string, number>();
    data.rows.forEach(r => {
      produtoTotais.set(r.produto, (produtoTotais.get(r.produto) || 0) + Number(r.cancelamentos));
    });
    const todosProdutos = Array.from(produtoTotais.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);

    const topProdutos = todosProdutos.slice(0, TOP_N_PRODUTOS);
    const temOutros = todosProdutos.length > TOP_N_PRODUTOS;
    const produtos = temOutros ? [...topProdutos, "Outros"] : topProdutos;

    const chartData = mesesOrdenados.map(mes => {
      const mesMap = aggMap.get(mes)!;
      const entry: Record<string, string | number> = {
        mes: mes.slice(0, 7),
        mesLabel: formatMes(mes),
      };
      topProdutos.forEach(p => {
        const v = mesMap.get(p);
        entry[p] = v ? v[metricaLinha === "cancelamentos" ? "cancelamentos" : "mrr_perdido"] : 0;
      });
      if (temOutros) {
        let outros = 0;
        mesMap.forEach((v, p) => {
          if (!topProdutos.includes(p)) {
            outros += metricaLinha === "cancelamentos" ? v.cancelamentos : v.mrr_perdido;
          }
        });
        entry["Outros"] = outros;
      }
      return entry;
    });

    return { chartData, produtos };
  }, [data, metricaLinha]);

  const { chartData: motivoChartData, produtos: motivos } = useMemo(() => {
    if (!data?.rows?.length) return { chartData: [], produtos: [] };

    const aggMap = new Map<string, Map<string, { cancelamentos: number; mrr_perdido: number }>>();
    data.rows.forEach(r => {
      const motivo = r.motivo_cancelamento || "Não Informado";
      if (!aggMap.has(r.ano_mes)) aggMap.set(r.ano_mes, new Map());
      const mesMap = aggMap.get(r.ano_mes)!;
      const cur = mesMap.get(motivo) || { cancelamentos: 0, mrr_perdido: 0 };
      cur.cancelamentos += Number(r.cancelamentos);
      cur.mrr_perdido += Number(r.mrr_perdido);
      mesMap.set(motivo, cur);
    });

    const mesesOrdenados = Array.from(aggMap.keys()).sort();

    const motivoTotais = new Map<string, number>();
    data.rows.forEach(r => {
      const motivo = r.motivo_cancelamento || "Não Informado";
      motivoTotais.set(motivo, (motivoTotais.get(motivo) || 0) + Number(r.cancelamentos));
    });
    const todosMotivos = Array.from(motivoTotais.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);

    const topMotivos = todosMotivos.slice(0, TOP_N_PRODUTOS);
    const temOutros = todosMotivos.length > TOP_N_PRODUTOS;
    const motivos = temOutros ? [...topMotivos, "Outros"] : topMotivos;

    const chartData = mesesOrdenados.map(mes => {
      const mesMap = aggMap.get(mes)!;
      const entry: Record<string, string | number> = {
        mes: mes.slice(0, 7),
        mesLabel: formatMes(mes),
      };
      topMotivos.forEach(m => {
        const v = mesMap.get(m);
        entry[m] = v ? v[metrica === "cancelamentos" ? "cancelamentos" : "mrr_perdido"] : 0;
      });
      if (temOutros) {
        let outros = 0;
        mesMap.forEach((v, m) => {
          if (!topMotivos.includes(m)) {
            outros += metrica === "cancelamentos" ? v.cancelamentos : v.mrr_perdido;
          }
        });
        entry["Outros"] = outros;
      }
      return entry;
    });

    return { chartData, produtos: motivos };
  }, [data, metrica]);

  const { taxaChartData, taxaProdutos } = useMemo(() => {
    if (!taxaProdutoData?.rows?.length) return { taxaChartData: [], taxaProdutos: [] };
    const rows = taxaProdutoData.rows;

    const prodTotais = new Map<string, number>();
    rows.forEach(r => {
      prodTotais.set(r.produto, (prodTotais.get(r.produto) || 0) + Number(r.mrr_churn));
    });
    const topProds = Array.from(prodTotais.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP_N_PRODUTOS).map(([p]) => p);
    const temOutros = prodTotais.size > TOP_N_PRODUTOS;
    const taxaProdutos = temOutros ? [...topProds, "Outros"] : topProds;

    const mesesUnicos = Array.from(new Set(rows.map(r => r.mes))).sort();
    const taxaChartData = mesesUnicos.map(mes => {
      const entry: Record<string, string | number> = { mes, mesLabel: formatMes(mes + "-01") };
      const meRows = rows.filter(r => r.mes === mes);
      topProds.forEach(p => {
        const row = meRows.find(r => r.produto === p);
        entry[p] = Number(row?.taxa ?? 0);
      });
      if (temOutros) {
        const outros = meRows.filter(r => !topProds.includes(r.produto));
        const totalBase = outros.reduce((s, r) => s + Number(r.mrr_base), 0);
        const totalChurn = outros.reduce((s, r) => s + Number(r.mrr_churn), 0);
        entry["Outros"] = totalBase > 0 ? Math.round((totalChurn / totalBase) * 10000) / 100 : 0;
      }
      return entry;
    });
    return { taxaChartData, taxaProdutos };
  }, [taxaProdutoData]);

  // % churn por motivo (usa mrr_perdido / mrr_base_total)
  const { motivoTaxaChartData, motivoTaxaKeys } = useMemo(() => {
    if (!data?.rows?.length || !taxaData?.rows?.length) return { motivoTaxaChartData: [], motivoTaxaKeys: [] };
    const baseByMes = new Map<string, number>();
    taxaData.rows.forEach(r => baseByMes.set(r.mes, Number(r.mrr_base)));
    const motivoTotais = new Map<string, number>();
    data.rows.forEach(r => {
      const m = r.motivo_cancelamento || "Não Informado";
      motivoTotais.set(m, (motivoTotais.get(m) || 0) + Number(r.cancelamentos));
    });
    const topMotivos = Array.from(motivoTotais.entries()).sort((a,b) => b[1]-a[1]).slice(0, TOP_N_PRODUTOS).map(([m]) => m);
    const temOutros = motivoTotais.size > TOP_N_PRODUTOS;
    const motivoTaxaKeys = temOutros ? [...topMotivos, "Outros"] : topMotivos;
    const aggMap = new Map<string, Map<string, number>>();
    data.rows.forEach(r => {
      const m = r.motivo_cancelamento || "Não Informado";
      if (!aggMap.has(r.ano_mes)) aggMap.set(r.ano_mes, new Map());
      const mm = aggMap.get(r.ano_mes)!;
      mm.set(m, (mm.get(m) || 0) + Number(r.mrr_perdido));
    });
    const mesesOrdenados = Array.from(aggMap.keys()).sort();
    const motivoTaxaChartData = mesesOrdenados.map(mes => {
      const mm = aggMap.get(mes)!;
      const mesKey = mes.slice(0, 7);
      const base = baseByMes.get(mesKey) || 0;
      const entry: Record<string, string | number> = { mes: mesKey, mesLabel: formatMes(mes) };
      topMotivos.forEach(m => {
        const mrr = mm.get(m) || 0;
        entry[m] = base > 0 ? Math.round(mrr / base * 10000) / 100 : 0;
      });
      if (temOutros) {
        let otrosMrr = 0;
        mm.forEach((v, m) => { if (!topMotivos.includes(m)) otrosMrr += v; });
        entry["Outros"] = base > 0 ? Math.round(otrosMrr / base * 10000) / 100 : 0;
      }
      return entry;
    });
    return { motivoTaxaChartData, motivoTaxaKeys };
  }, [data, taxaData]);

  // Lista de todos os produtos disponíveis (para o dropdown)
  const todosProdutos = useMemo(() => {
    if (!data?.rows?.length) return [];
    const totais = new Map<string, number>();
    data.rows.forEach(r => {
      totais.set(r.produto, (totais.get(r.produto) || 0) + Number(r.cancelamentos));
    });
    return Array.from(totais.entries()).sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [data]);

  const produtoEfetivo = produtoSelecionado || todosProdutos[0] || "";

  // % churn por motivo para produto específico (usa mrr_perdido / product_mrr_base)
  const produtoMotivoTaxaChartData = useMemo(() => {
    if (!data?.rows?.length || !taxaProdutoData?.rows?.length || !produtoEfetivo) return null;
    const prodRows = data.rows.filter(r => r.produto === produtoEfetivo);
    if (!prodRows.length) return null;
    const prodBaseByMes = new Map<string, number>();
    taxaProdutoData.rows.filter(r => r.produto === produtoEfetivo).forEach(r => {
      prodBaseByMes.set(r.mes, Number(r.mrr_base));
    });
    const motivoTotais = new Map<string, number>();
    prodRows.forEach(r => {
      const m = r.motivo_cancelamento || "Não Informado";
      motivoTotais.set(m, (motivoTotais.get(m) || 0) + Number(r.cancelamentos));
    });
    const topMotivos = Array.from(motivoTotais.entries()).sort((a,b) => b[1]-a[1]).slice(0, 7).map(([m]) => m);
    const temOutros = motivoTotais.size > 7;
    const mesAgg = new Map<string, Map<string, number>>();
    prodRows.forEach(r => {
      if (!mesAgg.has(r.ano_mes)) mesAgg.set(r.ano_mes, new Map());
      const entry = mesAgg.get(r.ano_mes)!;
      const m = topMotivos.includes(r.motivo_cancelamento) ? r.motivo_cancelamento : "Outros";
      entry.set(m, (entry.get(m) || 0) + Number(r.mrr_perdido));
    });
    const mesesOrdenados = Array.from(mesAgg.keys()).sort();
    return mesesOrdenados.map(mes => {
      const mm = mesAgg.get(mes)!;
      const mesKey = mes.slice(0, 7);
      const base = prodBaseByMes.get(mesKey) || 0;
      const entry: Record<string, number | string> = { mesLabel: formatMes(mes) };
      topMotivos.forEach(m => {
        const mrr = mm.get(m) || 0;
        entry[m] = base > 0 ? Math.round(mrr / base * 10000) / 100 : 0;
      });
      if (temOutros) {
        const otrosMrr = mm.get("Outros") || 0;
        entry["Outros"] = base > 0 ? Math.round(otrosMrr / base * 10000) / 100 : 0;
      }
      return entry;
    });
  }, [data, taxaProdutoData, produtoEfetivo]);

  const { produtoChartData, motivosBarras } = useMemo(() => {
    if (!data?.rows?.length || !produtoEfetivo) return { produtoChartData: [], motivosBarras: [] };

    const prodRows = data.rows.filter(r => r.produto === produtoEfetivo);

    const motivoTotais = new Map<string, number>();
    prodRows.forEach(r => {
      const m = r.motivo_cancelamento || "Não Informado";
      motivoTotais.set(m, (motivoTotais.get(m) || 0) + Number(r.cancelamentos));
    });
    const topMotivos = Array.from(motivoTotais.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([m]) => m);
    const temOutros = motivoTotais.size > 7;
    const motivosBarras = temOutros ? [...topMotivos, "Outros"] : topMotivos;

    const mesAgg = new Map<string, Record<string, number>>();
    prodRows.forEach(r => {
      const motivo = topMotivos.includes(r.motivo_cancelamento) ? r.motivo_cancelamento : "Outros";
      if (!mesAgg.has(r.ano_mes)) mesAgg.set(r.ano_mes, {});
      const entry = mesAgg.get(r.ano_mes)!;
      const val = metrica === "cancelamentos" ? Number(r.cancelamentos) : Number(r.mrr_perdido);
      entry[motivo] = (entry[motivo] || 0) + val;
    });

    const mesesOrdenados = Array.from(mesAgg.keys()).sort();
    const produtoChartData = mesesOrdenados.map(mes => ({
      mesLabel: formatMes(mes),
      ...mesAgg.get(mes),
    }));

    return { produtoChartData, motivosBarras };
  }, [data, produtoEfetivo, metrica]);

  function formatMes(isoDate: string): string {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                   "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const parts = isoDate.split("-");
    const m = parts[1];
    const ano = isoDate.slice(2, 4);
    return `${meses[parseInt(m, 10) - 1]}/${ano}`;
  }

  const yFormatter = (v: number) => {
    if (metrica === "mrr_perdido") return formatCurrencyNoDecimals(v);
    if (metrica === "taxa_churn") return `${v.toFixed(1)}%`;
    return String(v);
  };

  const tooltipFormatter = (value: number, name: string) => {
    if (metrica === "mrr_perdido") return [formatCurrencyNoDecimals(value), name];
    if (metrica === "taxa_churn") return [`${Number(value).toFixed(2)}%`, name];
    return [String(value), name];
  };

  const yFormatterLinha = (v: number) => {
    if (metricaLinha === "mrr_perdido") return formatCurrencyNoDecimals(v);
    if (metricaLinha === "taxa_churn") return `${v.toFixed(1)}%`;
    return String(v);
  };

  const tooltipFormatterLinha = (value: number, name: string) => {
    if (metricaLinha === "mrr_perdido") return [formatCurrencyNoDecimals(value), name];
    if (metricaLinha === "taxa_churn") return [`${Number(value).toFixed(2)}%`, name];
    return [String(value), name];
  };

  if (isLoading) {
    return (
      <div className="h-96 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
    );
  }

  if (isError || !data?.rows?.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sem dados disponíveis.
      </div>
    );
  }

  return (
    <div className="space-y-6">

    {/* Taxa de Churn Mensal */}
    {taxaData?.rows && taxaData.rows.length > 1 && (
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900 dark:text-white">Taxa de Churn Mensal</CardTitle>
          <p className="text-xs text-muted-foreground">MRR churn / MRR base · excluindo abonos, erros e inadimplência</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={taxaData.rows.map(r => ({ ...r, taxa: Number(r.taxa), mrr_churn: Number(r.mrr_churn), mrr_base: Number(r.mrr_base), cancelamentos: Number(r.cancelamentos), mesLabel: formatMes(r.mes + "-01") }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="taxaGradMensal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} vertical={false} />
              <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === "taxa") return [`${v.toFixed(2)}%`, "Taxa churn"];
                  if (name === "mrr_churn") return [yFormatter(v), "MRR perdido"];
                  return [v, name];
                }}
                contentStyle={{ background: isDark ? "#18181b" : "#fff", border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb", borderRadius: 6, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="taxa" stroke="#ef4444" strokeWidth={2} fill="url(#taxaGradMensal)" dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )}

    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            Histórico Mensal por Produto
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
              {(["cancelamentos", "mrr_perdido", "taxa_churn"] as Metrica[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMetrica(m)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    metrica === m
                      ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "cancelamentos" ? "Contratos" : m === "mrr_perdido" ? "MRR Perdido" : "% Churn"}
                </button>
              ))}
            </div>
            <select
              value={produtoEfetivo}
              onChange={e => setProdutoSelecionado(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md border border-border/60 bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {todosProdutos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Cancelamentos por motivo mês a mês</p>
      </CardHeader>
      <CardContent>
        {metrica === "taxa_churn" && !produtoMotivoTaxaChartData ? (
          <div className="h-80 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
            Calculando taxas...
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={metrica === "taxa_churn" ? (produtoMotivoTaxaChartData ?? produtoChartData) : produtoChartData}
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} vertical={false} />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={yFormatter}
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              width={metrica === "mrr_perdido" ? 80 : 45}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                background: isDark ? "#18181b" : "#fff",
                border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {motivosBarras.map((motivo, i) => (
              <Bar
                key={motivo}
                dataKey={motivo}
                stackId="a"
                fill={motivo === "Outros" ? "#9ca3af" : PRODUTO_COLORS[i % PRODUTO_COLORS.length]}
                radius={i === motivosBarras.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>

    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            Cancelamentos por Produto ao Longo do Tempo
          </CardTitle>
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
            {(["cancelamentos", "mrr_perdido", "taxa_churn"] as Metrica[]).map(m => (
              <button
                key={m}
                onClick={() => setMetricaLinha(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  metricaLinha === m
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "cancelamentos" ? "Contratos" : m === "mrr_perdido" ? "MRR Perdido" : "% Churn"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Histórico completo</span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40">
            <MousePointerClick className="h-3 w-3" />
            Clique na legenda para destacar
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {metricaLinha === "taxa_churn" && isFetchingTaxa && !taxaProdutoData ? (
          <div className="h-96 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
            Calculando taxas...
          </div>
        ) : metricaLinha === "taxa_churn" && isErrorTaxa ? (
          <div className="h-96 flex items-center justify-center text-sm text-muted-foreground">
            Erro ao carregar taxas de churn por produto.
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={metricaLinha === "taxa_churn" ? taxaChartData : chartData}
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#3f3f46" : "#e5e7eb"}
            />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={yFormatterLinha}
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              width={metricaLinha === "mrr_perdido" ? 80 : 45}
            />
            <Tooltip
              formatter={tooltipFormatterLinha}
              contentStyle={{
                background: isDark ? "#18181b" : "#fff",
                border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12, cursor: "pointer" }}
              onClick={(d: { value: string }) =>
                setHighlightProduto(prev => prev === d.value ? null : d.value)
              }
            />
            {(metricaLinha === "taxa_churn" ? taxaProdutos : produtos).map((produto, i) => (
              <Line
                key={produto}
                type="monotone"
                dataKey={produto}
                stroke={produto === "Outros" ? "#9ca3af" : PRODUTO_COLORS[i % PRODUTO_COLORS.length]}
                strokeWidth={highlightProduto === produto ? 3 : (produto === "Outros" ? 1.5 : 2)}
                strokeOpacity={highlightProduto === null || highlightProduto === produto ? 1 : 0.1}
                strokeDasharray={produto === "Outros" ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>

    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            Evolução por Motivo de Cancelamento
          </CardTitle>
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
            {(["cancelamentos", "mrr_perdido", "taxa_churn"] as Metrica[]).map(m => (
              <button
                key={m}
                onClick={() => setMetrica(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  metrica === m
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "cancelamentos" ? "Contratos" : m === "mrr_perdido" ? "MRR Perdido" : "% Churn"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Top 7 motivos + Outros</span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40">
            <MousePointerClick className="h-3 w-3" />
            Clique na legenda para destacar
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={metrica === "taxa_churn" ? motivoTaxaChartData : motivoChartData}
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={yFormatter}
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              width={metrica === "mrr_perdido" ? 80 : 45}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                background: isDark ? "#18181b" : "#fff",
                border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12, cursor: "pointer" }}
              onClick={(d: { value: string }) =>
                setHighlightMotivo(prev => prev === d.value ? null : d.value)
              }
            />
            {(metrica === "taxa_churn" ? motivoTaxaKeys : motivos).map((motivo, i) => (
              <Line
                key={motivo}
                type="monotone"
                dataKey={motivo}
                stroke={motivo === "Outros" ? "#9ca3af" : PRODUTO_COLORS[i % PRODUTO_COLORS.length]}
                strokeWidth={highlightMotivo === motivo ? 3 : (motivo === "Outros" ? 1.5 : 2)}
                strokeOpacity={highlightMotivo === null || highlightMotivo === motivo ? 1 : 0.1}
                strokeDasharray={motivo === "Outros" ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
    </div>
  );
}
