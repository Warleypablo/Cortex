import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Clock, BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type ChurnContract } from "@/components/churn/types";
import { formatCurrencyNoDecimals } from "@/lib/utils";

const REFINED_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

export function DrawerTiming({ contratos }: { contratos: ChurnContract[] }): JSX.Element {
  // ── Distribuição por Lifetime ───────────────────────────────────────────────
  const distribuicaoPorLifetime = useMemo(() => {
    if (contratos.length === 0) return [];

    const ranges = [
      { name: "< 3m", min: 0, max: 3, count: 0, mrr: 0 },
      { name: "3-6m", min: 3, max: 6, count: 0, mrr: 0 },
      { name: "6-12m", min: 6, max: 12, count: 0, mrr: 0 },
      { name: "12-24m", min: 12, max: 24, count: 0, mrr: 0 },
      { name: "> 24m", min: 24, max: Infinity, count: 0, mrr: 0 },
    ];

    contratos.forEach((c) => {
      const lt = c.lifetime_meses;
      // Guard: skip contracts with null/undefined/negative lifetime
      // (null >= 0 is true in JS, so without this check they'd silently
      // inflate the "< 3m" bucket — same filter lifetimeCurve already uses)
      if (lt === null || lt === undefined || lt < 0) return;
      for (const range of ranges) {
        if (lt >= range.min && lt < range.max) {
          range.count++;
          range.mrr += c.valorr || 0;
          break;
        }
      }
    });

    const total = contratos.length;
    return ranges.map((r) => ({
      ...r,
      percentual: (r.count / total) * 100,
    }));
  }, [contratos]);

  // ── Análise de Cohort ───────────────────────────────────────────────────────
  const cohortAnalysis = useMemo(() => {
    if (contratos.length === 0) return [];

    const churnContratos = contratos.filter(
      (c) => c.tipo === "churn" && !c.is_abonado && c.data_inicio
    );
    if (churnContratos.length === 0) return [];

    const cohorts: Record<
      string,
      { count: number; totalLifetime: number; totalMrr: number; sortKey: string }
    > = {};

    churnContratos.forEach((c) => {
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

  // ── Curva de Lifetime (Survival Curve) ─────────────────────────────────────
  const lifetimeCurve = useMemo(() => {
    const contratosComLifetime = contratos.filter(
      (c) =>
        c.lifetime_meses !== undefined &&
        c.lifetime_meses !== null &&
        c.lifetime_meses >= 0
    );

    if (contratosComLifetime.length === 0) return [];

    const totalBase = contratosComLifetime.length;
    const totalMrrBase = contratosComLifetime.reduce(
      (sum, c) => sum + (c.valorr || 0),
      0
    );

    const curve: {
      monthIndex: number;
      retainedPct: number;
      mrrRetainedPct: number;
      retainedCount: number;
      totalStarted: number;
      churnedCount: number;
    }[] = [];

    for (let month = 0; month <= 12; month++) {
      const sobreviventes = contratosComLifetime.filter(
        (c) => c.lifetime_meses >= month
      );
      const sobrevivMrr = sobreviventes.reduce(
        (sum, c) => sum + (c.valorr || 0),
        0
      );
      const churnedNoPeriodo = contratosComLifetime.filter(
        (c) => c.lifetime_meses >= month && c.lifetime_meses < month + 1
      );

      const retainedPct =
        totalBase > 0 ? (sobreviventes.length / totalBase) * 100 : 0;
      const mrrRetainedPct =
        totalMrrBase > 0 ? (sobrevivMrr / totalMrrBase) * 100 : 0;

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

  // ── Max count for bar width scaling ────────────────────────────────────────
  const maxCount = useMemo(
    () => Math.max(...distribuicaoPorLifetime.map((d) => d.count), 1),
    [distribuicaoPorLifetime]
  );

  if (contratos.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Nenhum dado de timing disponível.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Distribuição por Lifetime ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Distribuição por Lifetime
          </p>
        </div>
        <div className="space-y-1.5">
          {distribuicaoPorLifetime.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2">
              {/* Colored dot */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
              />
              {/* Range label */}
              <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
                {item.name}
              </span>
              {/* Count bar */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <div className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.count / maxCount) * 100}%`,
                      backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length],
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-900 dark:text-white tabular-nums w-5 text-right flex-shrink-0">
                  {item.count}
                </span>
              </div>
              {/* MRR */}
              <span className="text-xs text-muted-foreground tabular-nums w-20 text-right flex-shrink-0">
                {formatCurrencyNoDecimals(item.mrr)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Análise de Cohort ──────────────────────────────────────────── */}
      {cohortAnalysis.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Lifetime Médio por Cohort
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Mês de início × lifetime médio até churn (meses)
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={cohortAnalysis}
              margin={{ top: 4, right: 4, left: -18, bottom: 4 }}
            >
              <defs>
                <linearGradient id="drawerCohortGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="cohort"
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(0)}m`}
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)} meses`, "Lifetime Médio"]}
                contentStyle={{
                  fontSize: 11,
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Bar
                dataKey="avgLifetime"
                fill="url(#drawerCohortGradient)"
                radius={[3, 3, 0, 0]}
                name="Lifetime Médio"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Curva de Sobrevivência ─────────────────────────────────────── */}
      {lifetimeCurve.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Curva de Sobrevivência
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            % de contratos retidos por mês de vida
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart
              data={lifetimeCurve}
              margin={{ top: 4, right: 4, left: -18, bottom: 4 }}
            >
              <defs>
                <linearGradient id="drawerSurvivalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="monthIndex"
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}m`}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}% retido`, "Sobrevivência"]}
                contentStyle={{
                  fontSize: 11,
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="retainedPct"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#drawerSurvivalGradient)"
                name="% Retido"
                dot={false}
                activeDot={{ r: 3, fill: "#6366f1" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
