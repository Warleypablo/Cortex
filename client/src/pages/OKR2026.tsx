import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Target, TrendingUp, DollarSign, AlertTriangle, AlertCircle,
  ArrowUpRight, Info, Rocket, Clock, CheckCircle2, 
  XCircle, Banknote, PiggyBank,
  CreditCard, TrendingDown as TrendingDownIcon, MonitorPlay, Users, Heart, Building
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  LineChart, Line
} from "recharts";

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
  turbooh_receita: number | null;
  turbooh_receita_liquida_ytd: number | null;
  turbooh_resultado: number | null;
  turbooh_resultado_ytd: number | null;
  turbooh_margem_pct: number | null;
  turbooh_vacancy_pct: number | null;
  tech_projetos_entregues: number;
  tech_freelancers_custo: number;
  tech_freelancers_percentual: number;
  new_mrr: number;
  new_mrr_ytd: number;
  expansion_mrr: number;
  expansion_mrr_ytd: number | null;
}

interface Objective {
  id: string;
  title: string;
  ownerRole?: string;
  narrative?: string;
  subtitle?: string;
  order?: number;
}

interface KR {
  id: string;
  objectiveId: string;
  title: string;
  metricKey: string;
  operator?: string;
  cadence?: string;
  targetType?: string;
  targets: Record<string, number>;
  description?: string;
  owner?: string;
  status: "green" | "yellow" | "red" | "gray";
  unit: string;
  direction: string;
  aggregation?: string;
  currentValue: number | null;
  target: number | null;
  progress: number | null;
  quarterValues?: {
    Q1?: { atual: number | null; meta: number };
    Q2?: { atual: number | null; meta: number };
    Q3?: { atual: number | null; meta: number };
    Q4?: { atual: number | null; meta: number };
  };
}

interface Initiative {
  id: string;
  objectiveId: string;
  name?: string;
  title?: string;
  ownerRole?: string;
  owner_email?: string;
  start?: string;
  end?: string;
  quarter?: string;
  status: string;
  type?: string;
  krIds?: string[];
  krs?: string[];
  tags?: string[];
  successMetricKeys?: string[];
  successKpi?: string;
  notes?: string;
}

interface Highlights {
  mrr: { value: number; target: number | null; progress: number | null };
  revenue: { value: number; target: number | null; progress: number | null };
  ebitda: { value: number; target: number | null; progress: number | null };
  inadimplencia: { value: number; target: number | null; status: string };
  net_churn: { value: number | null; target: number | null; status: string };
}

interface Series {
  mrr: { month: string; value: number }[];
  ebitda: { month: string; value: number }[];
  churn: { month: string; value: number }[];
}

interface SummaryResponse {
  objectives: Objective[];
  krs: KR[];
  metrics: DashboardMetrics;
  initiatives: Initiative[];
  highlights: Highlights;
  series: Series;
  meta: {
    generatedAt: string;
    period: string;
    bu: string;
    cacheHit: boolean;
  };
}

interface Collaborator {
  id: number;
  name: string;
  email: string;
  setor: string;
}

