// Fonte única das abas do BP 2026 (Orçado × Realizado) e da regra de quais
// abas um usuário pode ver. Sem dependências de banco — usável no front e no back.

export const BP2026_TABS = [
  { id: "dre", label: "Overview" },
  { id: "metricas", label: "Métricas Gerais" },
  { id: "revenue", label: "Revenue" },
  { id: "funil", label: "Funil Comercial" },
  { id: "vendasProduto", label: "Vendas por Produto" },
  { id: "capacity", label: "Capacity" },
  { id: "sga", label: "SG&A" },
  { id: "cac", label: "CAC" },
  { id: "outras", label: "Outras Receitas" },
  { id: "pontual", label: "Pontual" },
  { id: "pontual-creators", label: "Pontual · Creators" },
] as const;

export type Bp2026TabId = typeof BP2026_TABS[number]["id"];

export const BP2026_TAB_IDS: Bp2026TabId[] = BP2026_TABS.map((t) => t.id);

export function abasPermitidas(
  role: string | null | undefined,
  allowedBpTabs: string[] | null | undefined,
): Bp2026TabId[] {
  if (role === "admin") return [...BP2026_TAB_IDS];
  const set = new Set(allowedBpTabs ?? []);
  return BP2026_TAB_IDS.filter((id) => set.has(id));
}

export const BP2026_ROUTE = "/bp-2026";

// Liberar uma aba precisa, sozinho, dar acesso à página do BP — senão o usuário
// bate no AccessDenied da rota (que exige a permissão `fin.dre`, ampla demais,
// pois também libera /dashboard/dre). Os dados continuam filtrados por aba no
// backend, então abrir a página não concede nada além das abas liberadas.
export function podeAcessarBp2026(
  role: string | null | undefined,
  allowedBpTabs: string[] | null | undefined,
): boolean {
  return abasPermitidas(role, allowedBpTabs).length > 0;
}
