// Funções puras do scorecard: status vs. meta, delta M/M-1 e formatação de valor.
// Sem I/O, sem React — só lógica testável isoladamente (ver logica.test.ts).

import { formatCurrencyNoDecimals, formatPercent, formatDecimal } from "@/lib/utils";
import type { ScorecardDirection, ScorecardFormato, ScorecardRow, ScorecardSeriePonto } from "./tipos";
import type { EvolucaoProdutoTabelaData } from "@/components/lt-ltv-churn/types";

export type ScorecardStatus = "good" | "warn" | "bad" | null;

/**
 * Compara o valor atual com a meta e devolve o "farol" do scorecard.
 * - direction="up" (maior é melhor): good se atual>=meta, warn se atual>=90% da meta, senão bad.
 * - direction="down" (menor é melhor, ex. churn): good se atual<=meta, warn se atual<=110% da meta, senão bad.
 * - meta ausente (null/undefined) ou atual null → sem status (null).
 */
export function calcStatus(
  atual: number | null,
  meta: number | null | undefined,
  direction: ScorecardDirection,
): ScorecardStatus {
  if (atual === null || atual === undefined || meta === null || meta === undefined) return null;

  if (direction === "up") {
    if (atual >= meta) return "good";
    if (atual >= meta * 0.9) return "warn";
    return "bad";
  }

  // direction === "down"
  if (atual <= meta) return "good";
  if (atual <= meta * 1.1) return "warn";
  return "bad";
}

export interface DeltaM1Ponto {
  valor: number | null;
}

export interface DeltaM1Result {
  pct: number;
  dir: "up" | "down" | "flat";
}

/**
 * Compara os 2 últimos pontos VÁLIDOS (valor não-nulo) de uma série mensal ordenada
 * e devolve a variação percentual + direção. `flat` quando a variação é desprezível
 * (|pct| < 0.05) ou quando o ponto-base é 0 (evita divisão por zero / infinito).
 * null se a série tiver menos de 2 pontos válidos.
 */
export function deltaM1(serie?: DeltaM1Ponto[] | null): DeltaM1Result | null {
  if (!serie) return null;

  const validos = serie.filter((p) => p.valor !== null && p.valor !== undefined);
  if (validos.length < 2) return null;

  const [base, atual] = validos.slice(-2).map((p) => p.valor as number);

  if (base === 0) return { pct: 0, dir: "flat" };

  const pct = ((atual - base) / base) * 100;
  if (Math.abs(pct) < 0.05) return { pct, dir: "flat" };
  return { pct, dir: pct > 0 ? "up" : "down" };
}

/** Ponto cru de uma série mensal por dimensão — mesmo shape devolvido por
   GET /api/scorecard/series (server/routes/scorecard.helpers.ts: `SeriePonto`). Sem `label`
   (o backend só manda `month`) — quem consome decide como abreviar o mês. `valor` aceita
   `null` (ex: `leadTimePorProduto`, onde mês sem entrega não deve virar 0 — ver
   `rowsParaSeriesNullFill`); séries que nunca têm null (churn/mrr/entregas) continuam
   compatíveis, `number` é atribuível a `number | null`. */
export interface SerieDimPonto {
  month: string;
  valor: number | null;
}

export interface LinhasPorDimensaoOpts {
  /** Monta o `key` estável da linha a partir do nome da dimensão (produto/operador/squad) —
     cada seção usa seu próprio `slug` + prefixo (ex: `churn_produto_${slug(dim)}`). */
  keyFn: (dim: string) => string;
  formato: ScorecardFormato;
  /** "YYYY-MM" → label curto (ex: "Jan") — cada seção já tem seu próprio `labelMesCurto`. */
  labelMes: (mes: string) => string;
  /** Limita a quantidade de linhas (após ordenar por atual desc). Omitido = todas as dimensões. */
  top?: number;
  /** Sub-texto opcional por linha (ex: motivo top casado por nome, ou % do total) — recebe o
     `atual` já resolvido desta MESMA série (nunca de uma fonte externa, para não descasar
     com a série exibida). */
  sub?: (dim: string, atual: number | null) => string | undefined;
  /** Quando true, marca o dono automático da linha como a própria dimensão (ex: operador). */
  responsavelAuto?: boolean;
}

/**
 * Constrói linhas de Scorecard (`ScorecardRow[]`) a partir de uma série mensal por dimensão —
 * o shape `Record<dim, {month,valor}[]>` devolvido por GET /api/scorecard/series. O `atual` de
 * cada linha vem do ponto da série no mês selecionado (ou do último ponto <= mes, defensivo,
 * caso a janela não inclua `mes` exatamente) — NUNCA de uma fonte diferente da série, para que
 * o valor do mês e a linha do tempo do modo Evolução sempre reconciliem (mesma regra já seguida
 * pelo "Churn R$" geral em SecaoChurn.tsx). Ordena por atual desc; `top` (se informado) limita
 * a quantidade de linhas exibidas.
 */
