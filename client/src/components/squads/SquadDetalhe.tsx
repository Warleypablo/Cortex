import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals, formatPercent, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, Users, TrendingDown, TrendingUp, FileText, ArrowLeft, Search, UserCheck,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Bar, ComposedChart, Line,
} from "recharts";

const SQUAD_COLORS: Record<string, string> = {
  "Aurea": "#fbbf24", "Aurea (OFF)": "#fcd34d", "Black": "#475569",
  "Bloomfield": "#10b981", "Chama": "#f43f5e", "Chama (OFF)": "#fb7185",
  "Hunters": "#a855f7", "Hunters (OFF)": "#c084fc", "Makers": "#06b6d4",
  "Pulse": "#ec4899", "Selva": "#22c55e", "Squadra": "#3b82f6",
  "Squad X": "#6366f1", "Supreme": "#8b5cf6", "Supreme (OFF)": "#a78bfa",
  "Tech": "#0ea5e9", "Turbo Interno": "#94a3b8",
};

const OPERATOR_COLORS = [
  "#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899",
  "#3b82f6", "#10b981", "#f43f5e", "#6366f1", "#14b8a6",
];

function getSquadColor(squad: string): string {
  return SQUAD_COLORS[squad] || "#3b82f6";
}

function formatMesLabel(mesAno: string) {
  const [ano, mes] = mesAno.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[parseInt(mes) - 1]}/${ano.slice(2)}`;
}

interface ChartColors {
  grid: string;
  axisLine: string;
  axisTick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

interface SquadDetalheProps {
  squad: string;
  mesAno: string;
  chartColors: ChartColors;
  onBack: () => void;
}

interface Operador {
  nome: string;
  mrr: number;
  contratos: number;
  clientes: number;
  churns: number;
  mrrChurn: number;
  churnRate: number;
  ticketMedio: number;
}

interface ContratoAtivo {
  cliente: string;
  servico: string;
  produto: string;
  valorr: number;
  responsavel: string;
  data_inicio: string;
  id_subtask: string;
}

interface ContratoChurn {
  cliente: string;
  contrato: string;
  valorr: number;
  responsavel: string;
  data_encerramento: string;
  motivo_cancelamento: string;
  submotivo_cancelamento: string;
}

interface TotaisAnterior {
  mrr: number;
  contratos: number;
  clientes: number;
  churns: number;
  churnRate: number;
  mrrChurn: number;
}

interface OperadorAnterior {
  nome: string;
  mrr: number;
  contratos: number;
  clientes: number;
  churns: number;
  mrrChurn: number;
}

interface DetalheResponse {
  squad: string;
  mesAno: string;
  totais: {
    mrr: number;
    contratos: number;
    clientes: number;
    churns: number;
    churnRate: number;
    mrrChurn: number;
    ticketMedio: number;
    headcount: number;
  };
  operadores: Operador[];
  totaisAnterior?: TotaisAnterior;
  operadoresAnterior?: OperadorAnterior[];
  evolucaoMrr: { mes: string; mrr: number }[];
  evolucaoOperadores: { mes: string; operador: string; mrr: number }[];
  contratosChurn: ContratoChurn[];
  evolucaoChurn: { mes: string; churns: number; mrr_churn: number }[];
  churnPorMotivo?: { mes: string; motivo: string; mrr_churn: number }[];
  contratosAtivos: ContratoAtivo[];
}

function computeVariation(current: number, previous: number): { pct: number; label: string } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { pct: 100, label: "+100%" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct, label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` };
}

