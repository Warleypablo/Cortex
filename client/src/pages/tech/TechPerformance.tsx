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
  Cell,
} from "recharts";
import { Loader2, Rocket, Package, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import StatsCard from "@/components/StatsCard";
import { groupStatusIntoPhases, type PrazoPorStatus } from "@/lib/tech-utils";

export default function TechPerformance() {
  const [viewMode, setViewMode] = useState<"geral" | "por-po">("geral");
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

  const { data: deployByPO = [] } = useQuery({
    queryKey: ["/api/tech/tempo-deploy", periodo, "all-pos"],
    queryFn: async () => {
      const res = await fetch("/api/tech/board");
      if (!res.ok) return [];
      const columns = await res.json();
      const poResults = await Promise.all(
        columns.map(async (col: any) => {
          const poRes = await fetch(
            `/api/tech/tempo-deploy?meses=${periodo}&responsavel=${encodeURIComponent(col.responsavel)}`,
          );
          if (!poRes.ok) return null;
          const poData = await poRes.json();
          if (poData.length === 0) return null;
          const avgDays =
            poData.reduce((sum: number, d: any) => sum + (parseFloat(d.media_dias) || 0), 0) /
            poData.length;
          return { responsavel: col.responsavel, media_dias: Math.round(avgDays * 10) / 10 };
        }),
      );
      return poResults.filter(Boolean).sort((a: any, b: any) => b.media_dias - a.media_dias);
    },
    enabled: viewMode === "por-po",
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
      gargalo: gargalo?.status || "\u2014",
      gargaloDias: gargalo ? Math.round(parseFloat(gargalo.media_dias) * 10) / 10 : 0,
    };
  }, [deployData, entregasData, prazoPorStatus]);

  // ── Tempo por Fase (horizontal bar) ────────────────────────────────

  const tempoPorFase = useMemo(() => groupStatusIntoPhases(prazoPorStatus), [prazoPorStatus]);

  const isLoading = loadingDeploy || loadingPrazo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toggle + Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-gray-300 dark:border-zinc-600 overflow-hidden">
          <button
            onClick={() => setViewMode("geral")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "geral"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setViewMode("por-po")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "por-po"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            }`}
          >
            Por PO
          </button>
        </div>

        <div className="flex rounded-lg border border-gray-300 dark:border-zinc-600 overflow-hidden">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => setPeriodo(m)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                periodo === m
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Tempo Medio Deploy"
          value={`${kpis.tempoMedioDeploy}d`}
          icon={Rocket}
          variant="info"
        />
        <StatsCard
          title="Entregas no Trimestre"
          value={String(kpis.entregasTrimestre)}
          icon={Package}
          variant="success"
        />
        <StatsCard
          title="Gargalo Principal"
          value={kpis.gargalo}
          icon={AlertTriangle}
          variant="warning"
          subtitle={`${kpis.gargaloDias}d media`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo Deploy por Trimestre */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tempo Deploy por Trimestre</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={deployData.map((d: any) => ({
                  ...d,
                  media_dias: parseFloat(d.media_dias) || 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  formatter={(value: number) => [
                    `${Math.round(value * 10) / 10} dias`,
                    "Tempo Medio",
                  ]}
                />
                <Bar dataKey="media_dias" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tempo por Fase (NEW — horizontal bar from groupStatusIntoPhases) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tempo por Fase</CardTitle>
            <p className="text-xs text-muted-foreground">
              Media ponderada em dias por fase do pipeline
            </p>
          </CardHeader>
          <CardContent>
            {tempoPorFase.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, tempoPorFase.length * 36 + 40)}
              >
                <BarChart
                  layout="vertical"
                  data={tempoPorFase}
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickFormatter={(v: number) => `${Math.round(v)}d`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tick={{ fontSize: 12, fill: "#d1d5db" }}
                    width={140}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    formatter={(value: number, _name: string, props: any) => [
                      `${value} dias (${props.payload.total_transicoes} transicoes)`,
                      "Media",
                    ]}
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#e4e4e7",
                    }}
                    labelStyle={{ color: "#a1a1aa", fontWeight: 600 }}
                  />
                  <Bar dataKey="media_dias" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {tempoPorFase.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sem dados de prazo por fase
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deploy by PO (only in por-po mode) */}
      {viewMode === "por-po" && deployByPO.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tempo Deploy por PO</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, deployByPO.length * 40)}>
              <BarChart data={deployByPO} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  type="category"
                  dataKey="responsavel"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  formatter={(value: number) => [`${value} dias`, "Tempo Medio"]}
                />
                <Bar dataKey="media_dias" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
