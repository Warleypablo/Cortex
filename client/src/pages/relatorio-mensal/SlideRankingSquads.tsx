import type { SquadRanking } from "./types";
import SlideLayout from "./SlideLayout";
import { Crown } from "lucide-react";

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
  "Comunicacao":"#64748b",
};

const DEFAULT_COLOR = "#71717a";

const MEDAL_COLORS: Record<number, { ring: string; text: string }> = {
  1: { ring: "#f59e0b", text: "text-amber-400" },
  2: { ring: "#a1a1aa", text: "text-zinc-300" },
  3: { ring: "#f97316", text: "text-orange-400" },
  4: { ring: "#71717a", text: "text-zinc-400" },
  5: { ring: "#71717a", text: "text-zinc-400" },
};

/** Extract emoji prefix and base name from squad name like "🪖 Selva" */
function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  // Find first ASCII letter position - everything before it is the emoji
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
      <SlideLayout section="commerce">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de squads para este periodo</p>
        </div>
      </SlideLayout>
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
    <SlideLayout section="commerce" className="items-center justify-center">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-4xl font-black tracking-tight">
          <span className="text-amber-400 italic">Ranking</span>{" "}
          <span className="text-white">Squads</span>
        </h2>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center" style={{ gap: 14 }}>
        {podiumOrder.map((squad) => {
          const { emoji, name } = parseSquadName(squad.squad);
          const color = getSquadColor(name);
          const barH = heightMap[squad.posicao] || 100;
          const iSize = iconSize[squad.posicao] || 56;
          const eSize = emojiSize[squad.posicao] || 26;
          const isFirst = squad.posicao === 1;

          const medal = MEDAL_COLORS[squad.posicao] || { ring: "#71717a", text: "text-zinc-400" };

          return (
            <div key={squad.squad} className="flex flex-col items-center" style={{ width: 140 }}>
              {/* Crown for 1st place */}
              {isFirst && <Crown className="text-amber-400 mb-2" style={{ width: 36, height: 36 }} />}

              {/* Squad emoji circle */}
              <div
                className="rounded-full flex items-center justify-center shadow-xl mb-2"
                style={{
                  width: iSize,
                  height: iSize,
                  background: `radial-gradient(circle at 30% 30%, ${color}50, ${color}20)`,
                  border: `4px solid ${color}`,
                  boxShadow: `0 0 30px ${color}50, 0 0 60px ${color}20`,
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

              {/* Squad name + Total + Recorrente + Pontual */}
              <p className={`font-bold text-white text-center ${isFirst ? "text-base" : "text-sm"}`}>
                {name}
              </p>
              <div className="grid grid-cols-[auto_auto] gap-x-1.5 gap-y-0 mt-0.5 mb-2 text-[11px] leading-tight">
                <span className="text-zinc-500 text-right">Total</span>
                <span className="text-white font-semibold tabular-nums text-right">{fmtBRL(squad.mrr + squad.pontual)}</span>
                <span className="text-zinc-500 text-right">Rec.</span>
                <span className="text-cyan-400 tabular-nums text-right">{fmtBRL(squad.mrr)}</span>
                <span className="text-zinc-500 text-right">Pont.</span>
                <span className="text-amber-400 tabular-nums text-right">{fmtBRL(squad.pontual)}</span>
              </div>

              {/* Colored bar */}
              <div
                className="w-full rounded-t-2xl flex flex-col items-center justify-end pb-4"
                style={{
                  height: barH,
                  background: `linear-gradient(to top, ${color}, ${color}99)`,
                }}
              >
                <span className={`font-black ${medal.text} ${isFirst ? "text-6xl" : "text-5xl"}`}>
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
    </SlideLayout>
  );
}
