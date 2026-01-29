import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Activity, Percent, Zap } from "lucide-react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";

interface MrrDataPoint {
  mes: string;
  squad: string;
  responsavel: string;
  mrr_total: number;
  total_contratos: number;
}

interface ChurnDataPoint {
  mes: string;
  squad: string;
  churns: number;
  mrr_churn: number;
}

interface EvolucaoMensalResponse {
  mrr: MrrDataPoint[];
  churns: ChurnDataPoint[];
  squads: string[];
  operadores: string[];
}

const SQUAD_COLORS: Record<string, string> = {
  "Aurea": "#fbbf24",
  "Aurea (OFF)": "#fcd34d",
  "Black": "#475569",
  "Bloomfield": "#10b981",
  "Chama": "#f43f5e",
  "Chama (OFF)": "#fb7185",
  "Comunicação (OFF)": "#64748b",
  "Hunters": "#a855f7",
  "Hunters (OFF)": "#c084fc",
  "Makers": "#06b6d4",
  "Pulse": "#ec4899",
  "Selva": "#22c55e",
  "Solar+ (OFF)": "#facc15",
  "Squadra": "#3b82f6",
  "Squad X": "#6366f1",
  "Supreme": "#8b5cf6",
  "Supreme (OFF)": "#a78bfa",
  "Tech": "#0ea5e9",
  "Tribo (OFF)": "#fb923c",
  "Turbo Interno": "#94a3b8",
};

function getSquadColor(squad: string, index: number): string {
  if (SQUAD_COLORS[squad]) return SQUAD_COLORS[squad];
  const fallbackColors = [
    "#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899",
    "#3b82f6", "#10b981", "#f43f5e", "#6366f1", "#14b8a6"
  ];
  return fallbackColors[index % fallbackColors.length];
}

