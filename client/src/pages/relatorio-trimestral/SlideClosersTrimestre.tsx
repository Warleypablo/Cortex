import { Trophy, Crown, Zap } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { CloserRanking } from "../relatorio-mensal/types";
import { ACCENT, fmtCompact, entrance, DeckKeyframes, GrowBar } from "./deck-kit";
import { useCountUp } from "./useCountUp";

interface Props {
  ranking: CloserRanking[];
  topPontual: CloserRanking | null;
  label: string;
}

function firstName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : (parts[0] ?? name);
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// Cores de medalha do pódio (1º/2º/3º) — semântica de ranking, não de entidade.
const PODIUM_COLORS = [
  { ring: "#f59e0b", grad: "from-amber-400 to-amber-600", block: "from-amber-500/25 to-amber-800/10", text: "text-amber-400" },
  { ring: "#a1a1aa", grad: "from-zinc-300 to-zinc-500", block: "from-zinc-400/20 to-zinc-700/10", text: "text-zinc-300" },
  { ring: "#f97316", grad: "from-orange-400 to-orange-600", block: "from-orange-500/20 to-orange-800/10", text: "text-orange-400" },
];

function Avatar({ nome, url, px, grad }: { nome: string; url: string | null; px: number; grad: string }) {
  const style = { width: px, height: px };
  if (url) {
    return <img src={url} alt={nome} style={style} className="rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />;
  }
  return (
    <div
      style={{ ...style, fontSize: Math.max(px * 0.32, 10) }}
      className={`rounded-full bg-gradient-to-br ${grad} flex items-center justify-center font-bold text-white/90 shrink-0`}
    >
      {initials(nome)}
    </div>
  );
}

