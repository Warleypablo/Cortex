import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Target, TrendingUp, TrendingDown, Users, DollarSign, Percent, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Info, Flag, Rocket, Clock, CheckCircle2, 
  XCircle, ChevronRight, Zap, BarChart3, Activity, Banknote, PiggyBank,
  CreditCard, TrendingDown as TrendingDownIcon, MonitorPlay, ShoppingCart
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, Tooltip as RechartsTooltip, Legend 
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
  ownerRole: string;
  narrative: string;
  order: number;
}

interface KR {
  id: string;
  objectiveId: string;
  title: string;
  metricKey: string;
  operator: string;
  cadence: string;
  targetType: string;
  targets: Record<string, number>;
  description?: string;
  owner: string;
  status: "green" | "yellow" | "red" | "gray";
  unit: string;
  direction: string;
  currentValue: number | null;
  target: number | null;
  progress: number | null;
}

interface Initiative {
  id: string;
  objectiveId: string;
  name: string;
  ownerRole: string;
  start: string;
  end: string;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  type: string;
  krIds: string[];
  successMetricKeys: string[];
  successKpi: string;
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

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
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

function getKRStatusColor(kr: KR): { bg: string; text: string; border: string; label: string } {
  const { progress, direction, currentValue, target, operator } = kr;
  
  if (progress === null || currentValue === null || target === null) {
    return { bg: "bg-muted", text: "text-muted-foreground", border: "border-muted", label: "Sem dados" };
  }

  if (direction === "lower" || operator === "<=") {
    if (currentValue <= target) {
      return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30", label: "No alvo" };
    }
    const overshoot = ((currentValue - target) / target) * 100;
    if (overshoot <= 10) {
      return { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", label: "Atenção" };
    }
    return { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Fora do alvo" };
  }
  
  if (progress >= 100) {
    return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30", label: "No alvo" };
  }
  if (progress >= 90) {
    return { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", label: "Atenção" };
  }
  return { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Fora do alvo" };
}

function HeroCard({ 
  title, 
  value, 
  target, 
  format, 
  direction = "higher",
  icon: Icon, 
  tooltip,
  status
}: {
  title: string;
  value: number | null;
  target: number | null;
  format: "currency" | "number" | "percent";
  direction?: "higher" | "lower";
  icon: typeof TrendingUp;
  tooltip?: string;
  status?: "green" | "yellow" | "red";
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
      </CardContent>
    </Card>
  );
}

function TurboOHBlock({ metrics }: { metrics: DashboardMetrics }) {
  const margem = metrics.turbooh_margem_pct;
  const margemStatus = margem !== null && margem >= 25 ? "green" : margem !== null && margem >= 20 ? "yellow" : "red";
  
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MonitorPlay className="w-5 h-5 text-primary" />
          TurboOH
        </CardTitle>
        <CardDescription>Performance do segmento Out-of-Home</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Receita OH</div>
            <div className="text-xl font-bold">
              {metrics.turbooh_receita !== null ? formatCurrency(metrics.turbooh_receita) : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Resultado OH</div>
            <div className="text-xl font-bold">
              {metrics.turbooh_resultado !== null ? formatCurrency(metrics.turbooh_resultado) : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              Margem OH %
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Meta: {">"}= 25%</TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-xl font-bold ${
              margemStatus === "green" ? "text-green-600 dark:text-green-400" : 
              margemStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" : 
              "text-red-600 dark:text-red-400"
            }`}>
              {margem !== null ? formatPercent(margem) : "—"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VendasBlock({ metrics }: { metrics: DashboardMetrics }) {
  const newMrr = metrics.new_mrr || 0;
  const expansion = metrics.expansion_mrr || 0;
  const total = newMrr + expansion;
  const newPct = total > 0 ? (newMrr / total) * 100 : 50;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Vendas: New MRR vs Expansão
        </CardTitle>
        <CardDescription>Comparativo de aquisição vs monetização base</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-blue-500" />
              New MRR
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(newMrr)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              Expansion MRR
            </div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(expansion)}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>New MRR ({newPct.toFixed(0)}%)</span>
            <span>Expansion ({(100 - newPct).toFixed(0)}%)</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            <div 
              className="bg-blue-500 transition-all" 
              style={{ width: `${newPct}%` }} 
            />
            <div 
              className="bg-green-500 transition-all" 
              style={{ width: `${100 - newPct}%` }} 
            />
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

function StatusBadge({ status, size = "sm" }: { status: "green" | "yellow" | "red" | "gray"; size?: "sm" | "md" }) {
  const config = {
    green: { label: "No alvo", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
    yellow: { label: "Atenção", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
    red: { label: "Fora do alvo", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
    gray: { label: "Sem dados", className: "bg-muted text-muted-foreground border-muted" },
  };
  const { label, className } = config[status] || config.gray;
  return (
    <Badge variant="outline" className={`${className} ${size === "sm" ? "text-xs" : "text-sm"}`}>
      {label}
    </Badge>
  );
}

function InitiativeStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: typeof Rocket; className: string }> = {
    not_started: { label: "Backlog", icon: Clock, className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
    in_progress: { label: "Em andamento", icon: Rocket, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    completed: { label: "Concluído", icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
    blocked: { label: "Bloqueado", icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
  };
  const { label, icon: Icon, className } = config[status] || config.not_started;
  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

function DashboardTab({ data }: { data: SummaryResponse }) {
  const { metrics, highlights, series } = data;
  const quarter = getCurrentQuarter();

  const inadStatus = highlights.inadimplencia?.status === "green" ? "green" : "red";
  const churnStatus = highlights.net_churn?.status === "green" ? "green" : "red";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <HeroCard
          title="MRR Ativo"
          value={metrics.mrr_ativo}
          target={highlights.mrr?.target}
          format="currency"
          direction="higher"
          icon={TrendingUp}
          tooltip={`Meta ${quarter}: ${highlights.mrr?.target ? formatCurrency(highlights.mrr.target) : "—"}`}
        />
        <HeroCard
          title="Receita Líquida"
          value={metrics.receita_liquida_ytd}
          target={highlights.revenue?.target}
          format="currency"
          direction="higher"
          icon={DollarSign}
          tooltip="Receita líquida acumulada no ano"
        />
        <HeroCard
          title="EBITDA"
          value={metrics.ebitda_ytd}
          target={highlights.ebitda?.target}
          format="currency"
          direction="higher"
          icon={Banknote}
        />
        <HeroCard
          title="Caixa"
          value={metrics.caixa_atual}
          target={null}
          format="currency"
          direction="higher"
          icon={PiggyBank}
          tooltip="Saldo disponível em contas bancárias"
        />
        <HeroCard
          title="Inadimplência %"
          value={metrics.inadimplencia_percentual}
          target={highlights.inadimplencia?.target}
          format="percent"
          direction="lower"
          icon={CreditCard}
          tooltip="Meta: <= 6%"
          status={inadStatus as "green" | "red"}
        />
        <HeroCard
          title="Net Churn %"
          value={metrics.net_churn_mrr_percentual}
          target={highlights.net_churn?.target}
          format="percent"
          direction="lower"
          icon={TrendingDownIcon}
          tooltip="Meta: <= 9%"
          status={churnStatus as "green" | "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TurboOHBlock metrics={metrics} />
        <VendasBlock metrics={metrics} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MRRChart data={series.mrr || metrics.mrr_serie || []} />
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
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
  const [cadenceFilter, setCadenceFilter] = useState<string>("all");

  const filteredKRs = useMemo(() => {
    return krs.filter(kr => {
      if (objectiveFilter !== "all" && kr.objectiveId !== objectiveFilter) return false;
      if (cadenceFilter !== "all" && kr.cadence !== cadenceFilter) return false;
      return true;
    });
  }, [krs, objectiveFilter, cadenceFilter]);

  const krsGroupedByObjective = useMemo(() => {
    const grouped: Record<string, KR[]> = {};
    filteredKRs.forEach(kr => {
      if (!grouped[kr.objectiveId]) grouped[kr.objectiveId] = [];
      grouped[kr.objectiveId].push(kr);
    });
    return grouped;
  }, [filteredKRs]);

  const formatKRValue = (kr: KR) => {
    if (kr.currentValue === null) return "—";
    if (kr.unit === "currency") return formatCurrency(kr.currentValue);
    if (kr.unit === "percentage") return formatPercent(kr.currentValue);
    return formatNumber(kr.currentValue);
  };

  const formatKRTarget = (kr: KR) => {
    if (kr.target === null) return "—";
    if (kr.unit === "currency") return formatCurrency(kr.target);
    if (kr.unit === "percentage") return formatPercent(kr.target);
    return formatNumber(kr.target);
  };

  const getObjectiveTitle = (objId: string) => {
    const obj = objectives.find(o => o.id === objId);
    return obj ? `${obj.id}: ${obj.title}` : objId;
  };

  const getObjectiveProgress = (objId: string) => {
    const objKRs = krsGroupedByObjective[objId] || [];
    const withProgress = objKRs.filter(kr => kr.progress !== null);
    if (withProgress.length === 0) return null;
    return withProgress.reduce((sum, kr) => sum + (kr.progress || 0), 0) / withProgress.length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-objective">
            <SelectValue placeholder="Objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Objetivos</SelectItem>
            {objectives.map(obj => (
              <SelectItem key={obj.id} value={obj.id}>{obj.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cadenceFilter} onValueChange={setCadenceFilter}>
          <SelectTrigger className="w-[150px]" data-testid="filter-cadence">
            <SelectValue placeholder="Cadência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="quarterly">Trimestral</SelectItem>
            <SelectItem value="annual">Anual</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="snapshot">Snapshot</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredKRs.length} KR(s) encontrado(s)
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {objectives.map(obj => {
          const objKRs = krsGroupedByObjective[obj.id] || [];
          const greenCount = objKRs.filter(kr => kr.status === "green").length;
          const progress = getObjectiveProgress(obj.id);
          
          return (
            <Card 
              key={obj.id} 
              className={`hover-elevate cursor-pointer ${objectiveFilter === obj.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setObjectiveFilter(objectiveFilter === obj.id ? "all" : obj.id)}
              data-testid={`card-objective-summary-${obj.id}`}
            >
              <CardContent className="pt-4 pb-3 px-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{obj.id}</Badge>
                  <span className="text-xs text-muted-foreground">{greenCount}/{objKRs.length}</span>
                </div>
                {progress !== null && (
                  <Progress value={progress} className="h-1.5" />
                )}
                <div className="text-xs text-muted-foreground line-clamp-1">{obj.title}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Accordion type="multiple" defaultValue={objectives.map(o => o.id)} className="space-y-4">
        {objectives.map(obj => {
          const objKRs = krsGroupedByObjective[obj.id];
          if (!objKRs || objKRs.length === 0) return null;

          const progress = getObjectiveProgress(obj.id);
          const greenCount = objKRs.filter(kr => kr.status === "green").length;

          return (
            <AccordionItem 
              key={obj.id} 
              value={obj.id} 
              className="border rounded-lg overflow-hidden"
              data-testid={`accordion-objective-${obj.id}`}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{obj.id}: {obj.title}</div>
                      <div className="text-xs text-muted-foreground">{obj.narrative}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={greenCount === objKRs.length ? "default" : "secondary"} className="text-xs">
                      {greenCount}/{objKRs.length} KRs
                    </Badge>
                    {progress !== null && (
                      <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mt-2">
                  {objKRs.map(kr => {
                    const statusColor = getKRStatusColor(kr);
                    
                    return (
                      <div 
                        key={kr.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${statusColor.border} ${statusColor.bg}`}
                        data-testid={`row-kr-${kr.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{kr.id}</span>
                            <span className="text-sm">{kr.title}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {kr.cadence === "quarterly" ? "Trimestral" : 
                               kr.cadence === "annual" ? "Anual" : 
                               kr.cadence === "monthly" ? "Mensal" : "Snapshot"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {kr.owner} • {kr.direction === "higher" ? "Maior melhor" : "Menor melhor"}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right min-w-[100px]">
                            <div className="font-bold">{formatKRValue(kr)}</div>
                            <div className="text-xs text-muted-foreground">Meta: {formatKRTarget(kr)}</div>
                          </div>
                          <div className="w-24">
                            {kr.progress !== null && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Progresso</span>
                                  <span className={`font-medium ${statusColor.text}`}>{kr.progress.toFixed(0)}%</span>
                                </div>
                                <Progress value={Math.min(100, kr.progress)} className="h-1.5" />
                              </div>
                            )}
                          </div>
                          <StatusBadge status={kr.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function InitiativesTab({ data }: { data: SummaryResponse }) {
  const { initiatives, objectives, krs } = data;
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter(ini => {
      if (statusFilter !== "all" && ini.status !== statusFilter) return false;
      if (objectiveFilter !== "all" && ini.objectiveId !== objectiveFilter) return false;
      return true;
    });
  }, [initiatives, statusFilter, objectiveFilter]);

  const statusOrder: Record<string, number> = { in_progress: 0, blocked: 1, not_started: 2, completed: 3 };
  const sortedInitiatives = [...filteredInitiatives].sort((a, b) => 
    (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  );

  const stats = useMemo(() => ({
    in_progress: initiatives.filter(i => i.status === "in_progress").length,
    not_started: initiatives.filter(i => i.status === "not_started").length,
    completed: initiatives.filter(i => i.status === "completed").length,
    blocked: initiatives.filter(i => i.status === "blocked").length,
  }), [initiatives]);

  const getObjectiveTitle = (objId: string) => {
    const obj = objectives.find(o => o.id === objId);
    return obj ? obj.id : objId;
  };

  const getKRTitle = (krId: string) => {
    const kr = krs.find(k => k.id === krId);
    return kr ? kr.title : krId;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.in_progress}</div>
                <div className="text-sm text-muted-foreground">Em andamento</div>
              </div>
              <Rocket className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "not_started" ? "all" : "not_started")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.not_started}</div>
                <div className="text-sm text-muted-foreground">Backlog</div>
              </div>
              <Clock className="w-8 h-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">Concluídas</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter(statusFilter === "blocked" ? "all" : "blocked")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.blocked}</div>
                <div className="text-sm text-muted-foreground">Bloqueadas</div>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="filter-initiative-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="not_started">Backlog</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
            <SelectItem value="blocked">Bloqueadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-initiative-objective">
            <SelectValue placeholder="Objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Objetivos</SelectItem>
            {objectives.map(obj => (
              <SelectItem key={obj.id} value={obj.id}>{obj.id}: {obj.title.substring(0, 30)}...</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {sortedInitiatives.length} iniciativa(s)
        </div>
      </div>

      <div className="space-y-3">
        {sortedInitiatives.map(ini => (
          <Card key={ini.id} className="hover-elevate" data-testid={`card-initiative-${ini.id}`}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      {getObjectiveTitle(ini.objectiveId)}
                    </Badge>
                    <span className="font-medium">{ini.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mt-2">
                    <Badge variant="secondary" className="text-xs">{ini.ownerRole}</Badge>
                    <span>|</span>
                    <span>{ini.start} → {ini.end}</span>
                  </div>

                  {ini.krIds && ini.krIds.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">KRs impactados: </span>
                      <span className="text-xs">
                        {ini.krIds.map((krId, idx) => (
                          <span key={krId}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-primary cursor-help">{krId}</span>
                              </TooltipTrigger>
                              <TooltipContent>{getKRTitle(krId)}</TooltipContent>
                            </Tooltip>
                            {idx < ini.krIds.length - 1 && ", "}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}

                  {ini.successMetricKeys && ini.successMetricKeys.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">Métricas: </span>
                      <span className="text-xs">
                        {ini.successMetricKeys.slice(0, 4).join(", ")}
                        {ini.successMetricKeys.length > 4 && ` +${ini.successMetricKeys.length - 4}`}
                      </span>
                    </div>
                  )}

                  {ini.successKpi && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">KPI: </span>
                      <span className="text-foreground">{ini.successKpi}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <InitiativeStatusBadge status={ini.status} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {sortedInitiatives.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma iniciativa encontrada com os filtros selecionados
          </div>
        )}
      </div>
    </div>
  );
}

const PERIODS = ["YTD", "Q1", "Q2", "Q3", "Q4", "Last12m"];
const BUSINESS_UNITS = [
  { id: "all", label: "Todas" },
  { id: "turbooh", label: "TurboOH" },
  { id: "tech", label: "Tech" },
  { id: "commerce", label: "Commerce" }
];

export default function OKR2026() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("YTD");
  const [selectedBU, setSelectedBU] = useState("all");

  const { data, isLoading, error } = useQuery<SummaryResponse>({
    queryKey: ["/api/okr2026/summary", { period: selectedPeriod, bu: selectedBU }],
  });

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
        return <InitiativesTab data={data} />;
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
            <Badge variant="outline" className="text-sm">
              {getCurrentQuarter()} 2026
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
