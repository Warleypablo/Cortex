import React, { useState, useMemo } from "react";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { type ChurnContract } from "@/components/churn/types";
import { severityHex } from "@/components/churn/severity";
import { formatCurrencyNoDecimals } from "@/lib/utils";

const SQUAD_BLACKLIST = ["turbo interno", "squad x", "interno", "x"];

function isBlacklisted(squad: string): boolean {
  return SQUAD_BLACKLIST.includes((squad ?? "").toLowerCase().trim());
}

function getDateKey(c: ChurnContract): string | null {
  return c.tipo === "churn" ? c.data_encerramento : null;
}

type MetricKey = "mrr" | "count";

interface DayBucket {
  dayKey: string; // yyyy-MM-dd
  label: string;  // DD/MM
  mrr: number;
  count: number;
  contratos: ChurnContract[];
}

interface TooltipPayloadItem {
  payload: DayBucket;
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  metric: MetricKey;
}

function CustomTooltip({ active, payload, metric }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 shadow-lg text-xs space-y-0.5">
      <p className="font-semibold text-foreground">{d.label}</p>
      <p className="text-muted-foreground">
        MRR perdido:{" "}
        <span className="font-medium text-foreground">
          {formatCurrencyNoDecimals(d.mrr)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Contratos:{" "}
        <span className="font-medium text-foreground">{d.count}</span>
      </p>
      {metric === "mrr" ? null : null}
    </div>
  );
}

export function RitmoDiario({
  contratos,
  onDrill,
}: {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}): JSX.Element {
  const [metric, setMetric] = useState<MetricKey>("mrr");
  const [squadFilter, setSquadFilter] = useState<string>("total");

  // Distinct squads from churn contracts (excluding blacklist)
  const squads = useMemo(() => {
    const churnContratos = contratos.filter(
      (c) => c.tipo === "churn" && !c.is_abonado
    );
    const set = new Set<string>();
    churnContratos.forEach((c) => {
      const s = (c.squad ?? "").trim();
      if (s && !isBlacklisted(s)) set.add(s);
    });
    return Array.from(set).sort();
  }, [contratos]);

  // Base churn contracts
  const baseContratos = useMemo(() => {
    let list = contratos.filter((c) => c.tipo === "churn" && !c.is_abonado);
    if (squadFilter !== "total") {
      list = list.filter(
        (c) => (c.squad ?? "").trim() === squadFilter
      );
    }
    return list;
  }, [contratos, squadFilter]);

  // Daily buckets
  const series = useMemo((): DayBucket[] => {
    const map = new Map<string, DayBucket>();

    baseContratos.forEach((c) => {
      const rawDate = getDateKey(c);
      if (!rawDate) return;
      try {
        const dayKey = rawDate.slice(0, 10); // yyyy-MM-dd
        const parsed = parseISO(dayKey);
        const label = format(parsed, "dd/MM", { locale: ptBR });
        if (!map.has(dayKey)) {
          map.set(dayKey, { dayKey, label, mrr: 0, count: 0, contratos: [] });
        }
        const bucket = map.get(dayKey)!;
        bucket.mrr += c.valorr ?? 0;
        bucket.count += 1;
        bucket.contratos.push(c);
      } catch {
        // skip invalid dates
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.dayKey.localeCompare(b.dayKey)
    );
  }, [baseContratos]);

  const maxValue = useMemo(() => {
    if (series.length === 0) return 1;
    return Math.max(...series.map((d) => (metric === "mrr" ? d.mrr : d.count)));
  }, [series, metric]);

  const yTickFormatter = (v: number) =>
    metric === "mrr" ? formatCurrencyNoDecimals(v) : String(v);

  // Empty state
  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-2 min-h-[160px]">
        <p className="text-sm font-semibold text-foreground">Ritmo Diário</p>
        <p className="text-xs text-muted-foreground">
          Nenhum churn no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Ritmo Diário</p>

        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              className={`px-3 py-1 transition-colors ${
                metric === "mrr"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMetric("mrr")}
            >
              MRR
            </button>
            <button
              className={`px-3 py-1 border-l border-border transition-colors ${
                metric === "count"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMetric("count")}
            >
              Logos
            </button>
          </div>

          {/* Squad selector */}
          {squads.length > 0 && (
            <select
              value={squadFilter}
              onChange={(e) => setSquadFilter(e.target.value)}
              className="text-xs rounded-md border border-border bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="total">Todos os squads</option>
              {squads.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={series}
          margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            className="stroke-border"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={yTickFormatter}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={metric === "mrr" ? 72 : 30}
          />
          <Tooltip
            content={<CustomTooltip metric={metric} />}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          />
          <Bar
            dataKey={metric}
            radius={[3, 3, 0, 0]}
            cursor="pointer"
            onClick={(data: DayBucket) => {
              onDrill(
                `Dia ${data.label}${squadFilter !== "total" ? ` · ${squadFilter}` : ""}`,
                data.contratos
              );
            }}
          >
            {series.map((entry) => {
              const normalised = maxValue > 0
                ? (metric === "mrr" ? entry.mrr : entry.count) / maxValue
                : 0;
              return (
                <Cell key={entry.dayKey} fill={severityHex(normalised)} />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        Clique numa barra para ver os contratos daquele dia.
      </p>
    </div>
  );
}
