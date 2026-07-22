// server/routes/ceoDashboard.movimentoReceita.ts
// Fonte única do bloco "Movimento de Receita" do CEO Dashboard.
// Reusa 5 linhas de computarBpReceitas (vendas_mrr, churn_mes, vendas_pontual,
// pontual_churn, pontual_estoque_ini) e adiciona só 2 queries: cross-sell por mês
// e MRR-início por mês. A régua das 8 métricas (inclusive Churn % bruto) vive na
// função pura montarMovimentoReceita — testável sem IO.
import { sql } from "drizzle-orm";
import type { BpLinha } from "./ceoDashboard.helpers";
import { CHANNEL_EXPANSAO } from "../../shared/crm-channel";

export interface MovimentoQueries {
  crossMrrPorMes: Record<number, number>;
  crossPontPorMes: Record<number, number>;
  mrrInicioPorMes: Record<number, number>;
}

// Deals de expansão do mês, para o drawer das células de cross-sell. MESMO filtro da série
// mensal acima — se um mudar, mudar o outro, senão o drawer deixa de somar a célula.
export async function crosssellDealsDoMes(
  db: any, mesNum: number
): Promise<Array<{ cliente: string; closer: string; data: string | null; recorrente: number; pontual: number }>> {
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(cl.nome),''), NULLIF(d.company_name,''), d.title, 'Sem nome') AS cliente,
           COALESCE(NULLIF(TRIM(c.nome), ''), '') AS closer,
           d.data_fechamento::date::text AS data,
           COALESCE(d.valor_recorrente::numeric, 0) AS rec,
           COALESCE(d.valor_pontual::numeric, 0) AS pont
    FROM "Bitrix".crm_deal d
    LEFT JOIN "Bitrix".crm_closers c
      ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
    LEFT JOIN "Clickup".cup_clientes cl
      ON REGEXP_REPLACE(COALESCE(cl.cnpj,''),'[^0-9]','','g') = REGEXP_REPLACE(COALESCE(d.cnpj,''),'[^0-9]','','g')
      AND COALESCE(d.cnpj,'') <> ''
    WHERE d.stage_name='Negócio Ganho' AND d.data_fechamento IS NOT NULL
      AND EXTRACT(YEAR FROM d.data_fechamento)=2026
      AND EXTRACT(MONTH FROM d.data_fechamento)=${mesNum}
      AND TRIM(d.channel)=${CHANNEL_EXPANSAO}
    ORDER BY d.valor_recorrente::numeric DESC NULLS LAST`);
  return (r.rows ?? []).map((x: any) => ({
    cliente: String(x.cliente),
    closer: String(x.closer || ""),
    data: x.data ? String(x.data) : null,
    recorrente: Number(x.rec) || 0,
    pontual: Number(x.pont) || 0,
  }));
}

// Cross-sell por mês (deals ganhos marcados como expansão de conta no CRM) e MRR-início
// por mês (1º snapshot do mês). Ano fixo 2026.
//
// Régua: `channel = 'Expansão de Conta'`, a marcação que o comercial faz no deal. Substituiu
// `source='PARTNER' + CNPJ de cliente pré-existente` (2026-07-21), que zerava a linha inteira:
// PARTNER tem 1 deal em toda a base desde que o crm_deal virou espelho do Synapse. O guard de
// CNPJ era muleta para PARTNER ser proxy fraco (indicação/parceiro ≠ expansão) e foi removido —
// com marcação explícita ele só descartaria deal sem CNPJ (32 dos 106 em 2026, −51% do MRR).
// `channel='Reativação'` NÃO entra: win-back de cliente perdido não é expansão de conta ativa.
export async function carregarMovimentoQueries(db: any): Promise<MovimentoQueries> {
  const crossMrrPorMes: Record<number, number> = {};
  const crossPontPorMes: Record<number, number> = {};
  const mrrInicioPorMes: Record<number, number> = {};

  const crossRes: any = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM d.data_fechamento)::int AS mes,
      COALESCE(SUM(COALESCE(d.valor_recorrente::numeric,0)),0) AS cross_mrr,
      COALESCE(SUM(COALESCE(d.valor_pontual::numeric,0)),0) AS cross_pont
    FROM "Bitrix".crm_deal d
    WHERE d.stage_name='Negócio Ganho' AND d.data_fechamento IS NOT NULL
      AND EXTRACT(YEAR FROM d.data_fechamento)=2026
      AND TRIM(d.channel)=${CHANNEL_EXPANSAO}
    GROUP BY 1`);
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
    vendaMrr: BpLinha; churnMrr: BpLinha; crossMrr: BpLinha; churnPct: BpLinha; nrr: BpLinha;
    vendaPontual: BpLinha; churnPontual: BpLinha; crossPontual: BpLinha; churnPctPontual: BpLinha; nrrPontual: BpLinha;
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

// Churn %: churn / base × 100 (base = fechamento do mês anterior). Base 0/ausente → null.
function serieChurnPct(churn: Record<number, number>, base: Record<number, number>, mesNum: number): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  for (let mes = 1; mes <= mesNum; mes++) {
    const b = base[mes];
    out[mes] = b && b > 0 ? (churn[mes] ?? 0) / b * 100 : null;
  }
  return out;
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

  const churnPctPorMes = serieChurnPct(churnMrrPorMes, queries.mrrInicioPorMes, mesNum);
  const churnPctPontualPorMes = serieChurnPct(churnPontualPorMes, estoquePontIniPorMes, mesNum);
  const nrrPorMes = serieNrr(churnMrrPorMes, queries.crossMrrPorMes, queries.mrrInicioPorMes, mesNum);
  const nrrPontualPorMes = serieNrr(churnPontualPorMes, queries.crossPontPorMes, estoquePontIniPorMes, mesNum);

  // Linha vazia como fallback quando o BP não trouxe a métrica.
  const vazia = (metrica: string): BpLinha => ({ metrica, meses: [] });

  return {
    linhas: {
      vendaMrr: input.vendasMrr ?? vazia("vendas_mrr"),
      churnMrr: input.churnMes ?? vazia("churn_mes"),
      crossMrr: linhaDeSerie("cross_mrr", "brl", queries.crossMrrPorMes, mesNum),
      churnPct: linhaDeSerie("churn_pct", "pct", churnPctPorMes, mesNum),
      nrr: linhaDeSerie("nrr", "pct", nrrPorMes, mesNum),
      vendaPontual: input.vendasPontual ?? vazia("vendas_pontual"),
      churnPontual: linhaDeSerie("churn_pontual", "brl", churnPontualPorMes, mesNum),
      crossPontual: linhaDeSerie("cross_pontual", "brl", queries.crossPontPorMes, mesNum),
      churnPctPontual: linhaDeSerie("churn_pct_pontual", "pct", churnPctPontualPorMes, mesNum),
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
