import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Cpu, Target, Trophy } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "../relatorio-mensal/SlideComponents";
import type { TechTrimestralData } from "./types";
import {
  ACCENT, fmtCompact, fmtK, entrance, DeckKeyframes, GrowBar, TOOLTIP_STYLE,
} from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Só a parte de data de "08/07/2026, 10:59:26" para o rótulo de fonte.
function fonteLabel(fonte: string, geradoEm: string | null): string {
  const dia = geradoEm ? geradoEm.split(",")[0].trim() : null;
  return dia ? `Fonte: ${fonte} · atualizado ${dia}` : `Fonte: ${fonte}`;
}

const MEDAL = ["#fbbf24", "#a1a1aa", "#f97316"];

function HeroCard({
  label, value, sub, accent = ACCENT.cyan, progress,
}: {
  label: string; value: string; sub?: string; accent?: string;
  progress?: { pct: number };
}) {
  return (
    <SecondaryCard className="flex flex-col justify-center py-4 px-4" borderColor={accent}>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-[28px] leading-none font-black text-white mt-1.5 tabular-nums">{value}</p>
      {progress && (
        <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <GrowBar
            widthPct={Math.min(progress.pct, 100)}
            delayMs={300}
            className="rounded-full"
            style={{ background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }}
          />
        </div>
      )}
      {sub && <p className="text-[11px] text-zinc-400 mt-1.5 tabular-nums">{sub}</p>}
    </SecondaryCard>
  );
}

