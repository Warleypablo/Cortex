import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  Activity,
  Users,
  Percent,
  Pause,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────

interface ChurnPorSquad {
  squad: string;
  mrr_ativo: number;
  mrr_perdido: number;
  percentual: number;
}

interface ChurnPorMotivo {
  motivo: string;
  mrr_perdido: number;
  quantidade: number;
  percentual: number;
}

interface ChurnDetalhamentoData {
  metricas: {
    total_churned: number;
    total_pausados: number;
    mrr_perdido: number;
    mrr_pausado: number;
    ltv_total: number;
    lt_medio: number;
    mrr_ativo_ref?: number;
    churn_percentual?: number;
    churn_por_squad?: ChurnPorSquad[];
    churn_por_motivo?: ChurnPorMotivo[];
  };
}

interface TendenciaItem {
  mes: string;
  totalChurned: number;
  mrrPerdido: number;
  mrrAtivo: number;
  churnRate: number;
}

interface TendenciaData {
  tendencia: TendenciaItem[];
}

// ── Constants ──────────────────────────────────────────

const SQUAD_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

const MOTIVO_LABELS: Record<string, string> = {
  resultado_fraco: "Resultado Fraco",
  falta_verba: "Falta de Verba",
  in_house: "In-House",
  concorrente: "Concorrente",
  qualidade_entrega: "Qualidade da Entrega",
  comunicacao: "Comunicação",
  timing: "Timing",
  inadimplencia: "Inadimplência",
  outros: "Outros",
  "Não especificado": "Não especificado",
};

const PERIODOS = [
  { label: "1M", meses: 1 },
  { label: "3M", meses: 3 },
  { label: "6M", meses: 6 },
  { label: "12M", meses: 12 },
];

// ── Formatting ─────────────────────────────────────────

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

