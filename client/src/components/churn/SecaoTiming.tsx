import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  PieChart as RechartsPie,
  Pie,
} from "recharts";
import { DollarSign, Clock, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type ChurnContract } from "@/components/churn/types";
import { TechChartCard } from "@/components/churn/ui/TechChartCard";
import { SectionBlock } from "@/components/churn/ui/SectionBlock";
import { StatPill } from "@/components/churn/ui/StatPill";
import { CustomTooltip } from "@/components/churn/ui/CustomTooltip";
import { formatCurrencyNoDecimals, formatCurrency } from "@/lib/utils";

const REFINED_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

export interface SecaoTimingProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}

export function SecaoTiming({ contratos, onDrill }: SecaoTimingProps): JSX.Element {
  // ── Distribuição por Lifetime ──────────────────────────────────────────────
  const distribuicaoPorLifetime = useMemo(() => {
    if (contratos.length === 0) return [];

    const ranges = [
      { name: "< 3m", min: 0, max: 3, count: 0, mrr: 0 },
      { name: "3-6m", min: 3, max: 6, count: 0, mrr: 0 },
      { name: "6-12m", min: 6, max: 12, count: 0, mrr: 0 },
      { name: "12-24m", min: 12, max: 24, count: 0, mrr: 0 },
      { name: "> 24m", min: 24, max: Infinity, count: 0, mrr: 0 },
    ];

    contratos.forEach(c => {
      const lt = c.lifetime_meses;
      for (const range of ranges) {
        if (lt >= range.min && lt < range.max) {
          range.count++;
          range.mrr += c.valorr || 0;
          break;
        }
      }
    });

    const total = contratos.length;
    return ranges.map(r => ({
      ...r,
      percentual: (r.count / total) * 100,
    }));
  }, [contratos]);

  // ── Churn por Mês ─────────────────────────────────────────────────────────
  const churnPorMes = useMemo(() => {
    if (contratos.length === 0) return [];

    const meses: Record<string, { count: number; countAbonado: number; mrr: number; mrrAbonado: number; sortKey: string }> = {};
    contratos.forEach(c => {
      const refDate = c.tipo === "pausado" ? c.data_pausa : c.data_encerramento;
      if (!refDate) return;
      const parsedDate = parseISO(refDate);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");
      if (!meses[mes]) meses[mes] = { count: 0, countAbonado: 0, mrr: 0, mrrAbonado: 0, sortKey };
      if (c.is_abonado) {
        meses[mes].countAbonado++;
        meses[mes].mrrAbonado += c.valorr || 0;
      } else {
        meses[mes].count++;
        meses[mes].mrr += c.valorr || 0;
      }
    });

    return Object.entries(meses)
      .map(([mes, data]) => ({
        mes,
        count: data.count,
        countAbonado: data.countAbonado,
        mrr: data.mrr,
        mrrAbonado: data.mrrAbonado,
        sortKey: data.sortKey,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [contratos]);

  // ── Comparativo Mensal (MRR Churn vs Abonado) ─────────────────────────────
  const comparativoMensal = useMemo(() => {
    if (contratos.length === 0) return [];

    const meses: Record<string, { churn: number; pausado: number; abonado: number; mrrChurn: number; mrrPausado: number; mrrAbonado: number; sortKey: string }> = {};

    contratos.forEach(c => {
      const refDate = c.tipo === "pausado" ? c.data_pausa : c.data_encerramento;
      if (!refDate) return;
      const parsedDate = parseISO(refDate);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");

      if (!meses[mes]) meses[mes] = { churn: 0, pausado: 0, abonado: 0, mrrChurn: 0, mrrPausado: 0, mrrAbonado: 0, sortKey };

      if (c.is_abonado) {
        meses[mes].abonado++;
        meses[mes].mrrAbonado += c.valorr || 0;
      } else if (c.tipo === "churn") {
        meses[mes].churn++;
        meses[mes].mrrChurn += c.valorr || 0;
      } else if (c.tipo === "pausado") {
        meses[mes].pausado++;
        meses[mes].mrrPausado += c.valorr || 0;
      }
    });

    return Object.entries(meses)
      .map(([mes, data]) => ({ mes, ...data }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [contratos]);

  // ── Análise de Cohort ─────────────────────────────────────────────────────
  const cohortAnalysis = useMemo(() => {
    if (contratos.length === 0) return [];

    const churnContratos = contratos.filter(c => c.tipo === "churn" && !c.is_abonado && c.data_inicio);
    if (churnContratos.length === 0) return [];

    const cohorts: Record<string, { count: number; totalLifetime: number; totalMrr: number; sortKey: string }> = {};

    churnContratos.forEach(c => {
      if (!c.data_inicio) return;
      const startDate = parseISO(c.data_inicio);
      const cohort = format(startDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(startDate, "yyyy-MM");

      if (!cohorts[cohort]) {
        cohorts[cohort] = { count: 0, totalLifetime: 0, totalMrr: 0, sortKey };
      }
      cohorts[cohort].count++;
      cohorts[cohort].totalLifetime += c.lifetime_meses || 0;
      cohorts[cohort].totalMrr += c.valorr || 0;
    });

    return Object.entries(cohorts)
      .map(([cohort, data]) => ({
        cohort,
        count: data.count,
        avgLifetime: data.count > 0 ? data.totalLifetime / data.count : 0,
        avgMrr: data.count > 0 ? data.totalMrr / data.count : 0,
        sortKey: data.sortKey,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [contratos]);

  // ── Curva de Lifetime (Survival Curve) ────────────────────────────────────
  const lifetimeCurve = useMemo(() => {
    const contratosComLifetime = contratos.filter(c =>
      c.lifetime_meses !== undefined && c.lifetime_meses !== null && c.lifetime_meses >= 0
    );

    if (contratosComLifetime.length === 0) return [];

    const totalBase = contratosComLifetime.length;
    const totalMrrBase = contratosComLifetime.reduce((sum, c) => sum + (c.valorr || 0), 0);

    const curve: { monthIndex: number; retainedPct: number; mrrRetainedPct: number; retainedCount: number; totalStarted: number; churnedCount: number }[] = [];

    for (let month = 0; month <= 12; month++) {
      const sobreviventes = contratosComLifetime.filter(c => c.lifetime_meses >= month);
      const sobrevivMrr = sobreviventes.reduce((sum, c) => sum + (c.valorr || 0), 0);
      const churnedNoPeriodo = contratosComLifetime.filter(c =>
        c.lifetime_meses >= month && c.lifetime_meses < month + 1
      );

      const retainedPct = totalBase > 0 ? (sobreviventes.length / totalBase) * 100 : 0;
      const mrrRetainedPct = totalMrrBase > 0 ? (sobrevivMrr / totalMrrBase) * 100 : 0;

      curve.push({
        monthIndex: month,
        retainedPct: Math.round(retainedPct * 10) / 10,
        mrrRetainedPct: Math.round(mrrRetainedPct * 10) / 10,
        retainedCount: sobreviventes.length,
        totalStarted: totalBase,
        churnedCount: churnedNoPeriodo.length,
      });
    }

    return curve;
  }, [contratos]);

  // ── MRR Perdido por Mês ───────────────────────────────────────────────────
  const mrrPerdidoPorMes = useMemo(() => {
    if (contratos.length === 0) return [];

    const meses: Record<string, { mrr: number; mrrAbonado: number; sortKey: string }> = {};

    contratos.forEach(c => {
      if (c.tipo !== "churn") return;
      if (!c.data_encerramento) return;
      const parsedDate = parseISO(c.data_encerramento);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");

      if (!meses[mes]) meses[mes] = { mrr: 0, mrrAbonado: 0, sortKey };
      if (c.is_abonado) {
        meses[mes].mrrAbonado += c.valorr || 0;
      } else {
        meses[mes].mrr += c.valorr || 0;
      }
    });

    return Object.entries(meses)
      .map(([mes, data]) => ({ mes, mrr: data.mrr, mrrAbonado: data.mrrAbonado, sortKey: data.sortKey }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [contratos]);

  // ── Derived vars ─────────────────────────────────────────────────────────
  const churnPorMesTotal = churnPorMes.reduce((sum, item) => sum + item.count, 0);
  const churnPorMesMedia = churnPorMes.length > 0 ? churnPorMesTotal / churnPorMes.length : 0;
  const topLifetime = distribuicaoPorLifetime.length > 0
    ? distribuicaoPorLifetime.reduce((best, item) => (item.count > best.count ? item : best))
    : undefined;
  const mrrPerdidoTotal = mrrPerdidoPorMes.reduce((sum, item) => sum + item.mrr, 0);
  const mrrAbonadoTotal = mrrPerdidoPorMes.reduce((sum, item) => sum + item.mrrAbonado, 0);
  const comparativoChurnTotal = comparativoMensal.reduce((sum, item) => sum + item.mrrChurn, 0);
  const comparativoAbonadoTotal = comparativoMensal.reduce((sum, item) => sum + item.mrrAbonado, 0);
  const cohortMediaGeral = cohortAnalysis.length > 0
    ? cohortAnalysis.reduce((sum, item) => sum + item.avgLifetime, 0) / cohortAnalysis.length
    : 0;

  // ── Drill helpers ─────────────────────────────────────────────────────────
  const ranges = [
    { name: "< 3m", min: 0, max: 3 },
    { name: "3-6m", min: 3, max: 6 },
    { name: "6-12m", min: 6, max: 12 },
    { name: "12-24m", min: 12, max: 24 },
    { name: "> 24m", min: 24, max: Infinity },
  ];

  const handleLifetimeDrill = (name: string) => {
    const range = ranges.find(r => r.name === name);
    if (!range) return;
    const filtered = contratos.filter(c => c.lifetime_meses >= range.min && c.lifetime_meses < range.max);
    onDrill(`Lifetime ${name}`, filtered);
  };

  const handleMesDrill = (mes: string) => {
    const filtered = contratos.filter(c => {
      const refDate = c.tipo === "pausado" ? c.data_pausa : c.data_encerramento;
      if (!refDate) return false;
      return format(parseISO(refDate), "MMM/yy", { locale: ptBR }) === mes;
    });
    onDrill(`Churn ${mes}`, filtered);
  };

  const handleCohortDrill = (cohort: string) => {
    const filtered = contratos.filter(c => {
      if (!c.data_inicio || c.tipo !== "churn" || c.is_abonado) return false;
      return format(parseISO(c.data_inicio), "MMM/yy", { locale: ptBR }) === cohort;
    });
    onDrill(`Cohort ${cohort}`, filtered);
  };

  const handleMrrMesDrill = (mes: string) => {
    const filtered = contratos.filter(c => {
      if (c.tipo !== "churn" || !c.data_encerramento) return false;
      return format(parseISO(c.data_encerramento), "MMM/yy", { locale: ptBR }) === mes;
    });
    onDrill(`MRR Perdido ${mes}`, filtered);
  };

  return (
    <>
      {/* ── Seção: Jornada do Cliente ─────────────────────────────────────── */}
      <SectionBlock
        title="Jornada do Cliente"
        subtitle="Distribuição por lifetime e evolução mensal do churn"
        icon={Clock}
        accent="bg-gradient-to-r from-orange-500 to-amber-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Churn por Mês */}
          <TechChartCard
            title="Churn por Mês"
            subtitle="Evolução mensal de contratos encerrados"
            icon={BarChart3}
            iconBg="bg-gradient-to-r from-orange-500 to-amber-500"
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <StatPill label="Total 12m" value={`${churnPorMesTotal} contratos`} />
                <StatPill label="Média" value={`${churnPorMesMedia.toFixed(1)}/mês`} />
              </div>
            }
          >
            {churnPorMes.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={churnPorMes}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]?.payload?.mes) {
                      handleMesDrill(data.activePayload[0].payload.mes);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="barGradientTiming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="count" stackId="a" fill="url(#barGradientTiming)" radius={[0, 0, 0, 0]} name="Churn Efetivo" />
                  <Bar dataKey="countAbonado" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Abonado" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TechChartCard>

          {/* Distribuição por Lifetime */}
          <TechChartCard
            title="Distribuição por Lifetime"
            subtitle="Tempo de permanência até o churn"
            icon={Clock}
            iconBg="bg-gradient-to-r from-violet-500 to-purple-500"
            meta={
              <StatPill
                label="Faixa líder"
                value={topLifetime ? `${topLifetime.name} (${topLifetime.count})` : "-"}
                tone="info"
              />
            }
          >
            {distribuicaoPorLifetime.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="55%" height={180}>
                  <RechartsPie>
                    <Pie
                      data={distribuicaoPorLifetime.filter(d => d.count > 0)}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                      onClick={(entry) => handleLifetimeDrill(entry.name)}
                      style={{ cursor: "pointer" }}
                    >
                      {distribuicaoPorLifetime.map((entry, index) => (
                        <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 text-xs">
                  {distribuicaoPorLifetime.filter(d => d.count > 0).map((item, i) => (
                    <div
                      key={item.name}
                      className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1 space-y-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/70 transition-colors"
                      onClick={() => handleLifetimeDrill(item.name)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                          />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                      </div>
                      <div className="pl-4 text-[10px] text-red-500 dark:text-red-400">
                        {formatCurrencyNoDecimals(item.mrr)} MRR
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TechChartCard>
        </div>
      </SectionBlock>

      {/* ── Seção: Evolução Financeira ────────────────────────────────────── */}
      <SectionBlock
        title="Evolução Financeira"
        subtitle="Impacto do MRR perdido e abonado ao longo do tempo"
        icon={DollarSign}
        accent="bg-gradient-to-r from-red-500 to-rose-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* MRR Perdido por Mês */}
          <TechChartCard
            title="Evolução do MRR Perdido"
            subtitle="Churn efetivo + abonado por mês"
            icon={DollarSign}
            iconBg="bg-gradient-to-r from-red-500 to-rose-500"
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <StatPill label="Efetivo 12m" value={formatCurrencyNoDecimals(mrrPerdidoTotal)} tone="danger" />
                {mrrAbonadoTotal > 0 && (
                  <StatPill label="Abonado 12m" value={formatCurrencyNoDecimals(mrrAbonadoTotal)} tone="warning" />
                )}
              </div>
            }
          >
            {mrrPerdidoPorMes.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={mrrPerdidoPorMes}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]?.payload?.mes) {
                      handleMrrMesDrill(data.activePayload[0].payload.mes);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="mrrGradientTiming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrency(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="mrr" stackId="a" fill="url(#mrrGradientTiming)" radius={[0, 0, 0, 0]} name="Churn Efetivo" />
                  <Bar dataKey="mrrAbonado" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Churn Abonado" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TechChartCard>

          {/* MRR Churn vs Abonado (Comparativo) */}
          <TechChartCard
            title="MRR Churn vs Abonado"
            subtitle="Comparativo mensal de valor (R$)"
            icon={DollarSign}
            iconBg="bg-gradient-to-r from-amber-500 to-yellow-500"
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <StatPill label="Churn" value={formatCurrencyNoDecimals(comparativoChurnTotal)} tone="danger" />
                <StatPill label="Abonado" value={formatCurrencyNoDecimals(comparativoAbonadoTotal)} tone="warning" />
              </div>
            }
          >
            {comparativoMensal.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparativoMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrency(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="mrrChurn" fill="#ef4444" radius={[4, 4, 0, 0]} name="MRR Churn" />
                  <Bar dataKey="mrrAbonado" fill="#f59e0b" radius={[4, 4, 0, 0]} name="MRR Abonado" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TechChartCard>
        </div>
      </SectionBlock>

      {/* ── Seção: Cohort e Curva de Lifetime ────────────────────────────── */}
      <SectionBlock
        title="Cohort e Curva de Lifetime"
        subtitle="Tempo até churn por mês de início e curva de sobrevivência"
        icon={Clock}
        accent="bg-gradient-to-r from-teal-500 to-emerald-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Análise de Cohort */}
          <TechChartCard
            title="Tempo até Churn por Cohort"
            subtitle="Lifetime médio por mês de início"
            icon={Clock}
            iconBg="bg-gradient-to-r from-teal-500 to-emerald-500"
            meta={
              <StatPill
                label="Média geral"
                value={`${cohortMediaGeral.toFixed(1)}m`}
                tone="success"
              />
            }
          >
            {cohortAnalysis.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={cohortAnalysis}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]?.payload?.cohort) {
                      handleCohortDrill(data.activePayload[0].payload.cohort);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="cohortGradientTiming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="cohort"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}m`}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v.toFixed(1)} meses`} />} />
                  <Bar dataKey="avgLifetime" fill="url(#cohortGradientTiming)" radius={[4, 4, 0, 0]} name="Lifetime Médio" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TechChartCard>

          {/* Curva de Lifetime (Survival Curve) */}
          <TechChartCard
            title="Curva de Sobrevivência"
            subtitle="% de contratos retidos por mês de vida"
            icon={BarChart3}
            iconBg="bg-gradient-to-r from-indigo-500 to-violet-500"
            meta={
              <StatPill
                label="Sobrev. 12m"
                value={lifetimeCurve.length >= 13
                  ? `${lifetimeCurve[12].retainedPct.toFixed(1)}%`
                  : lifetimeCurve.length > 0
                  ? `${lifetimeCurve[lifetimeCurve.length - 1].retainedPct.toFixed(1)}%`
                  : "-"}
                tone="info"
              />
            }
          >
            {lifetimeCurve.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lifetimeCurve} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="survivalGradientTiming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="monthIndex"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}m`}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v.toFixed(1)}% retido`} />} />
                  <Bar dataKey="retainedPct" fill="url(#survivalGradientTiming)" radius={[4, 4, 0, 0]} name="% Retido" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TechChartCard>
        </div>
      </SectionBlock>
    </>
  );
}
