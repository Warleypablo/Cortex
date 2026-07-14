// server/routes/ceoDashboard.movimentoReceita.ts
// Fonte única do bloco "Movimento de Receita" do CEO Dashboard.
// Reusa 5 linhas de computarBpReceitas (vendas_mrr, churn_mes, vendas_pontual,
// pontual_churn, pontual_estoque_ini) e adiciona só 2 queries: cross-sell por mês
// e MRR-início por mês. A régua das 8 métricas (inclusive NRR = erosão) vive na
// função pura montarMovimentoReceita — testável sem IO.
import { sql } from "drizzle-orm";
import type { BpLinha } from "./ceoDashboard.helpers";

export interface MovimentoQueries {
  crossMrrPorMes: Record<number, number>;
  crossPontPorMes: Record<number, number>;
  mrrInicioPorMes: Record<number, number>;
}

// Cross-sell por mês (régua de buildVendasMrrQuery: source=PARTNER + cliente
// pré-existente) e MRR-início por mês (1º snapshot do mês). Ano fixo 2026.
export async function carregarMovimentoQueries(db: any): Promise<MovimentoQueries> {
  const crossMrrPorMes: Record<number, number> = {};
  const crossPontPorMes: Record<number, number> = {};
  const mrrInicioPorMes: Record<number, number> = {};

  const crossRes: any = await db.execute(sql`
    WITH cliente_inicio AS (
      SELECT REGEXP_REPLACE(COALESCE(c.cnpj,''),'[^0-9]','','g') AS cnpj_norm,
             MIN(ct.data_inicio)::date AS primeiro_contrato
      FROM "Clickup".cup_clientes c
      JOIN "Clickup".cup_contratos ct ON ct.id_task = c.task_id
      WHERE COALESCE(c.cnpj,'') <> '' GROUP BY 1
    ),
    deals AS (
      SELECT EXTRACT(MONTH FROM d.data_fechamento)::int AS mes,
        COALESCE(d.valor_recorrente::numeric,0) AS rec,
        COALESCE(d.valor_pontual::numeric,0) AS pont,
        (d.source='PARTNER' AND ci.primeiro_contrato IS NOT NULL
          AND ci.primeiro_contrato < date_trunc('month', d.data_fechamento)::date) AS is_cross
      FROM "Bitrix".crm_deal d
      LEFT JOIN cliente_inicio ci ON REGEXP_REPLACE(COALESCE(d.cnpj,''),'[^0-9]','','g') = ci.cnpj_norm
      WHERE d.stage_name='Negócio Ganho' AND d.data_fechamento IS NOT NULL
        AND EXTRACT(YEAR FROM d.data_fechamento)=2026
    )
    SELECT mes,
      COALESCE(SUM(rec) FILTER (WHERE is_cross),0) AS cross_mrr,
      COALESCE(SUM(pont) FILTER (WHERE is_cross),0) AS cross_pont
    FROM deals GROUP BY mes`);
  for (const r of crossRes.rows ?? []) {
    const mes = Number(r.mes);
    if (!mes) continue;
    crossMrrPorMes[mes] = Number(r.cross_mrr) || 0;
    crossPontPorMes[mes] = Number(r.cross_pont) || 0;
  }

  const mrrRes: any = await db.execute(sql`
    WITH meses AS (SELECT generate_series(1,12) AS mes),
    snap AS (
      SELECT m.mes,
        (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist h
         WHERE date_trunc('month', h.data_snapshot) = make_date(2026, m.mes, 1)) AS snap
      FROM meses m
    )
    SELECT s.mes, COALESCE(SUM(h.valorr::numeric),0) AS mrr_inicio
    FROM snap s
    LEFT JOIN "Clickup".cup_data_hist h
      ON h.data_snapshot = s.snap
      AND h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0
    WHERE s.snap IS NOT NULL
    GROUP BY s.mes`);
  for (const r of mrrRes.rows ?? []) {
    const mes = Number(r.mes);
    if (mes) mrrInicioPorMes[mes] = Number(r.mrr_inicio) || 0;
  }

  return { crossMrrPorMes, crossPontPorMes, mrrInicioPorMes };
}

