import { Trophy, Crown, Zap } from "lucide-react";
import type { CloserRanking } from "./types";

interface Props {
  ranking: CloserRanking[];
  topPontual: CloserRanking | null;
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function firstName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
}

function Foto({ nome, url, px }: { nome: string; url: string | null; px: number }) {
  const initials = nome.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const style = { width: px, height: px };
  if (url) {
    return <img src={url} alt={nome} style={style} className="rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <div style={style} className="rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 text-2xl">
      {initials}
    </div>
  );
}

const COLORS = [
  { ring: "#f59e0b", grad: "from-amber-500/30 to-amber-800/20", text: "text-amber-400" },
  { ring: "#a1a1aa", grad: "from-zinc-400/25 to-zinc-700/15", text: "text-zinc-300" },
  { ring: "#f97316", grad: "from-orange-500/25 to-orange-800/15", text: "text-orange-400" },
];

export default function SlideRankingClosers({ ranking, topPontual }: Props) {
  const top3 = ranking.slice(0, 3);
  // Display: 2nd | 1st | 3rd
  const display = top3.length >= 3
    ? [{ c: top3[1], r: 1 }, { c: top3[0], r: 0 }, { c: top3[2], r: 2 }]
    : top3.length === 2
      ? [{ c: top3[1], r: 1 }, { c: top3[0], r: 0 }]
      : top3.map((c, i) => ({ c, r: i }));

  const fotoPx = [140, 110, 100];
  const topPad = [0, 50, 80];
  const labels = ["1\u00BA", "2\u00BA", "3\u00BA"];

  if (ranking.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
        <p className="relative z-10 text-zinc-500">Sem dados de vendas para este período</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full text-white flex flex-col relative overflow-hidden" style={{ padding: "32px 40px", background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      {/* Title */}
      <div className="relative z-10 shrink-0" style={{ marginBottom: 24 }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Ranking Closers</h2>
        </div>
        <div className="h-px bg-gradient-to-r from-amber-500/40 to-transparent" />
      </div>

      {/* Content: fills remaining space */}
      <div className="relative z-10 flex-1 flex items-stretch gap-8 min-h-0">
        {/* Podium */}
        <div className="flex-1 flex items-center justify-center" style={{ gap: 24 }}>
          {display.map(({ c, r }) => {
            const col = COLORS[r];
            const isFirst = r === 0;
            return (
              <div key={c.name} className="flex flex-col items-center" style={{ paddingBottom: 0, width: isFirst ? 210 : 175 }}>
                {/* Spacer to stagger */}
                <div style={{ height: topPad[r] }} />

                {isFirst && <Crown className="text-amber-400 mb-2" style={{ width: 36, height: 36 }} />}

                {/* Photo with ring */}
                <div className="rounded-full flex items-center justify-center mb-3"
                  style={{ padding: 4, border: `4px solid ${col.ring}` }}>
                  <Foto nome={c.name} url={c.fotoUrl} px={fotoPx[r]} />
                </div>

                {/* Info */}
                <p className={`font-bold text-center ${isFirst ? "text-xl" : "text-base"}`}>{firstName(c.name)}</p>
                <p className={`font-bold mt-1 ${isFirst ? "text-3xl" : "text-2xl"} ${col.text}`}>{formatBRL(c.mrrObtido)}</p>
                <p className="text-sm text-zinc-500 mt-0.5 mb-4">{c.negociosGanhos} negócios</p>

                {/* Podium block - stretches to bottom */}
                <div className={`w-full rounded-t-2xl bg-gradient-to-b ${col.grad} flex items-center justify-center flex-1`}
                  style={{ minHeight: isFirst ? 100 : r === 1 ? 70 : 50, borderTop: `3px solid ${col.ring}` }}>
                  <span className={`text-4xl font-black ${col.text}`}>{labels[r]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Pontual */}
        {topPontual && (
          <div className="flex items-center shrink-0" style={{ width: 240 }}>
            <div className="w-full bg-white/[0.03] backdrop-blur-xl border border-purple-500/15 rounded-2xl flex flex-col items-center text-center shadow-lg shadow-black/20"
              style={{ padding: "32px 24px" }}>
              <div className="flex items-center gap-2 mb-5">
                <Zap className="h-5 w-5 text-purple-400" />
                <span className="text-sm font-bold text-purple-400 uppercase tracking-widest">Top Pontual</span>
              </div>

              <div className="rounded-full mb-4 ring-2 ring-white/10 shadow-lg shadow-purple-500/20"
                style={{ padding: 4, border: "4px solid #a855f7" }}>
                <Foto nome={topPontual.name} url={topPontual.fotoUrl} px={120} />
              </div>

              <p className="text-xl font-bold">{firstName(topPontual.name)}</p>
              <p className="text-sm text-zinc-500 mt-1 mb-4">{topPontual.negociosGanhos} negócios</p>

              <div className="bg-white/[0.04] border border-purple-500/20 rounded-xl px-6 py-3">
                <p className="text-3xl font-bold text-purple-400">{formatBRL(topPontual.pontualObtido)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
