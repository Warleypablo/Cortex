import { Activity, Users, TrendingUp, TrendingDown, Pause, CreditCard, Target, RefreshCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { TurboMetrics } from "../relatorio-mensal/types";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "../relatorio-mensal/SlideComponents";
import { ACCENT, fmtCompact, fmtK, entrance, LegendDot, TOOLTIP_STYLE } from "./deck-kit";
import { useCountUp } from "./useCountUp";

function fmtFull(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtPct(num: number, den: number): string {
  if (den <= 0) return "—";
  return `${((num / den) * 100).toFixed(1).replace(".", ",")}%`;
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 min-w-[170px]">
      <p className="font-bold text-white mb-1.5">{label}</p>
      <div className="border-b border-zinc-700 pb-1 mb-1.5 flex justify-between gap-3">
        <span className="text-zinc-400">Total (MRR+Pontual):</span>
        <span className="font-bold text-cyan-300">{fmtCompact(data.total)}</span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-3">
          <span style={{ color: ACCENT.mrr }}>MRR:</span>
          <span style={{ color: ACCENT.mrr }}>{fmtCompact(data.mrr)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: ACCENT.pontual }}>Pontual:</span>
          <span style={{ color: ACCENT.pontual }}>{fmtCompact(data.pontual)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: ACCENT.churn }}>Churn:</span>
          <span style={{ color: ACCENT.churn }}>{fmtCompact(data.churnBrl)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: ACCENT.churn }}>Churn %:</span>
          <span style={{ color: ACCENT.churn }}>{data.churnPct}%</span>
        </div>
      </div>
    </div>
  );
}

