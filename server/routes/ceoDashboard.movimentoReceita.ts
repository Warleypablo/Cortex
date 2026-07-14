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
