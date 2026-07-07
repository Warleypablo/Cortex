/** Ponto de uma série mensal do Scorecard (modo Evolução). */
export interface SeriePonto {
  month: string;
  valor: number;
}

/** Como `SeriePonto`, mas para métricas onde a AUSÊNCIA de dado no mês não deve virar 0 (ex:
   lead time médio de entrega — "0 dias" mentiria, sugerindo entrega instantânea, quando na
   verdade não houve nenhuma entrega naquele mês/produto para calcular a média). */
export interface SeriePontoNullable {
  month: string;
  valor: number | null;
}

/** Linha crua retornada pelas queries de série (mes/dim/valor), antes do preenchimento de meses. */
export interface SerieRow {
  mes: string;
  dim: string;
  valor: number | string;
}

/**
 * Soma `delta` meses (pode ser negativo) a um "YYYY-MM", normalizando o overflow de mês/ano.
 * Ex.: addMeses("2026-01", -1) === "2025-12"; addMeses("2026-12", 1) === "2027-01".
 */
export function addMeses(mes: string, delta: number): string {
  const [anoStr, mesStr] = mes.split("-");
  let ano = parseInt(anoStr, 10);
  let mm = parseInt(mesStr, 10) + delta;
  while (mm > 12) {
    mm -= 12;
    ano += 1;
  }
  while (mm < 1) {
    mm += 12;
    ano -= 1;
  }
  return `${ano}-${String(mm).padStart(2, "0")}`;
}

/** Lista os 12 meses (YYYY-MM, ordem cronológica) terminando em `mesFim`, inclusive. */
export function listaMeses12(mesFim: string): string[] {
  const meses: string[] = [];
  for (let i = 11; i >= 0; i--) {
    meses.push(addMeses(mesFim, -i));
  }
  return meses;
}

/**
 * Agrupa linhas cruas {mes,dim,valor} em um Record<dim, pontos[]> com os 12 meses da
 * janela preenchidos (valor 0 onde não houver dado), na ordem cronológica de `meses`.
 * Soma valores quando a mesma (dim,mes) aparecer em mais de uma linha (defensivo).
 */
export function rowsParaSeries(rows: SerieRow[], meses: string[]): Record<string, SeriePonto[]> {
  const porDim = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!porDim.has(row.dim)) porDim.set(row.dim, new Map());
    const valoresPorMes = porDim.get(row.dim)!;
    valoresPorMes.set(row.mes, (valoresPorMes.get(row.mes) || 0) + (Number(row.valor) || 0));
  }

  const out: Record<string, SeriePonto[]> = {};
  for (const [dim, valoresPorMes] of Array.from(porDim.entries())) {
    out[dim] = meses.map((month) => ({ month, valor: valoresPorMes.get(month) || 0 }));
  }
  return out;
}

/**
 * Como `rowsParaSeries`, mas preenche meses sem dado com `null` em vez de 0 — para métricas
 * tipo média (ex: lead time), onde "sem observação no mês" é semanticamente diferente de
 * "0 dias/reais". O frontend já trata `valor: null` como "sem dado" em toda a cadeia do modo
 * Evolução (Sparkline filtra, deltaM1 filtra, TabelaEvolucao renderiza "—").
 *
 * Diferente de `rowsParaSeries`, não soma linhas duplicadas de (dim,mes) — as queries que
 * alimentam esta função já agregam com `GROUP BY mes, dim` no SQL (1 linha por combinação),
 * então uma segunda linha para a mesma chave apenas sobrescreve a primeira.
 */
export function rowsParaSeriesNullFill(rows: SerieRow[], meses: string[]): Record<string, SeriePontoNullable[]> {
  const porDim = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!porDim.has(row.dim)) porDim.set(row.dim, new Map());
    porDim.get(row.dim)!.set(row.mes, Number(row.valor) || 0);
  }

  const out: Record<string, SeriePontoNullable[]> = {};
  for (const [dim, valoresPorMes] of Array.from(porDim.entries())) {
    out[dim] = meses.map((month) => ({ month, valor: valoresPorMes.has(month) ? valoresPorMes.get(month)! : null }));
  }
  return out;
}
