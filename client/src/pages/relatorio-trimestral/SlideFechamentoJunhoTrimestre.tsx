import { Trophy, DollarSign, Zap, TrendingDown, Repeat } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import { ACCENT, formatBRL, entrance } from "./deck-kit";

// Fechamento de Junho/2026 — números do report diário do dia 30/06 (20h). Substitui o
// antigo slide "Performance por Squad". Destaque no Net Churn (5,91% — bateu a meta).
// Tudo hardcoded, direto da mensagem (decisão Ichino 2026-07-10).

function Linha({ label, valor, color, sub, strong }: { label: string; valor: string; color?: string; sub?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-zinc-400">{label}</span>
      <span className="text-right">
        <span className={`tabular-nums ${strong ? "text-2xl font-black" : "text-base font-bold"}`} style={{ color: color || "#f4f4f5" }}>{valor}</span>
        {sub && <span className="block text-[11px] text-zinc-500 leading-tight">{sub}</span>}
      </span>
    </div>
  );
}

export default function SlideFechamentoJunhoTrimestre() {
  return (
    <SlideLayout section="commerce" padding="26px 40px">
      <SlideHeader
        icon={Trophy}
        iconColor="text-emerald-400"
        title="Junho 2026 — Fechamento"
        gradientColor="#34d399"
        subtitle="Report diário · 30/06 · 20h"
      />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Linha 1: Net Churn (hero) + MRR */}
        <div className="grid grid-cols-[1.1fr_1fr] gap-4 flex-[2] min-h-0">
          {/* NET CHURN — o destaque do mês */}
          <div className={`${entrance(0).className} flex`} style={entrance(0).style}>
            <SecondaryCard className="w-full flex flex-col justify-center items-center text-center px-8 py-5" borderColor={ACCENT.mrr}>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
                <TrendingDown className="h-4 w-4" /> Net Churn — Junho
              </span>
              <p className="text-7xl font-black text-emerald-400 leading-none mt-3 tabular-nums">5,91%</p>
              <p className="text-xl font-bold text-zinc-200 mt-2 tabular-nums">{formatBRL(60948)}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full px-4 py-1 text-sm font-black">
                BATEU 🎯
              </span>
            </SecondaryCard>
          </div>

          {/* MRR */}
          <div className={`${entrance(120).className} flex`} style={entrance(120).style}>
            <SecondaryCard className="w-full flex flex-col justify-center px-7 py-5 gap-2.5" borderColor="#34d399">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
                <DollarSign className="h-4 w-4" /> MRR
              </span>
              <Linha label="Ativo (fim jun)" valor={formatBRL(1138700)} color={ACCENT.mrr} strong />
              <Linha label="Total jun" valor={formatBRL(1191068)} />
              <div className="h-px bg-white/10 my-1" />
              <Linha label="Meta jun" valor={formatBRL(1688510)} sub="realizado 70,5% da meta" />
              <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden mt-1">
                <div className="h-full rounded-full" style={{ width: "70.5%", background: `linear-gradient(to right, #059669, ${ACCENT.mrr})` }} />
              </div>
            </SecondaryCard>
          </div>
        </div>

        {/* Linha 2: Pontual · Churn MRR · Cross-sell */}
        <div className="grid grid-cols-3 gap-4 flex-[3] min-h-0">
          {/* Pontual */}
          <div className={`${entrance(200).className} flex`} style={entrance(200).style}>
            <SecondaryCard className="w-full flex flex-col justify-center px-6 py-5 gap-2.5" borderColor={ACCENT.pontual}>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">
                <Zap className="h-4 w-4" /> Pontual — Junho
              </span>
              <Linha label="Entrega" valor={formatBRL(268566)} color={ACCENT.pontual} strong />
              <div className="h-px bg-white/10 my-1" />
              <Linha label="Churn pontual" valor={formatBRL(72214)} color={ACCENT.churn} />
              <Linha label="Churn ajustado" valor={formatBRL(48726)} sub="s/ erro de venda, não iniciado e inadimplente 1 mês" />
            </SecondaryCard>
          </div>

          {/* Churn MRR */}
          <div className={`${entrance(280).className} flex`} style={entrance(280).style}>
            <SecondaryCard className="w-full flex flex-col justify-center px-6 py-5 gap-2.5" borderColor={ACCENT.churn}>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-400 mb-1">
                <TrendingDown className="h-4 w-4" /> Churn MRR — Junho
              </span>
              <Linha label="Churn total" valor={formatBRL(186662)} color={ACCENT.churn} />
              <Linha label="Churn ajustado" valor={formatBRL(146177)} color={ACCENT.churn} sub="14,2% · base MRR maio R$ 1.030.229" strong />
              <div className="h-px bg-white/10 my-1" />
              <Linha label="Em cancelamento" valor={formatBRL(118071)} />
              <Linha label="Em canc. ajustado" valor={formatBRL(106071)} sub="mesma régua" />
            </SecondaryCard>
          </div>

          {/* Cross-sell */}
          <div className={`${entrance(360).className} flex`} style={entrance(360).style}>
            <SecondaryCard className="w-full flex flex-col justify-center px-6 py-5 gap-2.5" borderColor={ACCENT.cyan}>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">
                <Repeat className="h-4 w-4" /> Cross-sell — Junho
              </span>
              <Linha label="Recorrente" valor={formatBRL(72838)} />
              <Linha label="Pontual (÷5)" valor={formatBRL(12391)} sub="R$ 61.955 ÷ 5" />
              <div className="h-px bg-white/10 my-1" />
              <Linha label="Total" valor={formatBRL(85229)} color={ACCENT.cyan} strong />
            </SecondaryCard>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
