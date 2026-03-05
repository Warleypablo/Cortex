import { Activity, Users, TrendingUp, TrendingDown, Pause, CreditCard, Target, Handshake } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { TurboMetrics } from "./types";

interface Props {
  metrics: TurboMetrics;
  mesLabel: string;
}

const MESES_ALL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(3).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtFull(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 ${className}`}>
      {children}
    </div>
  );
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "churnPct" ? `${p.value}%` : fmtBRL(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function SlideTurboMetrics({ metrics, mesLabel }: Props) {
  const faturamentoRecorrente = metrics.mrrAtivo;
  const faturamentoPontual = metrics.faturamentoTotal > faturamentoRecorrente
    ? metrics.faturamentoTotal - faturamentoRecorrente : 0;
  const crosssellTotal = metrics.crosssellMrr + metrics.crosssellPontual;

  // Build chart data: fill all 12 months, empty for months without data
  const chartData = MESES_ALL.map((label, i) => {
    const found = metrics.receitaChurnSeries?.find(s => {
      const m = parseInt(s.month.split("-")[1]);
      return m === i + 1;
    });
    return {
      label,
      mrr: found?.mrr || 0,
      churnBrl: found?.churnBrl || 0,
      churnPct: found?.churnPct || 0,
      hasData: !!found,
    };
  });

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <Activity className="h-6 w-6 text-cyan-400" />
        <h2 className="text-xl font-bold">Turbo Commerce — {mesLabel}</h2>
      </div>

      {/* Top row: 5 compact cards */}
      <div className="grid grid-cols-5 gap-3 mb-3 shrink-0">
        {/* Faturamento */}
        <Card>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Faturamento Mês</p>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-zinc-400">Rec:</span>
              <span className="text-xs font-bold text-emerald-400">{fmtBRL(faturamentoRecorrente)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-[10px] text-zinc-400">Pont:</span>
              <span className="text-xs font-bold text-purple-400">{fmtBRL(faturamentoPontual)}</span>
            </div>
          </div>
          <div className="mt-1.5 bg-cyan-500/10 rounded px-2 py-0.5 inline-block">
            <span className="text-xs font-bold text-cyan-400">Total: {fmtBRL(metrics.faturamentoTotal)}</span>
          </div>
        </Card>

        {/* Base */}
        <Card>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="h-3.5 w-3.5 text-blue-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Base</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-zinc-500">Clientes</p>
              <p className="text-xl font-black">{metrics.clientesAtivos}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">Contratos</p>
              <p className="text-xl font-black">{metrics.contratosTotais}</p>
            </div>
          </div>
        </Card>

        {/* MRR Add / Cancel / Pausado */}
        <Card>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-bold">Adicionado</span>
              </div>
              <span className="text-xs font-bold text-emerald-400">{fmtBRL(metrics.mrrAdicionado)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-400" />
                <span className="text-[10px] text-red-400 font-bold">Cancelados</span>
              </div>
              <span className="text-xs font-bold text-red-400">{fmtBRL(metrics.churnMrr)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Pause className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] text-amber-400 font-bold">Pausados</span>
              </div>
              <span className="text-xs font-bold text-amber-400">{fmtBRL(metrics.pausadosMrr)}</span>
            </div>
          </div>
        </Card>

        {/* Ticket Médio */}
        <Card className="flex flex-col items-center justify-center text-center">
          <CreditCard className="h-4 w-4 text-zinc-400 mb-1" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">Ticket Médio</p>
          <p className="text-2xl font-black">{fmtBRL(metrics.ticketMedio)}</p>
        </Card>

        {/* CXCS */}
        <Card>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Handshake className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">CXCS</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-zinc-400">Rec:</span>
              <span className="text-xs font-bold text-emerald-400">{fmtBRL(metrics.crosssellMrr)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-zinc-400">Pont:</span>
              <span className="text-xs font-bold text-purple-400">{fmtBRL(metrics.crosssellPontual)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-800 pt-1">
              <span className="text-[10px] text-zinc-400">Total:</span>
              <span className="text-xs font-bold text-cyan-400">{fmtBRL(crosssellTotal)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom: Chart + MRR/Churn info */}
      <div className="flex-1 grid grid-cols-7 gap-3 min-h-0">
        {/* Chart: Receita x Churn */}
        <Card className="col-span-5 flex flex-col">
          <p className="text-sm font-bold text-zinc-300 mb-2">Receita x Churn</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  tickFormatter={fmtK}
                  width={50}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#f472b6", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46", strokeDasharray: "4 4" }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  width={40}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar yAxisId="left" dataKey="mrr" name="MRR" stackId="a" radius={[0, 0, 0, 0]} barSize={32}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? "#34d399" : "transparent"} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Bar yAxisId="left" dataKey="churnBrl" name="Churn" stackId="a" radius={[4, 4, 0, 0]} barSize={32}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? "#f97316" : "transparent"} fillOpacity={0.5} stroke={entry.hasData ? "#f97316" : "transparent"} strokeWidth={1.5} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="churnPct"
                  name="Churn %"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={{ fill: "#ec4899", r: 4 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* MRR Ativo + Meta Churn */}
        <div className="col-span-2 flex flex-col gap-3">
          <Card className="flex-1 flex flex-col justify-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">MRR Ativo — {mesLabel}</p>
            <p className="text-2xl font-black text-emerald-400">{fmtFull(metrics.mrrAtivo)}</p>
          </Card>

          <Card className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-red-400" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Meta Churn Máx.</p>
            </div>
            <p className="text-2xl font-black text-red-400">{fmtFull(metrics.churnMetaMensal)}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-zinc-500">Realizado:</span>
              <span className={`text-xs font-bold ${metrics.churnMrr > metrics.churnMetaMensal ? "text-red-400" : "text-emerald-400"}`}>
                {fmtFull(metrics.churnMrr)}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                metrics.churnMrr > metrics.churnMetaMensal
                  ? "bg-red-500/15 text-red-400"
                  : "bg-emerald-500/15 text-emerald-400"
              }`}>
                {metrics.churnMetaMensal > 0
                  ? `${Math.round((metrics.churnMrr / metrics.churnMetaMensal) * 100)}%`
                  : "—"}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
