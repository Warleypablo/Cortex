import { TrendingUp, AlertTriangle, Landmark } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FaturamentoYtdData } from "../relatorio-mensal/types";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "../relatorio-mensal/SlideComponents";
import { ACCENT, fmtCompact, fmtK, entrance, TOOLTIP_STYLE } from "./deck-kit";
import { useCountUp } from "./useCountUp";

interface Props {
  data: FaturamentoYtdData;
  label: string;
  ano: number;
}

export default function SlideFaturamentoTrimestre({ data, label, ano }: Props) {
  const dfc = data.dfcRecebimentoMensal ?? [];
  const lastIdx = dfc.length - 1;
  const totalRecebidoYtd = dfc.reduce((s, m) => s + m.recebido, 0);

  const pctInad = data.faturamentoBrutoYtd > 0 ? (data.inadimplenciaYtd / data.faturamentoBrutoYtd) * 100 : 0;
  const pctImposto = data.faturamentoBrutoYtd > 0 ? (data.impostoYtd / data.faturamentoBrutoYtd) * 100 : 0;

  // Count-up sincronizado com a entrada do bloco hero (+200ms sobre o delay do bloco, entrance(0))
  const brutoAnim = useCountUp(data.faturamentoBrutoYtd, 750, 200);
  const inadAnim = useCountUp(data.inadimplenciaYtd, 750, 200);
  const impostoAnim = useCountUp(data.impostoYtd, 750, 200);

  const chartEntrance = entrance(150);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title={`Faturamento ${ano} — acumulado até ${label}`}
        gradientColor={ACCENT.mrr}
      />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: 3 stats — bruto (destaque), inadimplência, imposto */}
        <div {...entrance(0)}>
          <SecondaryCard className="px-6 py-5" borderColor={ACCENT.mrr}>
            <div className="grid grid-cols-3 gap-6 items-center">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Faturamento bruto YTD</p>
                </div>
                <p className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                  {fmtCompact(brutoAnim)}
                </p>
                <p className="text-[11px] text-zinc-600 mt-1">Jan → {label}</p>
              </div>

              <div className="border-l border-white/[0.08] pl-6">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">(-) Inadimplência YTD</p>
                </div>
                <p className="text-2xl font-black text-red-400">{fmtCompact(inadAnim)}</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  {data.faturamentoBrutoYtd > 0 ? `${pctInad.toFixed(1).replace(".", ",")}% do bruto` : "—"}
                </p>
              </div>

              <div className="border-l border-white/[0.08] pl-6">
                <div className="flex items-center gap-1.5 mb-1">
                  <Landmark className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">(-) Imposto YTD</p>
                </div>
                <p className="text-2xl font-black text-amber-400">{fmtCompact(impostoAnim)}</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  {data.faturamentoBrutoYtd > 0 ? `${pctImposto.toFixed(1).replace(".", ",")}% do bruto` : "—"}
                </p>
              </div>
            </div>
          </SecondaryCard>
        </div>

        {/* DFC Recebimento — mês a mês do ano (DFC anual, não trimestral) */}
        <div className={`${chartEntrance.className} flex-1 min-h-0 flex flex-col`} style={chartEntrance.style}>
          <ChartCard className="flex-1" title="">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-zinc-300">DFC Recebimento — {ano}</p>
              {dfc.length > 0 && (
                <div className="bg-emerald-500/10 rounded-lg px-3 py-1">
                  <span className="text-xs text-zinc-500">Total recebido: </span>
                  <span className="text-sm font-black text-emerald-400">{fmtCompact(totalRecebidoYtd)}</span>
                </div>
              )}
            </div>
            {dfc.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-zinc-600 italic">Sem dados de recebimento no período</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dfc} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={{ stroke: "#3f3f46" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#a1a1aa", fontSize: 10 }}
                      axisLine={{ stroke: "#3f3f46" }}
                      tickLine={false}
                      tickFormatter={fmtK}
                      width={48}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmtCompact(v), "Recebido"]} />
                    <Bar dataKey="recebido" name="Recebido" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={700}>
                      {dfc.map((_, i) => (
                        <Cell key={i} fill={ACCENT.mrr} fillOpacity={i === lastIdx ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </SlideLayout>
  );
}
