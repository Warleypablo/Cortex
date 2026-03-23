import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { groupStatusIntoPhases, type PrazoPorStatus } from "@/lib/tech-utils";

export default function TechPerformance() {
  const [periodo, setPeriodo] = useState<number>(12);

  // ── Data fetching ──────────────────────────────────────────────────

  const { data: deployData = [], isLoading: loadingDeploy } = useQuery({
    queryKey: ["/api/tech/tempo-deploy", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/tempo-deploy?meses=${periodo}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: entregasData = [] } = useQuery({
    queryKey: ["/api/tech/entregas-trimestre", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/entregas-trimestre?meses=${periodo}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: prazoPorStatus = [], isLoading: loadingPrazo } = useQuery<PrazoPorStatus[]>({
    queryKey: ["/api/tech/prazo-por-status"],
    queryFn: async () => {
      const res = await fetch("/api/tech/prazo-por-status");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // ── Computed KPIs ──────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const avgDeploy =
      deployData.length > 0
        ? deployData.reduce((sum: number, d: any) => sum + (parseFloat(d.media_dias) || 0), 0) /
          deployData.length
        : 0;

    const currentQuarter = entregasData.length > 0 ? entregasData[entregasData.length - 1] : null;
    const entregasTrimestre = currentQuarter ? parseInt(currentQuarter.total_entregas) || 0 : 0;

    // Taxa no prazo — percentage of deploys within target (e.g. <= 30 days)
    const totalEntregas = entregasData.reduce(
      (sum: number, d: any) => sum + (parseInt(d.total_entregas) || 0),
      0,
    );
    const entregasNoPrazo = entregasData.reduce(
      (sum: number, d: any) => sum + (parseInt(d.no_prazo) || 0),
      0,
    );
    const taxaNoPrazo = totalEntregas > 0 ? Math.round((entregasNoPrazo / totalEntregas) * 100) : 0;

    const gargalo =
      prazoPorStatus.length > 0
        ? prazoPorStatus.reduce((max: any, curr: any) =>
            (parseFloat(curr.media_dias) || 0) > (parseFloat(max.media_dias) || 0) ? curr : max,
            prazoPorStatus[0],
          )
        : null;

    return {
      tempoMedioDeploy: Math.round(avgDeploy * 10) / 10,
      entregasTrimestre,
      taxaNoPrazo,
      gargalo: gargalo?.status || "\u2014",
      gargaloDias: gargalo ? Math.round(parseFloat(gargalo.media_dias) * 10) / 10 : 0,
    };
  }, [deployData, entregasData, prazoPorStatus]);

  // ── Tempo por Fase ────────────────────────────────────────────────

  const tempoPorFase = useMemo(() => groupStatusIntoPhases(prazoPorStatus), [prazoPorStatus]);
  const maxFaseDias = useMemo(
    () => Math.max(...tempoPorFase.map((p) => p.media_dias), 1),
    [tempoPorFase],
  );

  const isLoading = loadingDeploy || loadingPrazo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Period selector — top right */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border bg-muted/50 overflow-hidden">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => setPeriodo(m)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                periodo === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.tempoMedioDeploy}d</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Tempo Medio Deploy
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.entregasTrimestre}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Entregas no Trimestre
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.taxaNoPrazo}%</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Taxa No Prazo
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.gargalo}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Gargalo Principal
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{kpis.gargaloDias}d media</div>
        </div>
      </div>

      {/* Charts row — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo de Deploy por Trimestre */}
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-foreground mb-4">
            Tempo de Deploy por Trimestre
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={deployData.map((d: any) => ({
                ...d,
                media_dias: parseFloat(d.media_dias) || 0,
              }))}
            >
              <CartesianGrid
                horizontal={true}
                vertical={false}
                strokeDasharray="3 3"
                opacity={0.15}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}d`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  padding: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [
                  `${Math.round(value * 10) / 10} dias`,
                  "Tempo Medio",
                ]}
              />
              <Bar
                dataKey="media_dias"
                fill="hsl(var(--primary))"
                opacity={0.6}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Entregas por Trimestre */}
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-foreground mb-4">Entregas por Trimestre</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={entregasData.map((d: any) => ({
                ...d,
                total_entregas: parseInt(d.total_entregas) || 0,
              }))}
            >
              <CartesianGrid
                horizontal={true}
                vertical={false}
                strokeDasharray="3 3"
                opacity={0.15}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  padding: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [`${value} entregas`, "Total"]}
              />
              <Bar
                dataKey="total_entregas"
                fill="#10b981"
                opacity={0.6}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tempo Medio por Fase — div-based horizontal bars */}
      <div className="rounded-lg border bg-card p-5">
        <div className="text-sm font-medium text-foreground mb-4">Tempo Medio por Fase</div>
        {tempoPorFase.length > 0 ? (
          <div className="space-y-3">
            {tempoPorFase.map((phase) => (
              <div key={phase.label} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm text-foreground truncate">{phase.label}</div>
                <div className="flex-1 h-6 rounded bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${Math.max((phase.media_dias / maxFaseDias) * 100, 2)}%`,
                      backgroundColor: phase.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <div className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {phase.media_dias}d
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            Sem dados de prazo por fase
          </p>
        )}
      </div>
    </div>
  );
}
