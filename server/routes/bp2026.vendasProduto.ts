// server/routes/bp2026.vendasProduto.ts
// Sub-aba Vendas por Produto: vendas MRR/Pontual, contratos e AOV por segmento BP.
// Realizado: "Clickup".cup_contratos por data_criado, com produto mapeado a segmento
// (bp2026.produtoSegmento). O drill-down lista os contratos do ClickUp.
// NOTA: carregarAtribuicaoVendas/parseMetricaProduto permanecem — a atribuição Bitrix
// ainda é usada pelo CAC (contratosVendidosRec em bp2026.ts).
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd } from "./bp2026.helpers";
import {
  aovMedioPorSegmento, parseServicosVendidos,
  agregarVendasProdutoClickup, contratosDoSegmento,
  type DealVenda, type MixClickup, type AovMedio, type ProdutoRowMix,
  type CelulaSeg, type TotalMes, type AggVendasClickup, type ContratoRow,
} from "./bp2026.vendasProduto.helpers";
import {
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS, SLUG,
  type SegmentoBP, type Natureza,
} from "../okr2026/servicosBitrix";
const ANO = 2026;

interface MesLinha { mes: number; orcado: number; realizado: number | null; atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo"; direcao: "maior_melhor";
  unidade: "brl" | "int" | "pct"; grupo: string; segmento: string; destaque?: boolean;
  semDetalhe?: boolean;
  meses: MesLinha[]; ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const SEG_POR_SLUG: Record<string, SegmentoBP> = Object.fromEntries(
  (Object.entries(SLUG) as [SegmentoBP, string][]).map(([seg, slug]) => [slug, seg])
) as Record<string, SegmentoBP>;
const orcKey = (medida: string, seg: SegmentoBP) => `${medida}_${SLUG[seg]}`;

// Carrega vendas por produto do ClickUp (data_criado) e agrega no formato da matriz.
export async function carregarVendasProdutoClickup(db: any): Promise<AggVendasClickup> {
  const ini = `${ANO}-01-01`, fim = `${ANO + 1}-01-01`;
  const prodRows = (await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_criado)::int AS mes,
           COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto,
           COALESCE(SUM(valorr::numeric), 0)::float AS mrr,
           COALESCE(SUM(valorp::numeric), 0)::float AS pont,
           COUNT(*) FILTER (WHERE COALESCE(valorr,0) > 0)::int AS contratos_mrr,
           COUNT(*) FILTER (WHERE COALESCE(valorp,0) > 0)::int AS contratos_pont
    FROM "Clickup".cup_contratos
    WHERE data_criado >= ${ini} AND data_criado < ${fim}
      AND LOWER(TRIM(status)) <> 'não usar'
    GROUP BY 1, 2
  `)).rows as any[];
  const totRows = (await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_criado)::int AS mes,
           COUNT(DISTINCT id_task)::int AS clientes
    FROM "Clickup".cup_contratos
    WHERE data_criado >= ${ini} AND data_criado < ${fim}
      AND LOWER(TRIM(status)) <> 'não usar'
    GROUP BY 1
  `)).rows as any[];
  return agregarVendasProdutoClickup(
    prodRows.map((r) => ({
      mes: Number(r.mes), produto: String(r.produto),
      mrr: Number(r.mrr), pont: Number(r.pont),
      contratosMrr: Number(r.contratos_mrr), contratosPont: Number(r.contratos_pont),
    })),
    totRows.map((r) => ({ mes: Number(r.mes), clientes: Number(r.clientes) })),
  );
}