function DeltaBadge({ current, previous, isNegative = false }: { current: number; previous: number; isNegative?: boolean }) {
  const variation = computeVariation(current, previous);
  if (!variation) return null;
  const isPositive = isNegative ? variation.pct <= 0 : variation.pct >= 0;
  return (
    <div className="flex items-center gap-1 mt-1">
      {variation.pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span className={cn("text-xs font-medium", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {variation.label}
      </span>
      <span className="text-[10px] text-gray-400 dark:text-zinc-500">vs mês ant.</span>
    </div>
  );
}

function ChurnRateIndicator({ rate }: { rate: number }) {
  const color = rate <= 2 ? "text-emerald-600 dark:text-emerald-400" :
    rate <= 5 ? "text-amber-600 dark:text-amber-400" :
    "text-rose-600 dark:text-rose-400";
  return <span className={cn("font-semibold", color)}>{formatPercent(rate)}</span>;
}

function getMotivoBadgeColor(motivo: string): string {
  const m = (motivo || "").toLowerCase();
  if (m.includes("insatisf")) return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
  if (m.includes("financ") || m.includes("custo")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (m.includes("concorr")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
  if (m.includes("intern")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (m.includes("encerr") || m.includes("fechou")) return "bg-gray-100 text-gray-700 dark:bg-zinc-700/50 dark:text-zinc-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300";
}

export default function SquadDetalhe({ squad, mesAno, chartColors, onBack }: SquadDetalheProps) {
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery<DetalheResponse>({
    queryKey: ["/api/analise-squads/detalhe", squad, mesAno],
    queryFn: () =>
      fetch(`/api/analise-squads/detalhe?squad=${encodeURIComponent(squad)}&mesAno=${mesAno}`)
        .then((r) => r.json()),
    enabled: !!squad,
  });

  const squadColor = getSquadColor(squad);

  // Evolução MRR chart data
  const evolucaoMrrData = useMemo(() => {
    if (!data?.evolucaoMrr) return [];
    return data.evolucaoMrr.map((r) => ({
      mes: formatMesLabel(r.mes),
      mrr: parseFloat(String(r.mrr)) || 0,
    }));
  }, [data]);

  // Evolução Churn chart data
  const evolucaoChurnData = useMemo(() => {
    if (!data?.evolucaoChurn) return [];
    return data.evolucaoChurn.map((r) => ({
      mes: formatMesLabel(r.mes),
      churns: parseInt(String(r.churns)) || 0,
      mrrChurn: parseFloat(String(r.mrr_churn)) || 0,
    }));
  }, [data]);

  // Evolução por operador (top 6 stacked area)
  const { operadorChartData, topOperadores } = useMemo(() => {
    if (!data?.evolucaoOperadores) return { operadorChartData: [], topOperadores: [] };

    const rows = data.evolucaoOperadores;
    const meses = Array.from(new Set(rows.map((r) => r.mes))).sort();

    // Top 6 operadores por MRR total
    const opTotals = new Map<string, number>();
    for (const r of rows) {
      opTotals.set(r.operador, (opTotals.get(r.operador) || 0) + (parseFloat(String(r.mrr)) || 0));
    }
    const top = [...opTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([op]) => op);

    const chartData = meses.map((mes) => {
      const row: Record<string, any> = { mes: formatMesLabel(mes) };
      for (const op of top) {
        const match = rows.find((r) => r.mes === mes && r.operador === op);
        row[op] = match ? parseFloat(String(match.mrr)) || 0 : 0;
      }
      return row;
    });

    return { operadorChartData: chartData, topOperadores: top };
  }, [data]);

  // Mapa de operadores do mês anterior para delta na tabela
  const operadorAntMap = useMemo(() => {
    const map = new Map<string, OperadorAnterior>();
    if (data?.operadoresAnterior) {
      for (const op of data.operadoresAnterior) {
        map.set(op.nome, op);
      }
    }
    return map;
  }, [data]);

  // Churn por motivo por mês (stacked bar chart)
  const MOTIVO_COLORS = [
    "#f43f5e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899",
    "#10b981", "#6366f1", "#84cc16",
  ];

  const { churnMotivoData, topMotivos } = useMemo(() => {
    if (!data?.churnPorMotivo?.length) return { churnMotivoData: [], topMotivos: [] };

    const rows = data.churnPorMotivo;
    const meses = Array.from(new Set(rows.map((r) => r.mes))).sort();

    // Top 6 motivos por MRR total, resto = "Outros"
    const motivoTotals = new Map<string, number>();
    for (const r of rows) {
      motivoTotals.set(r.motivo, (motivoTotals.get(r.motivo) || 0) + (parseFloat(String(r.mrr_churn)) || 0));
    }
    const sorted = Array.from(motivoTotals.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6).map(([m]) => m);
    const hasOutros = sorted.length > 6;

    const allKeys = hasOutros ? [...top, "Outros"] : top;

    const chartData = meses.map((mes) => {
      const row: Record<string, any> = { mes: formatMesLabel(mes) };
      for (const motivo of top) {
        const match = rows.find((r) => r.mes === mes && r.motivo === motivo);
        row[motivo] = match ? parseFloat(String(match.mrr_churn)) || 0 : 0;
      }
      if (hasOutros) {
        row["Outros"] = rows
          .filter((r) => r.mes === mes && !top.includes(r.motivo))
          .reduce((sum, r) => sum + (parseFloat(String(r.mrr_churn)) || 0), 0);
      }
      return row;
    });

    return { churnMotivoData: chartData, topMotivos: allKeys };
  }, [data]);

  // Contratos filtrados por busca
  const contratosFiltrados = useMemo(() => {
    if (!data?.contratosAtivos) return [];
    if (!busca.trim()) return data.contratosAtivos;
    const term = busca.toLowerCase();
    return data.contratosAtivos.filter(
      (c) =>
        (c.cliente || "").toLowerCase().includes(term) ||
        (c.servico || "").toLowerCase().includes(term) ||
        (c.produto || "").toLowerCase().includes(term) ||
        (c.responsavel || "").toLowerCase().includes(term)
    );
  }, [data, busca]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <div className="h-6 w-40 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-zinc-700 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-gray-200 dark:bg-zinc-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const t = data?.totais;

  const tAnt = data?.totaisAnterior;

  const kpiCards = [
    { title: "MRR Total", value: formatCurrencyNoDecimals(t?.mrr || 0), icon: DollarSign, color: "text-cyan-600 dark:text-cyan-400", bgGlow: "from-cyan-500/10 to-transparent", current: t?.mrr || 0, previous: tAnt?.mrr ?? null, isNegative: false },
    { title: "Contratos", value: (t?.contratos || 0).toLocaleString("pt-BR"), icon: FileText, color: "text-blue-600 dark:text-blue-400", bgGlow: "from-blue-500/10 to-transparent", current: t?.contratos || 0, previous: tAnt?.contratos ?? null, isNegative: false },
    { title: "Clientes", value: (t?.clientes || 0).toLocaleString("pt-BR"), icon: Users, color: "text-violet-600 dark:text-violet-400", bgGlow: "from-violet-500/10 to-transparent", current: t?.clientes || 0, previous: tAnt?.clientes ?? null, isNegative: false },
    { title: "Churn Rate", value: formatPercent(t?.churnRate || 0), icon: TrendingDown, color: (t?.churnRate || 0) <= 3 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400", bgGlow: (t?.churnRate || 0) <= 3 ? "from-emerald-500/10 to-transparent" : "from-rose-500/10 to-transparent", current: t?.churnRate || 0, previous: tAnt?.churnRate ?? null, isNegative: true },
    { title: "MRR Churn", value: formatCurrencyNoDecimals(t?.mrrChurn || 0), icon: TrendingDown, color: "text-amber-600 dark:text-amber-400", bgGlow: "from-amber-500/10 to-transparent", current: t?.mrrChurn || 0, previous: tAnt?.mrrChurn ?? null, isNegative: true },
    { title: "Headcount", value: (t?.headcount || 0).toString(), icon: UserCheck, color: "text-teal-600 dark:text-teal-400", bgGlow: "from-teal-500/10 to-transparent", current: null, previous: null, isNegative: false },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border px-3 py-2 shadow-lg text-xs" style={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, color: chartColors.tooltipText }}>
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="opacity-70">{p.name || p.dataKey}:</span>
            <span className="font-semibold">
              {typeof p.value === "number" && p.value > 100 ? formatCurrencyNoDecimals(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Overview
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: squadColor }} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{squad}</h2>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", card.bgGlow)} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-zinc-400">{card.title}</CardTitle>
              <card.icon className={cn("w-4 h-4", card.color)} />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</div>
              {card.current !== null && card.previous !== null && (
                <DeltaBadge current={card.current} previous={card.previous} isNegative={card.isNegative} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="bg-gray-100 dark:bg-zinc-800">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="churns">Churns</TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolução MRR */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                  Evolução MRR (12 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evolucaoMrrData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={evolucaoMrrData} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis dataKey="mes" tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
                      <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} axisLine={{ stroke: chartColors.axisLine }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="mrr" name="MRR" fill={squadColor} stroke={squadColor} fillOpacity={0.3} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-8">Sem dados de evolução</p>
                )}
              </CardContent>
            </Card>

            {/* Evolução Churn */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                  Evolução Churn (12 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evolucaoChurnData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={evolucaoChurnData} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis dataKey="mes" tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
                      <YAxis yAxisId="left" tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} axisLine={{ stroke: chartColors.axisLine }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="churns" name="Churns" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} fillOpacity={0.8} />
                      <Line yAxisId="right" type="monotone" dataKey="mrrChurn" name="MRR Churn" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-8">Sem dados de churn</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Colaboradores */}
        <TabsContent value="colaboradores" className="space-y-6">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                Desempenho por Colaborador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700">
                      <TableHead className="text-gray-600 dark:text-zinc-400">Nome</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Δ MRR</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Contratos</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Clientes</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Churns</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Churn Rate</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR Churn</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.operadores || []).map((op) => (
                      <TableRow key={op.nome} className="border-gray-100 dark:border-zinc-800">
                        <TableCell className="font-medium text-gray-900 dark:text-white">{op.nome}</TableCell>
                        <TableCell className="text-right font-semibold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(op.mrr)}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const prev = operadorAntMap.get(op.nome);
                            if (!prev) return <span className="text-gray-400 dark:text-zinc-600">—</span>;
                            const diff = op.mrr - prev.mrr;
                            const variation = computeVariation(op.mrr, prev.mrr);
                            if (!variation) return <span className="text-gray-400 dark:text-zinc-600">—</span>;
                            const isPositive = diff >= 0;
                            return (
                              <div className="flex flex-col items-end">
                                <span className={cn("text-xs font-semibold", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                  {isPositive ? "+" : ""}{formatCurrencyNoDecimals(diff)}
                                </span>
                                <span className={cn("text-[10px]", isPositive ? "text-emerald-500/70 dark:text-emerald-400/60" : "text-rose-500/70 dark:text-rose-400/60")}>
                                  {variation.label}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-zinc-300">{op.contratos}</TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-zinc-300">{op.clientes}</TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-zinc-300">{op.churns}</TableCell>
                        <TableCell className="text-right"><ChurnRateIndicator rate={op.churnRate} /></TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-zinc-300">{formatCurrencyNoDecimals(op.mrrChurn)}</TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-zinc-300">{formatCurrencyNoDecimals(op.ticketMedio)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Footer totais */}
                    {t && (
                      <TableRow className="border-t-2 border-gray-300 dark:border-zinc-600 bg-gray-50/50 dark:bg-zinc-800/30 font-semibold">
                        <TableCell className="text-gray-900 dark:text-white">Total</TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">{formatCurrencyNoDecimals(t.mrr)}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            if (!tAnt) return <span className="text-gray-400 dark:text-zinc-600">—</span>;
                            const diff = t.mrr - tAnt.mrr;
                            const variation = computeVariation(t.mrr, tAnt.mrr);
                            if (!variation) return <span className="text-gray-400 dark:text-zinc-600">—</span>;
                            const isPositive = diff >= 0;
                            return (
                              <div className="flex flex-col items-end">
                                <span className={cn("text-xs font-semibold", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                  {isPositive ? "+" : ""}{formatCurrencyNoDecimals(diff)}
                                </span>
                                <span className={cn("text-[10px]", isPositive ? "text-emerald-500/70 dark:text-emerald-400/60" : "text-rose-500/70 dark:text-rose-400/60")}>
                                  {variation.label}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">{t.contratos}</TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">{t.clientes}</TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">{t.churns}</TableCell>
                        <TableCell className="text-right"><ChurnRateIndicator rate={t.churnRate} /></TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">{formatCurrencyNoDecimals(t.mrrChurn)}</TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">{formatCurrencyNoDecimals(t.ticketMedio)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Evolução MRR por Operador */}
          {operadorChartData.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                  Evolução MRR por Colaborador (Top 6)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={operadorChartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="mes" tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
                    <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} axisLine={{ stroke: chartColors.axisLine }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    {topOperadores.map((op, idx) => (
                      <Area key={op} type="monotone" dataKey={op} stackId="op" fill={OPERATOR_COLORS[idx % OPERATOR_COLORS.length]} stroke={OPERATOR_COLORS[idx % OPERATOR_COLORS.length]} fillOpacity={0.6} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Contratos */}
        <TabsContent value="contratos" className="space-y-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                  Contratos Ativos ({contratosFiltrados.length})
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-zinc-500" />
                  <Input
                    placeholder="Buscar cliente, serviço..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9 bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900">
                      <TableHead className="text-gray-600 dark:text-zinc-400">Cliente</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Serviço</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Produto</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Responsável</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Data Início</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratosFiltrados.map((c, idx) => (
                      <TableRow key={`${c.id_subtask}-${idx}`} className="border-gray-100 dark:border-zinc-800">
                        <TableCell className="font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{c.cliente || "—"}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">{c.servico || "—"}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">{c.produto || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(parseFloat(String(c.valorr)) || 0)}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">{c.responsavel || "—"}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">
                          {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {contratosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 dark:text-zinc-500 py-8">
                          {busca ? "Nenhum contrato encontrado" : "Sem contratos ativos"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Churns */}
        <TabsContent value="churns" className="space-y-4">
          {/* Stacked Bar: MRR Churn por Motivo por Mês */}
          {churnMotivoData.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                  MRR Churn por Motivo (12 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={churnMotivoData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="mes" tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
                    <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} axisLine={{ stroke: chartColors.axisLine }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    {topMotivos.map((motivo, idx) => (
                      <Bar key={motivo} dataKey={motivo} stackId="motivo" fill={MOTIVO_COLORS[idx % MOTIVO_COLORS.length]} radius={idx === topMotivos.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} maxBarSize={40} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Churns do Mês ({(data?.contratosChurn || []).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700">
                      <TableHead className="text-gray-600 dark:text-zinc-400">Cliente</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Contrato</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR Perdido</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Responsável</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Data</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Motivo</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Submotivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.contratosChurn || []).map((c, idx) => (
                      <TableRow key={idx} className="border-gray-100 dark:border-zinc-800">
                        <TableCell className="font-medium text-gray-900 dark:text-white max-w-[180px] truncate">{c.cliente || "—"}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">{c.contrato || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-rose-600 dark:text-rose-400">{formatCurrencyNoDecimals(parseFloat(String(c.valorr)) || 0)}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">{c.responsavel || "—"}</TableCell>
                        <TableCell className="text-gray-700 dark:text-zinc-300">
                          {c.data_encerramento ? new Date(c.data_encerramento).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>
                          {c.motivo_cancelamento ? (
                            <Badge variant="secondary" className={cn("text-xs", getMotivoBadgeColor(c.motivo_cancelamento))}>
                              {c.motivo_cancelamento}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-zinc-500 text-xs max-w-[150px] truncate">{c.submotivo_cancelamento || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {(data?.contratosChurn || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 dark:text-zinc-500 py-8">
                          Sem churns no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
