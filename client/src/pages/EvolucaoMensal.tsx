import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import {
  BarChart,
  Bar,
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
        let totalChurn = 0;
        
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
        totalChurn = churnTotal;
        
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
      
      return {
        mes: formatMesLabel(mes),
        mesOriginal: mes,
        mrr: totalMrr,
        churn: churnTotal,
        churnsCount,
        contratos: totalContratos,
      };
    });
  }, [data, squadSelecionado, operadorSelecionado]);

  const totais = useMemo(() => {
    if (!aggregatedData.length) return { mrrAtual: 0, churnTotal: 0, variacaoMrr: 0 };
    
    const ultimo = aggregatedData[aggregatedData.length - 1];
    const penultimo = aggregatedData.length > 1 ? aggregatedData[aggregatedData.length - 2] : null;
    
    const variacaoMrr = penultimo ? ultimo.mrr - penultimo.mrr : 0;
    const churnTotal = aggregatedData.reduce((acc, d) => acc + d.churn, 0);
    
    return {
      mrrAtual: ultimo.mrr,
      churnTotal,
      variacaoMrr,
    };
  }, [aggregatedData]);

  const squads = data?.squads || [];
  const operadores = data?.operadores || [];

  const COLORS = [
    "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", 
    "#ec4899", "#06b6d4", "#84cc16", "#f43f5e", "#6366f1"
  ];

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
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="evolucao-mensal-page">
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as "squad" | "operador")}>
          <SelectTrigger className="w-[160px]" data-testid="select-view-mode">
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
          <SelectTrigger className="w-[140px]" data-testid="select-meses">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-mrr-atual">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Atual</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyNoDecimals(totais.mrrAtual)}</div>
            <p className={cn(
              "text-xs mt-1",
              totais.variacaoMrr >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {totais.variacaoMrr >= 0 ? "+" : ""}{formatCurrencyNoDecimals(totais.variacaoMrr)} vs mês anterior
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-churn-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Churn Total (período)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrencyNoDecimals(totais.churnTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos {meses} meses
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-variacao">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variação MRR</CardTitle>
            {totais.variacaoMrr >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              totais.variacaoMrr >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {totais.variacaoMrr >= 0 ? "+" : ""}{formatCurrencyNoDecimals(totais.variacaoMrr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Último mês
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-chart-main">
        <CardHeader>
          <CardTitle className="text-lg">Evolução MRR e Churn</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatCurrencyNoDecimals(value),
                    name === "mrr" ? "MRR" : "Churn"
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="mrr" 
                  name="MRR" 
                  fill="#f97316" 
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="churn" 
                  name="Churn" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  dot={{ fill: "#ef4444", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {viewMode === "squad" && chartData.length > 0 && (
        <Card data-testid="card-chart-by-squad">
          <CardHeader>
            <CardTitle className="text-lg">MRR por Squad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrencyNoDecimals(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  {squads.filter(s => squadSelecionado === "todos" || s === squadSelecionado).map((squad, i) => (
                    <Bar 
                      key={squad}
                      dataKey={squad}
                      name={squad}
                      stackId="a"
                      fill={COLORS[i % COLORS.length]}
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