interface Deps {
  agg: Map<number, Map<SegmentoBP, CelulaSeg>>;
  totais: Map<number, TotalMes>;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

// ---- Carregamento compartilhado: deals + mix ClickUp + AOV médio (usado pela
// agregação da sub-aba E pelo drill-down, para que não divirjam) ----
export interface AtribuicaoVendas {
  deals: DealVenda[];
  prMix: ProdutoRowMix;
  mixRec: MixClickup;
  mixPont: MixClickup;
  aovRec: AovMedio;
  aovPont: AovMedio;
  meta: Map<number, { titulo: string; data: string | null; closer: string }>;
}

export async function carregarAtribuicaoVendas(db: any): Promise<AtribuicaoVendas> {
  const dealsRows = (await db.execute(sql`
    SELECT id,
           EXTRACT(MONTH FROM data_fechamento)::int AS mes,
           regexp_replace(COALESCE(cnpj,''),'\\D','','g') AS cnpj_norm,
           COALESCE(valor_recorrente::numeric,0) AS vr,
           COALESCE(valor_pontual::numeric,0) AS vp,
           servicos_vendidos,
           COALESCE(title,'(sem título)') AS title,
           data_fechamento::date::text AS data,
           COALESCE(closer::text,'') AS closer
    FROM "Bitrix".crm_deal
    WHERE stage_name = 'Negócio Ganho'
      AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
      AND (COALESCE(valor_recorrente,0) > 0 OR COALESCE(valor_pontual,0) > 0)
  `)).rows as any[];

  const deals: DealVenda[] = [];
  const meta = new Map<number, { titulo: string; data: string | null; closer: string }>();
  for (const r of dealsRows) {
    const id = Number(r.id);
    deals.push({
      id, mes: Number(r.mes),
      cnpjNorm: r.cnpj_norm && [14, 11].includes(r.cnpj_norm.length) ? r.cnpj_norm : "",
      valorRec: parseFloat(r.vr), valorPont: parseFloat(r.vp),
      ids: parseServicosVendidos(r.servicos_vendidos),
    });
    meta.set(id, { titulo: r.title, data: r.data, closer: r.closer });
  }

  const cnpjs = Array.from(new Set(deals.map((d) => d.cnpjNorm).filter(Boolean)));
  const cnpjsLiteral = `{${cnpjs.join(",")}}`;
  const mixRec: MixClickup = new Map();
  const mixPont: MixClickup = new Map();
  if (cnpjs.length) {
    const mixRows = (await db.execute(sql`
      SELECT regexp_replace(COALESCE(cc.cnpj,''),'\\D','','g') AS cnpj_norm,
             CASE
               WHEN TRIM(COALESCE(c.produto,'')) = 'Performance' THEN 'Performance'
               WHEN TRIM(COALESCE(c.produto,'')) IN ('Creators','Creators - Recorrente') THEN 'Creators'
               WHEN TRIM(COALESCE(c.produto,'')) = 'Social Media' THEN 'Social'
               WHEN TRIM(COALESCE(c.produto,'')) = 'Gestão de Comunidade' THEN 'Gestão de Comunidade'
               WHEN TRIM(COALESCE(c.produto,'')) = 'Ecommerce' THEN 'E-commerce'
               WHEN TRIM(COALESCE(c.produto,'')) = 'Site' THEN 'Site Institucional'
               WHEN TRIM(COALESCE(c.produto,'')) = 'Landing Page' THEN 'Landing Page'
               WHEN TRIM(COALESCE(c.produto,'')) = 'CRM de Vendas' THEN 'CRM'
               ELSE 'Others'
             END AS segmento,
             COALESCE(SUM(c.valorr::numeric),0) AS rec,
             COALESCE(SUM(c.valorp::numeric),0) AS pont
      FROM "Clickup".cup_clientes cc
      JOIN "Clickup".cup_contratos c ON c.id_task = cc.task_id
      WHERE regexp_replace(COALESCE(cc.cnpj,''),'\\D','','g') = ANY(${cnpjsLiteral}::text[])
      GROUP BY 1, 2
    `)).rows as any[];
    for (const row of mixRows) {
      const seg = row.segmento as SegmentoBP;
      const rec = parseFloat(row.rec), pont = parseFloat(row.pont);
      if (rec > 0) {
        const m = mixRec.get(row.cnpj_norm) ?? new Map<SegmentoBP, number>();
        m.set(seg, (m.get(seg) ?? 0) + rec); mixRec.set(row.cnpj_norm, m);
      }
      if (pont > 0) {
        const m = mixPont.get(row.cnpj_norm) ?? new Map<SegmentoBP, number>();
        m.set(seg, (m.get(seg) ?? 0) + pont); mixPont.set(row.cnpj_norm, m);
      }
    }
  }

  // product rows do Bitrix (valor exato por serviço), sincronizadas em
  // cortex_core.bitrix_deal_produto_valor — fonte de mix de maior prioridade
  const prMix: ProdutoRowMix = new Map();
  const prRows = (await db.execute(sql`
    SELECT deal_id, segmento, valor::numeric AS valor
    FROM cortex_core.bitrix_deal_produto_valor
  `)).rows as any[];
  for (const r of prRows) {
    const id = Number(r.deal_id);
    const m = prMix.get(id) ?? new Map<SegmentoBP, number>();
    m.set(r.segmento as SegmentoBP, parseFloat(r.valor));
    prMix.set(id, m);
  }

  const aovRec = aovMedioPorSegmento(deals, "recorrente");
  const aovPont = aovMedioPorSegmento(deals, "pontual");
  return { deals, prMix, mixRec, mixPont, aovRec, aovPont, meta };
}

export function montarVendasProduto(deps: Deps): Linha[] {
  const { agg, totais, orcado, mesCorrente, mesFechado } = deps;

  const serie = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));
  const orcOf = (src: string | ((m: number) => number), mes: number): number =>
    typeof src === "function" ? src(mes) : (orcado[src]?.[mes] ?? 0);
  const razao = (num: number | null, den: number | null): number | null =>
    (num === null || den === null || !den) ? null : num / den;
  const somaAte = (s: (number | null)[]) =>
    s.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const somaOrcAte = (src: string | ((m: number) => number)) =>
    Array.from({ length: mesFechado }, (_, i) => orcOf(src, i + 1)).reduce((a, b) => a + b, 0);

  const fazLinha = (
    metrica: string, titulo: string, grupo: string, segmento: string,
    unidade: Linha["unidade"], serieReal: (number | null)[], orcSrc: string | ((m: number) => number),
    opts: { ytdOverride?: { orcado: number; realizado: number | null }; destaque?: boolean; semDetalhe?: boolean } = {}
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const o = orcOf(orcSrc, i + 1);
      const r = serieReal[i];
      return { mes: i + 1, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : opts.ytdOverride
        ? { ...opts.ytdOverride, atingimento: calcAtingimento(opts.ytdOverride.orcado, opts.ytdOverride.realizado) }
        : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return {
      metrica, titulo, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade, grupo, segmento,
      destaque: opts.destaque, semDetalhe: opts.semDetalhe, meses, ytd,
    };
  };

  const linhas: Linha[] = [];
  const t = (m: number) => totais.get(m);

  // ---- Bloco "Visão Geral" (totais; sem drill-down) ----
  const orcReceitaTotal = (m: number) => (orcado["vendas_mrr"]?.[m] ?? 0) + (orcado["vendas_pontual"]?.[m] ?? 0);
  const orcContratosTotal = (m: number) =>
    SEGMENTOS_RECORRENTES.reduce((s, seg) => s + (orcado[`contratos_vendidos_mrr_${SLUG[seg]}`]?.[m] ?? 0), 0) +
    SEGMENTOS_PONTUAIS.reduce((s, seg) => s + (orcado[`contratos_vendidos_pontual_${SLUG[seg]}`]?.[m] ?? 0), 0);
  const VG = "Visão Geral";
  linhas.push(fazLinha("vp_receita_total", "Receita Total", VG, "", "brl",
    serie((m) => (t(m)?.mrr ?? 0) + (t(m)?.pont ?? 0)), orcReceitaTotal, { destaque: true, semDetalhe: true }));
  linhas.push(fazLinha("vp_receita_mrr", "Receita MRR", VG, "", "brl",
    serie((m) => t(m)?.mrr ?? 0), "vendas_mrr", { semDetalhe: true }));
  linhas.push(fazLinha("vp_receita_pontual", "Receita Pontual", VG, "", "brl",
    serie((m) => t(m)?.pont ?? 0), "vendas_pontual", { semDetalhe: true }));
  linhas.push(fazLinha("vp_num_contratos", "Nº de Contratos", VG, "", "int",
    serie((m) => t(m)?.contratos ?? 0), orcContratosTotal, { semDetalhe: true }));
  linhas.push(fazLinha("vp_num_clientes", "Nº de Clientes", VG, "", "int",
    serie((m) => t(m)?.clientes ?? 0), () => 0, { semDetalhe: true }));

  // ---- Blocos Recorrente / Pontual por segmento ----
  const cel = (m: number, seg: SegmentoBP) => agg.get(m)?.get(seg);
  const blocos = [
    { grupo: "Recorrente", segmentos: SEGMENTOS_RECORRENTES, medida: "vendas_mrr", medidaCtr: "contratos_vendidos_mrr", medidaAov: "aov_venda_mrr", label: "MRR",
      pegaValor: (c?: CelulaSeg) => c?.mrr ?? 0, pegaCtr: (c?: CelulaSeg) => c?.contratosRec ?? 0 },
    { grupo: "Pontual", segmentos: SEGMENTOS_PONTUAIS, medida: "vendas_pontual", medidaCtr: "contratos_vendidos_pontual", medidaAov: "aov_venda_pontual", label: "Pontual",
      pegaValor: (c?: CelulaSeg) => c?.pont ?? 0, pegaCtr: (c?: CelulaSeg) => c?.contratosPont ?? 0 },
  ];
  for (const b of blocos) {
    for (const seg of b.segmentos) {
      const slug = SLUG[seg];
      const valorReal = serie((m) => b.pegaValor(cel(m, seg)));
      const ctrReal = serie((m) => b.pegaCtr(cel(m, seg)));
      const aovReal = Array.from({ length: 12 }, (_, i) => razao(valorReal[i], ctrReal[i]));
      linhas.push(fazLinha(`${b.medida}_${slug}`, `${seg} — ${b.label}`, b.grupo, seg, "brl", valorReal, `${b.medida}_${slug}`));
      linhas.push(fazLinha(`${b.medidaCtr}_${slug}`, `${seg} — Contratos`, b.grupo, seg, "int", ctrReal, `${b.medidaCtr}_${slug}`));
      const aovYtd = mesFechado === 0 ? undefined : {
        orcado: razao(somaOrcAte(`${b.medida}_${slug}`), somaOrcAte(`${b.medidaCtr}_${slug}`)) ?? 0,
        realizado: razao(somaAte(valorReal), somaAte(ctrReal)),
      };
      linhas.push(fazLinha(`${b.medidaAov}_${slug}`, `${seg} — AOV`, b.grupo, seg, "brl", aovReal, `${b.medidaAov}_${slug}`, { ytdOverride: aovYtd }));
    }
  }
  return linhas;
}

