// Shared utilities for Tech Hub components

export interface PrazoPorStatus {
  status: string;
  media_dias: number;
  total_transicoes: number;
}

export interface PhaseGrouped {
  label: string;
  media_dias: number;
  total_transicoes: number;
  color: string;
}

// Pipeline phases in logical order with display names and colors
export const PHASE_CONFIG: { key: string; label: string; color: string; patterns: string[] }[] = [
  { key: "backlog", label: "Backlog / Triagem", color: "#94a3b8", patterns: ["open", "backlog", "não iniciado", "novo projeto", "to do", "aguardando", "em andamento"] },
  { key: "planejamento", label: "Planejamento", color: "#8b5cf6", patterns: ["planejamento", "kickoff"] },
  { key: "design", label: "Design", color: "#ec4899", patterns: ["pronto p/ design", "design", "em design", "wireframe", "design + copy"] },
  { key: "design_review", label: "Design Review", color: "#f472b6", patterns: ["design - review", "design review", "ajuste design"] },
  { key: "pronto_dev", label: "Pronto p/ Dev", color: "#06b6d4", patterns: ["pronto p/ dev", "pronto desenvolvimento", "pronto p/ desenvolvimento"] },
  { key: "dev", label: "Desenvolvimento", color: "#3b82f6", patterns: ["dev", "desenvolvimento", "em progresso", "doing"] },
  { key: "dev_review", label: "Dev Review", color: "#6366f1", patterns: ["dev. review", "dev review", "review final", "qualidade", "configurações & review"] },
  { key: "lancamento", label: "Lançamento", color: "#10b981", patterns: ["pronto para lançar", "telas ok"] },
  { key: "bloqueado", label: "Bloqueado / Pausado", color: "#ef4444", patterns: ["bloqueado", "pausado"] },
  { key: "aguardando", label: "Aguardando Externo", color: "#f97316", patterns: ["aguardando externo", "aguardando interno"] },
];

// End-state statuses to exclude
export const END_STATES = ["deploy 🚀", "deploy", "encerrado 🚀", "complete", "completo", "deploy com pendências", "deploy com pend", "deplay com ped", "bloqueado", "pausado"];

export function groupStatusIntoPhases(data: PrazoPorStatus[]): PhaseGrouped[] {
  const filtered = data.filter(d => !END_STATES.includes(d.status.toLowerCase().trim()));

  const phaseMap: Record<string, { totalWeightedDays: number; totalTransitions: number; color: string; label: string; order: number }> = {};

  for (const item of filtered) {
    const statusLower = item.status.toLowerCase().trim();
    let matched = false;

    for (let i = 0; i < PHASE_CONFIG.length; i++) {
      const phase = PHASE_CONFIG[i];
      if (phase.patterns.some(p => statusLower.includes(p))) {
        if (!phaseMap[phase.key]) {
          phaseMap[phase.key] = { totalWeightedDays: 0, totalTransitions: 0, color: phase.color, label: phase.label, order: i };
        }
        const dias = parseFloat(String(item.media_dias || 0));
        const trans = parseInt(String(item.total_transicoes || 0));
        phaseMap[phase.key].totalWeightedDays += dias * trans;
        phaseMap[phase.key].totalTransitions += trans;
        matched = true;
        break;
      }
    }

    if (!matched && parseInt(String(item.total_transicoes || 0)) >= 10) {
      const key = `_other_${statusLower}`;
      phaseMap[key] = {
        totalWeightedDays: parseFloat(String(item.media_dias || 0)) * parseInt(String(item.total_transicoes || 0)),
        totalTransitions: parseInt(String(item.total_transicoes || 0)),
        color: "#94a3b8",
        label: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        order: 99,
      };
    }
  }

  return Object.values(phaseMap)
    .map(p => ({
      label: p.label,
      media_dias: p.totalTransitions > 0 ? Math.round((p.totalWeightedDays / p.totalTransitions) * 10) / 10 : 0,
      total_transicoes: p.totalTransitions,
      color: p.color,
    }))
    .filter(p => p.media_dias > 0)
    .sort((a, b) => b.media_dias - a.media_dias);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;
  return (target - Date.now()) / 86400000;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
