import { LayoutGrid, TrendingUp, TrendingDown, Activity, Sparkles, AlertTriangle } from "lucide-react";
import type { SquadDetail } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

interface Props {
  details: SquadDetail[];
  mesLabel: string;
}

const SQUAD_COLORS: Record<string, string> = {
  "Selva":         "#22c55e",
  "Squadra":       "#3b82f6",
  "Pulse":         "#ec4899",
  "Squad X":       "#6366f1",
  "Tech":          "#0ea5e9",
  "Makers":        "#06b6d4",
  "Hunters":       "#a855f7",
  "Chama":         "#f43f5e",
  "Aurea":         "#fbbf24",
  "Supreme":       "#8b5cf6",
  "Bloomfield":    "#10b981",
  "Black":         "#94a3b8",
  "Ventures":      "#f59e0b",
  "Vendas":        "#f97316",
  "CX&CS":         "#14b8a6",
  "Nitro":         "#ef4444",
  "Turbo Interno": "#94a3b8",
};

function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}

function getColor(baseName: string): string {
  if (SQUAD_COLORS[baseName]) return SQUAD_COLORS[baseName];
  const clean = baseName.replace(/\s*\(OFF\)\s*$/i, "").trim();
  return SQUAD_COLORS[clean] || "#71717a";
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

export default function SlideSquadSingle({ details, mesLabel }: Props) {
  if (details.length === 0) {
    return (
      <SlideLayout section="commerce">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de squads para este período</p>
        </div>
      </SlideLayout>
    );
  }

  // Layout density baseado em quantos squads aparecem ao mesmo tempo
  // 1 squad = card único largo;  2 = lado a lado;  3-4 = 2 cols;  5+ = 3 cols
  const cols =
    details.length === 1 ? 1 :
    details.length === 2 ? 2 :
    details.length <= 4 ? 2 :
    3;

  const isHero = details.length === 1;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={LayoutGrid}
        iconColor="text-purple-400"
        title={`Detalhes por Squad — ${mesLabel}`}
        gradientColor="#a855f7"
      />

      <div
        className={`flex-1 grid gap-4 min-h-0 content-start ${
          cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1"
        }`}
        style={{ gridAutoRows: details.length <= 2 ? "1fr" : "min-content" }}
      >
        {details.map((sq, idx) => {
          const { emoji, name } = parseSquadName(sq.squad);
          const color = getColor(name);
          const churnHigh = sq.churnPct >= 8;
          const churnColor = churnHigh ? "#ef4444" : "#22c55e";
          const evolUp = sq.evolucaoMrr >= 0;
          const evolColor = evolUp ? "#22c55e" : "#ef4444";
          const evolSign = evolUp ? "+" : "−";
          const evolAbs = Math.abs(Math.round(sq.evolucaoMrr));
          const churnPctDisplay = sq.churnPct.toFixed(1).replace(".", ",");
          // O último card é o "novo" no build-up — anima mais marcadamente
          const isLast = idx === details.length - 1;

          return (
            <div
              key={sq.squad}
              className={`rounded-2xl flex flex-col overflow-hidden shadow-xl shadow-black/30 animate-in fade-in ${
                isLast ? "slide-in-from-bottom-6 zoom-in-95" : "slide-in-from-bottom-2"
              }`}
              style={{
                background: `linear-gradient(135deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)`,
                border: `1px solid ${color}30`,
                animationDelay: `${idx * 90}ms`,
                animationDuration: isLast ? "550ms" : "380ms",
                animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                animationFillMode: "backwards",
              }}
            >
              {/* Header com avatar colorido */}
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ borderBottom: `1px solid ${color}25` }}
              >
                <div
                  className="rounded-full flex items-center justify-center shrink-0"
                  style={{
                    width: isHero ? 64 : 48,
                    height: isHero ? 64 : 48,
                    background: `radial-gradient(circle at 30% 30%, ${color}50, ${color}20)`,
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 24px ${color}40`,
                  }}
                >
                  {emoji ? (
                    <span style={{ fontSize: isHero ? 32 : 24, lineHeight: 1 }}>{emoji}</span>
                  ) : (
                    <span className="font-black text-white" style={{ fontSize: isHero ? 22 : 18 }}>
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className={`font-black tracking-wide truncate ${isHero ? "text-3xl" : "text-xl"}`}
                    style={{ color }}
                  >
                    {name.toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">
                    Performance · {mesLabel}
                  </p>
                </div>
              </div>

              {/* KPIs em grid 2x2 */}
              <div className={`grid grid-cols-2 gap-3 p-4 ${isHero ? "p-6 gap-5" : ""}`}>
                {/* MRR Ativo */}
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-zinc-500" />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">MRR Ativo</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(sq.mrr)}
                  </p>
                </div>

                {/* Pontual Entregue */}
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-zinc-500" />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Pontual Entregue</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(sq.pontual)}
                  </p>
                </div>

                {/* Churn */}
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-zinc-500" />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Churn</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p
                      className={`font-black tabular-nums ${isHero ? "text-3xl" : "text-xl"}`}
                      style={{ color: churnColor }}
                    >
                      {churnPctDisplay}%
                    </p>
                  </div>
                  <p className="text-[10px] text-zinc-600 tabular-nums">
                    {fmtBRL(sq.churnBrl)} / {fmtBRL(sq.mrrBase || 0)}
                  </p>
                  {/* Mini progress bar */}
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(sq.churnPct * 5, 100)}%`,
                        background: churnColor,
                      }}
                    />
                  </div>
                </div>

                {/* Evolução MRR */}
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {evolUp ? (
                      <TrendingUp className="h-3 w-3 text-zinc-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-zinc-500" />
                    )}
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Evolução MRR</p>
                  </div>
                  <p
                    className={`font-black tabular-nums ${isHero ? "text-3xl" : "text-xl"}`}
                    style={{ color: evolColor }}
                  >
                    {evolSign} R$ {evolAbs.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SlideLayout>
  );
}
