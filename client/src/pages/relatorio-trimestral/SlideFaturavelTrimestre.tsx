import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Landmark, TrendingUp, Zap } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { Faturavel } from "./types";
import { ACCENT, fmtCompact, fmtK, entrance, LegendDot, TOOLTIP_STYLE } from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Faturável do trimestre: Σ MRR ativo (foto do fim de cada mês) + pontual
// entregue. Fontes operacionais (cup_data_hist / cup_contratos) — sem Conta
// Azul, sem inadimplência, sem impostos (decisão 2026-07-09).
export default function SlideFaturavelTrimestre({ faturavel, label }: { faturavel: Faturavel; label: string }) {
  const totalAnim = useCountUp(faturavel.total, 800, 200);
  const mrrAnim = useCountUp(faturavel.mrrSoma, 750, 350);
  const pontualAnim = useCountUp(faturavel.pontualEntregue, 750, 450);
  const lastIdx = faturavel.porMes.length - 1;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader icon={Landmark} iconColor="text-emerald-400" title={`Faturável — ${label}`} gradientColor="#10b981" />

      <div className="flex-1 flex flex-col gap-5 min-h-0">
        {/* Hero: faturável total do trimestre */}
        <div className={`${entrance(0).className} shrink-0`} style={entrance(0).style}>
          <SecondaryCard className="px-8 py-6 flex items-end justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.25em]">Faturável no trimestre</p>
              <p className="text-7xl font-black leading-none mt-2 bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                {fmtCompact(totalAnim)}
              </p>
            </div>
            <p className="text-sm text-zinc-500 text-right max-w-[300px]">
              MRR ativo somado nos {faturavel.porMes.length} meses do tri + pontual entregue
            </p>
          </SecondaryCard>
        </div>

        <div className="flex-1 grid grid-cols-5 gap-5 min-h-0">
          {/* Composição */}
          <div className={`${entrance(150).className} col-span-2 flex flex-col gap-5 min-h-0`} style={entrance(150).style}>
            <SecondaryCard className="px-6 py-5 flex-1 flex flex-col justify-center" borderColor={ACCENT.mrr}>
              <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
                <TrendingUp className="h-4 w-4" /> MRR ativo (soma dos meses)
              </span>
              <p className="text-5xl font-black text-emerald-400 mt-3">{fmtCompact(mrrAnim)}</p>
              <p className="text-xs text-zinc-500 mt-2">foto do fim de cada mês do trimestre, somadas</p>
            </SecondaryCard>
            <SecondaryCard className="px-6 py-5 flex-1 flex flex-col justify-center" borderColor={ACCENT.pontual}>
              <span className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest">
                <Zap className="h-4 w-4" /> Pontual entregue
              </span>
              <p className="text-5xl font-black text-purple-400 mt-3">{fmtCompact(pontualAnim)}</p>
              <p className="text-xs text-zinc-500 mt-2">entregas concluídas dentro do trimestre</p>
            </SecondaryCard>
          </div>

          {/* Barras por mês do tri: MRR + pontual empilhados */}
          <div className={`${entrance(300).className} col-span-3 flex flex-col min-h-0`} style={entrance(300).style}>
            <SecondaryCard className="px-6 py-5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Faturável por mês</p>
                <div className="flex items-center gap-4">
                  <LegendDot color={ACCENT.mrr} label="MRR" />
                  <LegendDot color={ACCENT.pontual} label="Pontual" />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturavel.porMes} margin={{ top: 20, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                    <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => [fmtCompact(v), name === "mrr" ? "MRR" : "Pontual"]}
                    />
                    <Bar dataKey="mrr" name="mrr" stackId="fat" maxBarSize={56} animationDuration={900}>
                      {faturavel.porMes.map((_, i) => (
                        <Cell key={i} fill={ACCENT.mrr} fillOpacity={i === lastIdx ? 1 : 0.65} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="pontual"
                      name="pontual"
                      stackId="fat"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={56}
                      animationDuration={900}
                      label={{
                        position: "top",
                        fill: "#e4e4e7",
                        fontSize: 12,
                        fontWeight: 700,
                        formatter: (_v: number, _n: unknown, props: any) => {
                          const idx = props?.index ?? -1;
                          const row = faturavel.porMes[idx];
                          return row ? fmtCompact(row.total) : "";
                        },
                      }}
                    >
                      {faturavel.porMes.map((_, i) => (
                        <Cell key={i} fill={ACCENT.pontual} fillOpacity={i === lastIdx ? 1 : 0.65} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SecondaryCard>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
