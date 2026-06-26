// server/routes/bp2026.enforcement.ts
// Reforço de confidencialidade do BP 2026: remove do payload as seções cujas
// abas o usuário não pode ver. Função pura (testável sem Express/DB).
import type { Bp2026TabId } from "../../shared/bp2026-tabs";

export const CHAVE_POR_ABA: Record<string, string> = {
  dre: "linhas",
  metricas: "metricasGerais",
  revenue: "revenue",
  funil: "funil",
  vendasProduto: "vendasProduto",
  capacity: "capacity",
  sga: "sgaDetalhe",
  cac: "cacDetalhe",
  outras: "outrasDetalhe",
  pontual: "pontual",
};

export function filtrarPayloadPorAbas<T extends Record<string, any>>(
  payload: T,
  abas: Bp2026TabId[],
): T {
  const permitidas = new Set<string>(abas);
  const out: Record<string, any> = { ...payload };
  for (const [aba, chave] of Object.entries(CHAVE_POR_ABA)) {
    if (!permitidas.has(aba)) delete out[chave];
  }
  return out as T;
}