export default function SlideTurboTrimestre({ metrics, label }: { metrics: TurboMetrics; label: string }) {
  const faturamentoTotal = metrics.mrrAtivo + metrics.faturamentoPontual;

  // Cards em linha (delay 0 → count-up +200ms, brief)
  const mrrAtivoAnim = useCountUp(metrics.mrrAtivo, 750, 200);
  const pontualAnim = useCountUp(metrics.faturamentoPontual, 750, 250);
  const totalFaturamentoAnim = useCountUp(faturamentoTotal, 750, 300);
  const clientesAnim = useCountUp(metrics.clientesAtivos, 750, 200);
  const contratosAnim = useCountUp(metrics.contratosAtivos, 750, 250);
  const adicionadoAnim = useCountUp(metrics.mrrAdicionado, 750, 200);
  const canceladoAnim = useCountUp(metrics.churnMrr, 750, 250);
  const pausadoAnim = useCountUp(metrics.pausadosMrr, 750, 300);
  const ticketContratoAnim = useCountUp(metrics.ticketMedioContrato, 750, 200);
  const ticketClienteAnim = useCountUp(metrics.ticketMedioCliente, 750, 250);

  // Card lateral (delay 250/350 → count-up +200ms)
  const mrrHeroAnim = useCountUp(metrics.mrrAtivo, 750, 450);
  const metaChurnAnim = useCountUp(metrics.churnMetaMensal, 750, 550);
  const realizadoChurnAnim = useCountUp(metrics.churnMrr, 750, 550);

  const chartData = (metrics.receitaChurnSeries ?? []).map((s) => ({
    label: s.label,
    mrr: s.mrr,
    pontual: s.pontual,
    churnBrl: s.churnBrl,
    churnPct: s.churnPct,
    total: s.mrr + s.pontual,
  }));
  const lastIdx = chartData.length - 1;

  const churnPctVsMeta = metrics.churnMetaMensal > 0 ? Math.round((metrics.churnMrr / metrics.churnMetaMensal) * 100) : null;
  const churnAcimaDaMeta = metrics.churnMrr > metrics.churnMetaMensal;

  return (
    <SlideLayout section="commerce" padding="24px 32px">
      <SlideHeader icon={Activity} iconColor="text-cyan-400" title={`Turbo Commerce — ${label}`} gradientColor={ACCENT.cyan} />

      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {/* Linha de 4 cards compactos */}
        <div className={`grid grid-cols-4 gap-3 shrink-0 ${entrance(0).className}`} style={entrance(0).style}>
          {/* Faturamento */}
          <SecondaryCard className="p-3 flex flex-col justify-center" borderColor={ACCENT.cyan}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Faturamento</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT.mrr }} />
                <span className="text-[11px] text-zinc-400">MRR (fim do tri):</span>
                <span className="text-sm font-bold ml-auto tabular-nums" style={{ color: ACCENT.mrr }}>
                  {fmtCompact(mrrAtivoAnim)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT.pontual }} />
                <span className="text-[11px] text-zinc-400">Pontual no tri:</span>
                <span className="text-sm font-bold ml-auto tabular-nums" style={{ color: ACCENT.pontual }}>
                  {fmtCompact(pontualAnim)}
                </span>
              </div>
            </div>
            <div className="mt-1.5 bg-cyan-500/10 rounded px-2 py-0.5 inline-block w-fit">
              <span className="text-xs font-bold text-cyan-300">MRR + pontual do tri: {fmtCompact(totalFaturamentoAnim)}</span>
            </div>
          </SecondaryCard>

          {/* Base */}
          <SecondaryCard className="p-3 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Base — foto fim do tri</p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] text-zinc-500">Clientes</p>
                <p className="text-2xl font-black tabular-nums">{Math.round(clientesAnim)}</p>
              </div>
              <div className="w-px h-9 bg-white/10" />
              <div>
                <p className="text-[10px] text-zinc-500">Contratos</p>
                <p className="text-2xl font-black tabular-nums">{Math.round(contratosAnim)}</p>
              </div>
            </div>
          </SecondaryCard>

          {/* Movimentação */}
          <SecondaryCard className="p-3 flex flex-col justify-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Movimentação no tri</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 shrink-0" style={{ color: ACCENT.mrr }} />
                  <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: ACCENT.mrr }}>Adicionado</span>
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT.mrr }}>{fmtCompact(adicionadoAnim)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 shrink-0" style={{ color: ACCENT.churn }} />
                  <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: ACCENT.churn }}>Cancelado</span>
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT.churn }}>{fmtCompact(canceladoAnim)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <Pause className="h-3 w-3 shrink-0" style={{ color: ACCENT.amber }} />
                  <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: ACCENT.amber }}>
                    Pausados <span className="text-zinc-500 font-normal">(hoje)</span>
                  </span>
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT.amber }}>{fmtCompact(pausadoAnim)}</span>
              </div>
            </div>
          </SecondaryCard>

          {/* Ticket médio + Retenções */}
          <SecondaryCard className="p-3 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Ticket médio</p>
            </div>
            <div className="space-y-1 mb-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Contrato:</span>
                <span className="text-sm font-bold tabular-nums">{fmtCompact(ticketContratoAnim)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Cliente:</span>
                <span className="text-sm font-bold tabular-nums">{fmtCompact(ticketClienteAnim)}</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[11px] text-zinc-400 whitespace-nowrap">
                <RefreshCcw className="h-3 w-3 text-sky-400 shrink-0" /> Retenções:
              </span>
              <span className="text-xs font-bold text-sky-400 tabular-nums whitespace-nowrap">
                {metrics.retencoesCount}/{metrics.retencoesSolicitacoesCount} ({fmtPct(metrics.retencoesCount, metrics.retencoesSolicitacoesCount)})
              </span>
            </div>
          </SecondaryCard>
        </div>

        {/* Bloco principal: gráfico + MRR ativo / Meta Churn */}
        <div className="flex-1 grid grid-cols-7 gap-3 min-h-0">
          <div className={`col-span-5 flex flex-col min-h-0 ${entrance(150).className}`} style={entrance(150).style}>
            <ChartCard className="flex-1">
              <div className="flex items-center justify-between mb-2 shrink-0 gap-3">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">MRR + Pontual × Churn por trimestre</p>
                <div className="flex items-center gap-4">
                  <LegendDot color={ACCENT.mrr} label="MRR" />
                  <LegendDot color={ACCENT.pontual} label="Pontual" />
                  <LegendDot color={ACCENT.churn} label="Churn" />
                </div>
              </div>
              {chartData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">Sem dados no período</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                      <YAxis stroke="#a1a1aa" fontSize={10} tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="mrr" name="MRR" stackId="rec" maxBarSize={28} radius={[0, 0, 0, 0]} animationDuration={900}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={ACCENT.mrr} fillOpacity={i === lastIdx ? 1 : 0.55} />
                        ))}
                      </Bar>
                      <Bar dataKey="pontual" name="Pontual" stackId="rec" maxBarSize={28} radius={[4, 4, 0, 0]} animationDuration={900}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={ACCENT.pontual} fillOpacity={i === lastIdx ? 1 : 0.55} />
                        ))}
                      </Bar>
                      <Bar dataKey="churnBrl" name="Churn" maxBarSize={28} radius={[4, 4, 0, 0]} animationDuration={900}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={ACCENT.churn} fillOpacity={i === lastIdx ? 1 : 0.55} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="col-span-2 flex flex-col gap-3 min-h-0">
            <div className={`flex-1 min-h-0 ${entrance(250).className}`} style={entrance(250).style}>
              <SecondaryCard className="h-full flex flex-col justify-center p-3" borderColor={ACCENT.mrr}>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">MRR ativo — {label}</p>
                <p className="text-3xl font-black tabular-nums" style={{ color: ACCENT.mrr }}>{fmtFull(mrrHeroAnim)}</p>
              </SecondaryCard>
            </div>

            <div className={`shrink-0 ${entrance(350).className}`} style={entrance(350).style}>
              <SecondaryCard className="p-3" borderColor={ACCENT.churn}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3.5 w-3.5" style={{ color: ACCENT.churn }} />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Meta churn do tri</p>
                </div>
                <p className="text-xl font-black tabular-nums" style={{ color: ACCENT.churn }}>{fmtFull(metaChurnAnim)}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-zinc-500">Realizado:</span>
                  <span className={`text-sm font-bold tabular-nums ${churnAcimaDaMeta ? "text-red-400" : "text-emerald-400"}`}>
                    {fmtFull(realizadoChurnAnim)}
                  </span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                      churnAcimaDaMeta ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                    }`}
                  >
                    {churnPctVsMeta !== null ? `${churnPctVsMeta}%` : "—"}
                  </span>
                </div>
              </SecondaryCard>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
