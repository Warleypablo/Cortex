import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, Calendar, Coins, Activity } from "lucide-react";

type Modo = "vendido" | "realizado";
type Visao = "mrr" | "pontual" | "total";

interface ProdutoTemporal {
  produto: string;
  meses: Record<string, { mrr: number; pontual: number; contratos: number }>;
  total_mrr: number;
  total_pontual: number;
  total_contratos: number;
}

interface TemporalResponse {
  ano: number;
  modo: Modo;
  meses_com_dados: number[];
  produtos: ProdutoTemporal[];
  totais_mensais: Record<string, { mrr: number; pontual: number; contratos: number }>;
  anos_disponiveis: number[];
  squads_disponiveis: string[];
}

const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PALETA = [
  "#10b981", "#3b82f6", "#f97316", "#a855f7", "#ec4899",
  "#14b8a6", "#eab308", "#ef4444", "#6366f1", "#84cc16",
];

interface Props {
  squad: string;
}

export function EvolucaoTemporal({ squad }: Props) {
  const anoAtual = new Date().getFullYear();
  const [modo, setModo] = useState<Modo>("vendido");
  const [ano, setAno] = useState<number>(anoAtual);
  const [visao, setVisao] = useState<Visao>("total");
  const [topN, setTopN] = useState<number>(6);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("ano", String(ano));
    params.set("modo", modo);
    if (squad !== "todos") params.set("squad", squad);
    return params.toString();
  }, [ano, modo, squad]);

  const { data, isLoading, error } = useQuery<TemporalResponse>({
    queryKey: [`/api/financeiro/mix-receita/temporal?${queryParams}`],
    staleTime: 60 * 1000,
  });

  // Top produtos por receita total no período
  const topProdutos = useMemo(() => {
    if (!data) return [];
    return data.produtos.slice(0, topN);
  }, [data, topN]);

  // Dados para gráfico stacked: cada mês com séries por produto
  const chartData = useMemo(() => {
    if (!data) return [];
    const meses = data.meses_com_dados.length > 0
      ? data.meses_com_dados
      : Array.from({ length: 12 }, (_, i) => i + 1);

    return meses.map((mes) => {
      const row: Record<string, number | string> = { mes: MESES_LABEL[mes - 1] };
      for (const prod of topProdutos) {
        const m = prod.meses[mes];
        if (!m) {
          row[prod.produto] = 0;
          continue;
        }
        if (visao === "mrr") row[prod.produto] = Math.round(m.mrr);
        else if (visao === "pontual") row[prod.produto] = Math.round(m.pontual);
        else row[prod.produto] = Math.round(m.mrr + m.pontual);
      }
      return row;
    });
  }, [data, topProdutos, visao]);

  // Totais mensais (linha de tendência)
  const totaisMensaisChart = useMemo(() => {
    if (!data) return [];
    const meses = data.meses_com_dados.length > 0
      ? data.meses_com_dados
      : Array.from({ length: 12 }, (_, i) => i + 1);
    return meses.map((mes) => {
      const t = data.totais_mensais[mes] || { mrr: 0, pontual: 0, contratos: 0 };
      return {
        mes: MESES_LABEL[mes - 1],
        Recorrente: Math.round(t.mrr),
        Pontual: Math.round(t.pontual),
        Total: Math.round(t.mrr + t.pontual),
      };
    });
  }, [data]);

  // Totais agregados do período
  const totaisPeriodo = useMemo(() => {
    if (!data) return { mrr: 0, pontual: 0, contratos: 0 };
    let mrr = 0, pontual = 0, contratos = 0;
    for (const m of Object.values(data.totais_mensais)) {
      mrr += m.mrr; pontual += m.pontual; contratos += m.contratos;
    }
    return { mrr, pontual, contratos, total: mrr + pontual, pct_mrr: mrr + pontual > 0 ? (mrr / (mrr + pontual)) * 100 : 0 };
  }, [data]);

  const valorCell = (m: { mrr: number; pontual: number; contratos: number } | undefined) => {
    if (!m) return 0;
    if (visao === "mrr") return m.mrr;
    if (visao === "pontual") return m.pontual;
    return m.mrr + m.pontual;
  };

  const corDaVisao = visao === "mrr" ? "text-emerald-700 dark:text-emerald-400"
    : visao === "pontual" ? "text-orange-700 dark:text-orange-400"
    : "text-gray-900 dark:text-white";

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-md border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <button
            onClick={() => setModo("vendido")}
            className={`px-4 py-2 text-sm font-medium transition ${
              modo === "vendido"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
            }`}
          >
            Vendido (data_inicio)
          </button>
          <button
            onClick={() => setModo("realizado")}
            className={`px-4 py-2 text-sm font-medium transition ${
              modo === "realizado"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
            }`}
          >
            Realizado (caixa)
          </button>
        </div>

        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(data?.anos_disponiveis ?? [anoAtual]).map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-gray-200 dark:border-zinc-800 overflow-hidden">
          {[
            { v: "total" as Visao, label: "Total" },
            { v: "mrr" as Visao, label: "MRR" },
            { v: "pontual" as Visao, label: "Pontual" },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              className={`px-3 py-2 text-xs font-medium transition ${
                visao === v
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Top 3 produtos</SelectItem>
            <SelectItem value="6">Top 6 produtos</SelectItem>
            <SelectItem value="10">Top 10 produtos</SelectItem>
            <SelectItem value="15">Top 15 produtos</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-gray-500 dark:text-zinc-400">
          {modo === "vendido"
            ? "Receita vendida = soma valorr+valorp dos contratos com data_inicio no mês"
            : "Receita realizada = pagamentos quitados, rateados por produto via carteira do cliente"}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-sm">
          Erro ao carregar dados: {(error as Error).message}
        </div>
      )}

      {/* KPIs do período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiMini
              icon={<Coins className="w-4 h-4" />}
              iconBg="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
              label={modo === "vendido" ? "MRR Novo vendido" : "MRR Realizado"}
              value={formatCurrencyNoDecimals(totaisPeriodo.mrr)}
              hint={`${totaisPeriodo.pct_mrr.toFixed(1)}% do total`}
            />
            <KpiMini
              icon={<Activity className="w-4 h-4" />}
              iconBg="bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
              label={modo === "vendido" ? "Pontual vendido" : "Pontual Realizado"}
              value={formatCurrencyNoDecimals(totaisPeriodo.pontual)}
              hint={`${(100 - totaisPeriodo.pct_mrr).toFixed(1)}% do total`}
            />
            <KpiMini
              icon={<TrendingUp className="w-4 h-4" />}
              iconBg="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
              label={`Total ${ano}`}
              value={formatCurrencyNoDecimals(totaisPeriodo.total ?? 0)}
              hint={`${totaisPeriodo.contratos} contratos no período`}
            />
            <KpiMini
              icon={<Calendar className="w-4 h-4" />}
              iconBg="bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
              label="Meses com dados"
              value={String(data?.meses_com_dados.length ?? 0)}
              hint={`${data?.produtos.length ?? 0} produtos no período`}
            />
          </>
        )}
      </div>

      {/* Gráfico totais mensais — Recorrente vs Pontual */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">
            Evolução mensal — Recorrente vs Pontual
          </h3>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totaisMensaisChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-mrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="grad-pontual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-800" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="fill-gray-600 dark:fill-zinc-400" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatCurrencyNoDecimals(v)}
                    width={80}
                    className="fill-gray-600 dark:fill-zinc-400"
                  />
                  <Tooltip
                    formatter={(v: number) => formatCurrencyNoDecimals(v)}
                    contentStyle={{
                      backgroundColor: "rgb(24 24 27)",
                      border: "1px solid rgb(63 63 70)",
                      borderRadius: 6,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Recorrente" stackId="1" stroke="#10b981" fill="url(#grad-mrr)" />
                  <Area type="monotone" dataKey="Pontual" stackId="1" stroke="#f97316" fill="url(#grad-pontual)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico stacked por produto */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">
            Top {topN} produtos — {visao === "mrr" ? "MRR vendido" : visao === "pontual" ? "Pontual" : "Receita total"} por mês
          </h3>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-800" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="fill-gray-600 dark:fill-zinc-400" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatCurrencyNoDecimals(v)}
                    width={80}
                    className="fill-gray-600 dark:fill-zinc-400"
                  />
                  <Tooltip
                    formatter={(v: number) => formatCurrencyNoDecimals(v)}
                    contentStyle={{
                      backgroundColor: "rgb(24 24 27)",
                      border: "1px solid rgb(63 63 70)",
                      borderRadius: 6,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {topProdutos.map((p, idx) => (
                    <Bar
                      key={p.produto}
                      dataKey={p.produto}
                      stackId="a"
                      fill={PALETA[idx % PALETA.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela mês × produto */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              Detalhamento mês × produto — {visao === "mrr" ? "MRR" : visao === "pontual" ? "Pontual" : "Total"}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3 text-left text-xs uppercase tracking-wide font-semibold text-gray-600 dark:text-zinc-400 sticky left-0 bg-gray-50 dark:bg-zinc-900/50 min-w-[180px]">
                    Produto
                  </th>
                  {MESES_LABEL.map((m, idx) => (
                    <th key={m} className={`p-3 text-right text-xs uppercase tracking-wide font-semibold whitespace-nowrap ${
                      data?.meses_com_dados.includes(idx + 1)
                        ? "text-gray-600 dark:text-zinc-400"
                        : "text-gray-300 dark:text-zinc-700"
                    }`}>
                      {m}
                    </th>
                  ))}
                  <th className="p-3 text-right text-xs uppercase tracking-wide font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-zinc-900">
                      <td colSpan={14} className="p-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                ) : data && data.produtos.length > 0 ? (
                  data.produtos.map((prod) => {
                    const total =
                      visao === "mrr" ? prod.total_mrr
                      : visao === "pontual" ? prod.total_pontual
                      : prod.total_mrr + prod.total_pontual;
                    return (
                      <tr key={prod.produto} className="border-b border-gray-100 dark:border-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-900/30">
                        <td className="p-3 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-zinc-950">
                          {prod.produto}
                        </td>
                        {MESES_LABEL.map((_, idx) => {
                          const mes = idx + 1;
                          const v = valorCell(prod.meses[mes]);
                          return (
                            <td key={mes} className={`p-3 text-right tabular-nums ${v > 0 ? corDaVisao : "text-gray-300 dark:text-zinc-700"}`}>
                              {v > 0 ? formatCurrencyNoDecimals(v) : "—"}
                            </td>
                          );
                        })}
                        <td className={`p-3 text-right tabular-nums font-semibold ${corDaVisao}`}>
                          {formatCurrencyNoDecimals(total)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={14} className="p-8 text-center text-gray-500 dark:text-zinc-400">Sem dados para o período</td></tr>
                )}
              </tbody>
              {data && data.produtos.length > 0 && (
                <tfoot className="bg-gray-50 dark:bg-zinc-900/50 border-t-2 border-gray-200 dark:border-zinc-800 font-semibold">
                  <tr>
                    <td className="p-3 sticky left-0 bg-gray-50 dark:bg-zinc-900/50 text-gray-900 dark:text-white">Total</td>
                    {MESES_LABEL.map((_, idx) => {
                      const mes = idx + 1;
                      const t = data.totais_mensais[mes];
                      const v = t ? (visao === "mrr" ? t.mrr : visao === "pontual" ? t.pontual : t.mrr + t.pontual) : 0;
                      return (
                        <td key={mes} className={`p-3 text-right tabular-nums ${v > 0 ? "text-gray-900 dark:text-white" : "text-gray-300 dark:text-zinc-700"}`}>
                          {v > 0 ? formatCurrencyNoDecimals(v) : "—"}
                        </td>
                      );
                    })}
                    <td className={`p-3 text-right tabular-nums text-gray-900 dark:text-white`}>
                      {formatCurrencyNoDecimals(
                        visao === "mrr" ? totaisPeriodo.mrr
                        : visao === "pontual" ? totaisPeriodo.pontual
                        : totaisPeriodo.total ?? 0
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiMini({
  icon, iconBg, label, value, hint,
}: { icon: React.ReactNode; iconBg: string; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400 font-medium">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
            {hint && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