export interface MovimentoIngredientes {
  mrrInicioPorMes: Record<number, number>;
  estoquePontIniPorMes: Record<number, number>;
  crossMrrPorMes: Record<number, number>;
  crossPontPorMes: Record<number, number>;
  churnMrrPorMes: Record<number, number>;
  churnPontualPorMes: Record<number, number>;
}
export interface MovimentoReceita {
  linhas: {
    vendaMrr: BpLinha; churnMrr: BpLinha; crossMrr: BpLinha; nrr: BpLinha;
    vendaPontual: BpLinha; churnPontual: BpLinha; crossPontual: BpLinha; nrrPontual: BpLinha;
  };
  ingredientes: MovimentoIngredientes;
}
export interface MovimentoInput {
  vendasMrr?: BpLinha; churnMes?: BpLinha; vendasPontual?: BpLinha;
  pontualChurn?: BpLinha; pontualEstoqueIni?: BpLinha;
  queries: MovimentoQueries; mesNum: number;
}

// Extrai Record<mes, number> do realizado de uma BpLinha (aplica transform opcional).
function realizadoPorMes(linha: BpLinha | undefined, transform: (v: number) => number = (v) => v): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of linha?.meses ?? []) {
    if (m.realizado != null) out[m.mes] = transform(m.realizado);
  }
  return out;
}

// Constrói uma BpLinha de série própria (sem meta): orcado 0, atingimento null.
function linhaDeSerie(metrica: string, unidade: "brl" | "pct", seriePorMes: Record<number, number | null>, mesNum: number): BpLinha {
  const meses = [];
  for (let mes = 1; mes <= mesNum; mes++) {
    const v = seriePorMes[mes];
    meses.push({ mes, orcado: 0, realizado: v ?? null, atingimento: null });
  }
  return { metrica, unidade, meses };
}

// Erosão do NRR: (churn − cross) / base × 100. Base 0/ausente → null.
function serieNrr(churn: Record<number, number>, cross: Record<number, number>, base: Record<number, number>, mesNum: number): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  for (let mes = 1; mes <= mesNum; mes++) {
    const b = base[mes];
    out[mes] = b && b > 0 ? ((churn[mes] ?? 0) - (cross[mes] ?? 0)) / b * 100 : null;
  }
  return out;
}

export function montarMovimentoReceita(input: MovimentoInput): MovimentoReceita {
  const { queries, mesNum } = input;
  const churnMrrPorMes = realizadoPorMes(input.churnMes);                    // já positivo
  const churnPontualPorMes = realizadoPorMes(input.pontualChurn, Math.abs);  // negativo → positivo
  const estoquePontIniPorMes = realizadoPorMes(input.pontualEstoqueIni);

  const nrrPorMes = serieNrr(churnMrrPorMes, queries.crossMrrPorMes, queries.mrrInicioPorMes, mesNum);
  const nrrPontualPorMes = serieNrr(churnPontualPorMes, queries.crossPontPorMes, estoquePontIniPorMes, mesNum);

  // Linha vazia como fallback quando o BP não trouxe a métrica.
  const vazia = (metrica: string): BpLinha => ({ metrica, meses: [] });

  return {
    linhas: {
      vendaMrr: input.vendasMrr ?? vazia("vendas_mrr"),
      churnMrr: input.churnMes ?? vazia("churn_mes"),
      crossMrr: linhaDeSerie("cross_mrr", "brl", queries.crossMrrPorMes, mesNum),
      nrr: linhaDeSerie("nrr", "pct", nrrPorMes, mesNum),
      vendaPontual: input.vendasPontual ?? vazia("vendas_pontual"),
      churnPontual: linhaDeSerie("churn_pontual", "brl", churnPontualPorMes, mesNum),
      crossPontual: linhaDeSerie("cross_pontual", "brl", queries.crossPontPorMes, mesNum),
      nrrPontual: linhaDeSerie("nrr_pontual", "pct", nrrPontualPorMes, mesNum),
    },
    ingredientes: {
      mrrInicioPorMes: queries.mrrInicioPorMes,
      estoquePontIniPorMes,
      crossMrrPorMes: queries.crossMrrPorMes,
      crossPontPorMes: queries.crossPontPorMes,
      churnMrrPorMes,
      churnPontualPorMes,
    },
  };
}