export default function SlideClosersTrimestre({ ranking, topPontual, label }: Props) {
  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3, 7); // até 4 linhas (deck opera com 7 closers ativos no máximo)
  const hasResto = resto.length > 0;

  // Display: 2º | 1º | 3º (mesma convenção do pódio mensal)
  const display = top3.length >= 3
    ? [{ c: top3[1], r: 1 }, { c: top3[0], r: 0 }, { c: top3[2], r: 2 }]
    : top3.length === 2
      ? [{ c: top3[1], r: 1 }, { c: top3[0], r: 0 }]
      : top3.map((c, i) => ({ c, r: i }));

  const fotoPx = [104, 82, 74];
  const podiumH = [112, 78, 56];

  // Count-up do MRR obtido — hooks sempre chamados na mesma ordem (fallback 0 se não houver closer)
  const mrr0 = useCountUp(top3[0]?.mrrObtido ?? 0, 750, 200);
  const mrr1 = useCountUp(top3[1]?.mrrObtido ?? 0, 750, 300);
  const mrr2 = useCountUp(top3[2]?.mrrObtido ?? 0, 750, 400);
  const mrrAnim = [mrr0, mrr1, mrr2];
  const pontualAnim = useCountUp(topPontual?.pontualObtido ?? 0, 750, 350);

  const maxTotal = Math.max(...ranking.map((c) => c.totalObtido), 1);

  if (ranking.length === 0) {
    return (
      <SlideLayout section="comercial" padding="28px 36px">
        <SlideHeader icon={Trophy} iconColor="text-amber-400" title={`Ranking Closers — ${label}`} gradientColor="#f59e0b" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de closers para este trimestre</p>
        </div>
      </SlideLayout>
    );
  }

  return (
    <SlideLayout section="comercial" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Trophy} iconColor="text-amber-400" title={`Ranking Closers — ${label}`} gradientColor="#f59e0b" />

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Coluna principal: pódio top 3 + demais closers */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div
            {...entrance(0)}
            className={`flex justify-center gap-10 ${hasResto ? "items-end shrink-0" : "items-center flex-1"}`}
          >
            {display.map(({ c, r }) => {
              if (!c) return null;
              const col = PODIUM_COLORS[r];
              const isFirst = r === 0;
              const originalIdx = top3.indexOf(c);
              return (
                <div key={c.name} className="flex flex-col items-center" style={{ width: isFirst ? 172 : 140 }}>
                  {isFirst && <Crown className="text-amber-400 mb-1.5" style={{ width: 30, height: 30 }} />}
                  <div className="rounded-full flex items-center justify-center mb-2.5" style={{ padding: 3, border: `3px solid ${col.ring}` }}>
                    <Avatar nome={c.name} url={c.fotoUrl} px={fotoPx[r]} grad={col.grad} />
                  </div>
                  <p className={`font-bold text-center truncate max-w-full ${isFirst ? "text-lg" : "text-sm"}`}>{firstName(c.name)}</p>
                  <p className={`font-black mt-0.5 tabular-nums ${isFirst ? "text-3xl" : "text-xl"} ${col.text}`}>
                    {fmtCompact(mrrAnim[originalIdx])}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">{c.negociosGanhos} negócios</p>
                  <div
                    className={`w-full rounded-t-xl bg-gradient-to-b ${col.block} flex items-center justify-center`}
                    style={{ height: podiumH[r], borderTop: `2px solid ${col.ring}` }}
                  >
                    <span className={`text-3xl font-black ${col.text}`}>{r + 1}º</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Demais closers: linhas compactas com GrowBar proporcional ao total obtido */}
          {hasResto && (
            <div {...entrance(250)} className="flex-1 min-h-0">
              <SecondaryCard className="px-5 py-3.5 h-full flex flex-col" borderColor="#52525b">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2.5 shrink-0">Demais closers</p>
                <div className="flex-1 flex flex-col justify-center gap-2.5 min-h-0">
                  {resto.map((c, i) => {
                    const pct = (c.totalObtido / maxTotal) * 100;
                    return (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="w-4 text-xs font-bold text-zinc-500 text-right shrink-0">{i + 4}</span>
                        <Avatar nome={c.name} url={c.fotoUrl} px={26} grad="from-sky-500 to-sky-700" />
                        <span className="w-32 text-xs text-zinc-300 truncate shrink-0" title={c.name}>{firstName(c.name)}</span>
                        <div className="flex-1 h-4 rounded-md overflow-hidden bg-white/[0.03]">
                          <GrowBar widthPct={pct} delayMs={300 + i * 70} className="bg-gradient-to-r from-sky-500/80 to-sky-400/60 rounded-md" />
                        </div>
                        <span className="w-16 text-xs font-bold text-white text-right shrink-0 tabular-nums">{fmtCompact(c.totalObtido)}</span>
                        <span className="w-16 text-[10px] text-zinc-500 text-right shrink-0 tabular-nums">{c.negociosGanhos} neg.</span>
                      </div>
                    );
                  })}
                </div>
              </SecondaryCard>
            </div>
          )}
        </div>

        {/* Destaque Pontual */}
        {topPontual && (
          <div {...entrance(150)} className="shrink-0 flex" style={{ width: 240 }}>
            <SecondaryCard className="w-full flex flex-col items-center text-center px-6 py-7" borderColor={ACCENT.pontual}>
              <div className="flex items-center gap-2 mb-5">
                <Zap className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Destaque Pontual</span>
              </div>
              <div className="rounded-full mb-4" style={{ padding: 3, border: "3px solid #a855f7" }}>
                <Avatar nome={topPontual.name} url={topPontual.fotoUrl} px={100} grad="from-purple-400 to-purple-600" />
              </div>
              <p className="text-lg font-bold">{firstName(topPontual.name)}</p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">{topPontual.negociosGanhos} negócios</p>
              <div className="bg-white/[0.04] border border-purple-500/20 rounded-xl px-5 py-3 w-full">
                <p className="text-2xl font-black text-purple-400 tabular-nums">{fmtCompact(pontualAnim)}</p>
              </div>
            </SecondaryCard>
          </div>
        )}
      </div>
    </SlideLayout>
  );
}