export default function EvolucaoMensal() {
  usePageTitle("Evolução Mensal");
  useSetPageInfo("Evolução Mensal", "Evolução histórica de MRR por squad e operador");
  
  const [viewMode, setViewMode] = useState<"squad" | "operador">("squad");
  const [squadSelecionado, setSquadSelecionado] = useState<string>("todos");
  const [operadorSelecionado, setOperadorSelecionado] = useState<string>("todos");
  const [meses, setMeses] = useState<string>("6");
  
  const { data, isLoading } = useQuery<EvolucaoMensalResponse>({
    queryKey: [`/api/dashboard/evolucao-mensal?meses=${meses}`],
  });

  const chartData = useMemo(() => {
    if (!data?.mrr) return [];
    
    const mrrData = data.mrr;
    const churnData = data.churns || [];
    
    const mesesUnicos = Array.from(new Set(mrrData.map(d => d.mes))).sort();
    
    if (viewMode === "squad") {
      return mesesUnicos.map(mes => {
        const mrrMes = mrrData.filter(d => d.mes === mes);
        const churnMes = churnData.filter(d => d.mes === mes);
        
        const squadsUnicos = Array.from(new Set(mrrMes.map(d => d.squad).filter(Boolean)));
        
        const row: Record<string, any> = {
          mes: formatMesLabel(mes),
          mesOriginal: mes,
        };
        
        let totalMrr = 0;
        
        for (const squad of squadsUnicos) {
          if (squadSelecionado === "todos" || squadSelecionado === squad) {
            const mrrSquad = mrrMes
              .filter(d => d.squad === squad)
              .reduce((acc, d) => acc + (Number(d.mrr_total) || 0), 0);
            row[squad] = mrrSquad;
            totalMrr += mrrSquad;
          }
        }
        
        const churnTotal = churnMes
          .filter(d => squadSelecionado === "todos" || d.squad === squadSelecionado)
          .reduce((acc, d) => acc + (Number(d.mrr_churn) || 0), 0);
        
        row.totalMrr = totalMrr;
        row.churn = churnTotal;
        
        return row;
      });
    } else {
      return mesesUnicos.map(mes => {
        const mrrMes = mrrData.filter(d => d.mes === mes);
        const churnMes = churnData.filter(d => d.mes === mes);
        
        const operadoresUnicos = Array.from(new Set(mrrMes.map(d => d.responsavel).filter(Boolean)));
        
        const row: Record<string, any> = {
          mes: formatMesLabel(mes),
          mesOriginal: mes,
        };
        
        let totalMrr = 0;
        
        for (const operador of operadoresUnicos) {
          if (operadorSelecionado === "todos" || operadorSelecionado === operador) {
            const mrrOperador = mrrMes
              .filter(d => d.responsavel === operador)
              .reduce((acc, d) => acc + (Number(d.mrr_total) || 0), 0);
            row[operador] = mrrOperador;
            totalMrr += mrrOperador;
          }
        }
        
        const churnTotal = churnMes.reduce((acc, d) => acc + (Number(d.mrr_churn) || 0), 0);
        
        row.totalMrr = totalMrr;
        row.churn = churnTotal;
        
        return row;
      });
    }
  }, [data, viewMode, squadSelecionado, operadorSelecionado]);

  const aggregatedData = useMemo(() => {
    if (!data?.mrr) return [];
    
    const mrrData = data.mrr;
    const churnData = data.churns || [];
    
    const mesesUnicos = Array.from(new Set(mrrData.map(d => d.mes))).sort();
    
    return mesesUnicos.map(mes => {
      const mrrMes = mrrData.filter(d => d.mes === mes);
      const churnMes = churnData.filter(d => d.mes === mes);
      
      let totalMrr = 0;
      let totalContratos = 0;
      
      for (const d of mrrMes) {
        if (squadSelecionado === "todos" || d.squad === squadSelecionado) {
          if (operadorSelecionado === "todos" || d.responsavel === operadorSelecionado) {
            totalMrr += Number(d.mrr_total) || 0;
            totalContratos += Number(d.total_contratos) || 0;
          }
        }
      }
      
      const churnTotal = churnMes
        .filter(d => squadSelecionado === "todos" || d.squad === squadSelecionado)
        .reduce((acc, d) => acc + (Number(d.mrr_churn) || 0), 0);
      
      const churnsCount = churnMes
        .filter(d => squadSelecionado === "todos" || d.squad === squadSelecionado)
        .reduce((acc, d) => acc + (Number(d.churns) || 0), 0);
      
      const churnRate = totalMrr > 0 ? (churnTotal / totalMrr) * 100 : 0;
      
      return {
        mes: formatMesLabel(mes),
        mesOriginal: mes,
        mrr: totalMrr,
        churn: churnTotal,
        churnsCount,
        contratos: totalContratos,
        churnRate,
      };
    });
  }, [data, squadSelecionado, operadorSelecionado]);

  const totais = useMemo(() => {
    if (!aggregatedData.length) return { mrrAtual: 0, churnTotal: 0, variacaoMrr: 0, churnRate: 0 };
    
    const ultimo = aggregatedData[aggregatedData.length - 1];
    const penultimo = aggregatedData.length > 1 ? aggregatedData[aggregatedData.length - 2] : null;
    
    const variacaoMrr = penultimo ? ultimo.mrr - penultimo.mrr : 0;
    const churnTotal = aggregatedData.reduce((acc, d) => acc + d.churn, 0);
    const avgChurnRate = aggregatedData.reduce((acc, d) => acc + d.churnRate, 0) / aggregatedData.length;
    
    return {
      mrrAtual: ultimo.mrr,
      churnTotal,
      variacaoMrr,
      churnRate: avgChurnRate,
    };
  }, [aggregatedData]);

  const squads = data?.squads || [];
  const operadores = data?.operadores || [];

  function formatMesLabel(mes: string): string {
    const [ano, mesNum] = mes.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${meses[parseInt(mesNum) - 1]}/${ano.slice(2)}`;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-zinc-400 mb-2 font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}` }}
              />
              <span className="text-zinc-300">{entry.name}:</span>
              <span className="font-mono font-semibold text-white">
                {formatCurrencyNoDecimals(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="evolucao-mensal-loading">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="evolucao-mensal-page">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as "squad" | "operador")}>
          <SelectTrigger className="w-[150px] bg-zinc-900/50 border-zinc-700/50" data-testid="select-view-mode">
            <SelectValue placeholder="Visão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="squad">Por Squad</SelectItem>
            <SelectItem value="operador">Por Operador</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={squadSelecionado} onValueChange={setSquadSelecionado}>
          <SelectTrigger className="w-[180px] bg-zinc-900/50 border-zinc-700/50" data-testid="select-squad">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Squads</SelectItem>
            {squads.map(squad => (
              <SelectItem key={squad} value={squad}>{squad}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {viewMode === "operador" && (
          <Select value={operadorSelecionado} onValueChange={setOperadorSelecionado}>
            <SelectTrigger className="w-[200px] bg-zinc-900/50 border-zinc-700/50" data-testid="select-operador">
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Operadores</SelectItem>
              {operadores.map(op => (
                <SelectItem key={op} value={op}>{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Select value={meses} onValueChange={setMeses}>
          <SelectTrigger className="w-[130px] bg-zinc-900/50 border-zinc-700/50" data-testid="select-meses">
            <SelectValue placeholder="Meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 meses</SelectItem>
            <SelectItem value="6">6 meses</SelectItem>
            <SelectItem value="12">12 meses</SelectItem>
            <SelectItem value="24">24 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative group" data-testid="card-mrr-atual">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-50" />
          <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-zinc-400">MRR Atual</CardTitle>
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <DollarSign className="h-4 w-4 text-cyan-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white font-mono">{formatCurrencyNoDecimals(totais.mrrAtual)}</div>
              <p className={cn(
                "text-xs mt-1 flex items-center gap-1",
                totais.variacaoMrr >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {totais.variacaoMrr >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {totais.variacaoMrr >= 0 ? "+" : ""}{formatCurrencyNoDecimals(totais.variacaoMrr)} vs anterior
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="relative group" data-testid="card-variacao">
          <div className={cn(
            "absolute inset-0 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-50",
            totais.variacaoMrr >= 0 ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20" : "bg-gradient-to-r from-rose-500/20 to-red-500/20"
          )} />
          <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Variação MRR</CardTitle>
              <div className={cn(
                "p-2 rounded-lg",
                totais.variacaoMrr >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
              )}>
                {totais.variacaoMrr >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold font-mono",
                totais.variacaoMrr >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {totais.variacaoMrr >= 0 ? "+" : ""}{formatCurrencyNoDecimals(totais.variacaoMrr)}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Último mês
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="relative group" data-testid="card-churn-total">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-red-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-50" />
          <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Churn Total</CardTitle>
              <div className="p-2 rounded-lg bg-rose-500/10">
                <TrendingDown className="h-4 w-4 text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-400 font-mono">{formatCurrencyNoDecimals(totais.churnTotal)}</div>
              <p className="text-xs text-zinc-500 mt-1">
                Últimos {meses} meses
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="relative group" data-testid="card-churn-rate">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-50" />
          <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Taxa de Churn</CardTitle>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Percent className="h-4 w-4 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400 font-mono">{totais.churnRate.toFixed(1)}%</div>
              <p className="text-xs text-zinc-500 mt-1">
                Média do período
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="relative" data-testid="card-chart-main">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 rounded-xl blur-2xl" />
        <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
              <Activity className="h-4 w-4 text-cyan-400" />
              Evolução MRR e Churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={aggregatedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrGradientTech" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4}/>
                      <stop offset="50%" stopColor="#0891b2" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="churnGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    axisLine={{ stroke: '#3f3f46' }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => (
                      <span className="text-xs text-zinc-400">
                        {value === "mrr" ? "MRR" : "Churn"}
                      </span>
                    )}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="mrr"
                    name="mrr"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#mrrGradientTech)"
                    filter="url(#glow)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="churn" 
                    name="churn" 
                    stroke="#f43f5e" 
                    strokeWidth={2}
                    dot={{ fill: "#f43f5e", strokeWidth: 0, r: 4, filter: "url(#glow)" }}
                    activeDot={{ r: 6, stroke: "#f43f5e", strokeWidth: 2, fill: "#18181b" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === "squad" && chartData.length > 0 && (
        <div className="relative" data-testid="card-chart-by-squad">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-orange-500/5 rounded-xl blur-2xl" />
          <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Zap className="h-4 w-4 text-purple-400" />
                MRR por Squad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700/50">
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium sticky left-0 bg-zinc-900/95 backdrop-blur-sm">
                        Squad
                      </th>
                      {chartData.map((row) => (
                        <th key={row.mes} className="text-right py-3 px-4 text-zinc-400 font-medium whitespace-nowrap">
                          {row.mes}
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 text-cyan-400 font-semibold whitespace-nowrap border-l border-zinc-700/50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {squads
                      .filter(s => squadSelecionado === "todos" || s === squadSelecionado)
                      .filter(squad => chartData.reduce((acc, row) => acc + (Number(row[squad]) || 0), 0) > 0)
                      .map((squad, i) => {
                      const color = getSquadColor(squad, i);
                      const total = chartData.reduce((acc, row) => acc + (Number(row[squad]) || 0), 0);
                      
                      return (
                        <tr 
                          key={squad} 
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 sticky left-0 bg-zinc-900/95 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                              />
                              <span className="text-zinc-200 font-medium">{squad}</span>
                            </div>
                          </td>
                          {chartData.map((row) => {
                            const value = Number(row[squad]) || 0;
                            const prevIndex = chartData.indexOf(row) - 1;
                            const prevValue = prevIndex >= 0 ? (Number(chartData[prevIndex][squad]) || 0) : value;
                            const trend = value > prevValue ? "up" : value < prevValue ? "down" : "same";
                            
                            return (
                              <td key={row.mes} className="text-right py-3 px-4 font-mono">
                                <span className={cn(
                                  "text-zinc-300",
                                  trend === "up" && "text-emerald-400",
                                  trend === "down" && "text-rose-400"
                                )}>
                                  {formatCurrencyNoDecimals(value)}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-right py-3 px-4 font-mono font-semibold text-cyan-400 border-l border-zinc-700/50">
                            {formatCurrencyNoDecimals(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-600/50 bg-zinc-800/30">
                      <td className="py-3 px-4 sticky left-0 bg-zinc-800/95 backdrop-blur-sm text-zinc-200 font-semibold">
                        Total
                      </td>
                      {chartData.map((row) => {
                        const total = squads
                          .filter(s => squadSelecionado === "todos" || s === squadSelecionado)
                          .reduce((acc, squad) => acc + (Number(row[squad]) || 0), 0);
                        return (
                          <td key={row.mes} className="text-right py-3 px-4 font-mono font-semibold text-zinc-200">
                            {formatCurrencyNoDecimals(total)}
                          </td>
                        );
                      })}
                      <td className="text-right py-3 px-4 font-mono font-bold text-cyan-300 border-l border-zinc-700/50">
                        {formatCurrencyNoDecimals(
                          chartData.reduce((acc, row) => {
                            return acc + squads
                              .filter(s => squadSelecionado === "todos" || s === squadSelecionado)
                              .reduce((sum, squad) => sum + (Number(row[squad]) || 0), 0);
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === "operador" && chartData.length > 0 && (
        <div className="relative" data-testid="card-chart-by-operador">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-teal-500/5 to-emerald-500/5 rounded-xl blur-2xl" />
          <Card className="relative bg-zinc-900/80 border-zinc-700/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Activity className="h-4 w-4 text-cyan-400" />
                MRR por Operador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700/50">
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium sticky left-0 bg-zinc-900/95 backdrop-blur-sm">
                        Operador
                      </th>
                      {chartData.map((row) => (
                        <th key={row.mes} className="text-right py-3 px-4 text-zinc-400 font-medium whitespace-nowrap">
                          {row.mes}
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 text-cyan-400 font-semibold whitespace-nowrap border-l border-zinc-700/50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {operadores
                      .filter(op => operadorSelecionado === "todos" || op === operadorSelecionado)
                      .filter(op => chartData.reduce((acc, row) => acc + (Number(row[op]) || 0), 0) > 0)
                      .map((operador, i) => {
                      const color = getSquadColor(operador, i);
                      const total = chartData.reduce((acc, row) => acc + (Number(row[operador]) || 0), 0);
                      
                      return (
                        <tr 
                          key={operador} 
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 sticky left-0 bg-zinc-900/95 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                              />
                              <span className="text-zinc-200 font-medium">{operador}</span>
                            </div>
                          </td>
                          {chartData.map((row) => {
                            const value = Number(row[operador]) || 0;
                            const prevIndex = chartData.indexOf(row) - 1;
                            const prevValue = prevIndex >= 0 ? (Number(chartData[prevIndex][operador]) || 0) : value;
                            const trend = value > prevValue ? "up" : value < prevValue ? "down" : "same";
                            
                            return (
                              <td key={row.mes} className="text-right py-3 px-4 font-mono">
                                <span className={cn(
                                  "text-zinc-300",
                                  trend === "up" && "text-emerald-400",
                                  trend === "down" && "text-rose-400"
                                )}>
                                  {formatCurrencyNoDecimals(value)}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-right py-3 px-4 font-mono font-semibold text-cyan-400 border-l border-zinc-700/50">
                            {formatCurrencyNoDecimals(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-600/50 bg-zinc-800/30">
                      <td className="py-3 px-4 sticky left-0 bg-zinc-800/95 backdrop-blur-sm text-zinc-200 font-semibold">
                        Total
                      </td>
                      {chartData.map((row) => {
                        const total = operadores
                          .filter(op => operadorSelecionado === "todos" || op === operadorSelecionado)
                          .reduce((acc, op) => acc + (Number(row[op]) || 0), 0);
                        return (
                          <td key={row.mes} className="text-right py-3 px-4 font-mono font-semibold text-zinc-200">
                            {formatCurrencyNoDecimals(total)}
                          </td>
                        );
                      })}
                      <td className="text-right py-3 px-4 font-mono font-bold text-cyan-300 border-l border-zinc-700/50">
                        {formatCurrencyNoDecimals(
                          chartData.reduce((acc, row) => {
                            return acc + operadores
                              .filter(op => operadorSelecionado === "todos" || op === operadorSelecionado)
                              .reduce((sum, op) => sum + (Number(row[op]) || 0), 0);
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