// ---- Drill-down: deals que compõem uma célula (segmento × mês) ----
// AOV não entra aqui: é derivada (MRR ÷ Contratos), exibida como cálculo no painel.
const MEDIDAS_PRODUTO = ["vendas_mrr", "vendas_pontual", "contratos_vendidos_mrr", "contratos_vendidos_pontual"] as const;

export function parseMetricaProduto(metrica: string):
  { natureza: Natureza; segmento: SegmentoBP; modo: "valor" | "contrato"; titulo: string } | null {
  for (const medida of MEDIDAS_PRODUTO) {
    if (!metrica.startsWith(medida + "_")) continue;
    const slug = metrica.slice(medida.length + 1);
    const segmento = SEG_POR_SLUG[slug];
    if (!segmento) return null;
    const natureza: Natureza = medida.endsWith("pontual") ? "pontual" : "recorrente";
    const modo = medida.startsWith("contratos") ? "contrato" : "valor";
    const label = modo === "contrato" ? "Contratos" : (natureza === "recorrente" ? "MRR" : "Pontual");
    return { natureza, segmento, modo, titulo: `${segmento} — ${label}` };
  }
  return null;
}

export interface ItemVendaDet { grupo: string; nome: string; detalhe: string; data: string | null; valor: number; url?: string }

