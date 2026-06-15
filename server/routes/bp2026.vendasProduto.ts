// server/routes/bp2026.vendasProduto.ts
// Sub-aba Vendas por Produto: vendas MRR/Pontual, contratos e AOV por segmento BP.
// Realizado: Bitrix.crm_deal (servicos_vendidos) com valor atribuído pela cascata
// (produto único -> mix ClickUp -> AOV). Total por natureza fecha com o funil agregado.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd } from "./bp2026.helpers";
import {
  agregarVendasProduto, aovMedioPorSegmento, parseServicosVendidos,
  type DealVenda, type MixClickup,
} from "./bp2026.vendasProduto.helpers";
import {
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS, type SegmentoBP,
} from "../okr2026/servicosBitrix";

interface MesLinha { mes: number; orcado: number; realizado: number | null; atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo"; direcao: "maior_melhor";
  unidade: "brl" | "int" | "pct"; grupo: string; segmento: string;
  meses: MesLinha[]; ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const SLUG: Record<SegmentoBP, string> = {
  "Performance": "performance", "Creators": "creators", "Social": "social",
  "Gestão de Comunidade": "gc", "Others": "others",
  "E-commerce": "ecommerce", "Site Institucional": "site", "Landing Page": "landing",
};
const orcKey = (medida: string, seg: SegmentoBP) => `${medida}_${SLUG[seg]}`;

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

export async function montarVendasProduto(deps: Deps): Promise<Linha[]> {
  const { db, orcado, mesCorrente, mesFechado } = deps;

  const dealsRows = (await db.execute(sql`
    SELECT id,
           EXTRACT(MONTH FROM data_fechamento)::int AS mes,
           regexp_replace(COALESCE(cnpj,''),'\\D','','g') AS cnpj_norm,
           COALESCE(valor_recorrente::numeric,0) AS vr,
           COALESCE(valor_pontual::numeric,0) AS vp,
           servicos_vendidos
    FROM "Bitrix".crm_deal
    WHERE stage_name = 'Negócio Ganho'
      AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
      AND (COALESCE(valor_recorrente,0) > 0 OR COALESCE(valor_pontual,0) > 0)
  `)).rows as any[];

  const deals: DealVenda[] = dealsRows.map((r) => ({
    id: Number(r.id), mes: Number(r.mes),
    cnpjNorm: r.cnpj_norm && [14, 11].includes(r.cnpj_norm.length) ? r.cnpj_norm : "",
    valorRec: parseFloat(r.vr), valorPont: parseFloat(r.vp),
    ids: parseServicosVendidos(r.servicos_vendidos),
  }));

  const cnpjs = Array.from(new Set(deals.map((d) => d.cnpjNorm).filter(Boolean)));
  const mixRec: MixClickup = new Map();
  const mixPont: MixClickup = new Map();
  if (cnpjs.length) {
    const mixRows = (await db.execute(sql`
      SELECT regexp_replace(COALESCE(cc.cnpj,''),'\\D','','g') AS cnpj_norm,
             CASE
               WHEN c.produto = 'Performance' THEN 'Performance'
               WHEN c.produto IN ('Creators','Creators - Recorrente') THEN 'Creators'
               WHEN c.produto = 'Social Media' THEN 'Social'
               WHEN c.produto = 'Gestão de Comunidade' THEN 'Gestão de Comunidade'
               WHEN c.produto = 'Ecommerce' THEN 'E-commerce'
               WHEN c.produto = 'Site' THEN 'Site Institucional'
               WHEN c.produto = 'Landing Page' THEN 'Landing Page'
               ELSE 'Others'
             END AS segmento,
             COALESCE(SUM(c.valorr::numeric),0) AS rec,
             COALESCE(SUM(c.valorp::numeric),0) AS pont
      FROM "Clickup".cup_clientes cc
      JOIN "Clickup".cup_contratos c ON c.id_task = cc.task_id
      WHERE regexp_replace(COALESCE(cc.cnpj,''),'\\D','','g') = ANY(${cnpjs})
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

  const aovRec = aovMedioPorSegmento(deals, "recorrente");
  const aovPont = aovMedioPorSegmento(deals, "pontual");
  const agg = agregarVendasProduto(deals, mixRec, mixPont, aovRec, aovPont);

  const serie = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const fazLinha = (
    metrica: string, titulo: string, grupo: string, segmento: string,
    unidade: Linha["unidade"], serieReal: (number | null)[], orcadoMetrica: string
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const o = orcado[orcadoMetrica]?.[i + 1] ?? 0;
      const r = serieReal[i];
      return { mes: i + 1, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return { metrica, titulo, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade, grupo, segmento, meses, ytd };
  };

  const cel = (m: number, seg: SegmentoBP) => agg.get(m)?.get(seg);
  const linhas: Linha[] = [];

  const blocos: Array<{ grupo: string; segmentos: SegmentoBP[]; medidaValor: "vendas_mrr" | "vendas_pontual"; pegaValor: (c: any) => number; pegaCtr: (c: any) => number }> = [
    { grupo: "Recorrente", segmentos: SEGMENTOS_RECORRENTES, medidaValor: "vendas_mrr", pegaValor: (c) => c?.mrr ?? 0, pegaCtr: (c) => c?.contratosRec ?? 0 },
    { grupo: "Pontual", segmentos: SEGMENTOS_PONTUAIS, medidaValor: "vendas_pontual", pegaValor: (c) => c?.pont ?? 0, pegaCtr: (c) => c?.contratosPont ?? 0 },
  ];

  for (const b of blocos) {
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
      linhas.push(fazLinha(`${medidaAov}_${SLUG[seg]}`, `${seg} — AOV`, b.grupo, seg, "brl", aovReal, orcKey(medidaAov, seg)));
    }
  }
  return linhas;
}
