import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ChurnTrimestral {
  squad: string;
  ano: string;
  trimestre: string;
  label: string;
  total_churns: string;
  valor_total: string;
}

const SQUAD_COLORS: Record<string, string> = {
  "🪖 Selva": "#16a34a",
  "⚓️ Squadra": "#2563eb",
  "👑 Supreme (OFF)": "#9333ea",
  "⚡Makers": "#f59e0b",
  "💠 Pulse": "#06b6d4",
  "🔥 Chama (OFF)": "#ef4444",
  "👾 Squad X": "#8b5cf6",
  "🖥️ Tech": "#64748b",
  "🗝️ Bloomfield": "#d97706",
  "🏹 Hunters (OFF)": "#059669",
  "🌟 Aurea (OFF)": "#eab308",
  "🚀 Turbo Interno": "#3b82f6",
  "🐑 Black": "#1e293b",
  "📸 Comunicação (OFF)": "#ec4899",
  "⚡️ Solar+ (OFF)": "#f97316",
  "🏕 Tribo (OFF)": "#84cc16",
};

function getSquadColor(squad: string, index: number): string {
  if (SQUAD_COLORS[squad]) return SQUAD_COLORS[squad];
  const fallback = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];
  return fallback[index % fallback.length];
}

export default function ChurnConsolidadoTrimestral() {
  const [meses, setMeses] = useState(12);

  const { data, isLoading } = useQuery<ChurnTrimestral[]>({
    queryKey: ["/api/churn/consolidado-trimestral", meses],
    queryFn: async () => {
      const res = await fetch(`/api/churn/consolidado-trimestral?meses=${meses}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Agrupar por trimestre para o gráfico
  const chartData = useMemo(() => {
    if (!data) return [];
    const byTrimestre = new Map<string, { label: string; total: number; valor: number; ano: string; trimestre: string }>();

    data.forEach((d) => {
      const key = `${d.ano}-${d.trimestre}`;
      const existing = byTrimestre.get(key);
      if (existing) {
        existing.total += parseInt(d.total_churns);
        existing.valor += parseFloat(d.valor_total);
      } else {
        byTrimestre.set(key, {
          label: d.label,
          total: parseInt(d.total_churns),
          valor: parseFloat(d.valor_total),
          ano: d.ano,
          trimestre: d.trimestre,
        });
      }
    });

    return Array.from(byTrimestre.values()).sort(
      (a, b) => `${a.ano}${a.trimestre}`.localeCompare(`${b.ano}${b.trimestre}`)
    );
  }, [data]);

  // Tabela: squad x trimestre
  const tableData = useMemo(() => {
    if (!data) return { squads: [] as string[], trimestres: [] as string[], matrix: {} as Record<string, Record<string, { total: number; valor: number }>> };

    const trimestres = [...new Set(chartData.map((d) => d.label))];
    const squadsMap = new Map<string, Record<string, { total: number; valor: number }>>();

    data.forEach((d) => {
      const squad = d.squad;
      if (!squadsMap.has(squad)) squadsMap.set(squad, {});
      squadsMap.get(squad)![d.label] = {
        total: parseInt(d.total_churns),
        valor: parseFloat(d.valor_total),
      };
    });

    // Ordenar squads pelo valor total decrescente
    const squads = [...squadsMap.entries()]
      .sort((a, b) => {
        const totalA = Object.values(a[1]).reduce((s, v) => s + v.valor, 0);
        const totalB = Object.values(b[1]).reduce((s, v) => s + v.valor, 0);
        return totalB - totalA;
      })
      .map(([s]) => s);

    const matrix: Record<string, Record<string, { total: number; valor: number }>> = {};
    squadsMap.forEach((v, k) => { matrix[k] = v; });

    return { squads, trimestres, matrix };
  }, [data, chartData]);

  // KPIs
  const kpis = useMemo(() => {
    if (!chartData.length) return { totalChurns: 0, valorTotal: 0, mediaTrimestral: 0, valorMedioTrimestral: 0 };
    const totalChurns = chartData.reduce((s, d) => s + d.total, 0);
    const valorTotal = chartData.reduce((s, d) => s + d.valor, 0);
    return {
      totalChurns,
      valorTotal,
      mediaTrimestral: Math.round(totalChurns / chartData.length),
      valorMedioTrimestral: valorTotal / chartData.length,
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border bg-muted/50 overflow-hidden">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => setMeses(m)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                meses === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.totalChurns}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Total Churns</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light text-red-500">{formatCurrency(kpis.valorTotal)}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Valor Perdido</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light">{kpis.mediaTrimestral}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Média / Trimestre</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light text-red-500">{formatCurrency(kpis.valorMedioTrimestral)}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Valor Médio / Trimestre</div>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Churn por Trimestre</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
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
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
                        <p className="font-medium text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">{d?.total} contratos cancelados</p>
                        <p className="text-red-500 font-medium">{formatCurrency(d?.valor || 0)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" fill="#ef4444" opacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
          )}
        </CardContent>
      </Card>

      {/* Table: Squad x Trimestre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detalhamento por Squad</CardTitle>
        </CardHeader>
        <CardContent>
          {tableData.squads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium">Squad</TableHead>
                    {tableData.trimestres.map((t) => (
                      <TableHead key={t} className="text-center font-medium">{t}</TableHead>
                    ))}
                    <TableHead className="text-center font-medium">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.squads.map((squad, idx) => {
                    const row = tableData.matrix[squad] || {};
                    const totalSquad = Object.values(row).reduce((s, v) => s + v.valor, 0);
                    const totalCount = Object.values(row).reduce((s, v) => s + v.total, 0);
                    return (
                      <TableRow key={squad}>
                        <TableCell className="font-medium whitespace-nowrap">{squad}</TableCell>
                        {tableData.trimestres.map((t) => {
                          const cell = row[t];
                          return (
                            <TableCell key={t} className="text-center">
                              {cell ? (
                                <div>
                                  <div className="font-medium">{cell.total}</div>
                                  <div className="text-xs text-red-500">{formatCurrency(cell.valor)}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <div className="font-bold">{totalCount}</div>
                          <div className="text-xs text-red-500 font-medium">{formatCurrency(totalSquad)}</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>Total</TableCell>
                    {tableData.trimestres.map((t) => {
                      const colTotal = tableData.squads.reduce((s, sq) => s + (tableData.matrix[sq]?.[t]?.total || 0), 0);
                      const colValor = tableData.squads.reduce((s, sq) => s + (tableData.matrix[sq]?.[t]?.valor || 0), 0);
                      return (
                        <TableCell key={t} className="text-center">
                          <div className="font-bold">{colTotal}</div>
                          <div className="text-xs text-red-500 font-bold">{formatCurrency(colValor)}</div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <div className="font-bold">{kpis.totalChurns}</div>
                      <div className="text-xs text-red-500 font-bold">{formatCurrency(kpis.valorTotal)}</div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
