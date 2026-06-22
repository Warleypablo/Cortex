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

export const PRODUTOS_PRINCIPAIS = ["Performance", "Social Media", "Creators"] as const;
export const BUCKETS_ORDER = ["Performance", "Social Media", "Creators", "Outros", "Total"] as const;

export function produtoBucket(
  produto: string | null | undefined,
): "Performance" | "Social Media" | "Creators" | "Outros" {
  if (produto === "Performance" || produto === "Social Media" || produto === "Creators") {
    return produto;
  }
  return "Outros";
}

export function mediana(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ContratoMesRow {
  mes: string; // 'YYYY-MM'
  produto: string | null;
  lt: number; // meses
  valorr: number;
}

export interface CelulaMetrica {
  lt: number;
  ltv: number;
  lt_mediana: number;
  ltv_mediana: number;
  n: number;
}

export interface MatrizEvolucao {
  meses: string[];
  produtos: string[];
  celulas: Record<string, Record<string, CelulaMetrica>>;
}

export function buildMatrizEvolucaoProduto(
  rows: ContratoMesRow[],
  meses: string[],
): MatrizEvolucao {
  type Acc = { lt: number[]; ltv: number[] };
  const buckets: Record<string, Record<string, Acc>> = {};
  const ensure = (bucket: string, mes: string): Acc => {
    if (!buckets[bucket]) buckets[bucket] = {};
    if (!buckets[bucket][mes]) buckets[bucket][mes] = { lt: [], ltv: [] };
    return buckets[bucket][mes];
  };

  const mesesSet = new Set(meses);
  for (const r of rows) {
    if (!mesesSet.has(r.mes)) continue;
    const ltv = r.valorr * r.lt;
    const b = produtoBucket(r.produto);
    const cell = ensure(b, r.mes);
    cell.lt.push(r.lt);
    cell.ltv.push(ltv);
    const tot = ensure("Total", r.mes);
    tot.lt.push(r.lt);
    tot.ltv.push(ltv);
  }

  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const round0 = (n: number) => Math.round(n);

  const celulas: Record<string, Record<string, CelulaMetrica>> = {};
  const produtos: string[] = [];
  for (const bucket of BUCKETS_ORDER) {
    const porMes = buckets[bucket];
    if (!porMes) continue;
    const linha: Record<string, CelulaMetrica> = {};
    for (const mes of meses) {
      const acc = porMes[mes];
      if (!acc || acc.lt.length === 0) continue;
      linha[mes] = {
        lt: round1(avg(acc.lt)),
        ltv: round0(avg(acc.ltv)),
        lt_mediana: round1(mediana(acc.lt)),
        ltv_mediana: round0(mediana(acc.ltv)),
        n: acc.lt.length,
      };
    }
    if (Object.keys(linha).length > 0) {
      celulas[bucket] = linha;
      produtos.push(bucket);
    }
  }
  return { meses, produtos, celulas };
}