// monta itens do drill-down a partir das linhas de contrato (pura, testável)
export function montarItensVendaProduto(
  rows: ContratoRow[], natureza: Natureza, segmento: SegmentoBP, modo: "valor" | "contrato"
): { itens: ItemVendaDet[]; total: number } {
  const doSeg = contratosDoSegmento(rows, natureza, segmento);
  const valorDe = (c: ContratoRow) => (natureza === "recorrente" ? c.valorr : c.valorp);
  const itens: ItemVendaDet[] = doSeg.map((c) => ({
    grupo: "Contratos",
    nome: c.cliente,
    detalhe: [c.servico || c.produto, c.status].filter(Boolean).join(" · "),
    data: c.data,
    valor: modo === "valor" ? valorDe(c) : 0,
  }));
  itens.sort((a, b) => b.valor - a.valor);
  const total = modo === "valor" ? doSeg.reduce((s, c) => s + valorDe(c), 0) : doSeg.length;
  return { itens, total };
}

export async function detalheVendaProdutoMes(
  db: any, natureza: Natureza, segmento: SegmentoBP, mes: number, modo: "valor" | "contrato"
): Promise<{ itens: ItemVendaDet[]; total: number }> {
  const rows = (await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(NULLIF(TRIM(c.produto), ''), '(sem produto)') AS produto,
           COALESCE(c.servico, '') AS servico,
           COALESCE(c.status, '') AS status,
           COALESCE(c.valorr::numeric, 0)::float AS valorr,
           COALESCE(c.valorp::numeric, 0)::float AS valorp,
           c.data_criado::text AS data
    FROM "Clickup".cup_contratos c
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
    WHERE EXTRACT(MONTH FROM c.data_criado)::int = ${mes}
      AND c.data_criado >= ${`${ANO}-01-01`} AND c.data_criado < ${`${ANO + 1}-01-01`}
      AND LOWER(TRIM(c.status)) <> 'não usar'
  `)).rows as any[];
  const contratos: ContratoRow[] = rows.map((r) => ({
    cliente: String(r.cliente), produto: String(r.produto), servico: String(r.servico),
    status: String(r.status), valorr: Number(r.valorr), valorp: Number(r.valorp), data: r.data ?? null,
  }));
  return montarItensVendaProduto(contratos, natureza, segmento, modo);
}
