import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, TrendingDown, Users, DollarSign, Percent, AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight, Minus, Info, Flag, Rocket, Clock, CheckCircle2, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts";

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
  titulo: string;
  owner: string;
  bu: string;
  kr_vinculadas: string[];
  status: "backlog" | "doing" | "done" | "blocked";
  due_date: string;
  impacto_esperado: string;
  confianca: number;
  proximo_marco: string;
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

function MetricCard({ title, value, target, format, direction, icon: Icon, tooltip }: {
  title: string;
  value: number | null;
  target: number | null;
  format: "currency" | "number" | "percent";
  direction: "higher" | "lower";
  icon: typeof TrendingUp;
  tooltip?: string;
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

  const isOnTrack = progress !== null && progress >= 90;
  const isWarning = progress !== null && progress >= 70 && progress < 90;

  return (
    <Card className="relative overflow-visible" data-testid={`card-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
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
        <Icon className={`w-4 h-4 ${isOnTrack ? "text-green-500" : isWarning ? "text-yellow-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {value !== null ? formatValue(value) : "—"}
        </div>
        {target !== null && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Meta: {formatValue(target)}</span>
              {progress !== null && (
                <span className={isOnTrack ? "text-green-500" : isWarning ? "text-yellow-500" : "text-red-500"}>
                  {progress.toFixed(0)}%
                </span>
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

function DashboardTab() {
  const { data, isLoading } = useQuery<{ metrics: DashboardMetrics; targets: Targets }>({
    queryKey: ["/api/okr2026/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { metrics, targets } = data || { metrics: null, targets: null };
  if (!metrics || !targets) return null;

  const quarter = getCurrentQuarter();
  const mrrTarget = targets.company.mrr_ativo[quarter];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="MRR Ativo"
          value={metrics.mrr_ativo}
          target={mrrTarget}
          format="currency"
          direction="higher"
          icon={TrendingUp}
          tooltip={`Meta ${quarter}: ${formatCurrency(mrrTarget)}`}
        />
        <MetricCard
          title="Receita Líquida YTD"
          value={metrics.receita_liquida_ytd}
          target={targets.company.receita_liquida_anual}
          format="currency"
          direction="higher"
          icon={DollarSign}
        />
        <MetricCard
          title="EBITDA YTD"
          value={metrics.ebitda_ytd}
          target={targets.company.ebitda_anual}
          format="currency"
          direction="higher"
          icon={TrendingUp}
        />
        <MetricCard
          title="Caixa Atual"
          value={metrics.caixa_atual}
          target={null}
          format="currency"
          direction="higher"
          icon={DollarSign}
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
        />
        <MetricCard
          title="Inadimplência"
          value={metrics.inadimplencia_percentual}
          target={targets.company.inadimplencia_max}
          format="percent"
          direction="lower"
          icon={AlertTriangle}
          tooltip="Meta: máximo 6%"
        />
        <MetricCard
          title="Gross MRR Churn"
          value={metrics.gross_mrr_churn_percentual}
          target={targets.company.gross_mrr_churn_max}
          format="percent"
          direction="lower"
          icon={TrendingDown}
          tooltip="Meta: máximo 9.7%"
        />
        <MetricCard
          title="Headcount"
          value={metrics.headcount}
          target={null}
          format="number"
          direction="higher"
          icon={Users}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eficiência por Head</CardTitle>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas em Instrumentação</CardTitle>
            <CardDescription>Dados ainda não disponíveis automaticamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>Net Churn MRR (requer tracking de expansion)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>Logo Churn % (requer tracking de clientes)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>TurboOH Receita (separação de BU)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="w-4 h-4" />
              <span>Padronização de Contratos %</span>
            </div>
          </CardContent>
        </Card>
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

  return (
    <div className="space-y-6">
      {objectives.map((obj) => (
        <Card key={obj.id} data-testid={`card-objective-${obj.id}`}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  {obj.id}: {obj.title}
                </CardTitle>
                <CardDescription className="mt-1">{obj.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {obj.krs.map((kr) => (
                <div key={kr.id} className="py-4 first:pt-0 last:pb-0" data-testid={`row-kr-${kr.id}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{kr.id}</span>
                        <span className="text-muted-foreground">—</span>
                        <span>{kr.title}</span>
                        <Badge variant="secondary" className="text-xs">{kr.owner}</Badge>
                        {kr.target_type === "quarterly" && (
                          <Badge variant="outline" className="text-xs">{getCurrentQuarter()}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="font-semibold">{formatKRValue(kr)}</div>
                        <div className="text-xs text-muted-foreground">Meta: {formatKRTarget(kr)}</div>
                      </div>
                      <div className="w-24">
                        {kr.progress !== null && (
                          <Progress value={kr.progress} className="h-2" />
                        )}
                      </div>
                      <StatusBadge status={kr.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
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
