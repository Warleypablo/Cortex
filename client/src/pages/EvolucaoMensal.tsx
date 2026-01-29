import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Percent } from "lucide-react";
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
  Bar,
  BarChart,
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
  "Aurea": "#f59e0b",
  "Aurea (OFF)": "#fbbf24",
  "Black": "#1e293b",
  "Bloomfield": "#10b981",
  "Chama": "#ef4444",
  "Chama (OFF)": "#f87171",
  "Comunicação (OFF)": "#94a3b8",
  "Hunters": "#8b5cf6",
  "Hunters (OFF)": "#a78bfa",
  "Makers": "#06b6d4",
  "Pulse": "#ec4899",
  "Selva": "#22c55e",
  "Solar+ (OFF)": "#fcd34d",
  "Squadra": "#3b82f6",
  "Squad X": "#6366f1",
  "Supreme": "#8b5cf6",
  "Supreme (OFF)": "#a78bfa",
  "Tech": "#0ea5e9",
  "Tribo (OFF)": "#f97316",
  "Turbo Interno": "#64748b",
};

function getSquadColor(squad: string, index: number): string {
  if (SQUAD_COLORS[squad]) return SQUAD_COLORS[squad];
  const fallbackColors = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f43f5e", "#6366f1"
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
          <SelectTrigger className="w-[150px]" data-testid="select-view-mode">
            <SelectValue placeholder="Visão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="squad">Por Squad</SelectItem>
            <SelectItem value="operador">Por Operador</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={squadSelecionado} onValueChange={setSquadSelecionado}>
          <SelectTrigger className="w-[180px]" data-testid="select-squad">
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
            <SelectTrigger className="w-[200px]" data-testid="select-operador">
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
          <SelectTrigger className="w-[130px]" data-testid="select-meses">
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
        <Card data-testid="card-mrr-atual">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Atual</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrencyNoDecimals(totais.mrrAtual)}</div>
            <p className={cn(
              "text-xs mt-1 flex items-center gap-1",
              totais.variacaoMrr >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {totais.variacaoMrr >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {totais.variacaoMrr >= 0 ? "+" : ""}{formatCurrencyNoDecimals(totais.variacaoMrr)} vs mês anterior
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-variacao">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variação MRR</CardTitle>
            {totais.variacaoMrr >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              totais.variacaoMrr >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {totais.variacaoMrr >= 0 ? "+" : ""}{formatCurrencyNoDecimals(totais.variacaoMrr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Último mês
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-churn-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Churn Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrencyNoDecimals(totais.churnTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos {meses} meses
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-churn-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Churn</CardTitle>
            <Percent className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{totais.churnRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média do período
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-chart-main">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Evolução MRR e Churn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregatedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatCurrencyNoDecimals(value),
                    name === "mrr" ? "MRR" : "Churn"
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => <span className="text-xs text-muted-foreground">{value === "mrr" ? "MRR" : "Churn"}</span>}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="mrr"
                  name="mrr"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="churn" 
                  name="churn" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: "#ef4444", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, stroke: "#ef4444", strokeWidth: 2, fill: "hsl(var(--card))" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {viewMode === "squad" && chartData.length > 0 && (
        <Card data-testid="card-chart-by-squad">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              MRR por Squad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatCurrencyNoDecimals(value), name]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                  {squads.filter(s => squadSelecionado === "todos" || s === squadSelecionado).map((squad, i) => (
                    <Bar 
                      key={squad}
                      dataKey={squad}
                      name={squad}
                      stackId="a"
                      fill={getSquadColor(squad, i)}
                      radius={i === squads.filter(s => squadSelecionado === "todos" || s === squadSelecionado).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
