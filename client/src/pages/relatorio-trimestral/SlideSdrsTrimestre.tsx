import { Headset, Crown, CalendarCheck } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { SdrRanking, TopReunioes } from "../relatorio-mensal/types";
import { fmtCompact, entranceWith, DeckKeyframes } from "./deck-kit";
import { useCountUp } from "./useCountUp";

interface Props {
  ranking: SdrRanking[];
  topReunioes: TopReunioes | null;
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

export default function SlideSdrsTrimestre({ ranking, topReunioes, label }: Props) {
  const top3 = ranking.slice(0, 3); // só o pódio — apenas top 3 (decisão Ichino 2026-07-10)

  // Display: 2º | 1º | 3º (mesma convenção do pódio)
  const display = top3.length >= 3
    ? [{ c: top3[1], r: 1 }, { c: top3[0], r: 0 }, { c: top3[2], r: 2 }]
    : top3.length === 2
      ? [{ c: top3[1], r: 1 }, { c: top3[0], r: 0 }]
      : top3.map((c, i) => ({ c, r: i }));

  const fotoPx = [88, 72, 64];
  const podiumH = [72, 52, 38];

  // Count-up do MRR gerado — hooks sempre na mesma ordem (fallback 0)
  const mrr0 = useCountUp(top3[0]?.mrrGerado ?? 0, 750, 200);
  const mrr1 = useCountUp(top3[1]?.mrrGerado ?? 0, 750, 300);
  const mrr2 = useCountUp(top3[2]?.mrrGerado ?? 0, 750, 400);
  const mrrAnim = [mrr0, mrr1, mrr2];
  const reunioesAnim = useCountUp(topReunioes?.reunioes ?? 0, 750, 350);

  if (ranking.length === 0) {
    return (
      <SlideLayout section="comercial" padding="28px 36px">
        <SlideHeader icon={Headset} iconColor="text-sky-400" title={`Ranking SDRs — ${label}`} gradientColor="#38bdf8" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de SDRs para este trimestre</p>
        </div>
      </SlideLayout>
    );
  }

  return (
    <SlideLayout section="comercial" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Headset} iconColor="text-sky-400" title={`Ranking SDRs — ${label}`} gradientColor="#38bdf8" />

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Coluna principal: só o pódio top 3 (MRR gerado) */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div {...entranceWith(0, "flex justify-center gap-10 items-center flex-1")}>
            {display.map(({ c, r }) => {
              if (!c) return null;
              const col = PODIUM_COLORS[r];
              const isFirst = r === 0;
              const originalIdx = top3.indexOf(c);
              return (
                <div key={c.name} className="flex flex-col items-center" style={{ width: isFirst ? 172 : 140 }}>
                  {isFirst && <Crown className="text-amber-400 mb-1" style={{ width: 24, height: 24 }} />}
                  <div className="rounded-full flex items-center justify-center mb-2" style={{ padding: 3, border: `3px solid ${col.ring}` }}>
                    <Avatar nome={c.name} url={c.fotoUrl} px={fotoPx[r]} grad={col.grad} />
                  </div>
                  <p className={`font-bold text-center truncate max-w-full ${isFirst ? "text-base" : "text-sm"}`}>{firstName(c.name)}</p>
                  <p className={`font-black mt-0.5 tabular-nums ${isFirst ? "text-2xl" : "text-lg"} ${col.text}`}>
                    {fmtCompact(mrrAnim[originalIdx])}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 mb-1.5">MRR gerado · {c.negociosGanhos} neg.</p>
                  <div
                    className={`w-full rounded-t-xl bg-gradient-to-b ${col.block} flex items-center justify-center`}
                    style={{ height: podiumH[r], borderTop: `2px solid ${col.ring}` }}
                  >
                    <span className={`text-2xl font-black ${col.text}`}>{r + 1}º</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Destaque Reuniões */}
        {topReunioes && (
          <div {...entranceWith(150, "shrink-0 flex", { width: 240 })}>
            <SecondaryCard className="w-full flex flex-col items-center text-center px-6 py-7" borderColor="#22d3ee">
              <div className="flex items-center gap-2 mb-5">
                <CalendarCheck className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Destaque Reuniões</span>
              </div>
              <div className="rounded-full mb-4" style={{ padding: 3, border: "3px solid #22d3ee" }}>
                <Avatar nome={topReunioes.name} url={topReunioes.fotoUrl} px={100} grad="from-cyan-400 to-cyan-600" />
              </div>
              <p className="text-lg font-bold">{firstName(topReunioes.name)}</p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">líder em agendamentos</p>
              <div className="bg-white/[0.04] border border-cyan-500/20 rounded-xl px-5 py-3 w-full">
                <p className="text-3xl font-black text-cyan-400 tabular-nums">{Math.round(reunioesAnim)}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">reuniões realizadas</p>
              </div>
            </SecondaryCard>
          </div>
        )}
      </div>
    </SlideLayout>
  );
}