export function linhasPorDimensao(
  series: Record<string, SerieDimPonto[]> | undefined,
  mes: string,
  opts: LinhasPorDimensaoOpts,
): ScorecardRow[] {
  if (!series) return [];

  const linhas = Object.entries(series).map(([dim, pontosCrus]) => {
    const ordenados = [...pontosCrus].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    const pontoAtual = ordenados.find((p) => p.month === mes) ?? [...ordenados].reverse().find((p) => p.month <= mes);
    const atual = pontoAtual ? pontoAtual.valor : null;
    const serie: ScorecardSeriePonto[] = ordenados.map((p) => ({ month: p.month, label: opts.labelMes(p.month), valor: p.valor }));
    return { dim, atual, serie };
  });

  linhas.sort((a, b) => (b.atual ?? -Infinity) - (a.atual ?? -Infinity));
  const limitadas = typeof opts.top === "number" ? linhas.slice(0, opts.top) : linhas;

  return limitadas.map(({ dim, atual, serie }) => ({
    key: opts.keyFn(dim),
    metrica: dim,
    sub: opts.sub?.(dim, atual),
    atual,
    formato: opts.formato,
    serie,
    temporalidade: "mes",
    responsavelAuto: opts.responsavelAuto ? dim : undefined,
  }));
}

export interface OverviewSeriePonto {
  month: string;
  valor: number;
}

export interface SerieOverviewLtLtv {
  lt: OverviewSeriePonto[];
  ltv: OverviewSeriePonto[];
  totalRecorrentes: OverviewSeriePonto[];
}

/**
 * Agrega a matriz de `evolucao-produto-tabela` (produto × mês, já usada por
 * "LTV por produto (evolução)") numa série mensal para o "overview" (LT médio, LTV médio,
 * total de recorrentes) — ponderada por `n` de cada produto no mês.
 *
 * IMPORTANTE: `evolucaoProduto.produtos` inclui o bucket agregado "Total" (BUCKETS_ORDER em
 * server/routes/ltLtvChurn.helpers.ts:buildMatrizEvolucaoProduto), que já soma TODOS os outros
 * produtos (Performance/Social Media/Creators/Outros). Somar `n` sobre TODOS os produtos
 * incluindo "Total" dobraria a contagem (usada como valor direto em "Total recorrentes", não só
 * como peso de média) — por isso este helper EXCLUI "Total" da agregação e reconstrói o total a
 * partir dos buckets individuais.
 *
 * Meses sem nenhum produto com dado são omitidos (não entram como ponto 0/null).
 */
export function serieOverviewLtLtv(evolucaoProduto: EvolucaoProdutoTabelaData | undefined): SerieOverviewLtLtv {
  if (!evolucaoProduto) return { lt: [], ltv: [], totalRecorrentes: [] };

  const produtos = evolucaoProduto.produtos.filter((p) => p !== "Total");
  const lt: OverviewSeriePonto[] = [];
  const ltv: OverviewSeriePonto[] = [];
  const totalRecorrentes: OverviewSeriePonto[] = [];

  for (const mes of evolucaoProduto.meses) {
    let totalN = 0;
    let ltNumerador = 0;
    let ltvNumerador = 0;
    for (const produto of produtos) {
      const cel = evolucaoProduto.celulas[produto]?.[mes];
      if (!cel) continue;
      totalN += cel.n;
      ltNumerador += cel.lt * cel.n;
      ltvNumerador += cel.ltv * cel.n;
    }
    if (totalN === 0) continue;
    lt.push({ month: mes, valor: ltNumerador / totalN });
    ltv.push({ month: mes, valor: ltvNumerador / totalN });
    totalRecorrentes.push({ month: mes, valor: totalN });
  }

  return { lt, ltv, totalRecorrentes };
}

/** Formata um valor numérico conforme o formato do scorecard. null/undefined/NaN → "—". */
export function formatValor(v: number | null | undefined, formato: ScorecardFormato): string {
  if (v === null || v === undefined || isNaN(v)) return "—";

  switch (formato) {
    case "brl":
      return formatCurrencyNoDecimals(v);
    case "pct":
      return formatPercent(v, 1);
    case "int":
      return new Intl.NumberFormat("pt-BR").format(Math.round(v));
    case "meses":
      return `${formatDecimal(v, 1)} meses`;
    default:
      return String(v);
  }
}
