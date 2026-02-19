import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTheme } from "@/components/ThemeProvider";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { formatCurrencyNoDecimals, formatPercent, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Users,
  TrendingDown,
  TrendingUp,
  FileText,
  Receipt,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";

const SQUAD_COLORS: Record<string, string> = {
  "Aurea": "#fbbf24",
  "Aurea (OFF)": "#fcd34d",
  "Black": "#475569",
  "Bloomfield": "#10b981",
  "Chama": "#f43f5e",
  "Chama (OFF)": "#fb7185",
  "Hunters": "#a855f7",
  "Hunters (OFF)": "#c084fc",
  "Makers": "#06b6d4",
  "Pulse": "#ec4899",
  "Selva": "#22c55e",
  "Squadra": "#3b82f6",
  "Squad X": "#6366f1",
  "Supreme": "#8b5cf6",
  "Supreme (OFF)": "#a78bfa",
  "Tech": "#0ea5e9",
  "Turbo Interno": "#94a3b8",
};

const FALLBACK_COLORS = [
  "#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899",
  "#3b82f6", "#10b981", "#f43f5e", "#6366f1", "#14b8a6",
];

function getSquadColor(squad: string, index: number): string {
  if (SQUAD_COLORS[squad]) return SQUAD_COLORS[squad];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface SquadData {
  squad: string;
  mrr: number;
  contratos: number;
  clientes: number;
  churns: number;
  mrrChurn: number;
  churnRate: number;
  ticketMedio: number;
}

interface AnaliseSquadsResponse {
  mesAno: string;
  squads: SquadData[];
  totais: {
    totalMrr: number;
    totalContratos: number;
    totalClientes: number;
    totalChurns: number;
    churnRateGeral: number;
    ticketMedioGeral: number;
  };
  evolucao: {
    mrr: { mes: string; squad: string; mrr_total: number; total_contratos: number }[];
    churns: { mes: string; squad: string; churns: number; mrr_churn: number }[];
  };
  squadsLista: string[];
}

function formatMesLabel(mesAno: string) {
  const [ano, mes] = mesAno.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[parseInt(mes) - 1]}/${ano.slice(2)}`;
}

function ChurnRateIndicator({ rate }: { rate: number }) {
  const color = rate <= 2 ? "text-emerald-600 dark:text-emerald-400" :
    rate <= 5 ? "text-amber-600 dark:text-amber-400" :
    "text-rose-600 dark:text-rose-400";
  return <span className={cn("font-semibold", color)}>{formatPercent(rate)}</span>;
}

function getChurnBarColor(rate: number) {
  if (rate <= 2) return "#10b981";
  if (rate <= 5) return "#f59e0b";
  return "#f43f5e";
}

export default function AnaliseSquads() {
  usePageTitle("Análise de Squads");
  useSetPageInfo("Análise de Squads", "Performance consolidada por squad");

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const chartColors = {
    grid: isDark ? "#27272a" : "#e5e7eb",
    axisLine: isDark ? "#3f3f46" : "#d1d5db",
    axisTick: isDark ? "#71717a" : "#6b7280",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e5e7eb",
    tooltipText: isDark ? "#f4f4f5" : "#18181b",
  };

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  const mesAno = useMemo(() => {
    return `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, "0")}`;
  }, [selectedMonth]);

  const { data, isLoading } = useQuery<AnaliseSquadsResponse>({
    queryKey: ["/api/analise-squads", mesAno],
    queryFn: async () => {
      const response = await fetch(`/api/analise-squads?mesAno=${mesAno}`);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      return response.json();
    },
  });

  // Dados do bar chart MRR por squad (excluindo "Sem Squad")
  const mrrBarData = useMemo(() => {
    if (!data?.squads) return [];
    return data.squads
      .filter((s) => s.squad !== "Sem Squad")
      .sort((a, b) => b.mrr - a.mrr);
  }, [data]);

  // Dados do gráfico de evolução (area chart)
  const { evolucaoChartData, evolucaoSquads } = useMemo(() => {
    if (!data?.evolucao?.mrr) return { evolucaoChartData: [], evolucaoSquads: [] };

    const mrrRows = data.evolucao.mrr;
    const mesesUnicos = Array.from(new Set(mrrRows.map((r) => r.mes))).sort();
    const squadsUnicos = Array.from(
      new Set(mrrRows.map((r) => r.squad).filter((s) => s !== "Sem Squad"))
    );

    // Top 8 squads por MRR total no período
    const squadTotals = new Map<string, number>();
    for (const row of mrrRows) {
      if (row.squad === "Sem Squad") continue;
      squadTotals.set(row.squad, (squadTotals.get(row.squad) || 0) + (parseFloat(String(row.mrr_total)) || 0));
    }
    const topSquads = [...squadTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([squad]) => squad);

    const chartData = mesesUnicos.map((mes) => {
      const row: Record<string, any> = { mes: formatMesLabel(mes) };
      for (const squad of topSquads) {
        const match = mrrRows.find((r) => r.mes === mes && r.squad === squad);
        row[squad] = match ? parseFloat(String(match.mrr_total)) || 0 : 0;
      }
      return row;
    });

    return { evolucaoChartData: chartData, evolucaoSquads: topSquads };
  }, [data]);

  // Dados do churn rate por squad (bar chart)
  const churnRateBarData = useMemo(() => {
    if (!data?.squads) return [];
    return data.squads
      .filter((s) => s.squad !== "Sem Squad" && s.contratos > 0)
      .sort((a, b) => b.churnRate - a.churnRate);
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const totais = data?.totais;

  const kpiCards = [
    {
      title: "MRR Total",
      value: formatCurrencyNoDecimals(totais?.totalMrr || 0),
      icon: DollarSign,
      color: "text-cyan-600 dark:text-cyan-400",
      bgGlow: "from-cyan-500/10 to-transparent",
    },
    {
      title: "Contratos Ativos",
      value: (totais?.totalContratos || 0).toLocaleString("pt-BR"),
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bgGlow: "from-blue-500/10 to-transparent",
    },
    {
      title: "Clientes Únicos",
      value: (totais?.totalClientes || 0).toLocaleString("pt-BR"),
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      bgGlow: "from-violet-500/10 to-transparent",
    },
    {
      title: "Churn Rate",
      value: formatPercent(totais?.churnRateGeral || 0),
      icon: TrendingDown,
      color: "text-rose-600 dark:text-rose-400",
      bgGlow: "from-rose-500/10 to-transparent",
    },
    {
      title: "Ticket Médio",
      value: formatCurrencyNoDecimals(totais?.ticketMedioGeral || 0),
      icon: Receipt,
      color: "text-emerald-600 dark:text-emerald-400",
      bgGlow: "from-emerald-500/10 to-transparent",
    },
  ];

  const CustomTooltipMrr = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-lg border px-3 py-2 shadow-lg"
        style={{
          backgroundColor: chartColors.tooltipBg,
          borderColor: chartColors.tooltipBorder,
          color: chartColors.tooltipText,
        }}
      >
        <p className="text-xs font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="opacity-70">{p.dataKey}:</span>
            <span className="font-semibold">{formatCurrencyNoDecimals(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Análise de Squads</h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Performance consolidada por squad
          </p>
        </div>
        <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} minYear={2025} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", card.bgGlow)} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                {card.title}
              </CardTitle>
              <card.icon className={cn("w-4 h-4", card.color)} />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR por Squad - Horizontal Bar */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
              MRR por Squad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mrrBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, mrrBarData.length * 40)}>
                <BarChart data={mrrBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                    tickFormatter={(v) => formatCurrencyNoDecimals(v)}
                    axisLine={{ stroke: chartColors.axisLine }}
                  />
                  <YAxis
                    type="category"
                    dataKey="squad"
                    width={110}
                    tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                    axisLine={{ stroke: chartColors.axisLine }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as SquadData;
                      return (
                        <div
                          className="rounded-lg border px-3 py-2 shadow-lg text-xs"
                          style={{
                            backgroundColor: chartColors.tooltipBg,
                            borderColor: chartColors.tooltipBorder,
                            color: chartColors.tooltipText,
                          }}
                        >
                          <p className="font-semibold mb-1">{d.squad}</p>
                          <p>MRR: {formatCurrencyNoDecimals(d.mrr)}</p>
                          <p>Contratos: {d.contratos}</p>
                          <p>Clientes: {d.clientes}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="mrr" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {mrrBarData.map((entry, index) => (
                      <Cell key={entry.squad} fill={getSquadColor(entry.squad, index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-8">
                Sem dados para o período
              </p>
            )}
          </CardContent>
        </Card>

        {/* Evolução MRR por Squad - Stacked Area */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
              Evolução MRR por Squad (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={evolucaoChartData} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                    axisLine={{ stroke: chartColors.axisLine }}
                  />
                  <YAxis
                    tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                    tickFormatter={(v) => formatCurrencyNoDecimals(v)}
                    axisLine={{ stroke: chartColors.axisLine }}
                  />
                  <Tooltip content={<CustomTooltipMrr />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {evolucaoSquads.map((squad, index) => (
                    <Area
                      key={squad}
                      type="monotone"
                      dataKey={squad}
                      stackId="mrr"
                      fill={getSquadColor(squad, index)}
                      stroke={getSquadColor(squad, index)}
                      fillOpacity={0.6}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-8">
                Sem dados de evolução
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ranking de Squads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-700">
                  <TableHead className="text-gray-600 dark:text-zinc-400 w-12">#</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400">Squad</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Contratos</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Clientes</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Churns</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Churn Rate</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR Churn</TableHead>
                  <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.squads || [])
                  .filter((s) => s.squad !== "Sem Squad")
                  .map((squad, index) => (
                    <TableRow
                      key={squad.squad}
                      className="border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/30"
                    >
                      <TableCell className="font-medium text-gray-500 dark:text-zinc-500">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getSquadColor(squad.squad, index) }}
                          />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {squad.squad}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-gray-900 dark:text-white">
                        {formatCurrencyNoDecimals(squad.mrr)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">
                        {squad.contratos}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">
                        {squad.clientes}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">
                        {squad.churns}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChurnRateIndicator rate={squad.churnRate} />
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">
                        {formatCurrencyNoDecimals(squad.mrrChurn)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">
                        {formatCurrencyNoDecimals(squad.ticketMedio)}
                      </TableCell>
                    </TableRow>
                  ))}
                {/* Footer com totais */}
                {totais && (
                  <TableRow className="border-t-2 border-gray-300 dark:border-zinc-600 bg-gray-50/50 dark:bg-zinc-800/30 font-semibold">
                    <TableCell />
                    <TableCell className="text-gray-900 dark:text-white">Total</TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(totais.totalMrr)}
                    </TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white">
                      {totais.totalContratos}
                    </TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white">
                      {totais.totalClientes}
                    </TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white">
                      {totais.totalChurns}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChurnRateIndicator rate={totais.churnRateGeral} />
                    </TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(
                        (data?.squads || []).reduce((s, sq) => s + sq.mrrChurn, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(totais.ticketMedioGeral)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Churn Rate por Squad */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Churn Rate por Squad
          </CardTitle>
        </CardHeader>
        <CardContent>
          {churnRateBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnRateBarData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="squad"
                  tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                  axisLine={{ stroke: chartColors.axisLine }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={{ stroke: chartColors.axisLine }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as SquadData;
                    return (
                      <div
                        className="rounded-lg border px-3 py-2 shadow-lg text-xs"
                        style={{
                          backgroundColor: chartColors.tooltipBg,
                          borderColor: chartColors.tooltipBorder,
                          color: chartColors.tooltipText,
                        }}
                      >
                        <p className="font-semibold mb-1">{d.squad}</p>
                        <p>Churn Rate: {formatPercent(d.churnRate)}</p>
                        <p>Churns: {d.churns} contratos</p>
                        <p>MRR Churn: {formatCurrencyNoDecimals(d.mrrChurn)}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={3}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={{
                    value: "Meta 3%",
                    fill: chartColors.axisTick,
                    fontSize: 11,
                    position: "right",
                  }}
                />
                <Bar dataKey="churnRate" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {churnRateBarData.map((entry) => (
                    <Cell key={entry.squad} fill={getChurnBarColor(entry.churnRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-8">
              Sem dados de churn para o período
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