interface CollaboratorsResponse {
  collaborators: Collaborator[];
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function getCurrentQuarter(): "Q1" | "Q2" | "Q3" | "Q4" {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function getQuarterLabel(quarter: string): string {
  const labels: Record<string, string> = {
    Q1: "Jan-Mar",
    Q2: "Abr-Jun",
    Q3: "Jul-Set",
    Q4: "Out-Dez"
  };
  return labels[quarter] || quarter;
}

function getKRStatus(
  atual: number | null,
  meta: number,
  direction: string
): "green" | "yellow" | "red" | "gray" {
  if (atual === null) return "gray";
  
  if (direction === "lte") {
    if (atual <= meta) return "green";
    const overshoot = ((atual - meta) / meta) * 100;
    if (overshoot <= 10) return "yellow";
    return "red";
  } else {
    const progress = (atual / meta) * 100;
    if (progress >= 100) return "green";
    if (progress >= 90) return "yellow";
    return "red";
  }
}

interface SparklineData {
  month: string;
  value: number;
}

function Sparkline({ 
  data, 
  height = 32 
}: { 
  data: SparklineData[]; 
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const lastSix = data.slice(-6);
  const firstValue = lastSix[0]?.value ?? 0;
  const lastValue = lastSix[lastSix.length - 1]?.value ?? 0;
  
  const gradientId = `sparklineGradient-${Math.round(firstValue)}-${Math.round(lastValue)}-${lastSix.length}`;
  
  let trendColor = "hsl(var(--muted-foreground))";
  let fillColor = "hsl(var(--muted-foreground))";
  
  if (lastValue > firstValue) {
    trendColor = "#22c55e";
    fillColor = "#22c55e";
  } else if (lastValue < firstValue) {
    trendColor = "#ef4444";
    fillColor = "#ef4444";
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={lastSix} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={trendColor}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HeroCard({ 
  title, 
  value, 
  target, 
  format, 
  direction = "higher",
  icon: Icon, 
  tooltip,
  status,
  quarterLabel,
  series
}: {
  title: string;
  value: number | null;
  target: number | null;
  format: "currency" | "number" | "percent";
  direction?: "higher" | "lower";
  icon: typeof TrendingUp;
  tooltip?: string;
  status?: "green" | "yellow" | "red";
  quarterLabel?: string;
  series?: SparklineData[];
}) {
  const formatValue = (v: number) => {
    if (format === "currency") return formatCurrency(v);
    if (format === "percent") return formatPercent(v);
    return formatNumber(v);
  };

  let progress: number | null = null;
  if (value !== null && target !== null && target > 0) {
    if (direction === "higher") {
      progress = Math.min(100, (value / target) * 100);
    } else {
      progress = value <= target ? 100 : Math.max(0, 100 - ((value - target) / target) * 100);
    }
  }

  const getStatusColor = () => {
    if (status === "green") return { bg: "bg-green-500/10", border: "border-l-green-500", text: "text-green-600 dark:text-green-400" };
    if (status === "yellow") return { bg: "bg-yellow-500/10", border: "border-l-yellow-500", text: "text-yellow-600 dark:text-yellow-400" };
    if (status === "red") return { bg: "bg-red-500/10", border: "border-l-red-500", text: "text-red-600 dark:text-red-400" };
    
    if (progress === null) return { bg: "bg-muted/50", border: "border-l-muted-foreground/30", text: "text-muted-foreground" };
    if (progress >= 90) return { bg: "bg-green-500/10", border: "border-l-green-500", text: "text-green-600 dark:text-green-400" };
    if (progress >= 70) return { bg: "bg-yellow-500/10", border: "border-l-yellow-500", text: "text-yellow-600 dark:text-yellow-400" };
    return { bg: "bg-red-500/10", border: "border-l-red-500", text: "text-red-600 dark:text-red-400" };
  };

  const colors = getStatusColor();

  const getAlertStatus = (): "critical" | "warning" | null => {
    if (status === "red") return "critical";
    if (status === "yellow") return "warning";
    if (progress !== null) {
      if (progress < 90) return "critical";
      if (progress < 100) return "warning";
    }
    return null;
  };

  const alertStatus = getAlertStatus();

  return (
    <Card 
      className={`relative overflow-visible border-l-4 ${colors.border}`}
      data-testid={`card-hero-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <div className={`p-1.5 rounded-md ${colors.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
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
        <div className="flex items-center gap-1.5">
          {alertStatus === "critical" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" data-testid={`alert-critical-${title.toLowerCase().replace(/\s+/g, "-")}`} />
              </TooltipTrigger>
              <TooltipContent>Métrica crítica: abaixo de 90% da meta</TooltipContent>
            </Tooltip>
          )}
          {alertStatus === "warning" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="w-4 h-4 text-yellow-500" data-testid={`alert-warning-${title.toLowerCase().replace(/\s+/g, "-")}`} />
              </TooltipTrigger>
              <TooltipContent>Atenção: entre 90-99% da meta</TooltipContent>
            </Tooltip>
          )}
          {quarterLabel && (
            <Badge variant="outline" className="text-[10px]">{quarterLabel}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {value !== null ? formatValue(value) : "—"}
        </div>
        {target !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Meta: {formatValue(target)}</span>
              {progress !== null && (
                <span className={`font-medium ${colors.text}`}>{progress.toFixed(0)}%</span>
              )}
            </div>
            {progress !== null && (
              <Progress value={progress} className="h-1.5" />
            )}
          </div>
        )}
        {series && series.length >= 2 && (
          <div className="pt-1">
            <Sparkline data={series} height={32} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TurboOHBlock({ metrics, quarter }: { metrics: DashboardMetrics; quarter: string }) {
  const receitaOH = metrics.turbooh_receita;
  const resultadoOH = metrics.turbooh_resultado;
  const vacancyPct = metrics.turbooh_vacancy_pct;
  
  const vacancyStatus = vacancyPct !== null 
    ? (vacancyPct <= 10 ? "green" : vacancyPct <= 20 ? "yellow" : "red")
    : null;
  
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorPlay className="w-5 h-5 text-primary" />
            TurboOH
          </CardTitle>
          <Badge variant="outline">{quarter}</Badge>
        </div>
        <CardDescription>Performance do segmento Out-of-Home</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Receita Líquida OH</div>
            <div className="text-xl font-bold">
              {receitaOH !== null ? formatCurrency(receitaOH) : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Resultado OH</div>
            <div className="text-xl font-bold">
              {resultadoOH !== null ? formatCurrency(resultadoOH) : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              Vacância %
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Meta: {"<="} 10%</TooltipContent>
              </Tooltip>
            </div>
            {vacancyPct !== null ? (
              <div className={`text-xl font-bold ${
                vacancyStatus === "green" ? "text-green-600 dark:text-green-400" : 
                vacancyStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" : 
                "text-red-600 dark:text-red-400"
              }`}>
                {formatPercent(vacancyPct)}
              </div>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Em instrumentação
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HugzBlock({ 
  metrics, 
  initiatives 
}: { 
  metrics: DashboardMetrics; 
  initiatives: Initiative[] 
}) {
  const hugzInitiatives = initiatives.filter(i => 
    i.objectiveId === "O3" || 
    (i.tags && i.tags.includes("hugz"))
  );
  
  const doingCount = hugzInitiatives.filter(i => 
    i.status === "doing" || i.status === "in_progress"
  ).length;
  const blockedCount = hugzInitiatives.filter(i => i.status === "blocked").length;
  
  const inadPct = metrics.inadimplencia_percentual ?? 0;
  const churnPct = metrics.net_churn_mrr_percentual ?? 0;
  
  const inadStatus = inadPct <= 6 ? "green" : inadPct <= 7 ? "yellow" : "red";
  const churnStatus = churnPct <= 9 ? "green" : churnPct <= 10 ? "yellow" : "red";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          Hugz — Saúde da Receita
        </CardTitle>
        <CardDescription>Monitoramento de inadimplência e churn</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Inadimplência %</div>
            <div className={`text-xl font-bold ${
              inadStatus === "green" ? "text-green-600 dark:text-green-400" :
              inadStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`}>
              {formatPercent(metrics.inadimplencia_percentual)}
            </div>
            <div className="text-xs text-muted-foreground">Meta: {"<="} 6%</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Net Churn %</div>
            <div className={`text-xl font-bold ${
              churnStatus === "green" ? "text-green-600 dark:text-green-400" :
              churnStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`}>
              {metrics.net_churn_mrr_percentual !== null 
                ? formatPercent(metrics.net_churn_mrr_percentual) 
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Meta: {"<="} 9%</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Logo Churn %</div>
            <div className="text-xl font-bold">
              {metrics.logo_churn_percentual !== null 
                ? formatPercent(metrics.logo_churn_percentual) 
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Meta: {"<="} 10%</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Iniciativas Hugz</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Rocket className="w-3 h-3 mr-1" />
                {doingCount} doing
              </Badge>
              {blockedCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                  <XCircle className="w-3 h-3 mr-1" />
                  {blockedCount} blocked
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MRRChart({ data }: { data: { month: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evolução MRR</CardTitle>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center text-muted-foreground">
          Sem dados disponíveis
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Evolução MRR
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} width={50} />
              <RechartsTooltip 
                formatter={(value: number) => [formatCurrency(value), "MRR"]}
                labelFormatter={(label) => `Mês: ${label}`}
              />
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
  );
}

function StatusBadge({ status }: { status: "green" | "yellow" | "red" | "gray" }) {
  const config = {
    green: { label: "No alvo", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
    yellow: { label: "Atenção", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
    red: { label: "Fora do alvo", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
    gray: { label: "Em instrumentação", className: "bg-muted text-muted-foreground border-muted" },
  };
  const { label, className } = config[status] || config.gray;
  return (
    <Badge variant="outline" className={`${className} text-xs`}>
      {label}
    </Badge>
  );
}

function InitiativeStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: typeof Rocket; className: string }> = {
    planned: { label: "Planejado", icon: Clock, className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
    not_started: { label: "Backlog", icon: Clock, className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
    doing: { label: "Em andamento", icon: Rocket, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    in_progress: { label: "Em andamento", icon: Rocket, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    done: { label: "Concluído", icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
    completed: { label: "Concluído", icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
    blocked: { label: "Bloqueado", icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
  };
  const { label, icon: Icon, className } = config[status] || config.planned;
  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

interface AlertItem {
  name: string;
  currentValue: number | null;
  target: number;
  percentage: number;
  severity: "critical" | "warning";
  direction: "higher" | "lower";
  format: "currency" | "percent" | "number";
}

function AlertsSection({ 
  alerts,
  selectedQuarter 
}: { 
  alerts: AlertItem[];
  selectedQuarter: string;
}) {
  if (alerts.length === 0) {
    return null;
  }

  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const warningAlerts = alerts.filter(a => a.severity === "warning");

  const formatAlertValue = (value: number | null, format: "currency" | "percent" | "number") => {
    if (value === null) return "—";
    if (format === "currency") return formatCurrency(value);
    if (format === "percent") return formatPercent(value);
    return formatNumber(value);
  };

  return (
    <Card data-testid="section-alerts">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Alertas de Métricas ({alerts.length})
        </CardTitle>
        <CardDescription>
          Métricas que requerem atenção no {selectedQuarter}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalAlerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              Críticos ({criticalAlerts.length})
            </div>
            <div className="space-y-2">
              {criticalAlerts.map((alert, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                  data-testid={`alert-item-critical-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <div>
                      <div className="font-medium text-sm">{alert.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {alert.direction === "lower" ? "Meta: ≤" : "Meta:"} {formatAlertValue(alert.target, alert.format)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600 dark:text-red-400">
                      {formatAlertValue(alert.currentValue, alert.format)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {alert.percentage.toFixed(0)}% da meta
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {warningAlerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-4 h-4" />
              Atenção ({warningAlerts.length})
            </div>
            <div className="space-y-2">
              {warningAlerts.map((alert, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                  data-testid={`alert-item-warning-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="font-medium text-sm">{alert.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {alert.direction === "lower" ? "Meta: ≤" : "Meta:"} {formatAlertValue(alert.target, alert.format)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-600 dark:text-yellow-400">
                      {formatAlertValue(alert.currentValue, alert.format)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {alert.percentage.toFixed(0)}% da meta
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardTab({ data }: { data: SummaryResponse }) {
  const { metrics, highlights, series, initiatives, krs } = data;
  const currentQuarter = getCurrentQuarter();
  const [selectedQuarter, setSelectedQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">(currentQuarter);

  const getTargetForMetric = (metricKey: string): number | null => {
    const kr = krs?.find(k => k.metricKey === metricKey);
    if (!kr?.targets) return null;
    return kr.targets[selectedQuarter] ?? null;
  };

  const mrrTarget = getTargetForMetric("mrr_active");
  const ebitdaTarget = getTargetForMetric("ebitda");
  const cashGenTarget = getTargetForMetric("cash_generation");
  const inadTarget = getTargetForMetric("delinquency_pct") ?? 6;
  const netChurnTarget = getTargetForMetric("net_mrr_churn_pct") ?? 9;
  const logoChurnTarget = getTargetForMetric("logo_churn_pct") ?? 10;

  const inadPct = metrics.inadimplencia_percentual ?? 0;
  const netChurnPct = metrics.net_churn_mrr_percentual ?? 0;
  const logoChurnPct = metrics.logo_churn_percentual ?? 0;

  const inadStatus = inadPct <= inadTarget ? "green" : inadPct <= (inadTarget * 1.1) ? "yellow" : "red";
  const netChurnStatus = netChurnPct <= netChurnTarget ? "green" : netChurnPct <= (netChurnTarget * 1.1) ? "yellow" : "red";
  const logoChurnStatus = logoChurnPct <= logoChurnTarget ? "green" : logoChurnPct <= (logoChurnTarget * 1.2) ? "yellow" : "red";

  const computeAlerts = useMemo((): AlertItem[] => {
    const alerts: AlertItem[] = [];
    
    const checkHigherMetric = (
      name: string, 
      value: number | null, 
      target: number | null, 
      format: "currency" | "percent" | "number"
    ) => {
      if (value === null || target === null || target === 0) return;
      const percentage = (value / target) * 100;
      if (percentage < 90) {
        alerts.push({ name, currentValue: value, target, percentage, severity: "critical", direction: "higher", format });
      } else if (percentage < 100) {
        alerts.push({ name, currentValue: value, target, percentage, severity: "warning", direction: "higher", format });
      }
    };
    
    const checkLowerMetric = (
      name: string, 
      value: number | null, 
      target: number, 
      format: "currency" | "percent" | "number"
    ) => {
      if (value === null) return;
      if (value <= target) return;
      const overshoot = ((value - target) / target) * 100;
      const percentage = Math.max(0, 100 - overshoot);
      if (overshoot > 10) {
        alerts.push({ name, currentValue: value, target, percentage, severity: "critical", direction: "lower", format });
      } else {
        alerts.push({ name, currentValue: value, target, percentage, severity: "warning", direction: "lower", format });
      }
    };
    
    checkHigherMetric("MRR Ativo", metrics.mrr_ativo, mrrTarget, "currency");
    checkHigherMetric("EBITDA", metrics.ebitda_ytd, ebitdaTarget, "currency");
    checkHigherMetric("Geração Caixa", metrics.geracao_caixa_ytd, cashGenTarget, "currency");
    checkLowerMetric("Inadimplência %", metrics.inadimplencia_percentual, inadTarget, "percent");
    checkLowerMetric("Net Churn %", metrics.net_churn_mrr_percentual, netChurnTarget, "percent");
    checkLowerMetric("Logo Churn %", metrics.logo_churn_percentual, logoChurnTarget, "percent");
    
    alerts.sort((a, b) => {
      if (a.severity === "critical" && b.severity === "warning") return -1;
      if (a.severity === "warning" && b.severity === "critical") return 1;
      return a.percentage - b.percentage;
    });
    
    return alerts;
  }, [metrics, mrrTarget, ebitdaTarget, cashGenTarget, inadTarget, netChurnTarget, logoChurnTarget]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building className="w-4 h-4" />
          <span>Metas do trimestre:</span>
        </div>
        <Select value={selectedQuarter} onValueChange={(v) => setSelectedQuarter(v as "Q1" | "Q2" | "Q3" | "Q4")}>
          <SelectTrigger className="w-[150px]" data-testid="filter-dashboard-quarter">
            <SelectValue placeholder="Trimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
            <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
            <SelectItem value="Q3">Q3 (Jul-Set)</SelectItem>
            <SelectItem value="Q4">Q4 (Out-Dez)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          ({getQuarterLabel(selectedQuarter)}) {selectedQuarter === currentQuarter && <Badge variant="outline" className="ml-1 text-[10px]">Atual</Badge>}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <HeroCard
          title="MRR Ativo"
          value={metrics.mrr_ativo}
          target={mrrTarget}
          format="currency"
          direction="higher"
          icon={TrendingUp}
          tooltip={`Meta ${selectedQuarter}: ${mrrTarget ? formatCurrency(mrrTarget) : "—"}`}
          quarterLabel={selectedQuarter}
          series={series.mrr || metrics.mrr_serie}
        />
        <HeroCard
          title="EBITDA"
          value={metrics.ebitda_ytd}
          target={ebitdaTarget}
          format="currency"
          direction="higher"
          icon={Banknote}
          tooltip={`Meta ${selectedQuarter}: ${ebitdaTarget ? formatCurrency(ebitdaTarget) : "—"}`}
          quarterLabel={selectedQuarter}
          series={series.ebitda}
        />
        <HeroCard
          title="Geração Caixa"
          value={metrics.geracao_caixa_ytd}
          target={cashGenTarget}
          format="currency"
          direction="higher"
          icon={PiggyBank}
          tooltip={`Meta ${selectedQuarter}: ${cashGenTarget ? formatCurrency(cashGenTarget) : "—"}`}
          quarterLabel={selectedQuarter}
        />
        <HeroCard
          title="Inadimplência %"
          value={metrics.inadimplencia_percentual}
          target={inadTarget}
          format="percent"
          direction="lower"
          icon={CreditCard}
          tooltip={`Meta ${selectedQuarter}: <= ${inadTarget}%`}
          status={inadStatus}
        />
        <HeroCard
          title="Net Churn %"
          value={metrics.net_churn_mrr_percentual}
          target={netChurnTarget}
          format="percent"
          direction="lower"
          icon={TrendingDownIcon}
          tooltip={`Meta ${selectedQuarter}: <= ${netChurnTarget}%`}
          status={netChurnStatus}
          series={series.churn}
        />
        <HeroCard
          title="Logo Churn %"
          value={metrics.logo_churn_percentual}
          target={logoChurnTarget}
          format="percent"
          direction="lower"
          icon={Users}
          tooltip={`Meta ${selectedQuarter}: <= ${logoChurnTarget}%`}
          status={logoChurnStatus}
        />
      </div>

      {computeAlerts.length > 0 && (
        <AlertsSection alerts={computeAlerts} selectedQuarter={selectedQuarter} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TurboOHBlock metrics={metrics} quarter={selectedQuarter} />
        <HugzBlock metrics={metrics} initiatives={initiatives} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MRRChart data={series.mrr || metrics.mrr_serie || []} />
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Resumo Operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Clientes Ativos</div>
                <div className="text-xl font-bold">{formatNumber(metrics.clientes_ativos)}</div>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Headcount</div>
                <div className="text-xl font-bold">{formatNumber(metrics.headcount)}</div>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Receita/Head</div>
                <div className="text-xl font-bold">{formatCurrency(metrics.receita_por_head)}</div>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">MRR/Head</div>
                <div className="text-xl font-bold">{formatCurrency(metrics.mrr_por_head)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KRsTab({ data }: { data: SummaryResponse }) {
  const { objectives, krs } = data;
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const currentQuarter = getCurrentQuarter();

  const filteredKRs = useMemo(() => {
    return krs.filter(kr => {
      if (objectiveFilter !== "all" && kr.objectiveId !== objectiveFilter) return false;
      return true;
    });
  }, [krs, objectiveFilter]);

  const krsGroupedByObjective = useMemo(() => {
    const grouped: Record<string, KR[]> = {};
    filteredKRs.forEach(kr => {
      if (!grouped[kr.objectiveId]) grouped[kr.objectiveId] = [];
      grouped[kr.objectiveId].push(kr);
    });
    return grouped;
  }, [filteredKRs]);

  const formatKRValue = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return "—";
    if (unit === "BRL" || unit === "currency") return formatCurrency(value);
    if (unit === "PCT" || unit === "percentage") return formatPercent(value);
    return formatNumber(value);
  };

  const getAggregationLabel = (agg: string | undefined) => {
    const labels: Record<string, string> = {
      quarter_end: "Fim do trimestre",
      quarter_sum: "Soma do trimestre",
      quarter_avg: "Média do trimestre",
      quarter_max: "Máximo do trimestre",
      quarter_min: "Mínimo do trimestre"
    };
    return labels[agg || ""] || agg || "";
  };

  const getQuarterAtual = (kr: KR, quarter: "Q1" | "Q2" | "Q3" | "Q4"): number | null => {
    if (kr.quarterValues?.[quarter]?.atual !== undefined) {
      return kr.quarterValues[quarter].atual;
    }
    if (quarter === currentQuarter) {
      return kr.currentValue;
    }
    return null;
  };

  const getQuarterTarget = (kr: KR, quarter: "Q1" | "Q2" | "Q3" | "Q4"): number | null => {
    return kr.targets?.[quarter] ?? null;
  };

  const getQuarterStatus = (kr: KR, quarter: "Q1" | "Q2" | "Q3" | "Q4"): "green" | "yellow" | "red" | "gray" => {
    const atual = getQuarterAtual(kr, quarter);
    const target = getQuarterTarget(kr, quarter);
    
    if (atual === null || target === null) return "gray";
    return getKRStatus(atual, target, kr.direction);
  };

  const renderQuarterCell = (kr: KR, quarter: "Q1" | "Q2" | "Q3" | "Q4") => {
    const atual = getQuarterAtual(kr, quarter);
    const target = getQuarterTarget(kr, quarter);
    const status = getQuarterStatus(kr, quarter);
    const isCurrent = quarter === currentQuarter;

    const statusColors = {
      green: "bg-green-500/10 border-green-500/30",
      yellow: "bg-yellow-500/10 border-yellow-500/30",
      red: "bg-red-500/10 border-red-500/30",
      gray: "bg-muted/50 border-muted"
    };

    return (
      <div 
        className={`p-2 rounded-md border text-center min-w-[80px] ${statusColors[status]} ${isCurrent ? "ring-2 ring-primary/50" : ""}`}
      >
        <div className="text-sm font-medium">
          {formatKRValue(atual, kr.unit)}
        </div>
        <div className="text-[10px] text-muted-foreground">
          / {target !== null ? formatKRValue(target, kr.unit) : "—"}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
          <SelectTrigger className="w-[200px]" data-testid="filter-kr-objective">
            <SelectValue placeholder="Objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Objetivos</SelectItem>
            {objectives.map(obj => (
              <SelectItem key={obj.id} value={obj.id}>{obj.id}: {obj.title.substring(0, 30)}...</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quarterFilter} onValueChange={setQuarterFilter}>
          <SelectTrigger className="w-[150px]" data-testid="filter-kr-quarter">
            <SelectValue placeholder="Trimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
            <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
            <SelectItem value="Q3">Q3 (Jul-Set)</SelectItem>
            <SelectItem value="Q4">Q4 (Out-Dez)</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredKRs.length} KR(s) | Trimestre atual: <Badge variant="outline">{currentQuarter}</Badge>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={objectives.map(o => o.id)} className="space-y-4">
        {objectives.map(obj => {
          const objKRs = krsGroupedByObjective[obj.id];
          if (!objKRs || objKRs.length === 0) return null;

          const greenCount = objKRs.filter(kr => {
            const status = getQuarterStatus(kr, currentQuarter);
            return status === "green";
          }).length;

          return (
            <AccordionItem 
              key={obj.id} 
              value={obj.id} 
              className="border rounded-lg overflow-hidden"
              data-testid={`accordion-kr-${obj.id}`}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{obj.id}: {obj.title}</div>
                      <div className="text-xs text-muted-foreground">{obj.subtitle || obj.narrative}</div>
                    </div>
                  </div>
                  <Badge variant={greenCount === objKRs.length ? "default" : "secondary"} className="text-xs">
                    {greenCount}/{objKRs.length} no alvo
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full mt-2">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-2 px-2 min-w-[200px]">KR</th>
                        <th className="text-center py-2 px-2">Q1</th>
                        <th className="text-center py-2 px-2">Q2</th>
                        <th className="text-center py-2 px-2">Q3</th>
                        <th className="text-center py-2 px-2">Q4</th>
                        <th className="text-center py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {objKRs.map(kr => {
                        const currentStatus = getQuarterStatus(kr, currentQuarter);
                        
                        return (
                          <tr 
                            key={kr.id} 
                            className="border-b last:border-0"
                            data-testid={`row-kr-${kr.id}`}
                          >
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{kr.id}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm text-muted-foreground cursor-help truncate max-w-[150px]">
                                      {kr.title}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="space-y-1">
                                      <div className="font-medium">{kr.title}</div>
                                      {kr.aggregation && (
                                        <div className="text-xs text-muted-foreground">
                                          Agregação: {getAggregationLabel(kr.aggregation)}
                                        </div>
                                      )}
                                      <div className="text-xs">
                                        Direção: {kr.direction === "lte" || kr.direction === "lower" ? "Menor melhor" : "Maior melhor"}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q1")}</td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q2")}</td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q3")}</td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q4")}</td>
                            <td className="py-3 px-2 text-center">
                              <StatusBadge status={currentStatus} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function InitiativesTab({ 
  data, 
  collaborators 
}: { 
  data: SummaryResponse; 
  collaborators: Collaborator[] 
}) {
  const { initiatives, objectives, krs } = data;
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const collaboratorMap = useMemo(() => {
    const map: Record<string, string> = {};
    collaborators.forEach(c => {
      if (c.email) {
        map[c.email.toLowerCase()] = c.name;
      }
    });
    return map;
  }, [collaborators]);

  const resolveOwner = (email: string | undefined): string => {
    if (!email) return "—";
    const resolved = collaboratorMap[email.toLowerCase()];
    return resolved || email;
  };

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    initiatives.forEach(i => {
      if (i.owner_email) owners.add(i.owner_email);
      if (i.ownerRole) owners.add(i.ownerRole);
    });
    return Array.from(owners);
  }, [initiatives]);

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter(ini => {
      const status = ini.status;
      if (statusFilter !== "all") {
        const statusMatch = 
          (statusFilter === "planned" && (status === "planned" || status === "not_started")) ||
          (statusFilter === "doing" && (status === "doing" || status === "in_progress")) ||
          (statusFilter === "done" && (status === "done" || status === "completed")) ||
          (statusFilter === "blocked" && status === "blocked");
        if (!statusMatch) return false;
      }
      if (objectiveFilter !== "all" && ini.objectiveId !== objectiveFilter) return false;
      if (quarterFilter !== "all" && ini.quarter !== quarterFilter) return false;
      if (ownerFilter !== "all") {
        const ownerMatch = ini.owner_email === ownerFilter || ini.ownerRole === ownerFilter;
        if (!ownerMatch) return false;
      }
      return true;
    });
  }, [initiatives, statusFilter, objectiveFilter, quarterFilter, ownerFilter]);

  const stats = useMemo(() => {
    const byObjective: Record<string, { planned: number; doing: number; blocked: number; done: number }> = {};
    objectives.forEach(obj => {
      byObjective[obj.id] = { planned: 0, doing: 0, blocked: 0, done: 0 };
    });
    
    initiatives.forEach(ini => {
      const objStats = byObjective[ini.objectiveId];
      if (!objStats) return;
      
      if (ini.status === "planned" || ini.status === "not_started") objStats.planned++;
      else if (ini.status === "doing" || ini.status === "in_progress") objStats.doing++;
      else if (ini.status === "done" || ini.status === "completed") objStats.done++;
      else if (ini.status === "blocked") objStats.blocked++;
    });
    
    return byObjective;
  }, [initiatives, objectives]);

  const totalStats = useMemo(() => ({
    planned: initiatives.filter(i => i.status === "planned" || i.status === "not_started").length,
    doing: initiatives.filter(i => i.status === "doing" || i.status === "in_progress").length,
    done: initiatives.filter(i => i.status === "done" || i.status === "completed").length,
    blocked: initiatives.filter(i => i.status === "blocked").length,
  }), [initiatives]);

  const getKRTitle = (krId: string) => {
    const kr = krs.find(k => k.id === krId);
    return kr ? kr.title : krId;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "planned" ? "all" : "planned")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{totalStats.planned}</div>
                <div className="text-sm text-muted-foreground">Planejado</div>
              </div>
              <Clock className="w-8 h-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "doing" ? "all" : "doing")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{totalStats.doing}</div>
                <div className="text-sm text-muted-foreground">Em andamento</div>
              </div>
              <Rocket className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "blocked" ? "all" : "blocked")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{totalStats.blocked}</div>
                <div className="text-sm text-muted-foreground">Bloqueado</div>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{totalStats.done}</div>
                <div className="text-sm text-muted-foreground">Concluído</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="text-sm font-medium mb-3">Resumo por Objetivo</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {objectives.map(obj => {
              const objStats = stats[obj.id];
              if (!objStats) return null;
              const total = objStats.planned + objStats.doing + objStats.blocked + objStats.done;
              if (total === 0) return null;
              
              return (
                <div 
                  key={obj.id} 
                  className="p-2 rounded-md bg-muted/50 text-xs cursor-pointer hover:bg-muted"
                  onClick={() => setObjectiveFilter(objectiveFilter === obj.id ? "all" : obj.id)}
                >
                  <div className="font-medium mb-1">{obj.id}</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {objStats.planned > 0 && <Badge variant="outline" className="text-[10px] bg-slate-500/10">{objStats.planned}P</Badge>}
                    {objStats.doing > 0 && <Badge variant="outline" className="text-[10px] bg-blue-500/10">{objStats.doing}D</Badge>}
                    {objStats.blocked > 0 && <Badge variant="outline" className="text-[10px] bg-red-500/10">{objStats.blocked}B</Badge>}
                    {objStats.done > 0 && <Badge variant="outline" className="text-[10px] bg-green-500/10">{objStats.done}C</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-initiative-objective">
            <SelectValue placeholder="Objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Objetivos</SelectItem>
            {objectives.map(obj => (
              <SelectItem key={obj.id} value={obj.id}>{obj.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quarterFilter} onValueChange={setQuarterFilter}>
          <SelectTrigger className="w-[130px]" data-testid="filter-initiative-quarter">
            <SelectValue placeholder="Trimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Q1">Q1</SelectItem>
            <SelectItem value="Q2">Q2</SelectItem>
            <SelectItem value="Q3">Q3</SelectItem>
            <SelectItem value="Q4">Q4</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="filter-initiative-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="planned">Planejado</SelectItem>
            <SelectItem value="doing">Em andamento</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="done">Concluído</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-initiative-owner">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Owners</SelectItem>
            {uniqueOwners.map(owner => (
              <SelectItem key={owner} value={owner}>
                {resolveOwner(owner)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredInitiatives.length} iniciativa(s)
        </div>
      </div>

      <div className="space-y-3">
        {filteredInitiatives.map(ini => {
          const title = ini.title || ini.name || "";
          const tags = ini.tags || [];
          const krIds = ini.krs || ini.krIds || [];
          const ownerEmail = ini.owner_email || ini.ownerRole;
          
          return (
            <Card key={ini.id} className="hover-elevate" data-testid={`card-initiative-${ini.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        {ini.objectiveId}
                      </Badge>
                      {ini.quarter && (
                        <Badge variant="outline" className="text-xs">
                          {ini.quarter}
                        </Badge>
                      )}
                      <span className="font-medium">{title}</span>
                    </div>
                    
                    {tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>{resolveOwner(ownerEmail)}</span>
                    </div>

                    {krIds.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">KRs: </span>
                        <span className="text-xs">
                          {krIds.map((krId, idx) => (
                            <span key={krId}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-primary cursor-help">{krId}</span>
                                </TooltipTrigger>
                                <TooltipContent>{getKRTitle(krId)}</TooltipContent>
                              </Tooltip>
                              {idx < krIds.length - 1 && ", "}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <InitiativeStatusBadge status={ini.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredInitiatives.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma iniciativa encontrada com os filtros selecionados
          </div>
        )}
      </div>
    </div>
  );
}

const PERIODS = ["YTD", "Q1", "Q2", "Q3", "Q4"];
const BUSINESS_UNITS = [
  { id: "all", label: "Todas" },
  { id: "turbooh", label: "TurboOH" },
  { id: "tech", label: "Tech" },
  { id: "commerce", label: "Commerce" }
];

export default function OKR2026() {
  usePageTitle("OKR 2026");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("YTD");
  const [selectedBU, setSelectedBU] = useState("all");
  const currentQuarter = getCurrentQuarter();

  const { data, isLoading, error } = useQuery<SummaryResponse>({
    queryKey: ["/api/okr2026/summary", { period: selectedPeriod, bu: selectedBU }],
  });

  const { data: collaboratorsData } = useQuery<CollaboratorsResponse>({
    queryKey: ["/api/okr2026/collaborators"],
  });

  const collaborators = collaboratorsData?.collaborators || [];

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      );
    }

    if (error || !data) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Erro ao carregar dados</h3>
            <p className="text-muted-foreground">
              Não foi possível carregar os dados do OKR 2026. Tente novamente mais tarde.
            </p>
          </CardContent>
        </Card>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return <DashboardTab data={data} />;
      case "krs":
        return <KRsTab data={data} />;
      case "initiatives":
        return <InitiativesTab data={data} collaborators={collaborators} />;
      default:
        return <DashboardTab data={data} />;
    }
  };

  return (
    <div className="h-full overflow-auto p-6" data-testid="page-okr-2026">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Target className="w-8 h-8 text-primary" />
              OKR 2026 — Bigger & Better
            </h1>
            <p className="text-muted-foreground mt-1">
              Consolidação, Escala e Padronização
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[120px]" data-testid="select-period">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedBU} onValueChange={setSelectedBU}>
              <SelectTrigger className="w-[130px]" data-testid="select-bu">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_UNITS.map(bu => (
                  <SelectItem key={bu.id} value={bu.id}>{bu.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm bg-primary/10 text-primary border-primary/30">
              {currentQuarter} 2026
            </Badge>
          </div>
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
            {renderContent()}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
