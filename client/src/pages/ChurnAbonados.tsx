import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyNoDecimals } from "@/lib/utils";
import { getSquadColor } from "@/lib/squadColors";
import { TrendingDown, DollarSign, Users, Calendar, Shield, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import {
  format,
  parseISO,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface AbonadoContract {
  id: string;
  cliente_nome: string;
  produto: string;
  squad: string;
  responsavel: string;
  valorr: number;
  data_encerramento: string | null;
  motivo_cancelamento?: string;
  submotivo?: string | null;
  is_abonado?: boolean;
}

interface ChurnDetalhamentoData {
  contratos: AbonadoContract[];
  filtros: {
    squads: string[];
  };
}

const MOTIVOS_AUTOMATICOS = ["Inadimplente 1º Mês", "Não começou", "Erro na Venda"];

// Cores dos fills de gráfico. Hex fixos (não as vars de tema) porque --primary vira
// navy quase preto no light mode e --chart-2 alterna roxo↔azul entre temas — o que
// apagaria a distinção manual×automático. Azul/roxo vivos funcionam em dark e light.
// Os elementos de UI (número hero, toggle, marcador) seguem o tema via classes -primary.
const PRIMARY = "#3b82f6";
const PURPLE = "#8b5cf6";

// Squads vêm do ClickUp com prefixo de emoji ("🪖 Selva", "⚡Makers"). Limpa o
// prefixo antes de mapear a cor; passa o índice para variar o fallback dos
// squads sem cor fixa (Olimpo, Aura, Não especificado).
function squadColor(squad: string, index: number): string {
  // Remove o prefixo de emoji/variation-selector/espaço até a 1ª letra latina
  // (sem \p{L}/flag u, que exige target es6+ no tsc deste projeto).
  const clean = (squad || "").replace(/^[^A-Za-zÀ-ÿ]+/, "").trim();
  return getSquadColor(clean, index);
}

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-muted rounded-full p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-0.5 text-xs font-medium rounded-full transition-all ${
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ChurnAbonados() {
  usePageTitle("Churns Abonados");
  useSetPageInfo("Churns Abonados", "Análise de contratos com churn abonado");

  // "12m" = últimos 12 meses (default). Caso contrário, um mês específico (yyyy-MM).
  const [periodo, setPeriodo] = useState<string>("12m");
  const [filterSquad, setFilterSquad] = useState<string>("todos");
  const [motivoToggle, setMotivoToggle] = useState<"mrr" | "volume">("mrr");
  const [temporalToggle, setTemporalToggle] = useState<"mrr" | "volume">("mrr");
  const [selectedFilter, setSelectedFilter] = useState<{
    type: "motivo" | "squad" | "responsavel" | "mes";
    value: string;
    mesKey?: string;
  } | null>(null);

  const isAll = periodo === "12m";

  // Mês de referência: hoje quando "12m", ou o mês escolhido para drill.
  const refDate = useMemo(() => {
    const ref = isAll ? format(new Date(), "yyyy-MM") : periodo;
    const [year, month] = ref.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [isAll, periodo]);

  const dataInicio12m = useMemo(
    () => format(startOfMonth(subMonths(refDate, 11)), "yyyy-MM-dd"),
    [refDate]
  );
  const dataFim12m = useMemo(
    () => format(endOfMonth(refDate), "yyyy-MM-dd"),
    [refDate]
  );

  const { data, isLoading, error } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", dataInicio12m, dataFim12m],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dataInicio12m,
        endDate: dataFim12m,
      });
      const res = await fetch(
        `/api/analytics/churn-detalhamento?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  const abonados12m = useMemo(
    () =>
      (data?.contratos ?? [])
        .filter((c) => c.is_abonado)
        .filter((c) => filterSquad === "todos" || c.squad === filterSquad),
    [data, filterSquad]
  );

  const mesInicio = format(startOfMonth(refDate), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(refDate), "yyyy-MM-dd");

  const abonadosMes = useMemo(
    () =>
      abonados12m.filter((c) => {
        const d = c.data_encerramento ?? "";
        return d >= mesInicio && d <= mesFim;
      }),
    [abonados12m, mesInicio, mesFim]
  );

  // Mês específico sem abonados → cai para a visão de 12 meses (nunca fica vazio).
  const mesVazio = !isAll && abonadosMes.length === 0 && abonados12m.length > 0;
  const usar12m = isAll || mesVazio;
  const abonadosAtivos = usar12m ? abonados12m : abonadosMes;

  const periodoLabel = usar12m
    ? "últimos 12 meses"
    : format(refDate, "MMMM 'de' yyyy", { locale: ptBR });
  const mesAtivoLabel = format(refDate, "MMMM 'de' yyyy", { locale: ptBR });

  const squads = useMemo(() => data?.filtros?.squads ?? [], [data]);

  const heroMetrics = useMemo(() => {
    const count = abonadosAtivos.length;
    const mrr = abonadosAtivos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ticketMedio = count > 0 ? mrr / count : 0;
    const byMotivo: Record<string, number> = {};
    abonadosAtivos.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      byMotivo[m] = (byMotivo[m] || 0) + 1;
    });
    const maiorMotivo =
      Object.entries(byMotivo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { count, mrr, ticketMedio, maiorMotivo };
  }, [abonadosAtivos]);

  const motivoData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosAtivos.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      if (!map[m]) map[m] = { count: 0, mrr: 0 };
      map[m].count++;
      map[m].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([motivo, v]) => ({ motivo, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosAtivos]);

  const submotivoData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosAtivos
      .filter((c) => c.submotivo)
      .forEach((c) => {
        const s = c.submotivo!;
        if (!map[s]) map[s] = { count: 0, mrr: 0 };
        map[s].count++;
        map[s].mrr += c.valorr || 0;
      });
    return Object.entries(map)
      .map(([submotivo, v]) => ({ submotivo, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosAtivos]);

  const squadData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosAtivos.forEach((c) => {
      const s = c.squad || "Sem Squad";
      if (!map[s]) map[s] = { count: 0, mrr: 0 };
      map[s].count++;
      map[s].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([squad, v]) => ({ squad, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosAtivos]);

  const responsavelData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosAtivos.forEach((c) => {
      const r = c.responsavel || "Não especificado";
      if (!map[r]) map[r] = { count: 0, mrr: 0 };
      map[r].count++;
      map[r].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([responsavel, v]) => ({ responsavel, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [abonadosAtivos]);

  const drillContracts = useMemo(() => {
    if (!selectedFilter) return [];
    const { type, value, mesKey } = selectedFilter;
    if (type === "mes") {
      return abonados12m.filter(
        (c) => c.data_encerramento?.substring(0, 7) === mesKey
      );
    }
    return abonadosAtivos.filter((c) => {
      if (type === "motivo") return (c.motivo_cancelamento || "Não especificado") === value;
      if (type === "squad") return (c.squad || "Sem Squad") === value;
      if (type === "responsavel") return (c.responsavel || "Não especificado") === value;
      return false;
    });
  }, [selectedFilter, abonadosAtivos, abonados12m]);

  const temporalData = useMemo(() => {
    const months: Record<
      string,
      {
        manual: number;
        automatico: number;
        mrrManual: number;
        mrrAutomatico: number;
        sortKey: string;
      }
    > = {};

    for (let i = 11; i >= 0; i--) {
      const d = subMonths(refDate, i);
      const key = format(d, "MMM/yy", { locale: ptBR });
      months[key] = {
        manual: 0,
        automatico: 0,
        mrrManual: 0,
        mrrAutomatico: 0,
        sortKey: format(d, "yyyy-MM"),
      };
    }

    abonados12m.forEach((c) => {
      if (!c.data_encerramento) return;
      const d = parseISO(c.data_encerramento);
      const key = format(d, "MMM/yy", { locale: ptBR });
      if (!months[key]) return;
      const isManual = !MOTIVOS_AUTOMATICOS.includes(c.motivo_cancelamento ?? "");
      if (isManual) {
        months[key].manual++;
        months[key].mrrManual += c.valorr || 0;
      } else {
        months[key].automatico++;
        months[key].mrrAutomatico += c.valorr || 0;
      }
    });

    return Object.entries(months)
      .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
      .map(([mes, v]) => ({ mes, ...v }));
  }, [abonados12m, refDate]);

  // Rótulo do mês destacado no gráfico temporal (quando há um mês específico ativo).
  const mesDestaque = useMemo(
    () => (isAll ? null : format(refDate, "MMM/yy", { locale: ptBR })),
    [isAll, refDate]
  );

  const periodoOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "12m", label: "Últimos 12 meses" },
    ];
    for (let i = 0; i < 24; i++) {
      const d = subMonths(new Date(), i);
      opts.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM/yyyy", { locale: ptBR }),
      });
    }
    return opts;
  }, []);

  if (isLoading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando churns abonados...
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-destructive">
        Erro ao carregar dados.
      </div>
    );

  const motivoBarKey = motivoToggle === "mrr" ? "mrr" : "count";
  const temporalManualKey = temporalToggle === "mrr" ? "mrrManual" : "manual";
  const temporalAutoKey =
    temporalToggle === "mrr" ? "mrrAutomatico" : "automatico";

  const tooltipFormatter = (value: unknown, name: string) => {
    const v = Number(value);
    if (name === "mrrManual" || name === "mrr") return [formatCurrency(v), "MRR"];
    if (name === "mrrAutomatico") return [formatCurrency(v), "Abono Automático MRR"];
    if (name === "manual") return [v, "Abono Manual"];
    if (name === "automatico") return [v, "Abono Automático"];
    if (name === "count") return [v, "Contratos"];
    return [v, name];
  };

  const TOGGLE_OPTS = [
    { value: "mrr", label: "MRR" },
    { value: "volume", label: "Volume" },
  ];

  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--popover))",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
  };

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-4 w-0.5 rounded-full bg-primary" />
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {children}
        </h2>
        <div className="flex-1 h-px bg-border/60" />
      </div>
    );
  }

  function EmptyState() {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <Shield className="h-4 w-4 opacity-40" />
        <p className="text-sm">Nenhum abonado no período</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.04] pointer-events-none">
          <Shield className="w-full h-full text-primary" />
        </div>
        <div className="flex items-start justify-between gap-4 relative">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Churns Abonados
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Por motivo · Operacional · Evolução temporal
              </p>
            </div>
          </div>
          {heroMetrics.count > 0 && (
            <div className="text-right">
              <div className="text-3xl font-bold text-primary tabular-nums">
                {heroMetrics.count}
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                abonados · {periodoLabel}
              </div>
            </div>
          )}
        </div>

        {/* Filtros integrados ao header */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-[190px] text-xs bg-background border-border">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {periodoOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSquad} onValueChange={setFilterSquad}>
            <SelectTrigger className="h-8 w-[190px] text-xs bg-background border-border">
              <SelectValue placeholder="Squad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">Todos os squads</SelectItem>
              {squads.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Banner: mês selecionado sem abonados */}
      {mesVazio && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground -mt-4">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          Sem abonados em <span className="font-medium text-foreground">{mesAtivoLabel}</span> — exibindo a visão dos últimos 12 meses.
        </div>
      )}

      {/* Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contratos</span>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold text-primary tabular-nums">{heroMetrics.count}</div>
          <div className="text-xs text-muted-foreground mt-1">abonados no período</div>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">MRR Abonado</span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums leading-tight">{formatCurrency(heroMetrics.mrr)}</div>
          <div className="text-xs text-muted-foreground mt-1">não contabilizado como churn</div>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket Médio</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums leading-tight">{formatCurrency(heroMetrics.ticketMedio)}</div>
          <div className="text-xs text-muted-foreground mt-1">por contrato abonado</div>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Maior Motivo</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-base font-bold text-foreground leading-tight">{heroMetrics.maiorMotivo}</div>
          <div className="text-xs text-muted-foreground mt-1">motivo mais frequente</div>
        </div>
      </div>

      {/* Seção 1: Por Motivo */}
      <section>
        <SectionTitle>Por Motivo</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className={`border-border/60 ${submotivoData.length === 0 ? "lg:col-span-2" : ""}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Distribuição por Motivo</CardTitle>
              <SegmentedToggle
                options={TOGGLE_OPTS}
                value={motivoToggle}
                onChange={(v) => setMotivoToggle(v as "mrr" | "volume")}
              />
            </CardHeader>
            <CardContent>
              {motivoData.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={Math.max(motivoData.length * 52 + 20, 100)}>
                  <BarChart
                    data={motivoData}
                    layout="vertical"
                    margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                    style={{ cursor: "pointer" }}
                    onClick={(d) => {
                      const v = d?.activePayload?.[0]?.payload?.motivo;
                      if (v) setSelectedFilter({ type: "motivo", value: v });
                    }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="motivo" width={170} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                    <Bar dataKey={motivoBarKey} fill={PRIMARY} radius={[0, 6, 6, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {submotivoData.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Detalhamento por Submotivo</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Submotivo</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qtd</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submotivoData.map((row) => (
                      <tr key={row.submotivo} className="border-b border-border/40 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 text-foreground">{row.submotivo}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums">{row.count}</td>
                        <td className="py-2.5 text-right text-primary font-semibold tabular-nums">{formatCurrency(row.mrr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção 2: Operacional */}
      <section>
        <SectionTitle>Operacional</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Abonados por Squad</CardTitle>
            </CardHeader>
            <CardContent>
              {squadData.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={squadData}
                    margin={{ top: 8, right: 24, bottom: 48, left: 8 }}
                    style={{ cursor: "pointer" }}
                    onClick={(d) => {
                      const v = d?.activePayload?.[0]?.payload?.squad;
                      if (v) setSelectedFilter({ type: "squad", value: v });
                    }}
                  >
                    <XAxis dataKey="squad" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis hide />
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                    <Bar dataKey="mrr" radius={[6, 6, 0, 0]} name="mrr" isAnimationActive={false}>
                      {squadData.map((entry, i) => (
                        <Cell key={entry.squad} fill={squadColor(entry.squad, i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top 10 Responsáveis</CardTitle>
            </CardHeader>
            <CardContent>
              {responsavelData.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={Math.max(responsavelData.length * 44 + 20, 80)}>
                  <BarChart
                    data={responsavelData}
                    layout="vertical"
                    margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                    style={{ cursor: "pointer" }}
                    onClick={(d) => {
                      const v = d?.activePayload?.[0]?.payload?.responsavel;
                      if (v) setSelectedFilter({ type: "responsavel", value: v });
                    }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="responsavel" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={PRIMARY} radius={[0, 6, 6, 0]} name="count" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção 3: Evolução Temporal */}
      <section>
        <SectionTitle>Evolução Temporal</SectionTitle>
        <Card className="border-border/60">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Evolução Mês a Mês</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Últimos 12 meses — abono manual vs automático</p>
            </div>
            <SegmentedToggle
              options={TOGGLE_OPTS}
              value={temporalToggle}
              onChange={(v) => setTemporalToggle(v as "mrr" | "volume")}
            />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIMARY }} />
                <span className="text-xs text-muted-foreground">Abono Manual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PURPLE }} />
                <span className="text-xs text-muted-foreground">Abono Automático</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={temporalData}
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                style={{ cursor: "pointer" }}
                onClick={(d) => {
                  const p = d?.activePayload?.[0]?.payload;
                  if (p?.mes) setSelectedFilter({ type: "mes", value: p.mes, mesKey: p.sortKey });
                }}
              >
                <defs>
                  <linearGradient id="gradManual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradAuto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PURPLE} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={PURPLE} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                {mesDestaque && (
                  <ReferenceLine x={mesDestaque} stroke={PRIMARY} strokeDasharray="4 3" strokeOpacity={0.6} />
                )}
                <Area
                  type="monotone"
                  dataKey={temporalManualKey}
                  stackId="1"
                  fill="url(#gradManual)"
                  stroke={PRIMARY}
                  strokeWidth={2}
                  name={temporalManualKey}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={temporalAutoKey}
                  stackId="1"
                  fill="url(#gradAuto)"
                  stroke={PURPLE}
                  strokeWidth={2}
                  name={temporalAutoKey}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Drill-down side panel */}
      <Sheet open={!!selectedFilter} onOpenChange={(open) => { if (!open) setSelectedFilter(null); }}>
        <SheetContent side="right" className="w-[480px] sm:w-[540px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              {selectedFilter?.type === "motivo" && `Motivo: ${selectedFilter.value}`}
              {selectedFilter?.type === "squad" && `Squad: ${selectedFilter.value}`}
              {selectedFilter?.type === "responsavel" && `Responsável: ${selectedFilter.value}`}
              {selectedFilter?.type === "mes" && `Mês: ${selectedFilter.value}`}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              {drillContracts.length} contrato{drillContracts.length !== 1 ? "s" : ""} abonado{drillContracts.length !== 1 ? "s" : ""}
              {" · "}MRR total: {formatCurrencyNoDecimals(drillContracts.reduce((s, c) => s + (c.valorr ?? 0), 0))}
            </p>
          </SheetHeader>

          <div className="space-y-2">
            {drillContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato encontrado</p>
            ) : (
              drillContracts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{c.cliente_nome}</span>
                    <span className="text-sm font-semibold text-primary whitespace-nowrap">
                      {formatCurrencyNoDecimals(c.valorr ?? 0)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.produto && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {c.produto}
                      </span>
                    )}
                    {c.squad && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {c.squad}
                      </span>
                    )}
                    {c.responsavel && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {c.responsavel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{c.motivo_cancelamento ?? "Motivo não informado"}</span>
                    {c.data_encerramento && (
                      <span>{new Date(c.data_encerramento).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
