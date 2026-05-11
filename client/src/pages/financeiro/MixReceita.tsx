import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Repeat, Zap, TrendingUp, Package, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { EvolucaoTemporal } from "./mix-receita/EvolucaoTemporal";

interface MixReceitaItem {
  produto: string;
  contratos: number;
  qtd_recorrente: number;
  qtd_pontual: number;
  mrr_recorrente: number;
  total_pontual: number;
  receita_total: number;
  pct_recorrente: number;
}

interface PorSquadItem {
  squad: string;
  produto: string;
  contratos: number;
  mrr_recorrente: number;
  total_pontual: number;
}

interface MixReceitaResponse {
  itens: MixReceitaItem[];
  por_squad: PorSquadItem[];
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
    pct_recorrente: number;
    produtos_distintos: number;
  };
  status_disponiveis: string[];
  squads_disponiveis: string[];
  status_filtro: string[];
}

type SortKey = "produto" | "contratos" | "mrr_recorrente" | "total_pontual" | "receita_total" | "pct_recorrente";
type SortDir = "asc" | "desc";

const STATUS_PRESETS: Record<string, string[]> = {
  ativos: ["ativo", "em cancelamento", "pausado", "entregue", "onboarding"],
  somente_ativos: ["ativo"],
  todos: [],
};

