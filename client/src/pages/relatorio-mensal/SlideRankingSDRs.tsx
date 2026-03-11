import { Trophy, Crown } from "lucide-react";
import type { SdrRanking } from "./types";

interface Props {
  ranking: SdrRanking[];
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

export default function SlideRankingSDRs({ ranking }: Props) {
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

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
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Sem dados de SDRs para este periodo</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col" style={{ padding: "32px 40px" }}>
      {/* Title */}
      <div className="flex items-center gap-3 shrink-0" style={{ marginBottom: 24 }}>
        <Trophy className="h-7 w-7 text-emerald-400" />
        <h2 className="text-2xl font-bold">Ranking SDRs</h2>
        <span className="text-sm text-zinc-500 ml-2">por MRR gerado</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-stretch gap-8 min-h-0">
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

        {/* Remaining SDRs list */}
        {rest.length > 0 && (
          <div className="flex items-center shrink-0" style={{ width: 240 }}>
            <div className="w-full bg-gradient-to-b from-zinc-800/40 to-zinc-900/20 border border-zinc-700/40 rounded-2xl flex flex-col"
              style={{ padding: "24px 20px" }}>
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 text-center">Demais SDRs</p>
              <div className="flex flex-col gap-3">
                {rest.map((sdr, i) => (
                  <div key={sdr.name} className="flex items-center gap-3">
                    <span className="text-zinc-500 font-bold text-sm w-6 text-right">{i + 4}o</span>
                    <Foto nome={sdr.name} url={sdr.fotoUrl} px={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{firstName(sdr.name)}</p>
                      <p className="text-xs text-zinc-500">{formatBRL(sdr.mrrGerado)} · {sdr.negociosGanhos} neg.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
