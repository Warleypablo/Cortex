// Formatadores e presets de janela compartilhados pela Biblioteca de Criativos (read-back).

export function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function fmtRoas(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`;
}

// ROAS: verde se >=1, âmbar entre 0.5–1, vermelho abaixo.
export function roasClass(n: number | null | undefined): string {
  if (n === null || n === undefined) return "text-muted-foreground";
  if (n >= 1) return "text-green-600 dark:text-green-400 font-semibold";
  if (n >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export type WindowPreset = "7d" | "30d" | "90d" | "365d";

export const WINDOW_PRESETS: { value: WindowPreset; label: string; days: number }[] = [
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "365d", label: "Últimos 12 meses", days: 365 },
];

export function windowFromPreset(preset: WindowPreset): { since: string; until: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const days = WINDOW_PRESETS.find((p) => p.value === preset)?.days ?? 30;
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  return { since: fmt(since), until: fmt(until) };
}

export const RANKING_DIMENSIONS: { value: string; label: string }[] = [
  { value: "angulo", label: "Ângulo (hook)" },
  { value: "personagem", label: "Personagem" },
  { value: "bodyTipo", label: "Body / oferta" },
  { value: "ctaTipo", label: "Tipo de CTA" },
  { value: "tipo", label: "Tipo de ad" },
  { value: "produto", label: "Produto" },
];
