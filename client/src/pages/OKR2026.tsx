import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Target, TrendingUp, DollarSign, AlertTriangle, AlertCircle,
  ArrowUpRight, Info, Rocket, Clock, CheckCircle2, CheckCircle,
  XCircle, Banknote, PiggyBank, ClipboardCheck, MessageSquare, History,
  CreditCard, TrendingDown as TrendingDownIcon, MonitorPlay, Users, Heart, Building,
  LayoutGrid, List, Search, Loader2, Database, FileText, ListChecks, Calendar,
  ChevronRight, X, ExternalLink, Tag, Lightbulb, Zap, ShoppingCart, UserMinus, Wallet, Briefcase
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  ObjectiveBadge, 
  QuarterBadge, 
  InitiativeStatusBadge, 
  KRLinkBadge,
  TagBadge,
  EmptyState 
} from "@/components/ui/okr-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardMetrics {
  mrr_ativo: number;
  mrr_serie: { month: string; value: number }[];
  receita_total_ytd: number;
  receita_liquida_ytd: number;
  ebitda_ytd: number;
  geracao_caixa_ytd: number;
  caixa_atual: number;
  inadimplencia_percentual: number;
  inadimplencia_brl: number | null;
  gross_mrr_churn_percentual: number;
  net_churn_mrr_percentual: number | null;
  churn_brl: number | null;
  logo_churn_percentual: number | null;
  vendas_mrr: number | null;
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
  aquisicao_pontual: number | null;
  valor_entregue_pontual: number | null;
  folha_beneficios: number | null;
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
  description?: string;
  ownerRole?: string;
  owner_email?: string;
  owner_name?: string;
  start?: string;
  startedAt?: string;
  end?: string;
  dueDate?: string;
  quarter?: string;
  status: string;
  type?: string;
  krIds?: string[];
  krs?: string[];
  tags?: string[];
  checklist?: string[];
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

interface KRCheckin {
  id: number;
  krId: string;
  year: number;
  periodType: string;
  periodValue: string;
  confidence: number;
  commentary: string | null;
  blockers: string | null;
  nextActions: string | null;
  createdBy: string;
  createdAt: string;
}

interface KRCheckinsResponse {
  krId: string;
  year: number;
  checkins: KRCheckin[];
}

interface LatestCheckinsResponse {
  year: number;
  latestByKr: Record<string, KRCheckin>;
}

