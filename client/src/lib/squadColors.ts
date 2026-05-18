// Centralized squad color palette. Extracted from EvolucaoMensal.tsx so multiple
// dashboards (TV Leaderboard, etc.) reuse the same mapping.

export const SQUAD_COLORS: Record<string, string> = {
  "Aurea": "#fbbf24",
  "Aurea (OFF)": "#fcd34d",
  "Black": "#475569",
  "Bloomfield": "#10b981",
  "Chama": "#f43f5e",
  "Chama (OFF)": "#fb7185",
  "Comunicação (OFF)": "#64748b",
  "Hunters": "#a855f7",
  "Hunters (OFF)": "#c084fc",
  "Makers": "#06b6d4",
  "Pulse": "#ec4899",
  "Selva": "#22c55e",
  "Solar+ (OFF)": "#facc15",
  "Squadra": "#3b82f6",
  "Squad X": "#6366f1",
  "Supreme": "#8b5cf6",
  "Supreme (OFF)": "#a78bfa",
  "Tech": "#0ea5e9",
  "Tribo (OFF)": "#fb923c",
  "Turbo Interno": "#94a3b8",
};

const FALLBACK_COLORS = [
  "#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899",
  "#3b82f6", "#10b981", "#f43f5e", "#6366f1", "#14b8a6",
];

export function getSquadColor(squad: string, index = 0): string {
  if (SQUAD_COLORS[squad]) return SQUAD_COLORS[squad];
  return FALLBACK_COLORS[Math.abs(index) % FALLBACK_COLORS.length];
}
