import { ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Activity } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { TrendData } from "./types";

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-zinc-400">{label}</span>
    </span>
  );
}

const TOOLTIP_STYLE = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff", fontSize: 12 };

export default function SlideEvolucaoTrimestre({ trend }: { trend: TrendData }) {
  const data = trend.series.map((s) => ({ label: s.label, mrr: s.mrr, vendas: s.vendas, churn: s.churn }));
  const lastIdx = data.length - 1;
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader icon={Activity} iconColor="text-sky-400" title="Evolução por Trimestre" gradientColor="#0ea5e9" />
      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* MRR: linha + área em gradiente, trimestre atual com ponto em destaque */}
        <div className="flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none" style={{ animationFillMode: "both" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-zinc-300">MRR — foto no fim de cada trimestre</p>
            <LegendDot color="#34d399" label="MRR" />
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmtK(v), "MRR"]} />
                <Area type="monotone" dataKey="mrr" stroke="none" fill="url(#mrrGradient)" animationDuration={900} />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  animationDuration={900}
                  dot={(props: any) => {
                    const { cx, cy, index } = props;
                    const isLast = index === lastIdx;
                    return (
                      <circle
                        key={`dot-${index}`}
                        cx={cx}
                        cy={cy}
                        r={isLast ? 6 : 4}
                        fill="#34d399"
                        stroke="#09090b"
                        strokeWidth={2}
                        style={isLast ? { filter: "drop-shadow(0 0 6px rgba(52,211,153,0.9))" } : undefined}
                      />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vendas × Churn: barras com legenda, trimestre atual em destaque */}
        <div className="flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-zinc-300">Vendas recorrentes × Churn por trimestre</p>
            <div className="flex items-center gap-4">
              <LegendDot color="#38bdf8" label="Vendas" />
              <LegendDot color="#f87171" label="Churn" />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [fmtK(v), name === "vendas" ? "Vendas" : "Churn"]} />
                <Bar dataKey="vendas" name="vendas" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900}>
                  {data.map((_, i) => (
                    <Cell key={i} fill="#38bdf8" fillOpacity={i === lastIdx ? 1 : 0.55} />
                  ))}
                </Bar>
                <Bar dataKey="churn" name="churn" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900}>
                  {data.map((_, i) => (
                    <Cell key={i} fill="#f87171" fillOpacity={i === lastIdx ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
