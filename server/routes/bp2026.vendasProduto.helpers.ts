import {
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS,
  type SegmentoBP, type Natureza,
} from "../okr2026/servicosBitrix";

// contratosRec/contratosPont = nº de contratos criados no ClickUp por segmento
export interface CelulaSeg { mrr: number; pont: number; contratosRec: number; contratosPont: number }
// ===== Vendas por Produto via ClickUp (data_criado) =====
import { segmentoDeProduto } from "./bp2026.produtoSegmento";

export interface VendaProdutoRow { mes: number; produto: string; mrr: number; pont: number; contratosMrr: number; contratosPont: number }
export interface TotalMesRow { mes: number; clientes: number }
export interface TotalMes { mrr: number; pont: number; contratos: number; clientes: number }
export interface AggVendasClickup {
  agg: Map<number, Map<SegmentoBP, CelulaSeg>>;
  totais: Map<number, TotalMes>;
}
export interface ContratoRow {
  idSubtask: string; idTask: string; cliente: string; produto: string; servico: string; status: string;
  valorr: number; valorp: number; data: string | null;
}

const SET_REC = new Set<SegmentoBP>(SEGMENTOS_RECORRENTES);
const SET_PONT = new Set<SegmentoBP>(SEGMENTOS_PONTUAIS);

const segNoBloco = (seg: SegmentoBP, natureza: Natureza): SegmentoBP =>
  natureza === "recorrente" ? (SET_REC.has(seg) ? seg : "Others") : (SET_PONT.has(seg) ? seg : "Others");

export function agregarVendasProdutoClickup(
  produtoRows: VendaProdutoRow[], totalRows: TotalMesRow[]
): AggVendasClickup {
  const agg = new Map<number, Map<SegmentoBP, CelulaSeg>>();
  const totais = new Map<number, TotalMes>();
  const cel = (mes: number, seg: SegmentoBP): CelulaSeg => {
    const porMes = agg.get(mes) ?? new Map<SegmentoBP, CelulaSeg>();
    agg.set(mes, porMes);
    const c = porMes.get(seg) ?? { mrr: 0, pont: 0, contratosRec: 0, contratosPont: 0 };
    porMes.set(seg, c);
    return c;
  };
  const tot = (mes: number): TotalMes => {
    const t = totais.get(mes) ?? { mrr: 0, pont: 0, contratos: 0, clientes: 0 };
    totais.set(mes, t);
    return t;
  };
  for (const r of produtoRows) {
    const seg = segmentoDeProduto(r.produto);
    if (r.mrr || r.contratosMrr) {
      const c = cel(r.mes, segNoBloco(seg, "recorrente"));
      c.mrr += r.mrr; c.contratosRec += r.contratosMrr;
      tot(r.mes).mrr += r.mrr;
      tot(r.mes).contratos += r.contratosMrr;
    }
    if (r.pont || r.contratosPont) {
      const c = cel(r.mes, segNoBloco(seg, "pontual"));
      c.pont += r.pont; c.contratosPont += r.contratosPont;
      tot(r.mes).pont += r.pont;
      tot(r.mes).contratos += r.contratosPont;
    }
  }
  for (const tr of totalRows) {
    const t = tot(tr.mes);
    t.clientes = tr.clientes;
  }
  return { agg, totais };
}

export function contratosDoSegmento(
  rows: ContratoRow[], natureza: Natureza, segmento: SegmentoBP
): ContratoRow[] {
  return rows.filter((r) => {
    const valor = natureza === "recorrente" ? r.valorr : r.valorp;
    if (!(valor > 0)) return false;
    return segNoBloco(segmentoDeProduto(r.produto), natureza) === segmento;
  });
}