export default function SlideTechTrimestre({
  techData,
  label,
}: {
  techData: TechTrimestralData;
  label: string;
}) {
  const pct = Math.round((techData.atingimento || 0) * 100);

  // Hooks sempre na mesma ordem (fallback 0), independem de `disponivel`.
  const entregueAnim = useCountUp(techData.entregue ?? 0, 800, 200);
  const projetosAnim = useCountUp(techData.projetos ?? 0, 800, 250);
  const mrrAnim = useCountUp(techData.mrrUltimoMes ?? 0, 800, 300);
  const quartoAnim = useCountUp(techData.entregasTri ?? pct, 800, 350);

  const entregas = techData.entregasPorMes ?? [];
  const maxEntrega = Math.max(...entregas.map((e) => e.valor), 1);
  const mrrMeses = techData.mrrPorMes ?? [];
  const maxMrr = Math.max(...mrrMeses.map((m) => m.mrr), 1);
  const accounts = [...(techData.topAccounts ?? [])].sort((a, b) => b.valor - a.valor).slice(0, 3);
  const maxAccount = Math.max(...accounts.map((a) => a.valor), 1);

  if (!techData.disponivel) {
    return (
      <SlideLayout section="tech" padding="28px 36px">
        <SlideHeader icon={Cpu} iconColor="text-cyan-400" title={`Área Tech — ${label}`} gradientColor={ACCENT.cyan} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-zinc-400">Sem dados Tech para este trimestre na fonte.</p>
          <p className="text-xs text-zinc-600">{fonteLabel(techData.fonte, techData.geradoEm)}</p>
        </div>
      </SlideLayout>
    );
  }

  return (
    <SlideLayout section="tech" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader
        icon={Cpu}
        iconColor="text-cyan-400"
        title={`Área Tech — ${label}`}
        gradientColor={ACCENT.cyan}
        subtitle={fonteLabel(techData.fonte, techData.geradoEm)}
      />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: 4 KPIs com count-up */}
        <div className={`grid grid-cols-4 gap-3 shrink-0 ${entrance(0).className}`} style={entrance(0).style}>
          <HeroCard
            label="Entregue no trimestre"
            value={fmtCompact(entregueAnim)}
            accent={ACCENT.cyan}
            progress={{ pct }}
            sub={`Meta ${fmtCompact(techData.meta)} · ${pct}%`}
          />
          <HeroCard
            label="Projetos entregues"
            value={String(Math.round(projetosAnim))}
            accent={ACCENT.vendas}
            sub={`ticket médio ${fmtCompact(techData.ticketMedio)}`}
          />
          <HeroCard
            label={`MRR ${techData.mrrUltimoMesLabel || "recorrente"}`}
            value={fmtCompact(mrrAnim)}
            accent={ACCENT.mrr}
            sub={`${techData.contratosAtivos} contratos ativos`}
          />
          {techData.entregasTri != null ? (
            <HeroCard
              label="Entregas no trimestre"
              value={String(Math.round(quartoAnim))}
              accent={ACCENT.pontual}
              sub="tasks concluídas"
            />
          ) : (
            <HeroCard
              label="Atingimento da meta"
              value={`${Math.round(quartoAnim)}%`}
              accent={pct >= 100 ? ACCENT.mrr : ACCENT.amber}
              sub={`${fmtCompact(techData.entregue)} de ${fmtCompact(techData.meta)}`}
            />
          )}
        </div>

        {/* Entregas por mês (chart) + Top accounts / MRR recorrente (coluna) */}
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Chart de entregas por mês (R$) com contagem de projetos no topo */}
          <div className={`col-span-2 flex flex-col min-h-0 ${entrance(150).className}`} style={entrance(150).style}>
            <ChartCard className="flex-1">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Entregas por mês</p>
                <p className="text-[10px] text-zinc-500">receita entregue (R$) · nº de projetos</p>
              </div>
              {entregas.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">Sem entregas no trimestre</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={entregas} margin={{ top: 24, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                      <YAxis stroke="#a1a1aa" fontSize={10} tickFormatter={fmtK} tickLine={false} axisLine={false} width={40} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        formatter={(v: any, _n: any, p: any) => [`${fmtCompact(Number(v))} · ${p?.payload?.projetos ?? 0} proj.`, "Entregue"]}
                      />
                      <defs>
                        <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ACCENT.cyan} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={ACCENT.cyan} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="valor" fill="url(#techGrad)" maxBarSize={64} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                        <LabelList
                          dataKey="projetos"
                          position="top"
                          formatter={(v: any) => `${v} proj.`}
                          fill="#e4e4e7"
                          fontSize={11}
                          fontWeight={700}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Coluna: Top accounts + MRR recorrente por mês */}
          <div className="col-span-1 flex flex-col gap-4 min-h-0">
            <div className={`flex-1 flex flex-col min-h-0 ${entrance(250).className}`} style={entrance(250).style}>
              <SecondaryCard className="px-4 py-3 flex-1 flex flex-col min-h-0" borderColor={ACCENT.amber}>
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Top accounts</p>
                </div>
                {accounts.length === 0 ? (
                  <p className="text-sm text-zinc-500 flex-1 flex items-center justify-center">—</p>
                ) : (
                  <div className="flex-1 flex flex-col justify-center gap-2.5 min-h-0">
                    {accounts.map((a, i) => (
                      <div key={a.nome} className="flex items-center gap-2.5">
                        <span
                          className="w-5 h-5 rounded-full text-black text-[11px] font-black flex items-center justify-center shrink-0"
                          style={{ backgroundColor: MEDAL[i] ?? "#52525b" }}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{a.nome}</p>
                          <div className="h-3 mt-1 rounded-md overflow-hidden bg-white/[0.03]">
                            <GrowBar
                              widthPct={(a.valor / maxAccount) * 100}
                              delayMs={350 + i * 90}
                              className="bg-gradient-to-r from-amber-500/80 to-amber-400/50 rounded-md"
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-white tabular-nums">{fmtCompact(a.valor)}</p>
                          <p className="text-[9px] text-zinc-500 tabular-nums">{a.projetos} proj.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SecondaryCard>
            </div>

            <div className={`shrink-0 ${entrance(350).className}`} style={entrance(350).style}>
              <SecondaryCard className="px-4 py-3" borderColor={ACCENT.mrr}>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">MRR recorrente</p>
                </div>
                {mrrMeses.length === 0 ? (
                  <p className="text-sm text-zinc-500">—</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {mrrMeses.map((m, i) => (
                      <div key={m.month} className="flex items-center gap-2">
                        <span className="w-8 text-[11px] text-zinc-400 shrink-0">{m.label}</span>
                        <div className="flex-1 h-3.5 rounded-md overflow-hidden bg-white/[0.03]">
                          <GrowBar
                            widthPct={(m.mrr / maxMrr) * 100}
                            delayMs={450 + i * 80}
                            className="bg-gradient-to-r from-emerald-500/80 to-emerald-400/50 rounded-md"
                          />
                        </div>
                        <span className="w-12 text-[11px] font-bold text-white text-right shrink-0 tabular-nums">{fmtCompact(m.mrr)}</span>
                      </div>
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
