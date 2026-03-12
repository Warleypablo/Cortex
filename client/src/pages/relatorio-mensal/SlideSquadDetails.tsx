import type { SquadDetail } from "./types";

interface Props {
  details: SquadDetail[];
  mesLabel: string;
}

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
  "Turbo Interno": "#94a3b8",
};

function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) {
    return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  }
  return { emoji: "", name: trimmed };
}

function getColor(baseName: string): string {
  if (SQUAD_COLORS[baseName]) return SQUAD_COLORS[baseName];
  const clean = baseName.replace(/\s*\(OFF\)\s*$/i, "").trim();
  return SQUAD_COLORS[clean] || "#71717a";
}

function fmtBRL(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

export default function SlideSquadDetails({ details, mesLabel }: Props) {
  // Show top squads that fit in the grid (max 6)
  const squads = details.slice(0, 6);

  if (squads.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
        <p className="relative z-10 text-zinc-500">Sem dados de squads para este período</p>
      </div>
    );
  }

  const cols = squads.length <= 4 ? 2 : 3;

  return (
    <div className="w-full h-full flex flex-col text-white relative overflow-hidden" style={{ padding: "28px 36px", background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      {/* Header */}
      <div className="relative z-10 shrink-0 mb-4">
        <h2 className="text-2xl font-bold tracking-tight mb-3">Detalhes por Squad — {mesLabel}</h2>
        <div className="h-px bg-gradient-to-r from-purple-500/40 to-transparent" />
      </div>

      {/* Grid of cards */}
      <div className={`relative z-10 flex-1 grid gap-4 min-h-0 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {squads.map((sq) => {
          const { emoji, name } = parseSquadName(sq.squad);
          const color = getColor(name);
          const churnColor = sq.churnPct > 8 ? "#ef4444" : "#22c55e";
          const evolColor = sq.evolucaoMrr >= 0 ? "#22c55e" : "#ef4444";
          const evolSign = sq.evolucaoMrr >= 0 ? "+" : "";

          return (
            <div
              key={sq.squad}
              className="rounded-xl flex flex-col backdrop-blur-xl shadow-lg shadow-black/20"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${color}25`,
              }}
            >
              {/* Card header */}
              <div
                className="px-5 py-3 rounded-t-xl"
                style={{ borderBottom: `2px solid ${color}40` }}
              >
                <span className="text-xl font-black tracking-wide" style={{ color }}>
                  {emoji && <span className="mr-1.5">{emoji}</span>}
                  {name.toUpperCase()}
                </span>
              </div>

              {/* Metrics list */}
              <div className="px-5 py-3 flex-1 flex flex-col justify-center">
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <span className="text-zinc-400">MRR:</span>
                    <span className="font-bold">{fmtBRL(sq.mrr)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <span className="text-zinc-400">Pontual:</span>
                    <span className="font-bold">{fmtBRL(sq.pontual)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <span className="text-zinc-400">Ticket Médio MRR:</span>
                    <span className="font-bold">{fmtBRL(sq.ticketMedio)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <span className="text-zinc-400">Numero de Clientes:</span>
                    <span className="font-bold">{sq.clientes}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <span className="text-zinc-400">Churn:</span>
                    <span className="font-bold" style={{ color: churnColor }}>
                      {sq.churnPct.toFixed(1).replace(".", ",")}%
                    </span>
                    <span className="text-zinc-500">({fmtBRL(sq.churnBrl)} / {fmtBRL(sq.mrrBase || 0)})</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <span className="text-zinc-400">Evolução MRR:</span>
                    <span className="font-bold" style={{ color: evolColor }}>
                      R$ {evolSign}{Math.round(sq.evolucaoMrr).toLocaleString("pt-BR")}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
