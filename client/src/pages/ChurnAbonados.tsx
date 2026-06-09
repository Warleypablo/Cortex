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
import { formatCurrency } from "@/lib/utils";
import { TrendingDown, DollarSign, Users, Calendar, Shield } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  Legend,
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
              ? "bg-amber-500 text-white shadow-sm"
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

  const [anoMes, setAnoMes] = useState(() => format(new Date(), "yyyy-MM"));
  const [filterSquad, setFilterSquad] = useState<string>("todos");
  const [motivoToggle, setMotivoToggle] = useState<"mrr" | "volume">("mrr");
  const [temporalToggle, setTemporalToggle] = useState<"mrr" | "volume">("mrr");

  const refDate = useMemo(() => {
    const [year, month] = anoMes.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [anoMes]);

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
    () => (data?.contratos ?? []).filter((c) => c.is_abonado),
    [data]
  );

  const mesInicio = format(startOfMonth(refDate), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(refDate), "yyyy-MM-dd");

  const abonadosMes = useMemo(
    () =>
      abonados12m.filter((c) => {
        const d = c.data_encerramento ?? "";
        return (
          d >= mesInicio &&
          d <= mesFim &&
          (filterSquad === "todos" || c.squad === filterSquad)
        );
      }),
    [abonados12m, mesInicio, mesFim, filterSquad]
  );

  const squads = useMemo(() => data?.filtros?.squads ?? [], [data]);

  const heroMetrics = useMemo(() => {
    const count = abonadosMes.length;
    const mrr = abonadosMes.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ticketMedio = count > 0 ? mrr / count : 0;
    const byMotivo: Record<string, number> = {};
    abonadosMes.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      byMotivo[m] = (byMotivo[m] || 0) + 1;
    });
    const maiorMotivo =
      Object.entries(byMotivo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { count, mrr, ticketMedio, maiorMotivo };
  }, [abonadosMes]);

  const motivoData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      if (!map[m]) map[m] = { count: 0, mrr: 0 };
      map[m].count++;
      map[m].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([motivo, v]) => ({ motivo, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosMes]);

  const submotivoData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes
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
  }, [abonadosMes]);

  const squadData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes.forEach((c) => {
      const s = c.squad || "Sem Squad";
      if (!map[s]) map[s] = { count: 0, mrr: 0 };
      map[s].count++;
      map[s].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([squad, v]) => ({ squad, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosMes]);

  const responsavelData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes.forEach((c) => {
      const r = c.responsavel || "Não especificado";
      if (!map[r]) map[r] = { count: 0, mrr: 0 };
      map[r].count++;
      map[r].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([responsavel, v]) => ({ responsavel, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [abonadosMes]);

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

    const filtrados = abonados12m.filter(
      (c) => filterSquad === "todos" || c.squad === filterSquad
    );

    filtrados.forEach((c) => {
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
  }, [abonados12m, refDate, filterSquad]);

  const monthOptions = useMemo(() => {
    const opts = [];
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

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-4 w-0.5 rounded-full bg-amber-500" />
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {children}
        </h2>
        <div className="flex-1 h-px bg-border/60" />
      </div>
    );
  }

  function EmptyState() {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Shield className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum abonado no período</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-50 via-orange-50/60 to-background dark:from-amber-950/40 dark:via-orange-950/20 dark:to-background p-6">
        <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.06] pointer-events-none">
          <Shield className="w-full h-full text-amber-500" />
        </div>
        <div className="flex items-start justify-between gap-4 relative">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800/50 shadow-sm">
              <Shield className="h-7 w-7 text-amber-600 dark:text-amber-400" />
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
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {heroMetrics.count}
              </div>
              <div className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">
                abonados no mês
              </div>
            </div>
          )}
        </div>

        {/* Filtros integrados ao header */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-amber-200/60 dark:border-amber-800/30">
          <Select value={anoMes} onValueChange={setAnoMes}>
            <SelectTrigger className="h-8 w-[190px] text-xs bg-white/70 dark:bg-zinc-900/70 border-amber-200 dark:border-amber-800/50">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSquad} onValueChange={setFilterSquad}>
            <SelectTrigger className="h-8 w-[190px] text-xs bg-white/70 dark:bg-zinc-900/70 border-amber-200 dark:border-amber-800/50">
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

      {/* Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Contratos</span>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{heroMetrics.count}</div>
          <div className="text-xs text-amber-600/60 dark:text-amber-400/60 mt-1">abonados no período</div>
        </div>

        <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-100 dark:border-orange-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">MRR Abonado</span>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300 tabular-nums leading-tight">{formatCurrency(heroMetrics.mrr)}</div>
          <div className="text-xs text-orange-600/60 dark:text-orange-400/60 mt-1">não contabilizado como churn</div>
        </div>

        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-xl border border-yellow-100 dark:border-yellow-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Ticket Médio</span>
            <Users className="h-4 w-4 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 tabular-nums leading-tight">{formatCurrency(heroMetrics.ticketMedio)}</div>
          <div className="text-xs text-yellow-600/60 dark:text-yellow-400/60 mt-1">por contrato abonado</div>
        </div>

        <div className="p-4 bg-stone-50 dark:bg-stone-900/30 rounded-xl border border-stone-200 dark:border-stone-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Maior Motivo</span>
            <Calendar className="h-4 w-4 text-stone-400" />
          </div>
          <div className="text-base font-bold text-stone-700 dark:text-stone-200 leading-tight">{heroMetrics.maiorMotivo}</div>
          <div className="text-xs text-stone-500/60 dark:text-stone-400/60 mt-1">motivo mais frequente</div>
        </div>
      </div>

      {/* Seção 1: Por Motivo */}
      <section>
        <SectionTitle>Por Motivo</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/60">
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
                  <BarChart data={motivoData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="motivo" width={170} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={tooltipFormatter}
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                    />
                    <Bar dataKey={motivoBarKey} fill="#f59e0b" radius={[0, 6, 6, 0]} />
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
                      <tr key={row.submotivo} className="border-b border-border/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors">
                        <td className="py-2.5 text-foreground">{row.submotivo}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums">{row.count}</td>
                        <td className="py-2.5 text-right text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{formatCurrency(row.mrr)}</td>
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
                  <BarChart data={squadData} margin={{ top: 8, right: 24, bottom: 48, left: 8 }}>
                    <XAxis dataKey="squad" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis hide />
                    <Tooltip
                      formatter={tooltipFormatter}
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                    />
                    <Bar dataKey="mrr" fill="#f59e0b" radius={[6, 6, 0, 0]} name="mrr" />
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
                  <BarChart data={responsavelData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="responsavel" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={tooltipFormatter}
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                    />
                    <Bar dataKey="count" fill="#fb923c" radius={[0, 6, 6, 0]} name="count" />
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
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-xs text-muted-foreground">Abono Manual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <span className="text-xs text-muted-foreground">Abono Automático</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={temporalData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="gradManual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradAuto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                />
                <Area
                  type="monotone"
                  dataKey={temporalManualKey}
                  stackId="1"
                  fill="url(#gradManual)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name={temporalManualKey}
                />
                <Area
                  type="monotone"
                  dataKey={temporalAutoKey}
                  stackId="1"
                  fill="url(#gradAuto)"
                  stroke="#fb923c"
                  strokeWidth={2}
                  name={temporalAutoKey}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
