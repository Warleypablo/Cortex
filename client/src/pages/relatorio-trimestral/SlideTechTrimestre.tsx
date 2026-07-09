import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Cpu } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "../relatorio-mensal/SlideComponents";
import type { TechSlideData } from "../relatorio-mensal/types";
import {
  ACCENT, fmtCompact, fmtK, entrance, LegendDot, DeckKeyframes, GrowBar, TOOLTIP_STYLE,
} from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Cores dos tipos de entrega — variações dos ACCENTs canônicos, máx 5 séries.
const TIPO_COLORS = [ACCENT.cyan, ACCENT.mrr, ACCENT.vendas, ACCENT.pontual, ACCENT.amber];

function formatDias(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1).replace(".", ",")}d`;
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <SecondaryCard className="flex flex-col items-center justify-center py-4 px-2 text-center" borderColor={ACCENT.cyan}>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">{sub}</p>}
    </SecondaryCard>
  );
}

export default function SlideTechTrimestre({
  techData,
  label,
}: {
  techData: TechSlideData;
  label: string;
}) {
  const kpis = techData.kpis ?? {
    entregues: 0, valorEntregues: 0, tempoMedio: 0, adicionados: 0, valorAdicionados: 0,
  };

  const entreguesAnim = useCountUp(kpis.entregues ?? 0, 750, 200);
  const valorEntreguesAnim = useCountUp(kpis.valorEntregues ?? 0, 750, 200);
  const adicionadosAnim = useCountUp(kpis.adicionados ?? 0, 750, 200);
  const valorAdicionadosAnim = useCountUp(kpis.valorAdicionados ?? 0, 750, 200);
  const tempoMedioAnim = useCountUp(kpis.tempoMedio ?? 0, 750, 200);

  // Tipos de entrega: chaves dinâmicas de entregasPorTipo (exclui month/label), máx 5.
  const entregas = techData.entregasPorTipo ?? [];
  const tipoKeys = Array.from(
    new Set(entregas.flatMap((m) => Object.keys(m).filter((k) => k !== "month" && k !== "label"))),
  ).slice(0, 5);

  const emAberto = [...(techData.emAbertoPorTipo ?? [])].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const maxEmAberto = Math.max(...emAberto.map((e) => e.valor), 1);

  const pipeline = techData.pipeline ?? [];

  return (
    <SlideLayout section="tech" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Cpu} iconColor="text-cyan-400" title={`Área Tech — ${label}`} gradientColor={ACCENT.cyan} />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: 4 stats com count-up */}
        <div className={`grid grid-cols-4 gap-3 ${entrance(0).className}`} style={entrance(0).style}>
          <HeroStat label="Projetos entregues" value={String(Math.round(entreguesAnim))} />
          <HeroStat label="Receita entregue" value={fmtCompact(valorEntreguesAnim)} />
          <HeroStat
            label="Adicionados no tri"
            value={String(Math.round(adicionadosAnim))}
            sub={fmtCompact(valorAdicionadosAnim)}
          />
          <HeroStat label="Tempo médio" value={formatDias(tempoMedioAnim)} />
        </div>

        {/* Entregas por tipo (chart) + Em aberto/Pipeline (coluna) */}
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          <div className={`col-span-2 flex flex-col min-h-0 ${entrance(150).className}`} style={entrance(150).style}>
            <ChartCard className="flex-1">
              <div className="flex items-center justify-between mb-2 shrink-0 gap-3">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Entregas por tipo</p>
                {tipoKeys.length > 0 && (
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    {tipoKeys.map((tipo, i) => (
                      <LegendDot key={tipo} color={TIPO_COLORS[i % TIPO_COLORS.length]} label={tipo} />
                    ))}
                  </div>
                )}
              </div>
              {entregas.length === 0 || tipoKeys.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">Sem entregas no trimestre</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={entregas} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                      <YAxis stroke="#a1a1aa" fontSize={10} tickFormatter={fmtK} tickLine={false} axisLine={false} width={36} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      {tipoKeys.map((tipo, i) => (
                        <Bar
                          key={tipo}
                          dataKey={tipo}
                          name={tipo}
                          stackId="tipos"
                          fill={TIPO_COLORS[i % TIPO_COLORS.length]}
                          maxBarSize={24}
                          radius={i === tipoKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="col-span-1 flex flex-col gap-4 min-h-0">
            <div className={`flex-1 flex flex-col min-h-0 ${entrance(250).className}`} style={entrance(250).style}>
              <SecondaryCard className="px-4 py-3 flex-1 flex flex-col min-h-0">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2 shrink-0">Em aberto por tipo</p>
                {emAberto.length === 0 ? (
                  <p className="text-sm text-zinc-500 flex-1 flex items-center justify-center">—</p>
                ) : (
                  <div className="flex-1 flex flex-col justify-center gap-2 min-h-0">
                    {emAberto.map((e, i) => (
                      <div key={e.tipo} className="flex items-center gap-2">
                        <span className="w-16 text-[11px] text-zinc-400 truncate shrink-0" title={e.tipo}>{e.tipo}</span>
                        <div className="flex-1 h-4 rounded-md overflow-hidden bg-white/[0.03]">
                          <GrowBar widthPct={(e.valor / maxEmAberto) * 100} delayMs={350 + i * 80} className="bg-cyan-500/70 rounded-md" />
                        </div>
                        <span className="w-14 text-[11px] font-bold text-white text-right shrink-0 tabular-nums">{fmtCompact(e.valor)}</span>
                        <span className="w-10 text-[10px] text-zinc-500 text-right shrink-0 tabular-nums">{e.quantidade} un</span>
                      </div>
                    ))}
                  </div>
                )}
              </SecondaryCard>
            </div>

            <div className={`shrink-0 ${entrance(350).className}`} style={entrance(350).style}>
              <SecondaryCard className="px-4 py-3">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2">Pipeline</p>
                {pipeline.length === 0 ? (
                  <p className="text-sm text-zinc-500">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pipeline.map((p) => (
                      <span
                        key={p.status}
                        className="text-[11px] text-zinc-300 bg-white/[0.05] border border-white/[0.08] rounded-full px-2.5 py-1 whitespace-nowrap"
                      >
                        {p.status} <span className="font-bold text-cyan-400">{p.quantidade}</span>
                      </span>
                    ))}
                  </div>
                )}
              </SecondaryCard>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
