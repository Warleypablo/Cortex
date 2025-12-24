import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, TrendingDown, Users, DollarSign, Percent, AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight, Minus, Info, Flag, Rocket, Clock, CheckCircle2, XCircle, ChevronRight, Zap, BarChart3, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart, BarChart, Bar, Tooltip as RechartsTooltip, Legend } from "recharts";

interface DashboardMetrics {
  mrr_ativo: number;
  mrr_serie: { month: string; value: number }[];
  receita_total_ytd: number;
  receita_liquida_ytd: number;
  ebitda_ytd: number;
  geracao_caixa_ytd: number;
  caixa_atual: number;
  inadimplencia_percentual: number;
  gross_mrr_churn_percentual: number;
  net_churn_mrr_percentual: number | null;
  logo_churn_percentual: number | null;
  clientes_ativos: number;
  headcount: number;
  receita_por_head: number;
  mrr_por_head: number;
}

interface Targets {
  year: number;
  company: {
    mrr_ativo: Record<string, number>;
    receita_liquida_anual: number;
    ebitda_anual: number;
    inadimplencia_max: number;
    gross_mrr_churn_max: number;
    clientes_eoy: number;
  };
}

interface KR {
  id: string;
  title: string;
  metric_key: string;
  target_type: string;
  target: number | null;
  targets?: Record<string, number>;
  unit: string;
  direction: string;
  owner: string;
  atual: number | null;
  progress: number | null;
  status: "green" | "yellow" | "red" | "gray";
}

interface Objective {
  id: string;
  title: string;
  description: string;
  krs: KR[];
}

