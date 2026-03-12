import { Trophy, Crown, CalendarCheck } from "lucide-react";
import type { SdrRanking, TopReunioes } from "./types";

interface Props {
  ranking: SdrRanking[];
  topReunioes: TopReunioes | null;
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

export default function SlideRankingSDRs({ ranking, topReunioes }: Props) {
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
        <p className="relative z-10 text-zinc-500">Sem dados de SDRs para este periodo</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full text-white flex flex-col relative overflow-hidden" style={{ padding: "32px 40px", background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      {/* Title */}
      <div className="relative z-10 flex items-center gap-3 shrink-0" style={{ marginBottom: 24 }}>
        <Trophy className="h-7 w-7 text-emerald-400" />
        <h2 className="text-2xl font-bold">Ranking SDRs</h2>
        <span className="text-sm text-zinc-500 ml-2">por MRR gerado</span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-stretch gap-8 min-h-0">
        {/* Podium */}
        <div className="flex-1 flex items-center justify-center" style={{ gap: 24 }}>
          {display.map(({ c, r }) => {
            const col = COLORS[r];
            const isFirst = r === 0;
            return (
              <div key={c.name} className="flex flex-col items-center" style={{ paddingBottom: 0, width: isFirst ? 210 : 175 }}>
                <div style={{ height: topPad[r] }} />

                {isFirst && <Crown className="text-amber-400 mb-2" style={{ width: 36, height: 36 }} />}

                <div className="rounded-full flex items-center justify-center mb-3"
                  style={{ padding: 4, border: `4px solid ${col.ring}` }}>
                  <Foto nome={c.name} url={c.fotoUrl} px={fotoPx[r]} />
                </div>

                <p className={`font-bold text-center ${isFirst ? "text-xl" : "text-base"}`}>{firstName(c.name)}</p>
                <p className={`font-bold mt-1 ${isFirst ? "text-3xl" : "text-2xl"} ${col.text}`}>{formatBRL(c.mrrGerado)}</p>
                <p className="text-sm text-zinc-500 mt-0.5 mb-4">{c.negociosGanhos} negocios</p>

                <div className={`w-full rounded-t-2xl bg-gradient-to-b ${col.grad} flex items-center justify-center flex-1`}
                  style={{ minHeight: isFirst ? 100 : r === 1 ? 70 : 50, borderTop: `3px solid ${col.ring}` }}>
                  <span className={`text-4xl font-black ${col.text}`}>{labels[r]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Reuniões */}
        {topReunioes && (
          <div className="flex items-center shrink-0" style={{ width: 240 }}>
            <div className="w-full bg-gradient-to-b from-emerald-500/15 to-emerald-900/5 border border-emerald-500/30 rounded-2xl flex flex-col items-center text-center"
              style={{ padding: "32px 24px" }}>
              <div className="flex items-center gap-2 mb-5">
                <CalendarCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Top Reunioes</span>
              </div>

              <div className="rounded-full mb-4"
                style={{ padding: 4, border: "4px solid #10b981" }}>
                <Foto nome={topReunioes.name} url={topReunioes.fotoUrl} px={120} />
              </div>

              <p className="text-xl font-bold">{firstName(topReunioes.name)}</p>

              <div className="bg-emerald-500/15 rounded-xl px-6 py-3 mt-4">
                <p className="text-3xl font-bold text-emerald-400">{topReunioes.reunioes}</p>
                <p className="text-sm text-zinc-400 mt-1">reunioes realizadas</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
