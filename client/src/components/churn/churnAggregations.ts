import { type ChurnContract } from "./types";

/**
 * Soma MRR e pontual de um recorte de contratos, independentemente.
 * Ajustes manuais entram com valor negativo e são preservados de propósito —
 * eles reduzem o churn do mês.
 */
export function somarValoresDrawer(
  contratos: ChurnContract[],
): { mrr: number; pontual: number } {
  let mrr = 0;
  let pontual = 0;
  for (const c of contratos) {
    mrr += Number(c.valorr) || 0;
    pontual += Number(c.valorp) || 0;
  }
  return { mrr, pontual };
}

/**
 * Fração de um valor sobre a base de MRR do mês (0.084 = 8,4%).
 * Retorna null quando a base não permite um percentual honesto — nesses
 * casos a UI deve omitir o percentual, nunca mostrar 0% ou Infinity%.
 */
export function pctDaBase(valor: number, base: number): number | null {
  const b = Number(base);
  if (!Number.isFinite(b) || b <= 0) return null;
  return (Number(valor) || 0) / b;
}

/** Formata uma fração como percentual pt-BR: 0.084 -> "8,4%". */
export function formatPct(fracao: number, casas = 1): string {
  return `${(fracao * 100).toFixed(casas).replace(".", ",")}%`;
}