// ── Components ─────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "default" | "danger" | "warning" | "success" | "info";
}) {
  const styles = {
    default: {
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/20",
      gradient: "from-primary/5 to-primary/10",
    },
    danger: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
      gradient: "from-red-500/5 to-red-500/10",
    },
    warning: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
      gradient: "from-amber-500/5 to-amber-500/10",
    },
    success: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800",
      gradient: "from-emerald-500/5 to-emerald-500/10",
    },
    info: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      gradient: "from-blue-500/5 to-blue-500/10",
    },
  };

  const s = styles[color];

  return (
    <Card className={`relative overflow-hidden border ${s.border}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-50`} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${s.bg}`}>
            <div className={s.text}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border rounded-xl shadow-xl p-4 min-w-[200px]">
      <p className="text-sm font-semibold mb-2 pb-2 border-b">{label}</p>
      <div className="space-y-2">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold">
              {entry.dataKey === "churnRate" ? `${entry.value.toFixed(2)}%` : formatCurrencyCompact(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Main Page ──────────────────────────────────────────

export default function ChurnVisaoGeral() {
  usePageTitle("Visão Geral de Churn");
  useSetPageInfo("Visão Geral Churn", "Análise de churn e retenção de clientes");

  const [periodoIdx, setPeriodoIdx] = useState(1); // default 3M
  const periodo = PERIODOS[periodoIdx];

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - periodo.meses);
    start.setDate(1);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [periodo.meses]);

  // KPIs e breakdowns do endpoint existente
  const { data: detalhamento, isLoading: isLoadingDet } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/churn-detalhamento?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Tendência mensal
  const { data: tendencia, isLoading: isLoadingTrend } = useQuery<TendenciaData>({
    queryKey: ["/api/analytics/churn-visao-geral", periodo.meses],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/churn-visao-geral?meses=${Math.max(periodo.meses, 6)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const m = detalhamento?.metricas;
  const isLoading = isLoadingDet;

  // Chart data for trend
  const trendData = useMemo(() => {
    if (!tendencia?.tendencia) return [];
    return tendencia.tendencia.map((t) => ({
      ...t,
      label: format(parseISO(t.mes), "MMM yy", { locale: ptBR }),
    }));
  }, [tendencia]);

  // Squad data sorted by churn rate
  const squadData = useMemo(() => {
    if (!m?.churn_por_squad) return [];
    return [...m.churn_por_squad]
      .filter((s) => s.mrr_perdido > 0)
      .sort((a, b) => b.mrr_perdido - a.mrr_perdido)
      .slice(0, 8);
  }, [m]);

  // Motivo data for donut
  const motivoData = useMemo(() => {
    if (!m?.churn_por_motivo) return [];
    return m.churn_por_motivo.map((mot) => ({
      label: MOTIVO_LABELS[mot.motivo] || mot.motivo,
      value: mot.mrr_perdido,
      quantidade: mot.quantidade,
      percentual: mot.percentual,
    }));
  }, [m]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visão Geral de Churn</h2>
          <p className="text-muted-foreground mt-1">Análise de churn e retenção de clientes</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          {PERIODOS.map((p, idx) => (
            <button
              key={p.label}
              onClick={() => setPeriodoIdx(idx)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all ${
                idx === periodoIdx
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : m ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              title="Churn Rate"
              value={`${(m.churn_percentual ?? 0).toFixed(2)}%`}
              subtitle={`Base: ${formatCurrencyCompact(m.mrr_ativo_ref ?? 0)} MRR`}
              icon={<Percent className="w-5 h-5" />}
              color={(m.churn_percentual ?? 0) > 5 ? "danger" : (m.churn_percentual ?? 0) > 3 ? "warning" : "success"}
            />
            <KpiCard
              title="MRR Perdido"
              value={formatCurrencyCompact(m.mrr_perdido)}
              subtitle={`${m.total_churned} contratos`}
              icon={<DollarSign className="w-5 h-5" />}
              color="danger"
            />
            <KpiCard
              title="Contratos Churned"
              value={String(m.total_churned)}
              subtitle={`No período de ${periodo.label}`}
              icon={<TrendingDown className="w-5 h-5" />}
              color="danger"
            />
            <KpiCard
              title="Lifetime Médio"
              value={`${m.lt_medio.toFixed(1)} meses`}
              subtitle="Antes do churn"
              icon={<Clock className="w-5 h-5" />}
              color="info"
            />
            <KpiCard
              title="Pausados"
              value={String(m.total_pausados)}
              subtitle={formatCurrencyCompact(m.mrr_pausado) + " MRR em risco"}
              icon={<Pause className="w-5 h-5" />}
              color="warning"
            />
          </div>

          {/* Evolução Mensal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Evolução Mensal do Churn
              </CardTitle>
              <CardDescription>MRR perdido e taxa de churn por mês</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoadingTrend ? (
                <Skeleton className="h-[350px]" />
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="mrrPerdidoGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.85} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        yAxisId="mrr"
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="rate"
                        orientation="right"
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Bar
                        yAxisId="mrr"
                        dataKey="mrrPerdido"
                        name="MRR Perdido"
                        fill="url(#mrrPerdidoGrad)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                      <Line
                        yAxisId="rate"
                        type="monotone"
                        dataKey="churnRate"
                        name="Churn Rate"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span className="text-sm text-muted-foreground">MRR Perdido</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-amber-500 rounded" />
                  <span className="text-sm text-muted-foreground">Churn Rate %</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Squad + Motivo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Churn por Squad */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-primary" />
                  Churn por Squad
                </CardTitle>
                <CardDescription>Taxa de churn e MRR perdido por squad</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {squadData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados de churn por squad
                  </div>
                ) : (
                  <div className="space-y-3">
                    {squadData.map((sq, i) => {
                      const maxMrr = Math.max(...squadData.map((s) => s.mrr_perdido), 1);
                      const barWidth = (sq.mrr_perdido / maxMrr) * 100;
                      const hasPct = sq.percentual > 0;
                      return (
                        <div key={sq.squad} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate max-w-[180px]">{sq.squad}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold">
                                {formatCurrencyCompact(sq.mrr_perdido)}
                              </span>
                              {hasPct && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-semibold min-w-[52px] justify-center ${
                                    sq.percentual > 5
                                      ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                      : sq.percentual > 3
                                        ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                                        : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                                  }`}
                                >
                                  {sq.percentual.toFixed(1)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Churn por Motivo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Churn por Motivo
                </CardTitle>
                <CardDescription>Distribuição de MRR perdido por motivo de cancelamento</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {motivoData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados de motivo
                  </div>
                ) : (
                  <div className="space-y-3">
                    {motivoData.map((mot, i) => {
                      const maxVal = Math.max(...motivoData.map((m) => m.value), 1);
                      const barWidth = (mot.value / maxVal) * 100;
                      return (
                        <div key={mot.label} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: SQUAD_COLORS[i % SQUAD_COLORS.length] }}
                              />
                              <span className="text-sm font-medium truncate">{mot.label}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {mot.quantidade} {mot.quantidade === 1 ? "contrato" : "contratos"}
                              </span>
                              <span className="text-sm font-semibold min-w-[70px] text-right">
                                {formatCurrencyCompact(mot.value)}
                              </span>
                              <Badge variant="outline" className="text-xs font-medium min-w-[42px] justify-center">
                                {mot.percentual.toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </div>
        </Card>
      )}
    </div>
  );
}
