import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Line,
  Cell
} from "recharts";
import { 
  Handshake, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Target, 
  CalendarDays,
  Filter,
  RotateCcw,
  Percent,
  Repeat
} from "lucide-react";

interface CloserMetrics {
  mrrObtido: number;
  pontualObtido: number;
  reunioesRealizadas: number;
  negociosGanhos: number;
  taxaConversao: number;
}

interface Closer {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
}

interface ChartDataReunioesNegocios {
  closer: string;
  reunioes: number;
  negociosGanhos: number;
  taxaConversao: number;
}

interface ChartDataReceita {
  closer: string;
  mrr: number;
  pontual: number;
}

export default function DashboardClosers() {
  const [dataReuniaoInicio, setDataReuniaoInicio] = useState<string>("");
  const [dataReuniaoFim, setDataReuniaoFim] = useState<string>("");
  const [dataFechamentoInicio, setDataFechamentoInicio] = useState<string>("");
  const [dataFechamentoFim, setDataFechamentoFim] = useState<string>("");
  const [source, setSource] = useState<string>("all");
  const [pipeline, setPipeline] = useState<string>("all");
  const [closerId, setCloserId] = useState<string>("all");

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dataReuniaoInicio) params.append("dataReuniaoInicio", dataReuniaoInicio);
    if (dataReuniaoFim) params.append("dataReuniaoFim", dataReuniaoFim);
    if (dataFechamentoInicio) params.append("dataFechamentoInicio", dataFechamentoInicio);
    if (dataFechamentoFim) params.append("dataFechamentoFim", dataFechamentoFim);
    if (source && source !== "all") params.append("source", source);
    if (pipeline && pipeline !== "all") params.append("pipeline", pipeline);
    if (closerId && closerId !== "all") params.append("closerId", closerId);
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: closers } = useQuery<Closer[]>({
    queryKey: ["/api/closers/list"],
  });

  const { data: sources } = useQuery<string[]>({
    queryKey: ["/api/closers/sources"],
  });

  const { data: pipelines } = useQuery<string[]>({
    queryKey: ["/api/closers/pipelines"],
  });

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<CloserMetrics>({
    queryKey: ["/api/closers/metrics", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/metrics?${queryParams}`);
      return res.json();
    },
  });

  const { data: chartReunioesNegocios, isLoading: isLoadingChart1 } = useQuery<ChartDataReunioesNegocios[]>({
    queryKey: ["/api/closers/chart-reunioes-negocios", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-reunioes-negocios?${queryParams}`);
      return res.json();
    },
  });

  const { data: chartReceita, isLoading: isLoadingChart2 } = useQuery<ChartDataReceita[]>({
    queryKey: ["/api/closers/chart-receita", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-receita?${queryParams}`);
      return res.json();
    },
  });

  const clearFilters = () => {
    setDataReuniaoInicio("");
    setDataReuniaoFim("");
    setDataFechamentoInicio("");
    setDataFechamentoFim("");
    setSource("all");
    setPipeline("all");
    setCloserId("all");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  };

  const kpiCards = [
    {
      title: "MRR Obtido",
      value: metrics?.mrrObtido || 0,
      icon: Repeat,
      format: "currency",
      gradient: "from-emerald-500 to-teal-600",
      bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      title: "Pontual Obtido",
      value: metrics?.pontualObtido || 0,
      icon: DollarSign,
      format: "currency",
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      title: "Reuniões Realizadas",
      value: metrics?.reunioesRealizadas || 0,
      icon: Users,
      format: "number",
      gradient: "from-violet-500 to-purple-600",
      bgGradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600",
    },
    {
      title: "Negócios Ganhos",
      value: metrics?.negociosGanhos || 0,
      icon: Handshake,
      format: "number",
      gradient: "from-amber-500 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
    {
      title: "Taxa de Conversão",
      value: metrics?.taxaConversao || 0,
      icon: Target,
      format: "percent",
      gradient: "from-rose-500 to-pink-600",
      bgGradient: "from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-600",
    },
  ];

  const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <Handshake className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                Closers
              </h1>
              <p className="text-sm text-muted-foreground">
                Métricas e desempenho da equipe de vendas
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="border-border/50" data-testid="card-filters">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  Reunião Realizada (Início)
                </Label>
                <Input
                  type="date"
                  value={dataReuniaoInicio}
                  onChange={(e) => setDataReuniaoInicio(e.target.value)}
                  data-testid="input-data-reuniao-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  Reunião Realizada (Fim)
                </Label>
                <Input
                  type="date"
                  value={dataReuniaoFim}
                  onChange={(e) => setDataReuniaoFim(e.target.value)}
                  data-testid="input-data-reuniao-fim"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  Fechamento (Início)
                </Label>
                <Input
                  type="date"
                  value={dataFechamentoInicio}
                  onChange={(e) => setDataFechamentoInicio(e.target.value)}
                  data-testid="input-data-fechamento-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  Fechamento (Fim)
                </Label>
                <Input
                  type="date"
                  value={dataFechamentoFim}
                  onChange={(e) => setDataFechamentoFim(e.target.value)}
                  data-testid="input-data-fechamento-fim"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fonte</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger data-testid="select-source">
                    <SelectValue placeholder="Todas as fontes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as fontes</SelectItem>
                    {sources?.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pipeline</Label>
                <Select value={pipeline} onValueChange={setPipeline}>
                  <SelectTrigger data-testid="select-pipeline">
                    <SelectValue placeholder="Todos os pipelines" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pipelines</SelectItem>
                    {pipelines?.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Closer</Label>
                <Select value={closerId} onValueChange={setCloserId}>
                  <SelectTrigger data-testid="select-closer">
                    <SelectValue placeholder="Todos os closers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os closers</SelectItem>
                    {closers?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="w-full"
                  data-testid="button-clear-filters"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiCards.map((kpi, index) => (
            <Card 
              key={kpi.title}
              className={`border-0 bg-gradient-to-br ${kpi.bgGradient} shadow-sm`}
              data-testid={`card-kpi-${index}`}
            >
              <CardContent className="p-4">
                {isLoadingMetrics ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {kpi.title}
                      </span>
                      <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                        <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {kpi.format === "currency" 
                        ? formatCurrencyCompact(kpi.value)
                        : kpi.format === "percent"
                          ? `${kpi.value.toFixed(1)}%`
                          : kpi.value.toLocaleString("pt-BR")
                      }
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50" data-testid="card-chart-reunioes-negocios">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                Reuniões x Negócios por Closer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChart1 ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartReunioesNegocios || []}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="closer" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === "taxaConversao") return [`${value.toFixed(1)}%`, "Taxa de Conversão"];
                        return [value, name === "reunioes" ? "Reuniões" : "Negócios Ganhos"];
                      }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="reunioes" 
                      name="Reuniões" 
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="negociosGanhos" 
                      name="Negócios Ganhos" 
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="taxaConversao" 
                      name="Taxa de Conversão"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: "#f59e0b", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50" data-testid="card-chart-receita">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Receita MRR x Pontual por Closer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChart2 ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartReceita || []}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="closer" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="mrr" 
                      name="MRR" 
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="pontual" 
                      name="Pontual" 
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
