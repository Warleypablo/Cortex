import type { SquadRanking } from "./types";

interface Props {
  ranking: SquadRanking[];
}

// Colors by squad base name (without emoji prefix)
const SQUAD_COLORS: Record<string, string> = {
  "Selva":      "#22c55e",
  "Squadra":    "#3b82f6",
  "Pulse":      "#ec4899",
  "Squad X":    "#6366f1",
  "Tech":       "#0ea5e9",
  "Makers":     "#06b6d4",
  "Hunters":    "#a855f7",
  "Chama":      "#f43f5e",
  "Aurea":      "#fbbf24",
  "Supreme":    "#8b5cf6",
  "Bloomfield": "#10b981",
  "Black":      "#475569",
  "Ventures":   "#f59e0b",
  "Vendas":     "#f97316",
  "CX&CS":      "#14b8a6",
  "Nitro":      "#ef4444",
  "Revo":       "#84cc16",
  "Forja":      "#f97316",
  "Apex":       "#06b6d4",
  "Fast":       "#eab308",
  "Lumina":     "#a78bfa",
  "Turbo Interno": "#94a3b8",
  "Solar+":     "#facc15",
  "Tribo":      "#fb923c",
  "Comunicação":"#64748b",
};

const DEFAULT_COLOR = "#71717a";

/** Extract emoji prefix and base name from squad name like "🪖 Selva" */
function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  // Find first ASCII letter position — everything before it is the emoji
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) {
    return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  }
  return { emoji: "", name: trimmed };
}

function getSquadColor(baseName: string): string {
  // Try exact match first, then try without "(OFF)" suffix
  if (SQUAD_COLORS[baseName]) return SQUAD_COLORS[baseName];
  const clean = baseName.replace(/\s*\(OFF\)\s*$/i, "").trim();
  return SQUAD_COLORS[clean] || DEFAULT_COLOR;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(v)}`;
}

export default function SlideRankingSquads({ ranking }: Props) {
  const top = ranking.slice(0, 5);

  if (top.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Sem dados de squads para este período</p>
      </div>
    );
  }

  // Podium display order: 4th, 2nd, 1st, 3rd, 5th
  const podiumOrder = top.length >= 5
    ? [top[3], top[1], top[0], top[2], top[4]]
    : top.length >= 3
      ? [top[1], top[0], top[2]]
      : top;

  const heightMap: Record<number, number> = { 1: 260, 2: 215, 3: 180, 4: 145, 5: 115 };
  const iconSize: Record<number, number> = { 1: 80, 2: 68, 3: 64, 4: 60, 5: 56 };
  const emojiSize: Record<number, number> = { 1: 42, 2: 34, 3: 32, 4: 28, 5: 26 };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-zinc-950 to-purple-950/30" />

      {/* Title */}
      <div className="relative z-10 mb-6">
        <h2 className="text-4xl font-black tracking-tight">
          <span className="text-amber-400 italic">Ranking</span>{" "}
          <span className="text-white">Squads</span>
        </h2>
      </div>

      {/* Podium */}
      <div className="relative z-10 flex items-end justify-center" style={{ gap: 14 }}>
        {podiumOrder.map((squad) => {
          const { emoji, name } = parseSquadName(squad.squad);
          const color = getSquadColor(name);
          const barH = heightMap[squad.posicao] || 100;
          const iSize = iconSize[squad.posicao] || 56;
          const eSize = emojiSize[squad.posicao] || 26;
          const isFirst = squad.posicao === 1;

          return (
            <div key={squad.squad} className="flex flex-col items-center" style={{ width: 140 }}>
              {/* Squad emoji circle */}
              <div
                className="rounded-full flex items-center justify-center shadow-xl mb-2"
                style={{
                  width: iSize,
                  height: iSize,
                  background: `radial-gradient(circle at 30% 30%, ${color}50, ${color}20)`,
                  border: `4px solid ${color}`,
                  boxShadow: `0 0 20px ${color}40`,
                }}
              >
                {emoji ? (
                  <span role="img" style={{ fontSize: eSize, lineHeight: 1 }}>{emoji}</span>
                ) : (
                  <span className="font-black text-white" style={{ fontSize: eSize * 0.6 }}>
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Squad name + MRR */}
              <p className={`font-bold text-white text-center ${isFirst ? "text-base" : "text-sm"}`}>
                {name}
              </p>
              <p className="text-xs text-zinc-400 mb-2">{fmtBRL(squad.mrr)}</p>

              {/* Colored bar */}
              <div
                className="w-full rounded-t-2xl flex flex-col items-center justify-end pb-4"
                style={{
                  height: barH,
                  background: `linear-gradient(to top, ${color}, ${color}99)`,
                }}
              >
                <span className={`font-black text-white/95 ${isFirst ? "text-6xl" : "text-5xl"}`}>
                  {squad.posicao}°
                </span>
                <span className="text-xs text-white/70 mt-1">
                  {squad.clientes} clientes
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
