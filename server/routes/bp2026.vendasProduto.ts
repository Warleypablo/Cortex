// server/routes/bp2026.vendasProduto.ts
// Sub-aba Vendas por Produto: vendas MRR/Pontual, contratos e AOV por segmento BP.
// Realizado: Bitrix.crm_deal (servicos_vendidos) com valor atribuído pela cascata
// (produto único -> mix ClickUp -> AOV). Total por natureza fecha com o funil agregado.
// O drill-down (detalheVendaProdutoMes) reusa a MESMA atribuição — célula e detalhe
// não podem divergir.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd } from "./bp2026.helpers";
import {
  agregarVendasProduto, aovMedioPorSegmento, parseServicosVendidos, distribuirDeal,
  type DealVenda, type MixClickup, type AovMedio, type ProdutoRowMix,
} from "./bp2026.vendasProduto.helpers";
import {
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS, SERVICOS_BITRIX,
  type SegmentoBP, type Natureza,
} from "../okr2026/servicosBitrix";

// portal Bitrix para montar o link do deal (mesmo base usado no FunilBroadcast)
const BITRIX_BASE = "https://turbopartners.bitrix24.com.br";

interface MesLinha { mes: number; orcado: number; realizado: number | null; atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo"; direcao: "maior_melhor";
  unidade: "brl" | "int" | "pct"; grupo: string; segmento: string; destaque?: boolean;
  meses: MesLinha[]; ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const SLUG: Record<SegmentoBP, string> = {
  "Performance": "performance", "Creators": "creators", "Social": "social",
  "Gestão de Comunidade": "gc", "Others": "others",
  "E-commerce": "ecommerce", "Site Institucional": "site", "Landing Page": "landing", "CRM": "crm",
};
const SEG_POR_SLUG: Record<string, SegmentoBP> = Object.fromEntries(
  (Object.entries(SLUG) as [SegmentoBP, string][]).map(([seg, slug]) => [slug, seg])
) as Record<string, SegmentoBP>;
const orcKey = (medida: string, seg: SegmentoBP) => `${medida}_${SLUG[seg]}`;

interface Deps {
  db: any;
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

export async function montarVendasProduto(deps: Deps): Promise<Linha[]> {
  const { db, orcado, mesCorrente, mesFechado } = deps;

  const { deals, prMix, mixRec, mixPont, aovRec, aovPont } = await carregarAtribuicaoVendas(db);
  const agg = agregarVendasProduto(deals, prMix, mixRec, mixPont, aovRec, aovPont);

  const serie = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const razao = (num: number | null, den: number | null): number | null =>
    (num === null || den === null || !den) ? null : num / den;
  const somaAte = (s: (number | null)[]) =>
    s.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const somaOrcAte = (metricaKey: string) =>
    Array.from({ length: mesFechado }, (_, i) => orcado[metricaKey]?.[i + 1] ?? 0).reduce((a, b) => a + b, 0);

  const fazLinha = (
    metrica: string, titulo: string, grupo: string, segmento: string,
    unidade: Linha["unidade"], serieReal: (number | null)[], orcadoMetrica: string,
    ytdOverride?: { orcado: number; realizado: number | null },
    destaque = false
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const o = orcado[orcadoMetrica]?.[i + 1] ?? 0;
      const r = serieReal[i];
      return { mes: i + 1, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : ytdOverride
        ? { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) }
        : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return { metrica, titulo, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade, grupo, segmento, destaque, meses, ytd };
  };

  const cel = (m: number, seg: SegmentoBP) => agg.get(m)?.get(seg);
  const linhas: Linha[] = [];

  const blocos: Array<{ grupo: string; segmentos: SegmentoBP[]; medidaValor: "vendas_mrr" | "vendas_pontual"; pegaValor: (c: any) => number; pegaCtr: (c: any) => number }> = [
    { grupo: "Recorrente", segmentos: SEGMENTOS_RECORRENTES, medidaValor: "vendas_mrr", pegaValor: (c) => c?.mrr ?? 0, pegaCtr: (c) => c?.contratosRec ?? 0 },
    { grupo: "Pontual", segmentos: SEGMENTOS_PONTUAIS, medidaValor: "vendas_pontual", pegaValor: (c) => c?.pont ?? 0, pegaCtr: (c) => c?.contratosPont ?? 0 },
  ];

  for (const b of blocos) {
    // linha de TOTAL do bloco (soma dos produtos) no topo, em destaque;
    // orçado = total agregado (vendas_mrr / vendas_pontual); drill-down lista todos os deals
    const totalReal = serie((m) => b.segmentos.reduce((s, seg) => s + b.pegaValor(cel(m, seg)), 0));
    const totalTitulo = b.medidaValor === "vendas_mrr" ? "Total MRR" : "Total Pontual";
    linhas.push(fazLinha(b.medidaValor, totalTitulo, b.grupo, "", "brl", totalReal, b.medidaValor, undefined, true));
    for (const seg of b.segmentos) {
      const valorReal = serie((m) => b.pegaValor(cel(m, seg)));
      const ctrReal = serie((m) => b.pegaCtr(cel(m, seg)));
      const aovReal = Array.from({ length: 12 }, (_, i) => {
        const v = valorReal[i], n = ctrReal[i];
        return v === null || n === null || !n ? null : v / n;
      });
      const medidaAov = b.medidaValor === "vendas_mrr" ? "aov_venda_mrr" : "aov_venda_pontual";
      const medidaCtr = b.medidaValor === "vendas_mrr" ? "contratos_vendidos_mrr" : "contratos_vendidos_pontual";
      linhas.push(fazLinha(`${b.medidaValor}_${SLUG[seg]}`, `${seg} — ${b.grupo === "Recorrente" ? "MRR" : "Pontual"}`, b.grupo, seg, "brl", valorReal, orcKey(b.medidaValor, seg)));
      linhas.push(fazLinha(`${medidaCtr}_${SLUG[seg]}`, `${seg} — Contratos`, b.grupo, seg, "int", ctrReal, orcKey(medidaCtr, seg)));
      const aovYtd = mesFechado === 0 ? undefined : {
        orcado: razao(somaOrcAte(orcKey(b.medidaValor, seg)), somaOrcAte(orcKey(medidaCtr, seg))) ?? 0,
        realizado: razao(somaAte(valorReal), somaAte(ctrReal)),
      };
      linhas.push(fazLinha(`${medidaAov}_${SLUG[seg]}`, `${seg} — AOV`, b.grupo, seg, "brl", aovReal, orcKey(medidaAov, seg), aovYtd));
    }
  }
  return linhas;
}

// ---- Drill-down: deals que compõem uma célula (segmento × mês) ----
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

export async function detalheVendaProdutoMes(
  db: any, natureza: Natureza, segmento: SegmentoBP, mes: number, modo: "valor" | "contrato"
): Promise<{ itens: ItemVendaDet[]; total: number }> {
  const { deals, prMix, mixRec, mixPont, aovRec, aovPont, meta } = await carregarAtribuicaoVendas(db);
  const itens: ItemVendaDet[] = [];
  let total = 0;
  for (const d of deals) {
    if (d.mes !== mes) continue;
    const parte = distribuirDeal(d, prMix, mixRec, mixPont, aovRec, aovPont)
      .find((p) => p.natureza === natureza && p.segmento === segmento);
    if (!parte) continue;

    const valNat = natureza === "recorrente" ? d.valorRec : d.valorPont;
    const rateado = Math.round(valNat) !== Math.round(parte.valor); // multi-produto: valor do deal foi dividido
    const md = meta.get(d.id)!;
    // produto desta célula = o(s) serviço(s) do deal que pertencem ao segmento clicado
    const servicosDoSegmento = d.ids
      .filter((id) => SERVICOS_BITRIX[id]?.segmento === segmento)
      .map((id) => SERVICOS_BITRIX[id]!.nome);
    const produtoLabel = servicosDoSegmento.length ? servicosDoSegmento.join(", ") : segmento;
    const atribuido = `R$ ${Math.round(parte.valor).toLocaleString("pt-BR")}`;
    const detalhePartes = [
      produtoLabel,                                   // produto (serviço do segmento), claro e primeiro
      modo === "contrato" ? atribuido : "",           // no modo contagem o valor vai no texto
      md.closer ? `closer ${md.closer}` : "",
      rateado ? `de deal ${natureza === "recorrente" ? "MRR" : "pontual"} R$ ${Math.round(valNat).toLocaleString("pt-BR")}` : "",
    ].filter(Boolean);

    itens.push({
      grupo: "Deals",
      nome: md.titulo,
      detalhe: detalhePartes.join(" · "),
      data: md.data,
      valor: modo === "valor" ? parte.valor : 0,
      url: `${BITRIX_BASE}/crm/deal/details/${d.id}/`,
    });
    total += modo === "valor" ? parte.valor : 1;
  }
  itens.sort((a, b) => b.valor - a.valor);
  return { itens, total };
}
