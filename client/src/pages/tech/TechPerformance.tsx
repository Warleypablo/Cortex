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

  const { data: boardData = [] } = useQuery<any[]>({
    queryKey: ["tech-board"],
    queryFn: () => fetch("/api/tech/board").then((r) => r.json()),
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
    const valorTrimestre = currentQuarter ? parseFloat(currentQuarter.valor_total) || 0 : 0;

    // Taxa no prazo — projetos ativos não atrasados / total ativos
    const allProjects = boardData.flatMap((g: any) => g.projetos || []);
    const totalAtivos = allProjects.length;
    const now = Date.now();
    const atrasados = allProjects.filter((p: any) => {
      if (!p.data_vencimento) return false;
      return new Date(p.data_vencimento).getTime() < now;
    }).length;
    const taxaNoPrazo = totalAtivos > 0 ? Math.round(((totalAtivos - atrasados) / totalAtivos) * 100) : 100;

    return {
      tempoMedioDeploy: Math.round(avgDeploy * 10) / 10,
      entregasTrimestre,
      valorTrimestre,
      taxaNoPrazo,
    };
  }, [deployData, entregasData, boardData]);

  // ── Tempo deploy por tipo ─────────────────────────────────────────

  const { data: deployPorTipo = [] } = useQuery<any[]>({
    queryKey: ["/api/tech/tempo-deploy-por-tipo", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/tempo-deploy-por-tipo?meses=${periodo}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // ── Tempo por Fase ────────────────────────────────────────────────

  const tempoPorFase = useMemo(() => groupStatusIntoPhases(prazoPorStatus), [prazoPorStatus]);

  // Gargalo = fase de trabalho efetivo com mais tempo (exclui estados excepcionais)
  const gargalo = useMemo(() => {
    const excludeFromGargalo = ["bloqueado", "pendencias", "pendências", "aguardando"];
    const workPhases = tempoPorFase.filter(
      (p) => !excludeFromGargalo.some((ex) => p.label.toLowerCase().includes(ex))
    );
    if (workPhases.length === 0) return { label: "—", dias: 0 };
    const max = workPhases.reduce((a, b) => (a.media_dias > b.media_dias ? a : b));
    return { label: max.label, dias: Math.round(max.media_dias * 10) / 10 };
  }, [tempoPorFase]);
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
          {kpis.valorTrimestre > 0 && (
            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              R$ {kpis.valorTrimestre.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.taxaNoPrazo}%</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Taxa No Prazo
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{gargalo.label}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Gargalo Principal
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{gargalo.dias}d media</div>
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
                valor_total: parseFloat(d.valor_total) || 0,
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
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 text-xs shadow-lg">
                      <p className="font-medium text-popover-foreground mb-1">{label}</p>
                      <p className="text-muted-foreground">{d?.total_entregas} projetos</p>
                      {d?.valor_total > 0 && (
                        <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                          R$ {d.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                  );
                }}
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

      {/* Tempo de Deploy por Tipo — horizontal bars */}
      <div className="rounded-lg border bg-card p-5">
        <div className="text-sm font-medium text-foreground mb-4">Tempo Médio de Deploy por Tipo</div>
        {deployPorTipo.length > 0 ? (
          <div className="space-y-3">
            {deployPorTipo.map((item: any) => {
              const maxDias = Math.max(...deployPorTipo.map((d: any) => parseFloat(d.media_dias) || 0), 1);
              const dias = parseFloat(item.media_dias) || 0;
              const pct = (dias / maxDias) * 100;
              return (
                <div key={item.tipo} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 text-sm text-foreground truncate">{item.tipo}</div>
                  <div className="flex-1 h-6 rounded bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${pct}%`, backgroundColor: "hsl(var(--primary))", opacity: 0.6 }}
                    />
                  </div>
                  <div className="w-20 text-right text-xs text-muted-foreground shrink-0">
                    {dias}d ({item.total_projetos} proj)
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Sem dados de deploy por tipo</p>
        )}
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
