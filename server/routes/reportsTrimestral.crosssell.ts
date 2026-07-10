// Bloco "Cross-sell" do reporte trimestral.
//
// Universo (decisão 2026-07-09, Ichino): deals `Negócio Ganho` com `source='PARTNER'`
// fechados no trimestre, restritos a CLIENTES PRÉ-EXISTENTES — o 1º contrato no
// ClickUp começou antes do mês do fechamento. É a mesma régua do drawer de NRR
// (getCrosssellDealsDetail), então as duas telas contam a mesma coisa.
//
// A coluna "Mapeamento" da planilha de cross-sell NÃO existe no nosso banco
// (nem em crm_deal, nem em cup_clientes). O eixo secundário é PRODUTO, derivado
// de `servicos_vendidos` via o de-para canônico SERVICOS_BITRIX.

import { parseServicosVendidos, segmentosPorNatureza, type SegmentoBP } from "../okr2026/servicosBitrix";

export interface CrosssellDealRow {
  cx: string | null;
  valor_recorrente: number | string | null;
  valor_pontual: number | string | null;
  servicos_vendidos: string | null;
}

export interface CrosssellRanking {
  nome: string;
  deals: number;
  recorrente: number;
  pontual: number;
  total: number;
}

export interface Crosssell {
  totalDeals: number;
  recorrente: number;
  pontual: number;
  total: number;
  porCx: CrosssellRanking[];
  porProduto: CrosssellRanking[];
}

const SEM_CX = "Sem CX";
const FALLBACK_SEGMENTO: SegmentoBP = "Others";

function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function acc(map: Map<string, CrosssellRanking>, nome: string, rec: number, pont: number, contaDeal: boolean) {
  const cur = map.get(nome) ?? { nome, deals: 0, recorrente: 0, pontual: 0, total: 0 };
  cur.recorrente += rec;
  cur.pontual += pont;
  cur.total += rec + pont;
  if (contaDeal) cur.deals += 1;
  map.set(nome, cur);
}

const porTotalDesc = (a: CrosssellRanking, b: CrosssellRanking) => b.total - a.total;

/**
 * Agrega os deals de cross-sell do trimestre por CX e por produto.
 *
 * Distribuição por produto: o valor recorrente do deal é dividido igualmente
 * entre os segmentos RECORRENTES que ele vendeu, e o pontual entre os segmentos
 * PONTUAIS. Deal sem serviço mapeado cai em "Others" — assim a soma dos produtos
 * sempre fecha com o total do bloco, sem deal sumir no caminho.
 *
 * A contagem de `deals` por produto conta o deal uma vez por segmento tocado, e
 * portanto NÃO soma para `totalDeals` (um deal com 2 produtos aparece nos dois).
 */
export function buildCrosssell(rows: CrosssellDealRow[]): Crosssell {
  const porCx = new Map<string, CrosssellRanking>();
  const porProduto = new Map<string, CrosssellRanking>();
  let recorrente = 0;
  let pontual = 0;

  for (const row of rows) {
    const rec = num(row.valor_recorrente);
    const pont = num(row.valor_pontual);
    recorrente += rec;
    pontual += pont;

    const cx = row.cx?.trim() || SEM_CX;
    acc(porCx, cx, rec, pont, true);

    const ids = parseServicosVendidos(row.servicos_vendidos);
    const { recorrente: segRec, pontual: segPont } = segmentosPorNatureza(ids);
    const alvoRec = segRec.length ? segRec : rec > 0 ? [FALLBACK_SEGMENTO] : [];
    const alvoPont = segPont.length ? segPont : pont > 0 ? [FALLBACK_SEGMENTO] : [];

    for (const seg of alvoRec) acc(porProduto, seg, rec / alvoRec.length, 0, false);
    for (const seg of alvoPont) acc(porProduto, seg, 0, pont / alvoPont.length, false);
    const tocados = Array.from(new Set<string>([...alvoRec, ...alvoPont]));
    for (const seg of tocados) {
      const cur = porProduto.get(seg);
      if (cur) cur.deals += 1;
    }
  }

  return {
    totalDeals: rows.length,
    recorrente,
    pontual,
    total: recorrente + pontual,
    porCx: Array.from(porCx.values()).sort(porTotalDesc),
    porProduto: Array.from(porProduto.values()).sort(porTotalDesc),
  };
}
