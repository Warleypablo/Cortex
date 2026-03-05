import { Trophy, Medal } from "lucide-react";
import type { CloserRanking } from "./types";

interface Props {
  ranking: CloserRanking[];
  topPontual: CloserRanking | null;
}

function Avatar({ nome, fotoUrl, size = "md" }: { nome: string; fotoUrl: string | null; size?: "md" | "lg" }) {
  const initials = nome.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const sizeClass = size === "lg" ? "w-20 h-20 text-lg" : "w-12 h-12 text-sm";

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className={`${sizeClass} rounded-full object-cover border-2 border-zinc-700`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center font-bold text-zinc-400`}>
      {initials}
    </div>
  );
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

const MEDAL_COLORS = ["text-amber-400", "text-zinc-400", "text-orange-600"];

export default function SlideRankingClosers({ ranking, topPontual }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="h-7 w-7 text-amber-400" />
        <h2 className="text-2xl font-bold">Ranking Closers - Vendas MRR</h2>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* MRR Ranking */}
        <div className="flex-1 space-y-2 overflow-auto">
          {ranking.map((c, i) => (
            <div key={c.name} className={`flex items-center gap-4 rounded-xl p-3 border ${i === 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-zinc-900/60 border-zinc-800"}`}>
              <span className="w-6 text-center text-sm font-bold text-zinc-500">
                {i < 3 ? <Medal className={`h-5 w-5 ${MEDAL_COLORS[i]}`} /> : `${i + 1}`}
              </span>
              <Avatar nome={c.name} fotoUrl={c.fotoUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-xs text-zinc-500">{c.negociosGanhos} negócios</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">{formatBRL(c.mrrObtido)}</p>
                <p className="text-xs text-zinc-500">MRR</p>
              </div>
            </div>
          ))}

          {ranking.length === 0 && (
            <p className="text-zinc-500 text-sm">Sem dados de vendas para este período</p>
          )}
        </div>

        {/* Top Pontual */}
        {topPontual && (
          <div className="w-64 shrink-0">
            <h3 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wide">Top Pontual</h3>
            <div className="bg-zinc-900/60 border border-purple-500/30 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
              <Avatar nome={topPontual.name} fotoUrl={topPontual.fotoUrl} size="lg" />
              <p className="text-base font-bold">{topPontual.name}</p>
              <div className="bg-purple-500/10 rounded-full px-4 py-1.5">
                <p className="text-lg font-bold text-purple-400">{formatBRL(topPontual.pontualObtido)}</p>
              </div>
              <p className="text-xs text-zinc-500">{topPontual.negociosGanhos} negócios</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