interface Initiative {
  id: string;
  objetivo: string;
  titulo: string;
  descricao_curta?: string;
  owner: string;
  bu: string;
  quarter: string;
  kr_vinculadas: string[];
  status: "backlog" | "doing" | "done" | "blocked";
  due_date: string;
  kpi_impact?: string;
  impacto_esperado: string;
  confianca: number;
  proximo_marco: string;
  notes?: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function getStatusColor(progress: number | null, hasTarget: boolean): { bg: string; text: string; border: string; status: "on-track" | "warning" | "off-track" | "no-target" } {
  if (!hasTarget || progress === null) {
    return { bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/20", status: "no-target" };
  }
  if (progress >= 90) {
    return { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20", status: "on-track" };
  }
  if (progress >= 70) {
    return { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/20", status: "warning" };
  }
  return { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20", status: "off-track" };
}

function StatusIndicator({ status }: { status: "on-track" | "warning" | "off-track" | "no-target" }) {
  const configs = {
    "on-track": { icon: CheckCircle2, label: "No alvo", color: "text-green-500" },
    "warning": { icon: AlertTriangle, label: "Atenção", color: "text-yellow-500" },
    "off-track": { icon: XCircle, label: "Fora do alvo", color: "text-red-500" },
    "no-target": { icon: Minus, label: "Sem meta", color: "text-slate-400" },
  };
  const config = configs[status];
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1 text-xs ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium">{config.label}</span>
    </div>
  );
}

function MetricCard({ title, value, target, format, direction, icon: Icon, tooltip, trend, onDrillDown, description }: {
  title: string;
  value: number | null;
  target: number | null;
  format: "currency" | "number" | "percent";
  direction: "higher" | "lower";
  icon: typeof TrendingUp;
  tooltip?: string;
  trend?: { value: number; label: string };
  onDrillDown?: () => void;
  description?: string;
}) {
  const formatValue = (v: number) => {
    if (format === "currency") return formatCurrency(v);
    if (format === "percent") return formatPercent(v);
    return formatNumber(v);
  };

  const progress = value !== null && target !== null && target > 0
    ? direction === "higher"
      ? Math.min(100, (value / target) * 100)
      : value <= target ? 100 : Math.max(0, 100 - ((value - target) / target) * 100)
    : null;

  const statusColors = getStatusColor(progress, target !== null);
  const hasInteraction = !!onDrillDown;

  return (
    <Card 
      className={`relative overflow-visible transition-all duration-200 ${hasInteraction ? "cursor-pointer hover-elevate" : ""} ${statusColors.border} border-l-4`}
      onClick={onDrillDown}
      data-testid={`card-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <div className={`p-1.5 rounded-md ${statusColors.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${statusColors.text}`} />
          </div>
          {title}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
        {hasInteraction && (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl font-bold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
            {value !== null ? formatValue(value) : "—"}
          </div>
          {trend && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trend.value >= 0 ? "text-green-500" : "text-red-500"}`}>
              {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend.value).toFixed(1)}%
              <span className="text-muted-foreground ml-0.5">{trend.label}</span>
            </div>
          )}
        </div>
        {target !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Meta: {formatValue(target)}</span>
              <StatusIndicator status={statusColors.status} />
            </div>
            {progress !== null && (
              <div className="relative">
                <Progress value={progress} className="h-2" />
                <div className="absolute right-0 -top-0.5 text-[10px] font-medium text-muted-foreground">
                  {progress.toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "green" | "yellow" | "red" | "gray" }) {
  const config = {
    green: { label: "No alvo", className: "bg-green-500/10 text-green-600 border-green-500/20" },
    yellow: { label: "Atenção", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    red: { label: "Fora do alvo", className: "bg-red-500/10 text-red-600 border-red-500/20" },
    gray: { label: "Sem dados", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = config[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function InitiativeStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: typeof Rocket; className: string }> = {
    backlog: { label: "Backlog", icon: Clock, className: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
    doing: { label: "Em andamento", icon: Rocket, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    done: { label: "Concluído", icon: CheckCircle2, className: "bg-green-500/10 text-green-600 border-green-500/20" },
    blocked: { label: "Bloqueado", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
  };
  const { label, icon: Icon, className } = config[status] || config.backlog;
  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

interface DrillDownData {
  title: string;
  value: number;
  target: number | null;
  format: "currency" | "number" | "percent";
  description: string;
  insights: string[];
  chartData?: { month: string; value: number }[];
}

function MetricDrillDownModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: DrillDownData | null }) {
  if (!data) return null;
  
  const formatValue = (v: number) => {
    if (data.format === "currency") return formatCurrency(v);
    if (data.format === "percent") return formatPercent(v);
    return formatNumber(v);
  };

  const progress = data.target !== null && data.target > 0 
    ? Math.min(100, (data.value / data.target) * 100)
    : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {data.title}
          </DialogTitle>
          <DialogDescription>{data.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Valor Atual</div>
                <div className="text-3xl font-bold mt-1">{formatValue(data.value)}</div>
              </CardContent>
            </Card>
            {data.target !== null && (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Meta</div>
                  <div className="text-3xl font-bold mt-1">{formatValue(data.target)}</div>
                  {progress !== null && (
                    <div className="mt-2">
                      <Progress value={progress} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% atingido</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {data.chartData && data.chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evolução Histórica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.chartData}>
                      <defs>
                        <linearGradient id="drilldownGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => data.format === "currency" ? `${(v/1000000).toFixed(1)}M` : String(v)} tick={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#drilldownGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {data.insights.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Activity className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HealthScore({ metrics, targets }: { metrics: DashboardMetrics; targets: Targets }) {
  const quarter = getCurrentQuarter();
  const mrrTarget = targets.company.mrr_ativo[quarter];
  
  const scores: { label: string; score: number; weight: number }[] = [
    { 
      label: "MRR", 
      score: mrrTarget > 0 ? Math.min(100, (metrics.mrr_ativo / mrrTarget) * 100) : 0,
      weight: 25
    },
    { 
      label: "Receita", 
      score: targets.company.receita_liquida_anual > 0 ? Math.min(100, (metrics.receita_liquida_ytd / targets.company.receita_liquida_anual) * 100) : 0,
      weight: 20
    },
    { 
      label: "EBITDA", 
      score: targets.company.ebitda_anual > 0 ? Math.min(100, (metrics.ebitda_ytd / targets.company.ebitda_anual) * 100) : 0,
      weight: 20
    },
    { 
      label: "Clientes", 
      score: targets.company.clientes_eoy > 0 ? Math.min(100, (metrics.clientes_ativos / targets.company.clientes_eoy) * 100) : 0,
      weight: 15
    },
    { 
      label: "Inadimplência", 
      score: metrics.inadimplencia_percentual <= targets.company.inadimplencia_max ? 100 : Math.max(0, 100 - ((metrics.inadimplencia_percentual - targets.company.inadimplencia_max) * 10)),
      weight: 10
    },
    { 
      label: "Churn", 
      score: metrics.gross_mrr_churn_percentual <= targets.company.gross_mrr_churn_max ? 100 : Math.max(0, 100 - ((metrics.gross_mrr_churn_percentual - targets.company.gross_mrr_churn_max) * 5)),
      weight: 10
    },
  ];

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const overallScore = scores.reduce((sum, s) => sum + (s.score * s.weight), 0) / totalWeight;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Health Score Geral
          </span>
          <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore.toFixed(0)}%
          </span>
        </CardTitle>
        <CardDescription>Saúde geral dos OKRs baseado em pesos das métricas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {scores.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className={`font-medium ${getScoreColor(s.score)}`}>{s.score.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${getScoreBg(s.score)} rounded-full transition-all`} style={{ width: `${Math.min(100, s.score)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardTab() {
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const { data, isLoading } = useQuery<{ metrics: DashboardMetrics; targets: Targets }>({
    queryKey: ["/api/okr2026/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { metrics, targets } = data || { metrics: null, targets: null };
  if (!metrics || !targets) return null;

  const quarter = getCurrentQuarter();
  const mrrTarget = targets.company.mrr_ativo[quarter];

  const openMrrDrillDown = () => {
    setDrillDownData({
      title: "MRR Ativo",
      value: metrics.mrr_ativo,
      target: mrrTarget,
      format: "currency",
      description: "Monthly Recurring Revenue - receita mensal recorrente de contratos ativos",
      chartData: metrics.mrr_serie,
      insights: [
        metrics.mrr_serie.length >= 2 
          ? `Variação mensal: ${((metrics.mrr_serie[metrics.mrr_serie.length-1]?.value / metrics.mrr_serie[metrics.mrr_serie.length-2]?.value - 1) * 100).toFixed(1)}%`
          : "Dados insuficientes para calcular variação",
        `Média últimos 3 meses: ${formatCurrency(metrics.mrr_serie.slice(-3).reduce((s,m) => s + m.value, 0) / 3)}`,
        `Meta ${quarter}: ${formatCurrency(mrrTarget)} (${((metrics.mrr_ativo / mrrTarget) * 100).toFixed(1)}% atingido)`
      ]
    });
  };

  const openReceitaDrillDown = () => {
    const currentMonth = new Date().getMonth() + 1;
    const projecaoAnual = currentMonth > 0 ? (metrics.receita_liquida_ytd * 12) / currentMonth : 0;
    setDrillDownData({
      title: "Receita Líquida YTD",
      value: metrics.receita_liquida_ytd,
      target: targets.company.receita_liquida_anual,
      format: "currency",
      description: "Receita líquida acumulada no ano (Year-to-Date)",
      insights: [
        `Receita por colaborador: ${formatCurrency(metrics.receita_por_head)}/mês`,
        `Projeção anual linear: ${formatCurrency(projecaoAnual)}`,
        `Gap para meta: ${formatCurrency(targets.company.receita_liquida_anual - metrics.receita_liquida_ytd)}`
      ]
    });
  };

  const openEbitdaDrillDown = () => {
    const currentMonth = new Date().getMonth() + 1;
    const projecaoAnual = currentMonth > 0 ? (metrics.ebitda_ytd * 12) / currentMonth : 0;
    const margemEbitda = metrics.receita_liquida_ytd > 0 ? ((metrics.ebitda_ytd / metrics.receita_liquida_ytd) * 100) : 0;
    setDrillDownData({
      title: "EBITDA YTD",
      value: metrics.ebitda_ytd,
      target: targets.company.ebitda_anual,
      format: "currency",
      description: "Lucro antes de juros, impostos, depreciação e amortização",
      insights: [
        `Margem EBITDA: ${margemEbitda.toFixed(1)}%`,
        `Projeção anual linear: ${formatCurrency(projecaoAnual)}`,
        `Gap para meta: ${formatCurrency(targets.company.ebitda_anual - metrics.ebitda_ytd)}`
      ]
    });
  };

  return (
    <div className="space-y-6">
      <MetricDrillDownModal 
        open={drillDownData !== null} 
        onClose={() => setDrillDownData(null)} 
        data={drillDownData} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="MRR Ativo"
          value={metrics.mrr_ativo}
          target={mrrTarget}
          format="currency"
          direction="higher"
          icon={TrendingUp}
          tooltip={`Meta ${quarter}: ${formatCurrency(mrrTarget)}`}
          onDrillDown={openMrrDrillDown}
          description="Clique para ver evolução"
        />
        <MetricCard
          title="Receita Líquida YTD"
          value={metrics.receita_liquida_ytd}
          target={targets.company.receita_liquida_anual}
          format="currency"
          direction="higher"
          icon={DollarSign}
          onDrillDown={openReceitaDrillDown}
          description="Clique para ver detalhes"
        />
        <MetricCard
          title="EBITDA YTD"
          value={metrics.ebitda_ytd}
          target={targets.company.ebitda_anual}
          format="currency"
          direction="higher"
          icon={TrendingUp}
          onDrillDown={openEbitdaDrillDown}
          description="Clique para ver análise"
        />
        <MetricCard
          title="Caixa Atual"
          value={metrics.caixa_atual}
          target={null}
          format="currency"
          direction="higher"
          icon={DollarSign}
          tooltip="Saldo disponível em contas bancárias"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Clientes Ativos"
          value={metrics.clientes_ativos}
          target={targets.company.clientes_eoy}
          format="number"
          direction="higher"
          icon={Users}
          tooltip="Clientes com contratos ativos, onboarding ou triagem"
        />
        <MetricCard
          title="Inadimplência"
          value={metrics.inadimplencia_percentual}
          target={targets.company.inadimplencia_max}
          format="percent"
          direction="lower"
          icon={AlertTriangle}
          tooltip="Meta: máximo 6%. Parcelas vencidas / receita mensal"
        />
        <MetricCard
          title="Gross MRR Churn"
          value={metrics.gross_mrr_churn_percentual}
          target={targets.company.gross_mrr_churn_max}
          format="percent"
          direction="lower"
          icon={TrendingDown}
          tooltip="Meta: máximo 9.7%. Contratos encerrados / MRR anterior"
        />
        <MetricCard
          title="Headcount"
          value={metrics.headcount}
          target={null}
          format="number"
          direction="higher"
          icon={Users}
          tooltip="Total de colaboradores ativos"
        />
      </div>

      {metrics.mrr_serie && metrics.mrr_serie.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do MRR</CardTitle>
            <CardDescription>Últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.mrr_serie}>
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#mrrGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HealthScore metrics={metrics} targets={targets} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Eficiência por Head
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Receita / Head</span>
              <span className="font-semibold">{formatCurrency(metrics.receita_por_head)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">MRR / Head</span>
              <span className="font-semibold">{formatCurrency(metrics.mrr_por_head)}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="text-xs text-muted-foreground">Benchmark: R$ 15.000/head</div>
              <Progress value={Math.min(100, (metrics.receita_por_head / 15000) * 100)} className="h-1.5 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Em Instrumentação
            </CardTitle>
            <CardDescription>Métricas pendentes de integração</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>Net Churn MRR</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>Logo Churn %</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>TurboOH Receita</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>Padronização %</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ObjectiveSummary({ objectives }: { objectives: Objective[] }) {
  const allKRs = objectives.flatMap(o => o.krs);
  const greenCount = allKRs.filter(kr => kr.status === "green").length;
  const yellowCount = allKRs.filter(kr => kr.status === "yellow").length;
  const redCount = allKRs.filter(kr => kr.status === "red").length;
  const grayCount = allKRs.filter(kr => kr.status === "gray").length;
  const avgProgress = allKRs.filter(kr => kr.progress !== null).reduce((sum, kr) => sum + (kr.progress || 0), 0) / 
    (allKRs.filter(kr => kr.progress !== null).length || 1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-500">{greenCount}</div>
              <div className="text-xs text-muted-foreground">No alvo</div>
            </div>
            <CheckCircle2 className="w-6 h-6 text-green-500/50" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-yellow-500">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-yellow-500">{yellowCount}</div>
              <div className="text-xs text-muted-foreground">Atenção</div>
            </div>
            <AlertTriangle className="w-6 h-6 text-yellow-500/50" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-red-500">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-500">{redCount}</div>
              <div className="text-xs text-muted-foreground">Fora do alvo</div>
            </div>
            <XCircle className="w-6 h-6 text-red-500/50" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-slate-400">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-400">{grayCount}</div>
              <div className="text-xs text-muted-foreground">Sem dados</div>
            </div>
            <Minus className="w-6 h-6 text-slate-400/50" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{avgProgress.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Progresso médio</div>
            </div>
            <Activity className="w-6 h-6 text-primary/50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KRRow({ kr, formatKRValue, formatKRTarget }: { kr: KR; formatKRValue: (kr: KR) => string; formatKRTarget: (kr: KR) => string }) {
  const statusColors = {
    green: { bg: "bg-green-500/5", border: "border-l-green-500", icon: CheckCircle2, iconColor: "text-green-500" },
    yellow: { bg: "bg-yellow-500/5", border: "border-l-yellow-500", icon: AlertTriangle, iconColor: "text-yellow-500" },
    red: { bg: "bg-red-500/5", border: "border-l-red-500", icon: XCircle, iconColor: "text-red-500" },
    gray: { bg: "bg-muted/30", border: "border-l-slate-400", icon: Minus, iconColor: "text-slate-400" },
  };
  const style = statusColors[kr.status];
  const StatusIcon = style.icon;

  return (
    <div className={`p-4 rounded-lg ${style.bg} border-l-4 ${style.border} transition-all hover-elevate`} data-testid={`row-kr-${kr.id}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusIcon className={`w-4 h-4 ${style.iconColor}`} />
            <span className="font-semibold text-sm">{kr.id}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">{kr.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{kr.owner}</Badge>
            {kr.target_type === "quarterly" && (
              <Badge variant="outline" className="text-xs">{getCurrentQuarter()}</Badge>
            )}
            <span className={`text-xs font-medium ${style.iconColor}`}>
              {kr.direction === "higher" ? "↑ Maior melhor" : "↓ Menor melhor"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right min-w-[100px]">
            <div className="font-bold text-lg">{formatKRValue(kr)}</div>
            <div className="text-xs text-muted-foreground">Meta: {formatKRTarget(kr)}</div>
          </div>
          <div className="w-32 space-y-1">
            {kr.progress !== null && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className={`font-medium ${style.iconColor}`}>{kr.progress.toFixed(0)}%</span>
                </div>
                <Progress value={kr.progress} className="h-2" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KRsTab() {
  const { data, isLoading } = useQuery<{ objectives: Objective[] }>({
    queryKey: ["/api/okr2026/krs"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  const objectives = data?.objectives || [];

  const formatKRValue = (kr: KR) => {
    if (kr.atual === null) return "—";
    if (kr.unit === "currency") return formatCurrency(kr.atual);
    if (kr.unit === "percentage") return formatPercent(kr.atual);
    return formatNumber(kr.atual);
  };

  const formatKRTarget = (kr: KR) => {
    const target = kr.target_type === "quarterly" && kr.targets
      ? kr.targets[getCurrentQuarter()]
      : kr.target;
    if (target === null || target === undefined) return "—";
    if (kr.unit === "currency") return formatCurrency(target);
    if (kr.unit === "percentage") return formatPercent(target);
    return formatNumber(target);
  };

  const getObjectiveProgress = (obj: Objective) => {
    const krsWithProgress = obj.krs.filter(kr => kr.progress !== null);
    if (krsWithProgress.length === 0) return null;
    return krsWithProgress.reduce((sum, kr) => sum + (kr.progress || 0), 0) / krsWithProgress.length;
  };

  return (
    <div className="space-y-6">
      <ObjectiveSummary objectives={objectives} />
      
      {objectives.map((obj) => {
        const objProgress = getObjectiveProgress(obj);
        const greenKRs = obj.krs.filter(kr => kr.status === "green").length;
        const totalKRs = obj.krs.length;
        
        return (
          <Card key={obj.id} data-testid={`card-objective-${obj.id}`}>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                    {obj.id}: {obj.title}
                  </CardTitle>
                  <CardDescription className="mt-1">{obj.description}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Progresso Objetivo</div>
                    <div className="text-lg font-bold">{objProgress !== null ? `${objProgress.toFixed(0)}%` : "—"}</div>
                  </div>
                  <Badge variant={greenKRs === totalKRs ? "default" : "secondary"} className="text-xs">
                    {greenKRs}/{totalKRs} KRs no alvo
                  </Badge>
                </div>
              </div>
              {objProgress !== null && (
                <Progress value={objProgress} className="h-1.5 mt-3" />
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {obj.krs.map((kr) => (
                <KRRow key={kr.id} kr={kr} formatKRValue={formatKRValue} formatKRTarget={formatKRTarget} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function InitiativesTab() {
  const { data, isLoading } = useQuery<{ initiatives: Initiative[] }>({
    queryKey: ["/api/okr2026/initiatives"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const initiatives = data?.initiatives || [];

  const statusOrder = { doing: 0, blocked: 1, backlog: 2, done: 3 };
  const sortedInitiatives = [...initiatives].sort((a, b) => 
    (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  );

  const doingCount = initiatives.filter((i) => i.status === "doing").length;
  const backlogCount = initiatives.filter((i) => i.status === "backlog").length;
  const avgConfianca = initiatives.length > 0
    ? initiatives.reduce((sum, i) => sum + i.confianca, 0) / initiatives.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{doingCount}</div>
                <div className="text-sm text-muted-foreground">Em andamento</div>
              </div>
              <Rocket className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{backlogCount}</div>
                <div className="text-sm text-muted-foreground">No backlog</div>
              </div>
              <Clock className="w-8 h-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{avgConfianca.toFixed(0)}%</div>
                <div className="text-sm text-muted-foreground">Confiança média</div>
              </div>
              <Flag className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {sortedInitiatives.map((ini) => (
          <Card key={ini.id} className="hover-elevate" data-testid={`card-initiative-${ini.id}`}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium">{ini.id}</span>
                    <span className="text-muted-foreground">—</span>
                    <span className="font-medium">{ini.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    <Badge variant="outline">{ini.owner}</Badge>
                    <Badge variant="secondary">{ini.bu}</Badge>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(ini.due_date).toLocaleDateString("pt-BR")}
                    </span>
                    <span>|</span>
                    <span>KRs: {ini.kr_vinculadas.join(", ")}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Próximo marco: </span>
                    <span>{ini.proximo_marco}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <InitiativeStatusBadge status={ini.status} />
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground">Confiança:</span>
                    <span className={`font-medium ${ini.confianca >= 70 ? "text-green-500" : ini.confianca >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                      {ini.confianca}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function OKR2026() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="h-full overflow-auto p-6" data-testid="page-okr-2026">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Target className="w-8 h-8 text-primary" />
              OKR 2026
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhamento de Objetivos e Key Results
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {getCurrentQuarter()} 2026
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="krs" data-testid="tab-krs">
              KRs
            </TabsTrigger>
            <TabsTrigger value="initiatives" data-testid="tab-initiatives">
              Iniciativas
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="dashboard" className="mt-0">
              <DashboardTab />
            </TabsContent>
            <TabsContent value="krs" className="mt-0">
              <KRsTab />
            </TabsContent>
            <TabsContent value="initiatives" className="mt-0">
              <InitiativesTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