function pctClass(pct: number) {
  if (pct >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function perfilLabel(pct: number) {
  if (pct >= 85) return { label: "Assinatura", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" };
  if (pct >= 50) return { label: "Misto", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" };
  if (pct > 0) return { label: "Projeto+", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" };
  return { label: "Projeto", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" };
}

export default function MixReceita() {
  usePageTitle("Mix Receita por Produto");
  useSetPageInfo(
    "Mix Receita por Produto",
    "Pontual vs Recorrente por produto (cup_contratos)"
  );

  const [statusPreset, setStatusPreset] = useState<keyof typeof STATUS_PRESETS>("ativos");
  const [squad, setSquad] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("receita_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    const statuses = STATUS_PRESETS[statusPreset];
    if (statuses.length > 0) params.set("status", statuses.join(","));
    if (squad !== "todos") params.set("squad", squad);
    return params.toString();
  }, [statusPreset, squad]);

  const { data, isLoading, error } = useQuery<MixReceitaResponse>({
    queryKey: [`/api/financeiro/mix-receita?${queryParams}`],
    staleTime: 60 * 1000,
  });

  const itensOrdenados = useMemo(() => {
    if (!data) return [];
    const arr = [...data.itens];
    arr.sort((a, b) => {
      let av: number | string = a[sortKey];
      let bv: number | string = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const chartData = useMemo(() => {
    return itensOrdenados.slice(0, 15).map((it) => ({
      produto: it.produto.length > 18 ? it.produto.slice(0, 18) + "…" : it.produto,
      produto_full: it.produto,
      Recorrente: Math.round(it.mrr_recorrente),
      Pontual: Math.round(it.total_pontual),
    }));
  }, [itensOrdenados]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="w-3 h-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Mix de Receita por Produto
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
            Pontual vs Recorrente por produto, com base na carteira atual de contratos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusPreset} onValueChange={(v) => setStatusPreset(v as keyof typeof STATUS_PRESETS)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Carteira viva (ativo + onboarding + pausado + entregue + em cancelamento)</SelectItem>
              <SelectItem value="somente_ativos">Somente ativos</SelectItem>
              <SelectItem value="todos">Todos os status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={squad} onValueChange={setSquad}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os squads</SelectItem>
              {data?.squads_disponiveis.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : data ? (
          <>
            <KpiCard
              icon={<Repeat className="w-5 h-5" />}
              iconBg="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
              label="MRR Recorrente"
              value={formatCurrencyNoDecimals(data.totais.mrr_recorrente)}
              hint={`${data.totais.pct_recorrente.toFixed(1)}% da receita`}
            />
            <KpiCard
              icon={<Zap className="w-5 h-5" />}
              iconBg="bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
              label="Total Pontual"
              value={formatCurrencyNoDecimals(data.totais.total_pontual)}
              hint={`${(100 - data.totais.pct_recorrente).toFixed(1)}% da receita`}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5" />}
              iconBg="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
              label="Receita Total (carteira)"
              value={formatCurrencyNoDecimals(data.totais.receita_total)}
              hint={`${data.totais.contratos} contratos`}
            />
            <KpiCard
              icon={<Package className="w-5 h-5" />}
              iconBg="bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
              label="Produtos Distintos"
              value={String(data.totais.produtos_distintos)}
              hint="categorias com receita"
            />
          </>
        ) : null}
      </div>

      {/* Tabs: Produto / Por Squad */}
      <Tabs defaultValue="produto" className="w-full">
        <TabsList>
          <TabsTrigger value="produto">Por Produto</TabsTrigger>
          <TabsTrigger value="squad">Por Squad x Produto</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução temporal</TabsTrigger>
        </TabsList>

        <TabsContent value="produto" className="space-y-6 mt-4">
          {/* Gráfico stacked */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-4">
                Top 15 produtos — Recorrente vs Pontual
              </h3>
              {isLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 56 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-800" />
                      <XAxis
                        dataKey="produto"
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 11 }}
                        className="fill-gray-600 dark:fill-zinc-400"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatCurrencyNoDecimals(v)}
                        width={90}
                        className="fill-gray-600 dark:fill-zinc-400"
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrencyNoDecimals(v)}
                        labelFormatter={(label: string, payload: any) =>
                          payload?.[0]?.payload?.produto_full || label
                        }
                        contentStyle={{
                          backgroundColor: "rgb(24 24 27)",
                          border: "1px solid rgb(63 63 70)",
                          borderRadius: 6,
                          color: "white",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Recorrente" stackId="a" fill="#10b981" />
                      <Bar dataKey="Pontual" stackId="a" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800">
                    <tr>
                      <Th onClick={() => toggleSort("produto")}>
                        <div className="flex items-center gap-1">Produto <SortIcon k="produto" /></div>
                      </Th>
                      <Th onClick={() => toggleSort("contratos")} align="right">
                        <div className="flex items-center justify-end gap-1">Contratos <SortIcon k="contratos" /></div>
                      </Th>
                      <Th onClick={() => toggleSort("mrr_recorrente")} align="right">
                        <div className="flex items-center justify-end gap-1">MRR Recorrente <SortIcon k="mrr_recorrente" /></div>
                      </Th>
                      <Th onClick={() => toggleSort("total_pontual")} align="right">
                        <div className="flex items-center justify-end gap-1">Total Pontual <SortIcon k="total_pontual" /></div>
                      </Th>
                      <Th align="center">Mix</Th>
                      <Th onClick={() => toggleSort("pct_recorrente")} align="right">
                        <div className="flex items-center justify-end gap-1">% Recorrente <SortIcon k="pct_recorrente" /></div>
                      </Th>
                      <Th align="center">Perfil</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      [...Array(8)].map((_, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-zinc-900">
                          <td colSpan={7} className="p-3"><Skeleton className="h-5 w-full" /></td>
                        </tr>
                      ))
                    ) : itensOrdenados.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-500 dark:text-zinc-400">Sem dados para os filtros selecionados</td></tr>
                    ) : (
                      itensOrdenados.map((item) => {
                        const perfil = perfilLabel(item.pct_recorrente);
                        return (
                          <tr
                            key={item.produto}
                            className="border-b border-gray-100 dark:border-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-900/30"
                          >
                            <td className="p-3 font-medium text-gray-900 dark:text-white">{item.produto}</td>
                            <td className="p-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{item.contratos}</td>
                            <td className="p-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                              {formatCurrencyNoDecimals(item.mrr_recorrente)}
                            </td>
                            <td className="p-3 text-right tabular-nums text-orange-700 dark:text-orange-400 font-medium">
                              {formatCurrencyNoDecimals(item.total_pontual)}
                            </td>
                            <td className="p-3 min-w-[140px]">
                              <MixBar pctRecorrente={item.pct_recorrente} />
                            </td>
                            <td className={`p-3 text-right tabular-nums font-semibold ${pctClass(item.pct_recorrente)}`}>
                              {item.pct_recorrente.toFixed(1)}%
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${perfil.color}`}>
                                {perfil.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {data && itensOrdenados.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-zinc-900/50 border-t-2 border-gray-200 dark:border-zinc-800 font-semibold">
                      <tr>
                        <td className="p-3 text-gray-900 dark:text-white">Total</td>
                        <td className="p-3 text-right tabular-nums text-gray-900 dark:text-white">{data.totais.contratos}</td>
                        <td className="p-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                          {formatCurrencyNoDecimals(data.totais.mrr_recorrente)}
                        </td>
                        <td className="p-3 text-right tabular-nums text-orange-700 dark:text-orange-400">
                          {formatCurrencyNoDecimals(data.totais.total_pontual)}
                        </td>
                        <td className="p-3"><MixBar pctRecorrente={data.totais.pct_recorrente} /></td>
                        <td className={`p-3 text-right tabular-nums ${pctClass(data.totais.pct_recorrente)}`}>
                          {data.totais.pct_recorrente.toFixed(1)}%
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="squad" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <SquadProdutoMatrix data={data} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao" className="mt-4">
          <EvolucaoTemporal squad={squad} />
        </TabsContent>
      </Tabs>

      {error && (
        <div className="p-4 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-sm">
          Erro ao carregar dados: {(error as Error).message}
        </div>
      )}
    </div>
  );
}

// ---------- Sub-componentes ----------

function KpiCard({
  icon, iconBg, label, value, hint,
}: { icon: React.ReactNode; iconBg: string; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
            {hint && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MixBar({ pctRecorrente }: { pctRecorrente: number }) {
  const pct = Math.max(0, Math.min(100, pctRecorrente));
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-800">
      <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
      <div className="bg-orange-500" style={{ width: `${100 - pct}%` }} />
    </div>
  );
}

function Th({
  children, onClick, align,
}: { children: React.ReactNode; onClick?: () => void; align?: "left" | "right" | "center" }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const cursor = onClick ? "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-zinc-800" : "";
  return (
    <th
      onClick={onClick}
      className={`p-3 text-xs uppercase tracking-wide font-semibold text-gray-600 dark:text-zinc-400 ${alignClass} ${cursor}`}
    >
      {children}
    </th>
  );
}

function SquadProdutoMatrix({
  data, isLoading,
}: { data?: MixReceitaResponse; isLoading: boolean }) {
  const matrix = useMemo(() => {
    if (!data) return { rows: [], squads: [], totaisProduto: {}, totaisSquad: {} };

    const squadsSet = new Set<string>();
    const produtosSet = new Set<string>();
    const cells: Record<string, Record<string, { mrr: number; pontual: number }>> = {};

    for (const r of data.por_squad) {
      squadsSet.add(r.squad);
      produtosSet.add(r.produto);
      if (!cells[r.produto]) cells[r.produto] = {};
      cells[r.produto][r.squad] = {
        mrr: r.mrr_recorrente,
        pontual: r.total_pontual,
      };
    }

    const totaisProduto: Record<string, number> = {};
    const totaisSquad: Record<string, number> = {};

    for (const produto of produtosSet) {
      totaisProduto[produto] = 0;
      for (const squad of squadsSet) {
        const c = cells[produto]?.[squad];
        if (c) totaisProduto[produto] += c.mrr + c.pontual;
      }
    }
    for (const squad of squadsSet) {
      totaisSquad[squad] = 0;
      for (const produto of produtosSet) {
        const c = cells[produto]?.[squad];
        if (c) totaisSquad[squad] += c.mrr + c.pontual;
      }
    }

    const squadsOrdenados = Array.from(squadsSet).sort((a, b) => (totaisSquad[b] || 0) - (totaisSquad[a] || 0));
    const produtosOrdenados = Array.from(produtosSet).sort((a, b) => (totaisProduto[b] || 0) - (totaisProduto[a] || 0));

    return {
      rows: produtosOrdenados.map((produto) => ({
        produto,
        cells: squadsOrdenados.map((squad) => cells[produto]?.[squad] || null),
        total: totaisProduto[produto] || 0,
      })),
      squads: squadsOrdenados,
      totaisProduto,
      totaisSquad,
    };
  }, [data]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  if (!data || matrix.rows.length === 0) {
    return <div className="p-8 text-center text-gray-500 dark:text-zinc-400">Sem dados</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 sticky top-0">
          <tr>
            <th className="p-3 text-left text-xs uppercase tracking-wide font-semibold text-gray-600 dark:text-zinc-400 sticky left-0 bg-gray-50 dark:bg-zinc-900/50">
              Produto \ Squad
            </th>
            {matrix.squads.map((squad) => (
              <th key={squad} className="p-3 text-right text-xs uppercase tracking-wide font-semibold text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                {squad}
              </th>
            ))}
            <th className="p-3 text-right text-xs uppercase tracking-wide font-semibold text-gray-900 dark:text-white whitespace-nowrap">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.produto} className="border-b border-gray-100 dark:border-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-900/30">
              <td className="p-3 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-zinc-950 group-hover:bg-gray-50">
                {row.produto}
              </td>
              {row.cells.map((cell, idx) => (
                <td key={idx} className="p-3 text-right tabular-nums">
                  {cell ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-emerald-700 dark:text-emerald-400 text-xs">
                        {formatCurrencyNoDecimals(cell.mrr)}
                      </span>
                      <span className="text-orange-700 dark:text-orange-400 text-xs">
                        {formatCurrencyNoDecimals(cell.pontual)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-300 dark:text-zinc-700">—</span>
                  )}
                </td>
              ))}
              <td className="p-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                {formatCurrencyNoDecimals(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-zinc-900/50 border-t-2 border-gray-200 dark:border-zinc-800 font-semibold">
          <tr>
            <td className="p-3 sticky left-0 bg-gray-50 dark:bg-zinc-900/50 text-gray-900 dark:text-white">Total</td>
            {matrix.squads.map((squad) => (
              <td key={squad} className="p-3 text-right tabular-nums text-gray-900 dark:text-white">
                {formatCurrencyNoDecimals(matrix.totaisSquad[squad] || 0)}
              </td>
            ))}
            <td className="p-3 text-right tabular-nums text-gray-900 dark:text-white">
              {data && formatCurrencyNoDecimals(data.totais.receita_total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <div className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-200 dark:border-zinc-800">
        <span className="text-emerald-700 dark:text-emerald-400">verde</span> = MRR recorrente · <span className="text-orange-700 dark:text-orange-400">laranja</span> = total pontual
      </div>
    </div>
  );
}