const CONFIDENCE_LEVELS = [
  { value: 0, label: "Em risco", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
  { value: 33, label: "Com atenção", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  { value: 66, label: "No caminho", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { value: 100, label: "Garantido", color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
];

function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence <= 25) return CONFIDENCE_LEVELS[0];
  if (confidence <= 50) return CONFIDENCE_LEVELS[1];
  if (confidence <= 75) return CONFIDENCE_LEVELS[2];
  return CONFIDENCE_LEVELS[3];
}

const krCheckinSchema = z.object({
  periodValue: z.string().min(1, "Selecione o período"),
  confidence: z.number().min(0).max(100),
  commentary: z.string().optional(),
  blockers: z.string().optional(),
  nextActions: z.string().optional(),
});

type KRCheckinFormValues = z.infer<typeof krCheckinSchema>;

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const { label, color } = getConfidenceLabel(confidence);
  return (
    <Badge variant="outline" className={`${color} text-[10px]`}>
      {confidence}% - {label}
    </Badge>
  );
}

function KRCheckinModal({
  kr,
  open,
  onOpenChange,
}: {
  kr: KR | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const currentQuarter = getCurrentQuarter();
  
  const form = useForm<KRCheckinFormValues>({
    resolver: zodResolver(krCheckinSchema),
    defaultValues: {
      periodValue: currentQuarter,
      confidence: 50,
      commentary: "",
      blockers: "",
      nextActions: "",
    },
  });

  const { data: checkinsData, isLoading: checkinsLoading } = useQuery<KRCheckinsResponse>({
    queryKey: ["/api/okr2026/kr-checkins", kr?.id],
    enabled: !!kr && open,
  });

  const createCheckinMutation = useMutation({
    mutationFn: async (values: KRCheckinFormValues) => {
      return apiRequest("POST", "/api/okr2026/kr-checkins", {
        krId: kr?.id,
        year: 2026,
        periodType: "quarter",
        periodValue: values.periodValue,
        confidence: values.confidence,
        commentary: values.commentary || null,
        blockers: values.blockers || null,
        nextActions: values.nextActions || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Check-in registrado",
        description: "O check-in do KR foi salvo com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/okr2026/kr-checkins", kr?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr2026/kr-checkins-latest"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar check-in",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: KRCheckinFormValues) => {
    createCheckinMutation.mutate(values);
  };

  const checkins = checkinsData?.checkins || [];
  const confidenceValue = form.watch("confidence");

  if (!kr) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Check-in: {kr.id}
          </DialogTitle>
          <DialogDescription className="text-left">
            {kr.title}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Novo Check-in
            </h4>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="periodValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-checkin-period">
                            <SelectValue placeholder="Selecione o trimestre" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                          <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
                          <SelectItem value="Q3">Q3 (Jul-Set)</SelectItem>
                          <SelectItem value="Q4">Q4 (Out-Dez)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confidence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between">
                        <span>Nível de Confiança</span>
                        <ConfidenceBadge confidence={confidenceValue} />
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(val) => field.onChange(val[0])}
                          className="w-full"
                          data-testid="slider-confidence"
                        />
                      </FormControl>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Em risco</span>
                        <span>Com atenção</span>
                        <span>No caminho</span>
                        <span>Garantido</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commentary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comentário</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Como está o progresso deste KR?"
                          className="resize-none"
                          rows={3}
                          {...field}
                          data-testid="textarea-commentary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="blockers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bloqueios</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Existe algo impedindo o progresso?"
                          className="resize-none"
                          rows={2}
                          {...field}
                          data-testid="textarea-blockers"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextActions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próximas Ações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Quais são os próximos passos?"
                          className="resize-none"
                          rows={2}
                          {...field}
                          data-testid="textarea-next-actions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createCheckinMutation.isPending}
                  data-testid="button-submit-checkin"
                >
                  {createCheckinMutation.isPending ? "Salvando..." : "Registrar Check-in"}
                </Button>
              </form>
            </Form>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico de Check-ins
            </h4>
            
            {checkinsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : checkins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum check-in registrado ainda
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {checkins.map((checkin) => (
                  <Card key={checkin.id} className="p-3" data-testid={`card-checkin-${checkin.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px]">
                        {checkin.periodValue}
                      </Badge>
                      <ConfidenceBadge confidence={checkin.confidence} />
                    </div>
                    {checkin.commentary && (
                      <p className="text-sm text-muted-foreground mb-2">{checkin.commentary}</p>
                    )}
                    {checkin.blockers && (
                      <div className="text-xs mb-1">
                        <span className="font-medium text-red-600 dark:text-red-400">Bloqueios: </span>
                        <span className="text-muted-foreground">{checkin.blockers}</span>
                      </div>
                    )}
                    {checkin.nextActions && (
                      <div className="text-xs mb-1">
                        <span className="font-medium text-blue-600 dark:text-blue-400">Próximos: </span>
                        <span className="text-muted-foreground">{checkin.nextActions}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {checkin.createdBy} • {format(new Date(checkin.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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


function HeroCard({ 
  title, 
  value, 
  target, 
  format, 
  direction = "higher",
  icon: Icon, 
  tooltip,
  status,
  href
}: {
  title: string;
  value: number | null;
  target: number | null;
  format: "currency" | "number" | "percent";
  direction?: "higher" | "lower";
  icon: typeof TrendingUp;
  tooltip?: string;
  status?: "green" | "yellow" | "red";
  href?: string;
}) {
  const formatValue = (v: number) => {
    if (format === "currency") return formatCurrency(v);
    if (format === "percent") return formatPercent(v);
    return formatNumber(v);
  };

  let progress: number | null = null;
  let overshootPercent: number | null = null;
  if (value !== null && target !== null && target > 0) {
    if (direction === "higher") {
      progress = Math.min(100, (value / target) * 100);
    } else {
      if (value <= target) {
        progress = 100;
      } else {
        progress = Math.max(0, 100 - ((value - target) / target) * 100);
        overshootPercent = ((value - target) / target) * 100;
      }
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

  const cardContent = (
    <Card 
      className={`relative overflow-visible border-l-4 ${colors.border} ${href ? 'cursor-pointer hover-elevate transition-all' : ''}`}
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
                <span className={`font-medium ${colors.text}`}>
                  {overshootPercent !== null ? `+${overshootPercent.toFixed(0)}%` : `${progress.toFixed(0)}%`}
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

  if (href) {
    return <Link href={href} className="block">{cardContent}</Link>;
  }
  
  return cardContent;
}

function ImpactBadge({ type }: { type: "mrr" | "churn" | "caixa" }) {
  const config = {
    mrr: { label: "Impacta MRR", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    churn: { label: "Impacta Churn", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    caixa: { label: "Impacta Caixa", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  };
  const { label, className } = config[type];
  return (
    <Badge variant="outline" className={`text-[9px] ${className}`}>
      {label}
    </Badge>
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
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <MonitorPlay className="w-4 h-4 text-primary" />
              TurboOH
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Segmento Out-of-Home</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ImpactBadge type="mrr" />
            <Badge variant="outline" className="text-[10px]">{quarter}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5">Receita</div>
            <div className="text-lg font-bold">
              {receitaOH !== null ? formatCurrency(receitaOH) : "—"}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5">Resultado</div>
            <div className="text-lg font-bold">
              {resultadoOH !== null ? formatCurrency(resultadoOH) : "—"}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              Vacância
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Meta: ≤10%</TooltipContent>
              </Tooltip>
            </div>
            {vacancyPct !== null ? (
              <div className={`text-lg font-bold ${
                vacancyStatus === "green" ? "text-green-600 dark:text-green-400" : 
                vacancyStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" : 
                "text-red-600 dark:text-red-400"
              }`}>
                {formatPercent(vacancyPct)}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">—</div>
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
    <Card className="border-pink-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              Hugz — Saúde da Receita
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Inadimplência e churn</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ImpactBadge type="churn" />
            <ImpactBadge type="caixa" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-4 gap-3">
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              Inadimplência
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Meta: ≤6%</TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-lg font-bold ${
              inadStatus === "green" ? "text-green-600 dark:text-green-400" :
              inadStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`}>
              {formatPercent(metrics.inadimplencia_percentual)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              Net Churn
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Meta: ≤9%</TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-lg font-bold ${
              churnStatus === "green" ? "text-green-600 dark:text-green-400" :
              churnStatus === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`}>
              {metrics.net_churn_mrr_percentual !== null 
                ? formatPercent(metrics.net_churn_mrr_percentual) 
                : "—"}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              Logo Churn
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Meta: ≤10%</TooltipContent>
              </Tooltip>
            </div>
            <div className="text-lg font-bold">
              {metrics.logo_churn_percentual !== null 
                ? formatPercent(metrics.logo_churn_percentual) 
                : "—"}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <div className="text-[10px] text-muted-foreground mb-0.5">Iniciativas</div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{doingCount}</span>
              {blockedCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-[9px] px-1">
                  {blockedCount}!
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SmartEmptyState({ 
  title, 
  description,
  icon: Icon = Info,
  targetYear = 2026
}: { 
  title: string; 
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  targetYear?: number;
}) {
  const currentYear = new Date().getFullYear();
  const isFutureYear = currentYear < targetYear;
  
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-muted-foreground mb-1">{title}</div>
      <div className="text-xs text-muted-foreground/70 max-w-[200px]">
        {isFutureYear 
          ? `BP ${targetYear} carregado. Dados reais começam quando ${targetYear} iniciar.`
          : description
        }
      </div>
    </div>
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

type OverallStatus = "on_track" | "attention" | "off_track";

function calculateOverallStatus(krs: KR[]): { status: OverallStatus; onTrackPct: number; details: { green: number; yellow: number; red: number; gray: number } } {
  const financialMetricKeys = ["mrr_active", "ebitda", "cash_generation", "delinquency_pct", "net_mrr_churn_pct"];
  
  let green = 0, yellow = 0, red = 0, gray = 0;
  let financialWeight = 0, financialOnTrack = 0;
  
  krs.forEach(kr => {
    const isFinancial = financialMetricKeys.includes(kr.metricKey);
    const weight = isFinancial ? 2 : 1;
    
    if (kr.status === "green") {
      green++;
      financialWeight += weight;
      financialOnTrack += weight;
    } else if (kr.status === "yellow") {
      yellow++;
      financialWeight += weight;
      financialOnTrack += weight * 0.5;
    } else if (kr.status === "red") {
      red++;
      financialWeight += weight;
    } else {
      gray++;
    }
  });
  
  const totalWithStatus = green + yellow + red;
  const onTrackPct = financialWeight > 0 ? (financialOnTrack / financialWeight) * 100 : 0;
  
  let status: OverallStatus = "on_track";
  if (onTrackPct >= 80) {
    status = "on_track";
  } else if (onTrackPct >= 60) {
    status = "attention";
  } else {
    status = "off_track";
  }
  
  return { status, onTrackPct, details: { green, yellow, red, gray } };
}

function OverallStatusBadge({ status, onTrackPct }: { status: OverallStatus; onTrackPct: number }) {
  const config = {
    on_track: { 
      label: "On Track", 
      icon: CheckCircle,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
    },
    attention: { 
      label: "Atenção", 
      icon: AlertTriangle,
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" 
    },
    off_track: { 
      label: "Fora do Plano", 
      icon: AlertCircle,
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" 
    },
  };
  const { label, icon: Icon, className } = config[status];
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${className} text-xs px-3 py-1 gap-1.5 cursor-help`}>
          <Icon className="w-3.5 h-3.5" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div className="font-medium mb-1">Score: {onTrackPct.toFixed(0)}%</div>
          <div className="text-muted-foreground">Baseado no desempenho dos KRs com peso maior para métricas financeiras</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ExecutiveHeader({ 
  quarter, 
  krs,
  viewMode,
  monthLabel,
  onViewModeChange,
  selectedQuarter,
  onQuarterChange,
  selectedMonth,
  onMonthChange,
  currentQuarter
}: { 
  quarter: string; 
  krs: KR[];
  viewMode: "quarter" | "month";
  monthLabel?: string;
  onViewModeChange: (mode: ViewMode) => void;
  selectedQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  onQuarterChange: (q: "Q1" | "Q2" | "Q3" | "Q4") => void;
  selectedMonth: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  currentQuarter: "Q1" | "Q2" | "Q3" | "Q4";
}) {
  const { status, onTrackPct, details } = useMemo(() => calculateOverallStatus(krs), [krs]);
  
  return (
    <div className="sticky top-0 z-10 -mx-6 px-6 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            OKR 2026 — Status Executivo
          </h1>
          <p className="text-sm text-muted-foreground">
            Bigger & Better · Consolidação, Escala e Padronização
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && onViewModeChange(v as ViewMode)}
            className="bg-muted/50 p-0.5 rounded-md border"
            data-testid="toggle-view-mode"
          >
            <ToggleGroupItem value="quarter" className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Trimestre
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Mês
            </ToggleGroupItem>
          </ToggleGroup>
          
          {viewMode === "quarter" ? (
            <Select value={selectedQuarter} onValueChange={(v) => onQuarterChange(v as "Q1" | "Q2" | "Q3" | "Q4")}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-dashboard-quarter">
                <SelectValue placeholder="Trimestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
                <SelectItem value="Q3">Q3 (Jul-Set)</SelectItem>
                <SelectItem value="Q4">Q4 (Out-Dez)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedMonth} onValueChange={(v) => onMonthChange(v as MonthKey)}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-dashboard-month">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {(viewMode === "quarter" ? selectedQuarter === currentQuarter : selectedMonth === getCurrentMonth()) && (
            <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">Atual</Badge>
          )}
          
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border-l pl-3 ml-1">
            <span className="text-green-500">{details.green} no alvo</span>
            <span className="text-amber-500">{details.yellow} atenção</span>
            <span className="text-red-500">{details.red} fora</span>
          </div>
          <OverallStatusBadge status={status} onTrackPct={onTrackPct} />
        </div>
      </div>
    </div>
  );
}

function PriorityInitiativesSection({ 
  initiatives, 
  currentQuarter,
  onViewAll
}: { 
  initiatives: Initiative[];
  currentQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  onViewAll?: () => void;
}) {
  const priorityOrder: Record<string, number> = { 
    blocked: 0, 
    doing: 1, 
    in_progress: 1,
    backlog: 2, 
    planned: 2,
    done: 3
  };

  const quarterInitiatives = initiatives.filter(i => 
    i.quarter === currentQuarter || !i.quarter
  );

  const sorted = [...quarterInitiatives].sort((a, b) => {
    const aOrder = priorityOrder[a.status] ?? 3;
    const bOrder = priorityOrder[b.status] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aDate = a.end || a.dueDate || "9999-12-31";
    const bDate = b.end || b.dueDate || "9999-12-31";
    return aDate.localeCompare(bDate);
  });

  const top5 = sorted.slice(0, 5);

  if (top5.length === 0) {
    return null;
  }

  return (
    <Card data-testid="section-priorities">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Prioridades do Trimestre
          </CardTitle>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs">
              Ver todas
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
        <CardDescription>Top 5 iniciativas para focar no {currentQuarter}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {top5.map((init, idx) => (
          <div 
            key={init.id} 
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover-elevate border border-transparent hover:border-border transition-colors"
            data-testid={`priority-item-${idx}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{init.title || init.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <InitiativeStatusBadge status={init.status} />
                  {init.quarter && <QuarterBadge quarter={init.quarter} />}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-right">
              <div className="text-xs text-muted-foreground">
                {init.owner_name || init.ownerRole || "—"}
              </div>
              {(init.end || init.dueDate) && (
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="w-3 h-3 mr-1" />
                  {format(new Date(init.end || init.dueDate!), "dd/MM", { locale: ptBR })}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PendingCheckinsSection({ 
  krs, 
  latestCheckins,
  currentQuarter,
  onCheckin,
  targetYear = 2026
}: { 
  krs: KR[];
  latestCheckins: Record<string, KRCheckin>;
  currentQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  onCheckin?: (kr: KR) => void;
  targetYear?: number;
}) {
  const pendingKRs = krs.filter(kr => {
    const latestCheckin = latestCheckins[kr.id];
    if (!latestCheckin) return true;
    const checkinYear = latestCheckin.year;
    const checkinQuarter = latestCheckin.periodValue;
    if (checkinYear !== targetYear) return true;
    return checkinQuarter !== currentQuarter;
  });

  if (pendingKRs.length === 0) {
    return (
      <Card data-testid="section-checkins-all-done">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-green-500" />
            Check-ins do Trimestre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <div className="font-medium text-sm text-green-700 dark:text-green-400">
                Todos os check-ins em dia!
              </div>
              <div className="text-xs text-muted-foreground">
                Todos os KRs possuem check-in no {currentQuarter}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const top5Pending = pendingKRs.slice(0, 5);

  return (
    <Card data-testid="section-checkins-pending">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-500" />
          Check-ins Pendentes ({pendingKRs.length})
        </CardTitle>
        <CardDescription>
          KRs sem check-in no {currentQuarter}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {top5Pending.map((kr, idx) => (
          <div 
            key={kr.id} 
            className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
            data-testid={`checkin-pending-${idx}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {kr.id}: {kr.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {kr.objectiveId} • {kr.owner || "Sem owner"}
                </div>
              </div>
            </div>
            {onCheckin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onCheckin(kr)}
                className="text-xs flex-shrink-0"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Check-in
              </Button>
            )}
          </div>
        ))}
        {pendingKRs.length > 5 && (
          <div className="text-center text-xs text-muted-foreground pt-2">
            E mais {pendingKRs.length - 5} KR(s) pendente(s)...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ObjectiveSummary {
  id: string;
  title: string;
  krsTotal: number;
  krsOnTrack: number;
  krsWarning: number;
  krsOffTrack: number;
  initiativesCount: number;
}

const OBJECTIVE_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  O1: { bg: "bg-sky-500/10", border: "border-sky-500/30", icon: "text-sky-500" },
  O2: { bg: "bg-violet-500/10", border: "border-violet-500/30", icon: "text-violet-500" },
  O3: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: "text-emerald-500" },
  O4: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "text-amber-500" },
  O5: { bg: "bg-rose-500/10", border: "border-rose-500/30", icon: "text-rose-500" },
};

function ObjectiveSummaryCards({ 
  objectives, 
  krs, 
  initiatives,
  currentQuarter,
  onObjectiveClick
}: { 
  objectives: Objective[];
  krs: KR[];
  initiatives: Initiative[];
  currentQuarter: string;
  onObjectiveClick?: (objectiveId: string) => void;
}) {
  const computeSummaries = useMemo((): ObjectiveSummary[] => {
    return objectives.map(obj => {
      const objectiveKRs = krs.filter(kr => kr.objectiveId === obj.id);
      const objectiveInitiatives = initiatives.filter(init => 
        init.objectiveId === obj.id
      );
      
      let onTrack = 0;
      let warning = 0;
      let offTrack = 0;
      
      objectiveKRs.forEach(kr => {
        const status = kr.status;
        if (status === "gray") return;
        
        if (status === "green") onTrack++;
        else if (status === "yellow") warning++;
        else if (status === "red") offTrack++;
      });
      
      return {
        id: obj.id,
        title: obj.title,
        krsTotal: objectiveKRs.length,
        krsOnTrack: onTrack,
        krsWarning: warning,
        krsOffTrack: offTrack,
        initiativesCount: objectiveInitiatives.length,
      };
    });
  }, [objectives, krs, initiatives, currentQuarter]);
  
  if (objectives.length === 0) return null;
  
  return (
    <Card data-testid="section-objective-summaries">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Objetivos 2026
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {computeSummaries.map(summary => {
            const colors = OBJECTIVE_COLORS[summary.id] || OBJECTIVE_COLORS.O1;
            const hasIssues = summary.krsOffTrack > 0;
            const hasWarnings = summary.krsWarning > 0;
            
            return (
              <div
                key={summary.id}
                className={`p-3 rounded-lg border cursor-pointer hover-elevate ${colors.bg} ${colors.border}`}
                data-testid={`objective-card-${summary.id}`}
                onClick={() => onObjectiveClick?.(summary.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge className={`text-[10px] font-mono ${colors.bg} ${colors.icon} border-0`}>
                    {summary.id}
                  </Badge>
                  {hasIssues && (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                  {!hasIssues && hasWarnings && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  {!hasIssues && !hasWarnings && summary.krsTotal > 0 && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </div>
                <h4 className="text-xs font-medium line-clamp-2 h-8 mb-2">{summary.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span>{summary.krsTotal}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-0.5">
                          <p className="text-emerald-400">On Track: {summary.krsOnTrack}</p>
                          <p className="text-amber-400">Warning: {summary.krsWarning}</p>
                          <p className="text-red-400">Off Track: {summary.krsOffTrack}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="text-muted-foreground/50">|</span>
                  <div className="flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    <span>{summary.initiativesCount}</span>
                  </div>
                </div>
                {summary.krsTotal > 0 && (
                  <div className="mt-2 flex gap-0.5">
                    {summary.krsOnTrack > 0 && (
                      <div 
                        className="h-1 rounded-full bg-emerald-500"
                        style={{ flex: summary.krsOnTrack }}
                      />
                    )}
                    {summary.krsWarning > 0 && (
                      <div 
                        className="h-1 rounded-full bg-amber-500"
                        style={{ flex: summary.krsWarning }}
                      />
                    )}
                    {summary.krsOffTrack > 0 && (
                      <div 
                        className="h-1 rounded-full bg-red-500"
                        style={{ flex: summary.krsOffTrack }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
  metricKey?: string;
}

const METRIC_TO_KR: Record<string, string> = {
  "MRR Ativo": "O1_KR1",
  "EBITDA": "O2_KR1",
  "Geração Caixa": "O2_KR2",
  "Inadimplência %": "O3_KR1",
  "Net Churn %": "O3_KR2",
  "Logo Churn %": "O3_KR3",
};

function RisksActiveSection({ 
  alerts,
  selectedQuarter,
  initiatives,
  onViewInitiatives
}: { 
  alerts: AlertItem[];
  selectedQuarter: string;
  initiatives: Initiative[];
  onViewInitiatives?: () => void;
}) {
  if (alerts.length === 0) {
    return null;
  }

  const formatAlertValue = (value: number | null, format: "currency" | "percent" | "number") => {
    if (value === null) return "—";
    if (format === "currency") return formatCurrency(value);
    if (format === "percent") return formatPercent(value);
    return formatNumber(value);
  };

  const getRelatedInitiatives = (metricName: string): number => {
    const krId = METRIC_TO_KR[metricName];
    if (!krId) return 0;
    return initiatives.filter(init => 
      (init.krIds?.includes(krId) || init.krs?.includes(krId)) &&
      (init.status === "doing" || init.status === "in_progress" || init.status === "blocked")
    ).length;
  };

  const getDeviationPct = (alert: AlertItem): string => {
    if (alert.direction === "higher") {
      return `-${(100 - alert.percentage).toFixed(0)}%`;
    } else {
      const overshoot = alert.currentValue && alert.target 
        ? (((alert.currentValue - alert.target) / alert.target) * 100).toFixed(0) 
        : "0";
      return `+${overshoot}%`;
    }
  };

  return (
    <Card data-testid="section-risks" className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Riscos Ativos do {selectedQuarter}
          </CardTitle>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
            {alerts.length} métrica{alerts.length > 1 ? "s" : ""} em risco
          </Badge>
        </div>
        <CardDescription>Métricas fora do plano que requerem ação imediata</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {alerts.map((alert, idx) => {
            const isCritical = alert.severity === "critical";
            const relatedCount = getRelatedInitiatives(alert.name);
            const krId = METRIC_TO_KR[alert.name];
            
            return (
              <div 
                key={idx}
                className={`p-4 rounded-lg border ${isCritical ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
                data-testid={`risk-item-${idx}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 ${isCritical ? "bg-red-500 text-white border-red-500" : "bg-amber-500 text-white border-amber-500"}`}
                      >
                        {isCritical ? "CRÍTICO" : "ATENÇÃO"}
                      </Badge>
                      <span className="font-semibold">{alert.name}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Atual</div>
                        <div className={`font-bold ${isCritical ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {formatAlertValue(alert.currentValue, alert.format)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Meta</div>
                        <div className="font-medium">{formatAlertValue(alert.target, alert.format)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Desvio</div>
                        <div className={`font-bold ${isCritical ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {getDeviationPct(alert)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3 text-xs">
                      {krId && (
                        <span className="text-muted-foreground">
                          KR: <span className="font-mono text-foreground">{krId}</span>
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        Iniciativas ativas: <span className="font-semibold text-foreground">{relatedCount}</span>
                      </span>
                    </div>
                  </div>
                  
                  {relatedCount > 0 && onViewInitiatives && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={onViewInitiatives}
                      className="text-xs flex-shrink-0"
                    >
                      Ver iniciativas
                      <ArrowUpRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StrategicInitiativesSection({
  initiatives,
  krs,
  currentQuarter,
  onViewAll
}: {
  initiatives: Initiative[];
  krs: KR[];
  currentQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  onViewAll?: () => void;
}) {
  const offTrackKRIds = useMemo(() => {
    return krs.filter(kr => kr.status === "red" || kr.status === "yellow").map(kr => kr.id);
  }, [krs]);

  const strategicInitiatives = useMemo(() => {
    const activeStatuses = ["doing", "in_progress", "blocked"];
    
    return initiatives
      .filter(init => {
        if (!activeStatuses.includes(init.status)) return false;
        const linkedKRs = init.krIds || init.krs || [];
        const linksToOffTrack = linkedKRs.some(krId => offTrackKRIds.includes(krId));
        return linksToOffTrack || init.status === "blocked";
      })
      .slice(0, 5);
  }, [initiatives, offTrackKRIds]);

  if (strategicInitiatives.length === 0) {
    return null;
  }

  const getDaysInProgress = (init: Initiative): number | null => {
    const startField = init.startedAt || init.start;
    const startDate = startField ? new Date(startField) : null;
    if (!startDate || isNaN(startDate.getTime())) return null;
    const now = new Date();
    return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getSlaStatus = (days: number | null): { color: string; label: string; tooltip: string } => {
    if (days === null) return { 
      color: "text-muted-foreground", 
      label: "N/D", 
      tooltip: "Sem data de início definida" 
    };
    if (days <= 14) return { 
      color: "text-green-600 dark:text-green-400", 
      label: `${days}d`, 
      tooltip: `${days} dias em andamento - dentro do SLA` 
    };
    if (days <= 30) return { 
      color: "text-amber-600 dark:text-amber-400", 
      label: `${days}d`, 
      tooltip: `${days} dias em andamento - atenção` 
    };
    return { 
      color: "text-red-600 dark:text-red-400", 
      label: `${days}d`, 
      tooltip: `${days} dias em andamento - acima do SLA` 
    };
  };

  return (
    <Card data-testid="section-strategic-initiatives" className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Iniciativas Estratégicas Ativas
          </CardTitle>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs">
              Ver todas
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
        <CardDescription>Iniciativas ligadas a KRs fora do alvo ({currentQuarter})</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {strategicInitiatives.map((init, idx) => {
            const days = getDaysInProgress(init);
            const sla = getSlaStatus(days);
            const linkedKRs = init.krIds || init.krs || [];
            const isBlocked = init.status === "blocked";
            
            return (
              <div 
                key={init.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isBlocked 
                    ? "border-red-500/30 bg-red-500/5" 
                    : "border-border bg-muted/30 hover:border-primary/30"
                }`}
                data-testid={`strategic-init-${idx}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate mb-1.5">
                      {init.title || init.name}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ObjectiveBadge objective={init.objectiveId} />
                      <InitiativeStatusBadge status={init.status} />
                      {linkedKRs.slice(0, 2).map(krId => (
                        <Badge key={krId} variant="outline" className="text-[10px] font-mono">
                          {krId}
                        </Badge>
                      ))}
                      {linkedKRs.length > 2 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{linkedKRs.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">
                      {init.owner_name || init.ownerRole || "—"}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={`text-[10px] ${sla.color}`}>
                          <Clock className="w-3 h-3 mr-1" />
                          {sla.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{sla.tooltip}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutiveSummaryStrip({ 
  metrics, 
  krs, 
  initiatives,
  alerts 
}: { 
  metrics: DashboardMetrics;
  krs: KR[];
  initiatives: Initiative[];
  alerts: AlertItem[];
}) {
  const blockedInitiatives = initiatives.filter(i => i.status === "blocked");
  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const doingInitiatives = initiatives.filter(i => i.status === "doing" || i.status === "in_progress");
  
  const highlights: { icon: typeof TrendingUp; text: string; type: "positive" | "warning" | "critical" | "neutral" }[] = [];
  
  if (criticalAlerts.length > 0) {
    highlights.push({
      icon: AlertCircle,
      text: `${criticalAlerts.length} métrica(s) crítica(s) fora do alvo`,
      type: "critical"
    });
  }
  
  if (blockedInitiatives.length > 0) {
    highlights.push({
      icon: AlertTriangle,
      text: `${blockedInitiatives.length} iniciativa(s) bloqueada(s)`,
      type: "warning"
    });
  }
  
  if (doingInitiatives.length > 0) {
    highlights.push({
      icon: Rocket,
      text: `${doingInitiatives.length} iniciativa(s) em andamento`,
      type: "neutral"
    });
  }
  
  const krsOnTrack = krs.filter(kr => kr.status === "green").length;
  const krsTotal = krs.filter(kr => kr.status !== "gray").length;
  if (krsTotal > 0) {
    const pct = Math.round((krsOnTrack / krsTotal) * 100);
    highlights.push({
      icon: Target,
      text: `${krsOnTrack}/${krsTotal} KRs no alvo (${pct}%)`,
      type: pct >= 80 ? "positive" : pct >= 60 ? "neutral" : "warning"
    });
  }
  
  if (highlights.length === 0) return null;
  
  const getTypeStyles = (type: string) => {
    switch (type) {
      case "positive": return "text-emerald-600 dark:text-emerald-400";
      case "warning": return "text-amber-600 dark:text-amber-400";
      case "critical": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };
  
  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 rounded-lg border border-border/50" data-testid="executive-summary-strip">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="w-3.5 h-3.5" />
        <span className="font-medium">Destaques:</span>
      </div>
      {highlights.slice(0, 4).map((h, idx) => (
        <div key={idx} className={`flex items-center gap-1.5 text-xs ${getTypeStyles(h.type)}`}>
          <h.icon className="w-3.5 h-3.5" />
          <span>{h.text}</span>
        </div>
      ))}
      <div className="ml-auto text-[10px] text-muted-foreground/60">
        Atualizado: {format(new Date(), "dd/MM HH:mm", { locale: ptBR })}
      </div>
    </div>
  );
}

function NextActionsSection({ 
  initiatives,
  currentQuarter
}: { 
  initiatives: Initiative[];
  currentQuarter: string;
}) {
  const upcomingActions = initiatives
    .filter(i => {
      const status = i.status;
      const hasDate = i.end || i.dueDate;
      return (status === "doing" || status === "in_progress" || status === "backlog" || status === "planned") && hasDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.end || a.dueDate || "9999-12-31");
      const dateB = new Date(b.end || b.dueDate || "9999-12-31");
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);
  
  if (upcomingActions.length === 0) return null;
  
  const getDaysUntil = (dateStr: string): number => {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };
  
  const getUrgencyStyle = (days: number): string => {
    if (days < 0) return "text-red-600 dark:text-red-400 bg-red-500/10";
    if (days <= 7) return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
    return "text-muted-foreground bg-muted/50";
  };
  
  return (
    <Card data-testid="section-next-actions" className="border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-500" />
          Próximas Entregas
        </CardTitle>
        <CardDescription className="text-xs">Ações com prazo mais próximo</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {upcomingActions.map((action, idx) => {
            const dateStr = action.end || action.dueDate || "";
            const days = getDaysUntil(dateStr);
            const urgency = getUrgencyStyle(days);
            
            return (
              <div
                key={action.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover-elevate"
                data-testid={`next-action-${idx}`}
              >
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <ObjectiveBadge objective={action.objectiveId} />
                  <span className="text-sm truncate">{action.title || action.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {action.owner_name || action.ownerRole || "—"}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${urgency}`}>
                    {days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? "Hoje" : `${days}d`}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type ViewMode = "quarter" | "month";
type MonthKey = "jan" | "fev" | "mar" | "abr" | "mai" | "jun" | "jul" | "ago" | "set" | "out" | "nov" | "dez";

const MONTHS: { key: MonthKey; label: string; quarter: "Q1" | "Q2" | "Q3" | "Q4" }[] = [
  { key: "jan", label: "Janeiro", quarter: "Q1" },
  { key: "fev", label: "Fevereiro", quarter: "Q1" },
  { key: "mar", label: "Março", quarter: "Q1" },
  { key: "abr", label: "Abril", quarter: "Q2" },
  { key: "mai", label: "Maio", quarter: "Q2" },
  { key: "jun", label: "Junho", quarter: "Q2" },
  { key: "jul", label: "Julho", quarter: "Q3" },
  { key: "ago", label: "Agosto", quarter: "Q3" },
  { key: "set", label: "Setembro", quarter: "Q3" },
  { key: "out", label: "Outubro", quarter: "Q4" },
  { key: "nov", label: "Novembro", quarter: "Q4" },
  { key: "dez", label: "Dezembro", quarter: "Q4" },
];

function getCurrentMonth(): MonthKey {
  const monthIndex = new Date().getMonth();
  return MONTHS[monthIndex].key;
}

function DashboardTab({ data, onTabChange }: { data: SummaryResponse; onTabChange?: (tab: string) => void }) {
  const { metrics, highlights, series, initiatives, krs, objectives } = data;
  const currentQuarter = getCurrentQuarter();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedQuarter, setSelectedQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q1");
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>("jan");

  const { data: latestCheckinsData } = useQuery<LatestCheckinsResponse>({
    queryKey: ["/api/okr2026/kr-checkins-latest"],
  });

  const latestCheckins = latestCheckinsData?.latestByKr || {};
  
  const getValueFromSeries = (seriesData: { month: string; value: number }[] | undefined, monthKey: MonthKey): number | null => {
    if (!seriesData || seriesData.length === 0) return null;
    const monthLabels: Record<MonthKey, string[]> = {
      jan: ["jan", "janeiro", "01"],
      fev: ["fev", "fevereiro", "02"],
      mar: ["mar", "março", "marco", "03"],
      abr: ["abr", "abril", "04"],
      mai: ["mai", "maio", "05"],
      jun: ["jun", "junho", "06"],
      jul: ["jul", "julho", "07"],
      ago: ["ago", "agosto", "08"],
      set: ["set", "setembro", "09"],
      out: ["out", "outubro", "10"],
      nov: ["nov", "novembro", "11"],
      dez: ["dez", "dezembro", "12"],
    };
    const possibleLabels = monthLabels[monthKey];
    const entry = seriesData.find(s => 
      possibleLabels.some(label => s.month.toLowerCase().includes(label))
    );
    return entry?.value ?? null;
  };
  
  const selectedMonthData = MONTHS.find(m => m.key === selectedMonth);
  const effectiveQuarter = viewMode === "month" && selectedMonthData ? selectedMonthData.quarter : selectedQuarter;

  // Verificar se o mês selecionado é futuro (ainda não tem dados)
  const currentMonthIndex = new Date().getMonth();
  const selectedMonthIndex = MONTHS.findIndex(m => m.key === selectedMonth);
  const isSelectedMonthFuture = selectedMonthIndex > currentMonthIndex;
  const isSelectedMonthCurrent = selectedMonthIndex === currentMonthIndex;

  const getTargetForMetric = (metricKey: string): number | null => {
    const kr = krs?.find(k => k.metricKey === metricKey);
    if (!kr?.targets) return null;
    return kr.targets[effectiveQuarter] ?? null;
  };

  // Metas mensais baseadas nos OKRs definidos (valores corretos passados pelo usuário)
  const monthlyTargets: Record<MonthKey, { mrr: number; vendasMrr: number; inadimplencia: number; churn: number; geracaoCaixa: number }> = {
    jan: { mrr: 1156850, vendasMrr: 215000, inadimplencia: 69411, churn: 92548, geracaoCaixa: 42113 },
    fev: { mrr: 1267734, vendasMrr: 215000, inadimplencia: 76064, churn: 101419, geracaoCaixa: 190284 },
    mar: { mrr: 1368637, vendasMrr: 215000, inadimplencia: 82118, churn: 109491, geracaoCaixa: 212724 },
    abr: { mrr: 1485460, vendasMrr: 240000, inadimplencia: 89128, churn: 118837, geracaoCaixa: 255448 },
    mai: { mrr: 1591769, vendasMrr: 240000, inadimplencia: 95506, churn: 127342, geracaoCaixa: 257036 },
    jun: { mrr: 1688510, vendasMrr: 240000, inadimplencia: 101311, churn: 135081, geracaoCaixa: 345070 },
    jul: { mrr: 1806544, vendasMrr: 270000, inadimplencia: 108393, churn: 144524, geracaoCaixa: 325588 },
    ago: { mrr: 1913955, vendasMrr: 270000, inadimplencia: 114837, churn: 153116, geracaoCaixa: 448395 },
    set: { mrr: 2011699, vendasMrr: 270000, inadimplencia: 120702, churn: 160936, geracaoCaixa: 485121 },
    out: { mrr: 2130646, vendasMrr: 300000, inadimplencia: 127839, churn: 170452, geracaoCaixa: 511923 },
    nov: { mrr: 2238888, vendasMrr: 300000, inadimplencia: 134333, churn: 179111, geracaoCaixa: 576613 },
    dez: { mrr: 2337388, vendasMrr: 300000, inadimplencia: 140243, churn: 186991, geracaoCaixa: 596171 },
  };

  // Metas trimestrais (último mês do trimestre para MRR, soma para vendas/geração, soma para churn/inadimplência)
  const quarterlyTargets: Record<string, { mrr: number; vendasMrr: number; inadimplencia: number; churn: number; geracaoCaixa: number }> = {
    Q1: { mrr: 1368637, vendasMrr: 645000, inadimplencia: 227593, churn: 303458, geracaoCaixa: 445121 },
    Q2: { mrr: 1688510, vendasMrr: 720000, inadimplencia: 285945, churn: 381260, geracaoCaixa: 857554 },
    Q3: { mrr: 2011699, vendasMrr: 810000, inadimplencia: 343932, churn: 458576, geracaoCaixa: 1259104 },
    Q4: { mrr: 2337388, vendasMrr: 900000, inadimplencia: 402415, churn: 536554, geracaoCaixa: 1684707 },
  };

  const getCurrentTargets = () => {
    if (viewMode === "month") {
      return monthlyTargets[selectedMonth];
    }
    return quarterlyTargets[selectedQuarter];
  };

  const currentTargets = getCurrentTargets();
  const mrrTarget = currentTargets.mrr;
  const vendasMrrTarget = currentTargets.vendasMrr;
  const inadTarget = currentTargets.inadimplencia;
  const churnTarget = currentTargets.churn;
  const cashGenTarget = currentTargets.geracaoCaixa;

  // Valores atuais
  const inadValue = metrics.inadimplencia_brl ?? (metrics.inadimplencia_percentual ? (metrics.mrr_ativo ?? 0) * (metrics.inadimplencia_percentual / 100) : 0);
  const churnValue = metrics.churn_brl ?? (metrics.net_churn_mrr_percentual ? (metrics.mrr_ativo ?? 0) * (metrics.net_churn_mrr_percentual / 100) : 0);
  const vendasMrrValue = metrics.vendas_mrr ?? 0;

  // Status baseado em valores em R$
  const inadStatus = inadValue <= inadTarget ? "green" : inadValue <= (inadTarget * 1.1) ? "yellow" : "red";
  const churnStatus = churnValue <= churnTarget ? "green" : churnValue <= (churnTarget * 1.1) ? "yellow" : "red";

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
    checkHigherMetric("Vendas MRR", vendasMrrValue, vendasMrrTarget, "currency");
    checkHigherMetric("Geração Caixa", metrics.geracao_caixa_ytd, cashGenTarget, "currency");
    checkLowerMetric("Inadimplência", inadValue, inadTarget, "currency");
    checkLowerMetric("Churn", churnValue, churnTarget, "currency");
    
    alerts.sort((a, b) => {
      if (a.severity === "critical" && b.severity === "warning") return -1;
      if (a.severity === "warning" && b.severity === "critical") return 1;
      return a.percentage - b.percentage;
    });
    
    return alerts;
  }, [metrics, mrrTarget, vendasMrrTarget, vendasMrrValue, cashGenTarget, inadTarget, inadValue, churnTarget, churnValue]);

  return (
    <div className="space-y-6">
      <ExecutiveHeader 
        quarter={effectiveQuarter} 
        krs={krs} 
        viewMode={viewMode}
        monthLabel={selectedMonthData?.label}
        onViewModeChange={setViewMode}
        selectedQuarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        currentQuarter={currentQuarter}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <HeroCard
          title="MRR Ativo"
          value={viewMode === "month" 
            ? (isSelectedMonthCurrent || isSelectedMonthFuture 
                ? metrics.mrr_ativo 
                : getValueFromSeries(series.mrr || metrics.mrr_serie, selectedMonth) ?? metrics.mrr_ativo)
            : metrics.mrr_ativo}
          target={mrrTarget}
          format="currency"
          direction="higher"
          icon={TrendingUp}
          tooltip={viewMode === "month"
            ? `${selectedMonthData?.label}: Meta ${formatCurrency(mrrTarget)}${isSelectedMonthFuture ? ' (Valor atual - mês futuro)' : ''}`
            : `Meta ${selectedQuarter}: ${formatCurrency(mrrTarget)}`}
          href="/visao-geral"
        />
        <HeroCard
          title="Vendas MRR"
          value={viewMode === "month" && isSelectedMonthFuture ? null : vendasMrrValue}
          target={vendasMrrTarget}
          format="currency"
          direction="higher"
          icon={ShoppingCart}
          tooltip={viewMode === "month"
            ? `${selectedMonthData?.label}: Meta ${formatCurrency(vendasMrrTarget)}${isSelectedMonthFuture ? ' (Mês futuro - sem dados)' : ''}`
            : `Meta ${selectedQuarter}: ${formatCurrency(vendasMrrTarget)}`}
          href="/dashboard/comercial/closers"
        />
        <HeroCard
          title="Inadimplência"
          value={viewMode === "month" && isSelectedMonthFuture ? null : inadValue}
          target={inadTarget}
          format="currency"
          direction="lower"
          icon={CreditCard}
          tooltip={viewMode === "month"
            ? `${selectedMonthData?.label}: Máx ${formatCurrency(inadTarget)}${isSelectedMonthFuture ? ' (Mês futuro - sem dados)' : ''}`
            : `Meta ${selectedQuarter}: Máx ${formatCurrency(inadTarget)}`}
          status={isSelectedMonthFuture ? undefined : inadStatus}
          href="/dashboard/inadimplencia"
        />
        <HeroCard
          title="Churn"
          value={viewMode === "month" && isSelectedMonthFuture ? null : churnValue}
          target={churnTarget}
          format="currency"
          direction="lower"
          icon={TrendingDownIcon}
          tooltip={viewMode === "month"
            ? `${selectedMonthData?.label}: Máx ${formatCurrency(churnTarget)}${isSelectedMonthFuture ? ' (Mês futuro - sem dados)' : ''}`
            : `Meta ${selectedQuarter}: Máx ${formatCurrency(churnTarget)}`}
          status={isSelectedMonthFuture ? undefined : churnStatus}
          href="/dashboard/churn-detalhamento"
        />
        <HeroCard
          title="Geração de Caixa"
          value={viewMode === "month" && isSelectedMonthFuture ? null : metrics.geracao_caixa_ytd}
          target={cashGenTarget}
          format="currency"
          direction="higher"
          icon={PiggyBank}
          tooltip={viewMode === "month"
            ? `${selectedMonthData?.label}: Meta ${formatCurrency(cashGenTarget)}${isSelectedMonthFuture ? ' (Mês futuro - sem dados)' : ''}`
            : `Meta ${selectedQuarter}: ${formatCurrency(cashGenTarget)}`}
          href="/dashboard/dfc"
        />
        <HeroCard
          title="Vendas Pontuais"
          value={viewMode === "month" && isSelectedMonthFuture ? null : (metrics.aquisicao_pontual ?? 0)}
          target={null}
          format="currency"
          direction="higher"
          icon={Wallet}
          tooltip="Vendas pontuais fechadas no mês (CRM)"
        />
        <HeroCard
          title="Entregas Pontuais"
          value={viewMode === "month" && isSelectedMonthFuture ? null : (metrics.valor_entregue_pontual ?? 0)}
          target={null}
          format="currency"
          direction="higher"
          icon={Target}
          tooltip="Projetos pontuais entregues no mês"
        />
        <HeroCard
          title="Folha + Benefícios"
          value={viewMode === "month" && isSelectedMonthFuture ? null : (metrics.folha_beneficios ?? 0)}
          target={null}
          format="currency"
          direction="lower"
          icon={Briefcase}
          tooltip="Despesas de folha de pagamento e benefícios do mês"
        />
      </div>

      <ExecutiveSummaryStrip 
        metrics={metrics} 
        krs={krs} 
        initiatives={initiatives} 
        alerts={computeAlerts} 
      />

      <ObjectiveSummaryCards
        objectives={objectives}
        krs={krs}
        initiatives={initiatives}
        currentQuarter={effectiveQuarter}
        onObjectiveClick={onTabChange ? (id) => onTabChange("krs") : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {computeAlerts.length > 0 && (
            <RisksActiveSection 
              alerts={computeAlerts} 
              selectedQuarter={effectiveQuarter}
              initiatives={initiatives}
              onViewInitiatives={onTabChange ? () => onTabChange("initiatives") : undefined}
            />
          )}
          <StrategicInitiativesSection
            initiatives={initiatives}
            krs={krs}
            currentQuarter={effectiveQuarter}
            onViewAll={onTabChange ? () => onTabChange("initiatives") : undefined}
          />
        </div>

        <div className="space-y-4">
          <NextActionsSection 
            initiatives={initiatives}
            currentQuarter={effectiveQuarter}
          />
          <TurboOHBlock metrics={metrics} quarter={effectiveQuarter} />
          <HugzBlock metrics={metrics} initiatives={initiatives} />
        </div>
      </div>
    </div>
  );
}

function KRsTab({ data }: { data: SummaryResponse }) {
  const { objectives, krs } = data;
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [selectedKR, setSelectedKR] = useState<KR | null>(null);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const currentQuarter = getCurrentQuarter();

  const { data: latestCheckinsData } = useQuery<LatestCheckinsResponse>({
    queryKey: ["/api/okr2026/kr-checkins-latest"],
  });

  const latestCheckins = latestCheckinsData?.latestByKr || {};

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
                        <th className="text-center py-2 px-2">Confiança</th>
                        <th className="text-center py-2 px-2">Q1</th>
                        <th className="text-center py-2 px-2">Q2</th>
                        <th className="text-center py-2 px-2">Q3</th>
                        <th className="text-center py-2 px-2">Q4</th>
                        <th className="text-center py-2 px-2">Status</th>
                        <th className="text-center py-2 px-2">Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {objKRs.map(kr => {
                        const currentStatus = getQuarterStatus(kr, currentQuarter);
                        const latestCheckin = latestCheckins[kr.id];
                        
                        return (
                          <tr 
                            key={kr.id} 
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
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
                            <td className="py-3 px-2 text-center">
                              {latestCheckin ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="inline-block cursor-help">
                                      <ConfidenceBadge confidence={latestCheckin.confidence} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="space-y-1">
                                      <div className="text-xs">Período: {latestCheckin.periodValue}</div>
                                      {latestCheckin.commentary && (
                                        <div className="text-xs">{latestCheckin.commentary}</div>
                                      )}
                                      <div className="text-[10px] text-muted-foreground">
                                        Por {latestCheckin.createdBy}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
                                  Sem check-in
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q1")}</td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q2")}</td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q3")}</td>
                            <td className="py-3 px-2">{renderQuarterCell(kr, "Q4")}</td>
                            <td className="py-3 px-2 text-center">
                              <StatusBadge status={currentStatus} />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedKR(kr);
                                  setCheckinModalOpen(true);
                                }}
                                data-testid={`button-checkin-${kr.id}`}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                                Check-in
                              </Button>
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

      <KRCheckinModal
        kr={selectedKR}
        open={checkinModalOpen}
        onOpenChange={setCheckinModalOpen}
      />
    </div>
  );
}

interface KanbanColumn {
  id: string;
  title: string;
  icon: typeof Clock;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  statuses: string[];
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { 
    id: "backlog", 
    title: "Backlog", 
    icon: Clock, 
    iconColor: "text-slate-500",
    bgColor: "bg-slate-500/5",
    borderColor: "border-t-slate-500",
    statuses: ["planned", "not_started", "backlog", "Backlog"]
  },
  { 
    id: "doing", 
    title: "Em Andamento", 
    icon: Rocket, 
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/5",
    borderColor: "border-t-blue-500",
    statuses: ["doing", "in_progress", "Doing", "In Progress"]
  },
  { 
    id: "done", 
    title: "Concluído", 
    icon: CheckCircle2, 
    iconColor: "text-green-500",
    bgColor: "bg-green-500/5",
    borderColor: "border-t-green-500",
    statuses: ["done", "completed", "Done", "Completed"]
  },
  { 
    id: "blocked", 
    title: "Bloqueado", 
    icon: XCircle, 
    iconColor: "text-red-500",
    bgColor: "bg-red-500/5",
    borderColor: "border-t-red-500",
    statuses: ["blocked", "Blocked"]
  },
];

function InitiativeDrawer({
  initiative,
  open,
  onOpenChange,
  resolveOwner,
  getKRTitle,
  krs,
}: {
  initiative: Initiative | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolveOwner: (email: string | undefined) => string;
  getKRTitle: (krId: string) => string;
  krs: KR[];
}) {
  if (!initiative) return null;
  
  const title = initiative.title || initiative.name || "";
  const krIds = initiative.krs || initiative.krIds || [];
  const tags = initiative.tags || [];
  const checklist = initiative.checklist || [];
  const ownerEmail = initiative.owner_email || initiative.ownerRole;
  const ownerName = initiative.owner_name || resolveOwner(ownerEmail);
  const description = initiative.description || "";
  
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      backlog: { label: "Backlog", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-500/10" },
      planned: { label: "Planejado", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-500/10" },
      doing: { label: "Em andamento", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
      in_progress: { label: "Em andamento", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
      done: { label: "Concluído", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
      completed: { label: "Concluído", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
      blocked: { label: "Bloqueado", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    };
    return configs[status] || configs.backlog;
  };
  
  const statusConfig = getStatusConfig(initiative.status);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0" data-testid="drawer-initiative">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <ObjectiveBadge objective={initiative.objectiveId} />
            {initiative.quarter && <QuarterBadge quarter={initiative.quarter} />}
            <Badge variant="outline" className={`${statusConfig.color} ${statusConfig.bg} border-0`}>
              {statusConfig.label}
            </Badge>
          </div>
          <SheetTitle className="text-lg font-semibold pr-8" data-testid="drawer-initiative-title">
            {title}
          </SheetTitle>
          {ownerName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Users className="w-4 h-4" />
              <span>{ownerName}</span>
            </div>
          )}
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="px-6 py-4 space-y-6">
            {description && (
              <div data-testid="drawer-section-description">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Descrição
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            )}
            
            {krIds.length > 0 && (
              <div data-testid="drawer-section-krs">
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  KRs Vinculados
                  <Badge variant="outline" className="text-[10px]">{krIds.length}</Badge>
                </div>
                <div className="space-y-2">
                  {krIds.map((krId) => {
                    const krTitle = getKRTitle(krId);
                    return (
                      <div 
                        key={krId}
                        className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20"
                      >
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 shrink-0"
                        >
                          {krId}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{krTitle}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {checklist.length > 0 && (
              <div data-testid="drawer-section-checklist">
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <ListChecks className="w-4 h-4 text-muted-foreground" />
                  Checklist
                  <Badge variant="outline" className="text-[10px]">
                    {checklist.filter(Boolean).length} itens
                  </Badge>
                </div>
                <div className="space-y-2">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-1.5">
                      <Checkbox 
                        id={`check-${idx}`} 
                        disabled 
                        className="mt-0.5"
                        data-testid={`checkbox-item-${idx}`}
                      />
                      <label 
                        htmlFor={`check-${idx}`}
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        {item}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {tags.length > 0 && (
              <div data-testid="drawer-section-tags">
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag, idx) => (
                    <Badge 
                      key={idx}
                      variant="outline"
                      className="text-[10px] bg-muted/50"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {initiative.dueDate && (
              <div data-testid="drawer-section-deadline">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Prazo
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(initiative.dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            )}
            
            <div className="pt-4 border-t" data-testid="drawer-section-history">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <History className="w-4 h-4 text-muted-foreground" />
                Histórico de Atualizações
              </div>
              <div className="text-sm text-muted-foreground/70 text-center py-6 bg-muted/30 rounded-lg">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhuma atualização ainda
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function InitiativeKanbanCard({
  initiative,
  resolveOwner,
  getKRTitle,
  krs,
  onClick,
}: {
  initiative: Initiative;
  resolveOwner: (email: string | undefined) => string;
  getKRTitle: (krId: string) => string;
  krs: KR[];
  onClick?: () => void;
}) {
  const title = initiative.title || initiative.name || "";
  const krIds = initiative.krs || initiative.krIds || [];
  const ownerEmail = initiative.owner_email || initiative.ownerRole;
  const ownerName = resolveOwner(ownerEmail);
  const initials = ownerName !== "—" 
    ? ownerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Card 
      className="hover-elevate cursor-pointer mb-2" 
      data-testid={`card-initiative-${initiative.id}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Badge 
              variant="outline" 
              className="bg-primary/10 text-primary border-primary/30 text-[10px] shrink-0"
            >
              {initiative.objectiveId}
            </Badge>
            {initiative.quarter && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {initiative.quarter}
              </Badge>
            )}
          </div>
          
          <p className="text-sm font-medium line-clamp-2">{title}</p>
          
          {krIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {krIds.map((krId) => (
                <Tooltip key={krId}>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 cursor-help"
                    >
                      {krId}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {getKRTitle(krId)}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-2 pt-1">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
              {initials}
            </div>
            <span className="text-xs text-muted-foreground truncate flex-1">
              {ownerName}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const handleInitiativeClick = (initiative: Initiative) => {
    setSelectedInitiative(initiative);
    setDrawerOpen(true);
  };

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
      if (objectiveFilter !== "all" && ini.objectiveId !== objectiveFilter) return false;
      if (quarterFilter !== "all" && ini.quarter !== quarterFilter) return false;
      if (ownerFilter !== "all") {
        const ownerMatch = ini.owner_email === ownerFilter || ini.ownerRole === ownerFilter;
        if (!ownerMatch) return false;
      }
      if (searchQuery) {
        const title = (ini.name || ini.title || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        if (!title.includes(query)) return false;
      }
      return true;
    });
  }, [initiatives, objectiveFilter, quarterFilter, ownerFilter, searchQuery]);

  const columnData = useMemo(() => {
    const data: Record<string, Initiative[]> = {};
    KANBAN_COLUMNS.forEach(col => {
      data[col.id] = filteredInitiatives.filter(ini => 
        col.statuses.includes(ini.status)
      );
    });
    return data;
  }, [filteredInitiatives]);

  const totalStats = useMemo(() => ({
    backlog: initiatives.filter(i => ["planned", "not_started", "backlog", "Backlog"].includes(i.status)).length,
    doing: initiatives.filter(i => ["doing", "in_progress", "Doing", "In Progress"].includes(i.status)).length,
    done: initiatives.filter(i => ["done", "completed", "Done", "Completed"].includes(i.status)).length,
    blocked: initiatives.filter(i => ["blocked", "Blocked"].includes(i.status)).length,
  }), [initiatives]);

  const getKRTitle = (krId: string) => {
    const kr = krs.find(k => k.id === krId);
    return kr ? kr.title : krId;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      planned: "Backlog",
      not_started: "Backlog", 
      doing: "Em andamento",
      in_progress: "Em andamento",
      done: "Concluído",
      completed: "Concluído",
      blocked: "Bloqueado",
    };
    return statusMap[status] || status;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
            <SelectTrigger className="w-[160px]" data-testid="filter-initiative-objective">
              <SelectValue placeholder="Objetivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Objetivos</SelectItem>
              {objectives.map(obj => (
                <SelectItem key={obj.id} value={obj.id}>{obj.id} - {obj.title?.slice(0, 30)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Select value={quarterFilter} onValueChange={setQuarterFilter}>
          <SelectTrigger className="w-[120px]" data-testid="filter-initiative-quarter">
            <SelectValue placeholder="Trimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Q</SelectItem>
            <SelectItem value="Q1">Q1</SelectItem>
            <SelectItem value="Q2">Q2</SelectItem>
            <SelectItem value="Q3">Q3</SelectItem>
            <SelectItem value="Q4">Q4</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
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
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar iniciativa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-[200px]"
            data-testid="input-search-initiative"
          />
        </div>
        
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredInitiatives.length} iniciativa(s)</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-slate-500/10">{totalStats.backlog} backlog</Badge>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10">{totalStats.doing} doing</Badge>
              <Badge variant="outline" className="text-[10px] bg-green-500/10">{totalStats.done} done</Badge>
              {totalStats.blocked > 0 && (
                <Badge variant="outline" className="text-[10px] bg-red-500/10">{totalStats.blocked} blocked</Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center border rounded-lg p-1 bg-muted/50">
            <Button 
              variant={viewMode === "kanban" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="gap-1.5"
              data-testid="button-view-kanban"
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-1.5"
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
              Lista
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kanban-board">
          {KANBAN_COLUMNS.map(column => {
            const Icon = column.icon;
            const items = columnData[column.id] || [];
            
            return (
              <div 
                key={column.id}
                className={`rounded-lg border-t-4 ${column.borderColor} ${column.bgColor}`}
                data-testid={`kanban-column-${column.id}`}
              >
                <div className="p-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${column.iconColor}`} />
                      <span className="font-medium text-sm">{column.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {items.length}
                    </Badge>
                  </div>
                </div>
                
                <div className="p-2 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                      Nenhuma iniciativa
                    </div>
                  ) : (
                    items.map(initiative => (
                      <InitiativeKanbanCard
                        key={initiative.id}
                        initiative={initiative}
                        resolveOwner={resolveOwner}
                        getKRTitle={getKRTitle}
                        krs={krs}
                        onClick={() => handleInitiativeClick(initiative)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {filteredInitiatives.length === 0 ? (
              <EmptyState 
                title="Nenhuma iniciativa encontrada"
                description="Tente ajustar os filtros para ver mais resultados."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[300px]">Título</TableHead>
                      <TableHead className="w-[80px]">Objetivo</TableHead>
                      <TableHead className="w-[70px]">Quarter</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[150px]">Owner</TableHead>
                      <TableHead className="w-[200px]">KRs Vinculados</TableHead>
                      <TableHead className="w-[150px]">Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInitiatives.map((initiative) => {
                      const title = initiative.name || initiative.title || "—";
                      const krIds = initiative.krs || initiative.krIds || [];
                      const tags = initiative.tags || [];
                      const ownerEmail = initiative.owner_email || initiative.ownerRole;
                      
                      return (
                        <TableRow 
                          key={initiative.id} 
                          className="hover-elevate cursor-pointer"
                          data-testid={`row-initiative-${initiative.id}`}
                          onClick={() => handleInitiativeClick(initiative)}
                        >
                          <TableCell className="font-medium">
                            <div className="max-w-[280px] truncate" title={title}>
                              {title}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ObjectiveBadge objective={initiative.objectiveId} />
                          </TableCell>
                          <TableCell>
                            {initiative.quarter ? (
                              <QuarterBadge quarter={initiative.quarter} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <InitiativeStatusBadge status={initiative.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                                {resolveOwner(ownerEmail) !== "—" 
                                  ? resolveOwner(ownerEmail).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                                  : "?"
                                }
                              </div>
                              <span className="text-sm truncate max-w-[100px]">
                                {resolveOwner(ownerEmail)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {krIds.slice(0, 3).map((krId) => (
                                <Tooltip key={krId}>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <KRLinkBadge krKey={krId} />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {getKRTitle(krId)}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {krIds.length > 3 && (
                                <Badge variant="outline" className="text-[10px]">
                                  +{krIds.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[130px]">
                              {tags.slice(0, 2).map((tag) => (
                                <TagBadge key={tag} tag={tag} />
                              ))}
                              {tags.length > 2 && (
                                <Badge variant="outline" className="text-[10px]">
                                  +{tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <InitiativeDrawer
        initiative={selectedInitiative}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        resolveOwner={resolveOwner}
        getKRTitle={getKRTitle}
        krs={krs}
      />
    </div>
  );
}

interface BPMetricMonth {
  month: string;
  plan: number | null;
  actual: number | null;
  variance: number | null;
  status: "green" | "yellow" | "red" | "gray";
}

interface BPMetric {
  metric_key: string;
  title: string;
  unit: "BRL" | "COUNT" | "PCT";
  direction: string;
  is_derived: boolean;
  order: number;
  months: BPMetricMonth[];
  totals: {
    plan: number | null;
    actual: number | null;
  };
}

interface BPFinanceiroResponse {
  year: number;
  currentMonth: string | null;
  months: string[];
  metrics: BPMetric[];
  meta: {
    generatedAt: string;
    totalMetrics: number;
  };
}

type BPDisplayMode = "actual" | "plan" | "variance";

function BPFinanceiroTab() {
  const [displayMode, setDisplayMode] = useState<BPDisplayMode>("actual");
  
  const { data, isLoading, error } = useQuery<BPFinanceiroResponse>({
    queryKey: ["/api/okr2026/bp-financeiro"],
  });

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return "—";
    if (unit === "PCT") return `${(value * 100).toFixed(1)}%`;
    if (unit === "COUNT") return formatNumber(value);
    return formatCurrency(value);
  };

  const formatVariance = (variance: number | null) => {
    if (variance === null) return "—";
    const sign = variance >= 0 ? "+" : "";
    return `${sign}${variance.toFixed(1)}%`;
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "green": return "bg-emerald-50 dark:bg-emerald-950/40";
      case "yellow": return "bg-amber-50 dark:bg-amber-950/40";
      case "red": return "bg-rose-50 dark:bg-rose-950/40";
      default: return "bg-muted/30";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "green": return "text-green-600 dark:text-green-400";
      case "yellow": return "text-yellow-600 dark:text-yellow-400";
      case "red": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getSignalDot = (status: string) => {
    switch (status) {
      case "green": return "bg-green-500";
      case "yellow": return "bg-yellow-500";
      case "red": return "bg-red-500";
      default: return "bg-muted-foreground/30";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Erro ao carregar BP Financeiro</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Não foi possível carregar os dados do Business Plan 2026. Verifique sua conexão e tente novamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getMonthLabel = (month: string) => {
    const monthNum = parseInt(month.split("-")[1]);
    const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return labels[monthNum - 1] || month;
  };

  const keyMetrics = data.metrics.filter(m => 
    ["receita_liquida", "margem_bruta", "mrr_ativo"].includes(m.metric_key)
  );

  const getMetricIcon = (key: string) => {
    switch (key) {
      case "mrr_ativo": return <TrendingUp className="w-5 h-5" />;
      case "receita_liquida": return <Banknote className="w-5 h-5" />;
      case "ebitda": return <PiggyBank className="w-5 h-5" />;
      case "margem_bruta": return <TrendingUp className="w-5 h-5" />;
      default: return <DollarSign className="w-5 h-5" />;
    }
  };

  const calculateProgress = (actual: number | null, plan: number | null) => {
    if (actual === null || plan === null || plan === 0) return null;
    return Math.round((actual / plan) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {keyMetrics.map((metric) => {
          const progress = calculateProgress(metric.totals.actual, metric.totals.plan);
          const isOnTrack = progress !== null && progress >= 90;
          return (
            <Card key={metric.metric_key} className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-card/80">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${isOnTrack ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'}`}>
                    {getMetricIcon(metric.metric_key)}
                  </div>
                  {progress !== null && (
                    <Badge variant="outline" className={`text-xs font-medium ${isOnTrack ? 'border-emerald-300 text-emerald-600 dark:text-emerald-400' : 'border-amber-300 text-amber-600 dark:text-amber-400'}`}>
                      {progress}%
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">{metric.title}</p>
                  <p className="text-2xl font-bold tracking-tight">
                    {formatValue(metric.totals.actual, metric.unit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Meta: {formatValue(metric.totals.plan, metric.unit)}
                  </p>
                </div>
                {progress !== null && (
                  <Progress value={Math.min(progress, 100)} className="h-1.5 mt-3" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">BP 2026 — Financeiro</CardTitle>
                  <CardDescription className="mt-0.5">
                    Acompanhamento Plan vs Actual por métrica e mês
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                  <span className="text-muted-foreground">No alvo</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50" />
                  <span className="text-muted-foreground">Atenção</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                  <span className="text-muted-foreground">Fora</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  <span className="text-muted-foreground">Sem dados</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Exibir:</span>
              <div className="inline-flex rounded-lg bg-muted p-1 gap-1" data-testid="toggle-bp-display-mode">
                <button
                  onClick={() => setDisplayMode("actual")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    displayMode === "actual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="toggle-bp-actual"
                >
                  Actual
                </button>
                <button
                  onClick={() => setDisplayMode("plan")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    displayMode === "plan"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="toggle-bp-plan"
                >
                  Plan
                </button>
                <button
                  onClick={() => setDisplayMode("variance")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    displayMode === "variance"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="toggle-bp-variance"
                >
                  Variance %
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold text-sm sticky left-0 bg-muted/30 backdrop-blur-sm z-10 min-w-[200px] border-r border-border/50">
                    Métrica
                  </th>
                  {data.months.map(m => (
                    <th key={m} className="text-center py-3 px-2 font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[80px]">
                      {getMonthLabel(m)}
                    </th>
                  ))}
                  <th className="text-center py-3 px-4 font-semibold text-sm min-w-[100px] border-l-2 border-primary/20 bg-primary/5">
                    YTD
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.metrics.map((metric, idx) => (
                  <tr 
                    key={metric.metric_key} 
                    className={`group transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                    data-testid={`row-bp-${metric.metric_key}`}
                  >
                    <td className={`py-3 px-4 sticky left-0 z-10 border-r border-border/50 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'} group-hover:bg-muted/40 transition-colors`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-help">
                            <span className="font-medium text-sm">{metric.title}</span>
                            {metric.is_derived && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                calc
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1">
                            <div className="font-semibold">{metric.title}</div>
                            <div className="text-xs text-muted-foreground">
                              Chave: {metric.metric_key}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {metric.direction === "up" ? "↑ Maior é melhor" : metric.direction === "down" ? "↓ Menor é melhor" : "→ Estável"}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    {metric.months.map((m) => {
                      const displayValue = displayMode === "plan" 
                        ? formatValue(m.plan, metric.unit)
                        : displayMode === "variance" 
                          ? formatVariance(m.variance)
                          : formatValue(m.actual, metric.unit);
                      
                      const showSignal = displayMode !== "plan";
                      const cellStatus = m.status || "gray";
                      
                      return (
                        <td key={m.month} className="py-2 px-1 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 min-w-[70px] transition-colors ${showSignal ? getStatusBg(cellStatus) : "bg-muted/30"} hover:brightness-95 dark:hover:brightness-110`}>
                                {showSignal && (
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSignalDot(cellStatus)}`} />
                                )}
                                <span className={`text-xs font-semibold ${showSignal ? getStatusText(cellStatus) : "text-foreground"}`}>
                                  {displayValue}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-2 min-w-[160px]">
                                <div className="font-semibold border-b pb-1">{metric.title}</div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Plan:</span>
                                  <span className="font-medium">{formatValue(m.plan, metric.unit)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Actual:</span>
                                  <span className="font-medium">{m.actual !== null ? formatValue(m.actual, metric.unit) : "Sem dados"}</span>
                                </div>
                                {m.variance !== null && (
                                  <div className={`flex items-center justify-between text-xs pt-1 border-t ${m.variance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                    <span>Variance:</span>
                                    <span className="font-semibold">{formatVariance(m.variance)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-xs pt-1 border-t">
                                  <span className="text-muted-foreground">Status:</span>
                                  <div className={`w-2 h-2 rounded-full ${getSignalDot(cellStatus)}`} />
                                  <span className={`font-medium ${getStatusText(cellStatus)}`}>
                                    {cellStatus === "green" ? "No alvo" : cellStatus === "yellow" ? "Atenção" : cellStatus === "red" ? "Fora" : "Sem dados"}
                                  </span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-center border-l-2 border-primary/20 bg-primary/5">
                      {(() => {
                        const ytdVariance = metric.totals.actual !== null && metric.totals.plan !== null && metric.totals.plan !== 0
                          ? ((metric.totals.actual - metric.totals.plan) / metric.totals.plan) * 100
                          : null;
                        const ytdDisplayValue = displayMode === "plan"
                          ? formatValue(metric.totals.plan, metric.unit)
                          : displayMode === "variance"
                            ? formatVariance(ytdVariance)
                            : formatValue(metric.totals.actual, metric.unit);
                        
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center cursor-help">
                                <div className="text-sm font-bold text-foreground">
                                  {ytdDisplayValue}
                                </div>
                                {displayMode === "actual" && (
                                  <div className="text-[10px] text-muted-foreground font-medium">
                                    / {metric.totals.plan !== null ? formatValue(metric.totals.plan, metric.unit) : "—"}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1 min-w-[140px]">
                                <div className="font-semibold border-b pb-1">{metric.title} (YTD)</div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Plan:</span>
                                  <span className="font-medium">{formatValue(metric.totals.plan, metric.unit)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Actual:</span>
                                  <span className="font-medium">{formatValue(metric.totals.actual, metric.unit)}</span>
                                </div>
                                {ytdVariance !== null && (
                                  <div className={`flex items-center justify-between text-xs pt-1 border-t ${ytdVariance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                    <span>Variance:</span>
                                    <span className="font-semibold">{formatVariance(ytdVariance)}</span>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        Atualizado em {new Date(data.meta.generatedAt).toLocaleString("pt-BR")}
        <span className="text-border">•</span>
        {data.meta.totalMetrics} métricas
      </div>
    </div>
  );
}

interface SquadGoal {
  id: number;
  squad: string;
  perspective: string;
  metricName: string;
  unit: string;
  periodicity: string;
  dataSource: string | null;
  ownerTeam: string | null;
  actualValue: number | null;
  targetValue: number | null;
  score: number | null;
  weight: number;
  notes: string | null;
  year: number;
  quarter: string | null;
  month: string | null;
  updatedAt: string;
}

interface SquadGoalsResponse {
  goals: SquadGoal[];
}

const PERSPECTIVES = [
  { id: "financeiro", label: "Financeiro", icon: DollarSign, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { id: "cliente", label: "Cliente", icon: Users, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { id: "processo", label: "Processo", icon: ClipboardCheck, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { id: "pessoas", label: "Pessoas", icon: Heart, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
];

const SQUADS = ["Commerce", "TurboOH", "Ventures", "Tech", "G&G", "Finance"];

function SquadGoalsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterSquad, setFilterSquad] = useState<string>("all");
  const [filterPerspective, setFilterPerspective] = useState<string>("all");

  const { data, isLoading, error, refetch } = useQuery<SquadGoalsResponse>({
    queryKey: ["/api/okr2026/squad-goals", { year: 2026 }],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/okr2026/seed-squad-goals");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Seed realizado", description: "Metas de squad populadas com sucesso." });
      refetch();
    },
    onError: () => {
      toast({ title: "Erro no seed", description: "Falha ao popular metas.", variant: "destructive" });
    }
  });

  const goals = data?.goals || [];

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      if (filterSquad !== "all" && g.squad !== filterSquad) return false;
      if (filterPerspective !== "all" && g.perspective !== filterPerspective) return false;
      return true;
    });
  }, [goals, filterSquad, filterPerspective]);

  const goalsByPerspective = useMemo(() => {
    const grouped: Record<string, SquadGoal[]> = {};
    for (const p of PERSPECTIVES) {
      grouped[p.id] = filteredGoals.filter(g => g.perspective.toLowerCase() === p.id);
    }
    return grouped;
  }, [filteredGoals]);

  const calculateScore = (actual: number | null, target: number | null) => {
    if (actual === null || target === null || target === 0) return null;
    return Math.round((actual / target) * 100);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400";
    if (score >= 100) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    if (score >= 80) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return "—";
    if (unit === "PCT" || unit === "%") return `${(value * 100).toFixed(1)}%`;
    if (unit === "BRL" || unit === "R$") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar metas</h3>
          <p className="text-muted-foreground">
            Não foi possível carregar as metas dos squads.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Target className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhuma meta cadastrada</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            As metas por squad ainda não foram configuradas. Clique abaixo para popular com dados de exemplo.
          </p>
          {user?.role === "admin" && (
            <Button 
              onClick={() => seedMutation.mutate()} 
              disabled={seedMutation.isPending}
              data-testid="button-seed-squad-goals"
            >
              {seedMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Populando...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Popular Metas de Vendas
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={filterSquad} onValueChange={setFilterSquad}>
          <SelectTrigger className="w-[160px]" data-testid="select-squad-filter">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Squads</SelectItem>
            {SQUADS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPerspective} onValueChange={setFilterPerspective}>
          <SelectTrigger className="w-[180px]" data-testid="select-perspective-filter">
            <SelectValue placeholder="Perspectiva" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Perspectivas</SelectItem>
            {PERSPECTIVES.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1">
          <Target className="w-3.5 h-3.5" />
          {filteredGoals.length} metas
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PERSPECTIVES.filter(p => filterPerspective === "all" || filterPerspective === p.id).map(perspective => {
          const perspectiveGoals = goalsByPerspective[perspective.id] || [];
          const PerspectiveIcon = perspective.icon;

          if (perspectiveGoals.length === 0 && filterPerspective === "all") return null;

          return (
            <Card key={perspective.id} className="overflow-hidden border-0 shadow-md">
              <CardHeader className={`pb-3 ${perspective.color}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background/80 backdrop-blur-sm">
                    <PerspectiveIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{perspective.label}</CardTitle>
                    <CardDescription className="text-current/70">
                      {perspectiveGoals.length} {perspectiveGoals.length === 1 ? "métrica" : "métricas"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {perspectiveGoals.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">Nenhuma métrica nesta perspectiva</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Métrica</TableHead>
                        <TableHead className="font-semibold text-center w-[80px]">Squad</TableHead>
                        <TableHead className="font-semibold text-right w-[90px]">Atual</TableHead>
                        <TableHead className="font-semibold text-right w-[90px]">Meta</TableHead>
                        <TableHead className="font-semibold text-center w-[70px]">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perspectiveGoals.map((goal) => {
                        const score = goal.score ?? calculateScore(goal.actualValue, goal.targetValue);
                        return (
                          <TableRow key={goal.id} className="group">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{goal.metricName}</span>
                                {goal.ownerTeam && (
                                  <span className="text-xs text-muted-foreground">{goal.ownerTeam}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {goal.squad}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatValue(goal.actualValue, goal.unit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {formatValue(goal.targetValue, goal.unit)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${getScoreColor(score)} border-0 font-semibold min-w-[50px]`}>
                                {score !== null ? `${score}%` : "—"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredGoals.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Resumo por Squad</CardTitle>
                <CardDescription>Score médio ponderado por squad</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {SQUADS.map(squad => {
                const squadGoals = filteredGoals.filter(g => g.squad === squad);
                if (squadGoals.length === 0) return null;

                const avgScore = squadGoals.reduce((sum, g) => {
                  const score = g.score ?? calculateScore(g.actualValue, g.targetValue);
                  return sum + (score || 0);
                }, 0) / squadGoals.length;

                return (
                  <div key={squad} className="p-4 rounded-xl bg-muted/50 text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">{squad}</p>
                    <p className={`text-2xl font-bold ${avgScore >= 100 ? "text-green-600" : avgScore >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                      {Math.round(avgScore)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{squadGoals.length} métricas</p>
                    <Progress value={Math.min(avgScore, 100)} className="h-1.5 mt-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


export default function OKR2026() {
  const { toast } = useToast();
  usePageTitle("OKR 2026");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const currentQuarter = getCurrentQuarter();

  const { data, isLoading, error } = useQuery<SummaryResponse>({
    queryKey: ["/api/okr2026/summary", { bu: "all" }],
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
        return <DashboardTab data={data} onTabChange={setActiveTab} />;
      case "krs":
        return <KRsTab data={data} />;
      case "initiatives":
        return <InitiativesTab data={data} collaborators={collaborators} />;
      case "bp-financeiro":
        return <BPFinanceiroTab />;
      case "metas-squad":
        return <SquadGoalsTab />;
      default:
        return <DashboardTab data={data} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="h-full overflow-auto" data-testid="page-okr-2026">
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-b">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-primary/10 shadow-lg shadow-primary/5">
                <Target className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
                  OKR 2026
                </h1>
                <p className="text-xl text-muted-foreground font-medium mt-0.5">
                  Bigger & Better
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Consolidação, Escala e Padronização
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="text-sm px-4 py-1.5 bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                2026
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="inline-flex h-11 items-center justify-start gap-1 rounded-xl bg-muted/50 p-1 backdrop-blur-sm">
            <TabsTrigger 
              value="dashboard" 
              data-testid="tab-dashboard"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="krs" 
              data-testid="tab-krs"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              KRs
            </TabsTrigger>
            <TabsTrigger 
              value="initiatives" 
              data-testid="tab-initiatives"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Iniciativas
            </TabsTrigger>
            <TabsTrigger 
              value="bp-financeiro" 
              data-testid="tab-bp-financeiro"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              BP Financeiro
            </TabsTrigger>
            <TabsTrigger 
              value="metas-squad" 
              data-testid="tab-metas-squad"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Metas Squad
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
