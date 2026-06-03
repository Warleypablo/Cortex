/**
 * Benchmarks internos da Turbo por canal × categoria de base.
 *
 * Fonte: dashboard-broadcast (estagiário, mai/2026), arquivo benchmarks.js.
 * Fonte primária: doc interno `02_mapa_de_bases.md`.
 */

import { baseTem } from "./matriz-validacao";

export type BenchmarkCanal = "wpp" | "email";
export type Classificacao = "excelente" | "bom" | "medio" | "alerta";

// ── BENCHMARKS POR CATEGORIA ───────────────────────────────────────────────

export const BENCHMARKS_TURBO = {
  // WhatsApp — alta open rate (28-50%)
  wpp: {
    premium: 50, // Clientes, Mix da Nata, Show me the money
    mql: 28, // MQLs (Geral, Creators, CRM)
    leads_30_100k: 24,
    congelados: 30, // Reativação — surpreende positivamente
    leads_abaixo_30k: 38, // Base pequena e nova, open alto
    default: 25,
  },

  // E-mail — open rate menor (4-12%) mas CTOR alto quando subject funciona
  email: {
    premium: 12,
    mql: 7,
    leads_30_100k: 5,
    congelados: 8,
    leads_abaixo_30k: 4,
    default: 6,
  },

  // CTOR — proxy de qualidade do subject (E-mail)
  ctor: {
    excelente: 55,
    bom: 45,
    alerta: 30,
  },

  // Reply rate (conversas geradas / entregues × 100)
  replyRate: {
    excelente: 5.0,
    bom: 3.0,
    medio: 1.5,
    alerta: 0.5,
  },

  // Custo
  custoReuniao: {
    excelente: 100,
    bom: 250,
    alerta: 500,
  },
} as const;

// ── BENCHMARK DE OPEN RATE POR BASE × CANAL ────────────────────────────────

export function getBenchmark(base: string, canal: BenchmarkCanal = "wpp"): number {
  const benchs = BENCHMARKS_TURBO[canal];
  if (!benchs) return BENCHMARKS_TURBO.wpp.default;

  if (baseTem(base, "premium")) return benchs.premium;
  if (baseTem(base, "clientes")) return benchs.premium;
  if (baseTem(base, "congelados")) return benchs.congelados;
  if (baseTem(base, "mql")) return benchs.mql;
  if (baseTem(base, "leads_30_100k")) return benchs.leads_30_100k;
  if (baseTem(base, "leads_abaixo_30k")) return benchs.leads_abaixo_30k;

  return benchs.default;
}

// ── AVALIAÇÃO ──────────────────────────────────────────────────────────────

export interface AvaliacaoPerformance {
  classificacao: Classificacao;
  benchmark: number;
  delta: number;
  deltaPct: number;
}

export function avaliarPerformance(taxa: number, base: string, canal: BenchmarkCanal = "wpp"): AvaliacaoPerformance {
  const benchmark = getBenchmark(base, canal);
  const delta = taxa - benchmark;
  const deltaPct = benchmark > 0 ? (delta / benchmark) * 100 : 0;

  let classificacao: Classificacao;
  if (deltaPct >= 20) classificacao = "excelente";
  else if (deltaPct >= 0) classificacao = "bom";
  else if (deltaPct >= -20) classificacao = "medio";
  else classificacao = "alerta";

  return { classificacao, benchmark, delta, deltaPct };
}

export function avaliarCTOR(ctor: number): Classificacao {
  if (ctor >= BENCHMARKS_TURBO.ctor.excelente) return "excelente";
  if (ctor >= BENCHMARKS_TURBO.ctor.bom) return "bom";
  if (ctor >= BENCHMARKS_TURBO.ctor.alerta) return "medio";
  return "alerta";
}

export function avaliarReplyRate(rate: number): Classificacao {
  const b = BENCHMARKS_TURBO.replyRate;
  if (rate >= b.excelente) return "excelente";
  if (rate >= b.bom) return "bom";
  if (rate >= b.medio) return "medio";
  return "alerta";
}

// ── UI HELPERS (Tailwind-friendly) ─────────────────────────────────────────

/** Classes Tailwind por classificação (modo escuro/claro). */
export const CLASSIFICACAO_TAILWIND: Record<Classificacao, { text: string; bg: string; border: string }> = {
  excelente: {
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-800",
  },
  bom: {
    text: "text-lime-700 dark:text-lime-300",
    bg: "bg-lime-100 dark:bg-lime-950/40",
    border: "border-lime-300 dark:border-lime-800",
  },
  medio: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-800",
  },
  alerta: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-800",
  },
};

export const CLASSIFICACAO_LABEL: Record<Classificacao, string> = {
  excelente: "Excelente",
  bom: "Bom",
  medio: "Médio",
  alerta: "Alerta",
};
