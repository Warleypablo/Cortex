import {
  SERVICOS_BITRIX, parseServicosVendidos, segmentosPorNatureza,
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS,
  type SegmentoBP, type Natureza,
} from "../okr2026/servicosBitrix";

export interface DealVenda {
  id: number; cnpjNorm: string; mes: number;
  valorRec: number; valorPont: number; ids: number[];
}
export type MixClickup = Map<string, Map<SegmentoBP, number>>;
// product rows do Bitrix por deal (deal.id -> valor por segmento) — fonte exata de mix
export type ProdutoRowMix = Map<number, Map<SegmentoBP, number>>;
export type AovMedio = Record<string, number>;
export interface ParteDeal { segmento: SegmentoBP; natureza: Natureza; valor: number; contrato: 1 }

function pesar(valor: number, segmentos: SegmentoBP[], pesos: Map<SegmentoBP, number> | undefined): Map<SegmentoBP, number> | null {
  if (!pesos) return null;
  let soma = 0;
  for (const s of segmentos) {
    const p = pesos.get(s);
    if (!p || p <= 0) return null;
    soma += p;
  }
  if (soma <= 0) return null;
  const out = new Map<SegmentoBP, number>();
  for (const s of segmentos) out.set(s, (valor * (pesos.get(s) as number)) / soma);
  return out;
}

function pesosAov(segmentos: SegmentoBP[], aov: AovMedio): Map<SegmentoBP, number> {
  const m = new Map<SegmentoBP, number>();
  for (const s of segmentos) m.set(s, aov[s] && aov[s] > 0 ? aov[s] : 1);
  return m;
}

// Tenta cada fonte de pesos na ordem dada (product rows -> mix ClickUp); se nenhuma
// cobrir todos os segmentos, cai no rateio por AOV médio. Em todos os casos o total
// distribuído == valor (pesar normaliza pela soma dos pesos).
function distribuirNatureza(
  valor: number, segmentos: SegmentoBP[], natureza: Natureza,
  fontes: Array<Map<SegmentoBP, number> | undefined>, aov: AovMedio
): ParteDeal[] {
  if (valor <= 0 || segmentos.length === 0) return [];
  if (segmentos.length === 1) {
    return [{ segmento: segmentos[0], natureza, valor, contrato: 1 }];
  }
  let pesado: Map<SegmentoBP, number> | null = null;
  for (const f of fontes) {
    pesado = pesar(valor, segmentos, f);
    if (pesado) break;
  }
  if (!pesado) pesado = pesar(valor, segmentos, pesosAov(segmentos, aov))!;
  return segmentos.map((s) => ({ segmento: s, natureza, valor: pesado!.get(s) ?? 0, contrato: 1 as const }));
}

export function distribuirDeal(
  deal: DealVenda, prMix: ProdutoRowMix, mixRec: MixClickup, mixPont: MixClickup, aovRec: AovMedio, aovPont: AovMedio
): ParteDeal[] {
  const { recorrente, pontual } = segmentosPorNatureza(deal.ids);
  const segRec = recorrente.length ? recorrente : (deal.valorRec > 0 ? (["Others"] as SegmentoBP[]) : []);
  const segPont = pontual.length ? pontual : (deal.valorPont > 0 ? (["Others"] as SegmentoBP[]) : []);
  const pr = prMix.get(deal.id); // product rows aplicam-se às duas naturezas (pesar filtra por segmento)
  return [
    ...distribuirNatureza(deal.valorRec, segRec, "recorrente", [pr, mixRec.get(deal.cnpjNorm)], aovRec),
    ...distribuirNatureza(deal.valorPont, segPont, "pontual", [pr, mixPont.get(deal.cnpjNorm)], aovPont),
  ];
}

export function aovMedioPorSegmento(deals: DealVenda[], natureza: Natureza): AovMedio {
  const acc: Record<string, { soma: number; n: number }> = {};
  for (const d of deals) {
    const seg = segmentosPorNatureza(d.ids)[natureza];
    if (seg.length !== 1) continue;
    const valor = natureza === "recorrente" ? d.valorRec : d.valorPont;
    if (valor <= 0) continue;
    const k = seg[0];
    acc[k] = acc[k] ?? { soma: 0, n: 0 };
    acc[k].soma += valor; acc[k].n += 1;
  }
  const out: AovMedio = {};
  for (const k of Object.keys(acc)) out[k] = acc[k].soma / acc[k].n;
  return out;
}

export interface CelulaSeg { mrr: number; pont: number; contratosRec: number; contratosPont: number }
export function agregarVendasProduto(
  deals: DealVenda[], prMix: ProdutoRowMix, mixRec: MixClickup, mixPont: MixClickup, aovRec: AovMedio, aovPont: AovMedio
): Map<number, Map<SegmentoBP, CelulaSeg>> {
  const out = new Map<number, Map<SegmentoBP, CelulaSeg>>();
  for (const d of deals) {
    const partes = distribuirDeal(d, prMix, mixRec, mixPont, aovRec, aovPont);
    const porMes = out.get(d.mes) ?? new Map<SegmentoBP, CelulaSeg>();
    for (const p of partes) {
      const c = porMes.get(p.segmento) ?? { mrr: 0, pont: 0, contratosRec: 0, contratosPont: 0 };
      if (p.natureza === "recorrente") { c.mrr += p.valor; c.contratosRec += p.contrato; }
      else { c.pont += p.valor; c.contratosPont += p.contrato; }
      porMes.set(p.segmento, c);
    }
    out.set(d.mes, porMes);
  }
  return out;
}

export { parseServicosVendidos, SERVICOS_BITRIX };

// ===== Vendas por Produto via ClickUp (data_criado) =====
import { segmentoDeProduto } from "./bp2026.produtoSegmento";

export interface VendaProdutoRow { mes: number; produto: string; mrr: number; pont: number; contratosMrr: number; contratosPont: number }
export interface TotalMesRow { mes: number; contratos: number; clientes: number }
export interface TotalMes { mrr: number; pont: number; contratos: number; clientes: number }
export interface AggVendasClickup {
  agg: Map<number, Map<SegmentoBP, CelulaSeg>>;
  totais: Map<number, TotalMes>;
}
export interface ContratoRow {
  cliente: string; produto: string; servico: string; status: string;
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
    }
    if (r.pont || r.contratosPont) {
      const c = cel(r.mes, segNoBloco(seg, "pontual"));
      c.pont += r.pont; c.contratosPont += r.contratosPont;
      tot(r.mes).pont += r.pont;
    }
  }
  for (const tr of totalRows) {
    const t = tot(tr.mes);
    t.contratos = tr.contratos; t.clientes = tr.clientes;
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
