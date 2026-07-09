import { Trophy } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { SquadRanking } from "../relatorio-mensal/types";
import { ACCENT, fmtCompact, entrance, LegendDot, DeckKeyframes, GrowBar } from "./deck-kit";
import { useCountUp } from "./useCountUp";

interface Props {
  ranking: SquadRanking[];
  label: string;
}

const MEDAL_COLORS: Record<number, string> = {
  1: "#f59e0b", // amber (ouro)
  2: "#a1a1aa", // zinc (prata)
  3: "#f97316", // orange (bronze)
};

/** Extrai o emoji-prefixo e o nome-base de um squad tipo "🪖 Selva". */
function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}

export default function SlideSquadsRankingTrimestre({ ranking, label }: Props) {
  const sorted = [...(ranking ?? [])]
    .map((r) => ({ ...r, total: r.mrr + r.pontual }))
    .sort((a, b) => b.total - a.total);

  if (sorted.length === 0) {
    return (
      <SlideLayout section="commerce" padding="28px 36px">
        <SlideHeader icon={Trophy} iconColor="text-amber-400" title={`Ranking Squads — ${label}`} gradientColor="#f59e0b" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de squads para este trimestre</p>
        </div>
      </SlideLayout>
    );
  }

  const totalGeral = sorted.reduce((acc, r) => acc + r.total, 0);
  const totalGeralAnim = useCountUp(totalGeral, 750, 150);
  const maxTotal = Math.max(...sorted.map((r) => r.total), 1);

  // Densidade adaptativa: com muitos squads, comprime altura das linhas p/ caber sem espaço morto
  const isDense = sorted.length > 7;
  const rowGap = isDense ? "gap-2" : "gap-3";
  const barH = isDense ? "h-5" : "h-7";

  // Stagger das barras limitado (independente do nº de squads) p/ respeitar orçamento de animação (<=1100ms)
  const rowStep = sorted.length > 1 ? Math.min(50, Math.floor(300 / (sorted.length - 1))) : 0;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Trophy} iconColor="text-amber-400" title={`Ranking Squads — ${label}`} gradientColor="#f59e0b" />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: total geral (count-up) + legenda das séries */}
        <div {...entrance(0)} className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total gerado no trimestre</p>
            <p className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-purple-400 bg-clip-text text-transparent">
              {fmtCompact(totalGeralAnim)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <LegendDot color={ACCENT.mrr} label="MRR" />
            <LegendDot color={ACCENT.pontual} label="Pontual" />
          </div>
        </div>

        {/* Ranking: barras horizontais empilhadas por squad */}
        <div {...entrance(150)} className="flex-1 min-h-0 flex flex-col">
          <SecondaryCard className="px-6 py-4 flex-1 flex flex-col min-h-0">
            <div className={`flex-1 flex flex-col justify-center ${rowGap} min-h-0`}>
              {sorted.map((r, i) => {
                const { emoji, name } = parseSquadName(r.squad);
                const pos = i + 1;
                const medal = MEDAL_COLORS[pos] || "#52525b";
                const pctMrr = r.total > 0 ? (r.mrr / r.total) * 100 : 0;
                return (
                  <div key={r.squad} className="flex items-center gap-3">
                    <span className="w-9 text-right text-lg font-black tabular-nums shrink-0" style={{ color: medal }}>
                      {pos}°
                    </span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${medal}40, ${medal}15)`,
                        border: `2px solid ${medal}70`,
                      }}
                    >
                      {emoji ? (
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
                      ) : (
                        <span className="text-[10px] font-black text-white">{name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="w-32 text-sm font-semibold text-zinc-200 truncate shrink-0" title={name}>
                      {name}
                    </span>
                    <div className={`flex-1 ${barH} rounded-md overflow-hidden bg-white/[0.03]`}>
                      <GrowBar widthPct={(r.total / maxTotal) * 100} delayMs={200 + i * rowStep} className="rounded-md">
                        <div
                          className="h-full"
                          style={{ width: `${pctMrr}%`, background: `linear-gradient(to right, ${ACCENT.mrr}, ${ACCENT.mrr}bb)` }}
                        />
                        <div className="h-full flex-1" style={{ background: `linear-gradient(to right, ${ACCENT.pontual}, ${ACCENT.pontual}bb)` }} />
                      </GrowBar>
                    </div>
                    <span className="w-20 text-sm font-bold text-white text-right shrink-0 tabular-nums">
                      {fmtCompact(r.total)}
                    </span>
                    <span className="w-32 text-[11px] text-zinc-500 text-right shrink-0 tabular-nums">
                      {r.clientes} cli · {r.contratos} ctr
                    </span>
                  </div>
                );
              })}
            </div>
          </SecondaryCard>
        </div>
      </div>
    </SlideLayout>
  );
}
