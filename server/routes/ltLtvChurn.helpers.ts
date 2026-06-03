/** Revenue churn % = MRR perdido / MRR ativo no início do período, 1 casa decimal. */
export function revenueChurnPct(mrrPerdido: number, mrrAtivoInicio: number): number {
  if (!mrrAtivoInicio || mrrAtivoInicio <= 0) return 0;
  return Math.round((mrrPerdido / mrrAtivoInicio) * 1000) / 10;
}

/** Colunas ordenáveis da tabela de clientes → nome de coluna SQL (whitelist anti-injection). */
const CLIENTE_SORT_COLS: Record<string, string> = {
  nome: "nome_cliente",
  contratos: "n_contratos_rec",
  lt: "lt_meses",
  ltvRecorrente: "ltv_recorrente",
  ltvPontual: "ltv_pontual",
  ltvTotal: "ltv_total",
};

/**
 * Resolve a ordenação da tabela de clientes a partir dos query params.
 * Sempre retorna uma coluna da whitelist (default ltv_total) e direção válida (default DESC),
 * de modo que os valores possam ser interpolados com segurança no ORDER BY.
 */
export function resolveClienteSort(
  sort?: string,
  dir?: string,
): { col: string; dir: "ASC" | "DESC" } {
  const col = CLIENTE_SORT_COLS[sort ?? ""] ?? "ltv_total";
  return { col, dir: dir === "asc" ? "ASC" : "DESC" };
}
