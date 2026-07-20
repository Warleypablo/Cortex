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
