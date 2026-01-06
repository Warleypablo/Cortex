import { db } from "../db";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { objectiveRegistry, krRegistry, metricRegistry, type KR, type MetricSpec } from "./okrRegistry";
import manualMetrics from "./manualMetrics.json";
import initiatives from "./initiatives.json";

export interface MetricValue {
  value: number | null;
  date: string;
  formatted?: string;
}

export interface MetricSeries {
  metric_key: string;
  series: { month: string; value: number }[];
}

export interface DashboardMetrics {
  mrr_ativo: number;
  mrr_serie: { month: string; value: number }[];
  receita_total_ytd: number;
  receita_liquida_ytd: number;
  ebitda_ytd: number;
  geracao_caixa_ytd: number;
  caixa_atual: number;
  inadimplencia_valor: number;
  inadimplencia_brl: number;
  inadimplencia_percentual: number;
  gross_churn_mrr: number;
  gross_mrr_churn_percentual: number;
  net_churn_mrr: number | null;
  net_churn_mrr_percentual: number | null;
  logo_churn: number;
  logo_churn_percentual: number | null;
  clientes_ativos: number;
  clientes_inicio_mes: number;
  receita_recorrente_ytd: number | null;
  receita_pontual_ytd: number | null;
  receita_outras_ytd: number | null;
  mix_is_estimated: boolean;
  new_mrr: number;
  new_mrr_ytd: number;
  expansion_mrr: number;
  expansion_mrr_ytd: number | null;
  vendas_pontual: number;
  vendas_mrr: number;
  headcount: number;
  receita_por_head: number;
  mrr_por_head: number;
  turbooh_receita: number | null;
  turbooh_receita_liquida_ytd: number | null;
  turbooh_custos: number | null;
  turbooh_resultado: number | null;
  turbooh_resultado_ytd: number | null;
  turbooh_margem_pct: number | null;
  tech_projetos_entregues: number;
  tech_freelancers_custo: number;
  tech_projetos_valor: number;
  tech_freelancers_percentual: number;
  quarter_summary?: QuarterSummaryMetric[];
  standardization_completion_pct?: number | null;
}

export type AggregationType = "quarter_end" | "quarter_sum" | "quarter_avg" | "quarter_max" | "quarter_min";

export interface MetricResult {
  status: "ready" | "not_ready";
  value: number | null;
}

export interface QuarterAggResult {
  Q1: number | null;
  Q2: number | null;
  Q3: number | null;
  Q4: number | null;
}

export interface MetricSeriesPoint {
  date: string;
  value: number;
}

export interface QuarterSummaryMetric {
  metricKey: string;
  quarters: QuarterAggResult;
  status: "ready" | "not_ready" | "partial";
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function getQuarterTarget(krId: string): number {
  const quarter = getCurrentQuarter();
  const kr = krRegistry.find(k => k.id === krId);
  if (!kr) return 0;
  return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || kr.targets.Q4 || 0;
}

export async function getMrrAtivo(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH ultimo_snapshot AS (
        SELECT MAX(data_snapshot) as data_ultimo
        FROM cup_data_hist
      )
      SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
      FROM cup_data_hist h
      JOIN ultimo_snapshot us ON h.data_snapshot = us.data_ultimo
      WHERE status IN ('ativo', 'onboarding', 'triagem')
        AND valorr IS NOT NULL
        AND valorr > 0
    `);
    return parseFloat((result.rows[0] as any)?.mrr || "0");
  } catch (error) {
    console.error("[OKR] Error fetching MRR Ativo:", error);
    return 0;
  }
}

export async function getMrrInicioMes(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH primeiro_snapshot_mes AS (
        SELECT MIN(data_snapshot) as data_primeiro
        FROM cup_data_hist
        WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
      )
      SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
      FROM cup_data_hist h
      JOIN primeiro_snapshot_mes ps ON h.data_snapshot = ps.data_primeiro
      WHERE status IN ('ativo', 'onboarding', 'triagem')
        AND valorr IS NOT NULL
        AND valorr > 0
    `);
    return parseFloat((result.rows[0] as any)?.mrr || "0");
  } catch (error) {
    console.error("[OKR] Error fetching MRR Inicio Mes:", error);
    return 0;
  }
}

export async function getMrrSerie(): Promise<{ month: string; value: number }[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_snapshots AS (
        SELECT 
          TO_CHAR(data_snapshot, 'YYYY-MM') as month,
          MAX(data_snapshot) as last_snapshot
        FROM cup_data_hist
        WHERE data_snapshot >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(data_snapshot, 'YYYY-MM')
      )
      SELECT 
        ms.month,
        COALESCE(SUM(h.valorr::numeric), 0) as mrr
      FROM monthly_snapshots ms
      JOIN cup_data_hist h ON h.data_snapshot = ms.last_snapshot
      WHERE h.status IN ('ativo', 'onboarding', 'triagem')
        AND h.valorr IS NOT NULL
        AND h.valorr > 0
      GROUP BY ms.month
      ORDER BY ms.month
    `);
    return (result.rows as any[]).map(row => ({
      month: row.month,
      value: parseFloat(row.mrr || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching MRR serie:", error);
    return [];
  }
}

export async function getReceitaYTD(): Promise<{ 
  total: number; 
  liquida: number; 
  recorrente: number | null; 
  pontual: number | null; 
  outras: number | null;
  mix_is_estimated: boolean;
}> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as total,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND categoria_nome NOT ILIKE '%imposto%' THEN valor_pago::numeric ELSE 0 END), 0) as liquida
      FROM caz_parcelas
      WHERE EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento)) = ${currentYear}
        AND tipo_evento = 'RECEITA'
        AND status = 'QUITADO'
    `);
    
    const total = parseFloat((result.rows[0] as any)?.total || "0");
    const liquida = parseFloat((result.rows[0] as any)?.liquida || "0");
    
    return {
      total,
      liquida,
      recorrente: null,
      pontual: null,
      outras: null,
      mix_is_estimated: true
    };
  } catch (error) {
    console.error("[OKR] Error fetching Receita YTD:", error);
    return { total: 0, liquida: 0, recorrente: null, pontual: null, outras: null, mix_is_estimated: true };
  }
}

export async function getEbitdaYTD(): Promise<number> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as ebitda
      FROM caz_parcelas
      WHERE EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento)) = ${currentYear}
        AND status = 'QUITADO'
    `);
    return parseFloat((result.rows[0] as any)?.ebitda || "0");
  } catch (error) {
    console.error("[OKR] Error fetching EBITDA YTD:", error);
    return 0;
  }
}

export async function getCaixaAtual(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(balance::numeric), 0) as saldo
      FROM caz_bancos
      WHERE ativo = 'true' OR ativo = 't' OR ativo IS NULL
    `);
    return parseFloat((result.rows[0] as any)?.saldo || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Caixa:", error);
    return 0;
  }
}

export async function getInadimplenciaValor(): Promise<number> {
  try {
    // Inadimplência = faturas RECEITA com vencimento do dia 01 do mês até ontem
    // que ainda têm valor não pago (nao_pago > 0)
    // Mesma lógica do /api/inadimplencia/resumo
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(nao_pago::numeric), 0) as valor_inadimplente
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento >= date_trunc('month', CURRENT_DATE)
        AND data_vencimento < CURRENT_DATE
        AND nao_pago::numeric > 0
    `);
    return parseFloat((result.rows[0] as any)?.valor_inadimplente || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Inadimplência Valor:", error);
    return 0;
  }
}

export async function getInadimplenciaPct(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH inadimplente AS (
        SELECT COALESCE(SUM(nao_pago::numeric), 0) as valor_inadimplente
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= date_trunc('month', CURRENT_DATE)
          AND data_vencimento < CURRENT_DATE
          AND nao_pago::numeric > 0
      ),
      receita_mes AS (
        SELECT COALESCE(SUM(valor_bruto::numeric), 0) as receita_total
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= date_trunc('month', CURRENT_DATE)
          AND data_vencimento <= CURRENT_DATE
      )
      SELECT 
        CASE WHEN r.receita_total > 0 
          THEN (i.valor_inadimplente / r.receita_total) * 100 
          ELSE 0 
        END as percentual
      FROM inadimplente i, receita_mes r
    `);
    return parseFloat((result.rows[0] as any)?.percentual || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Inadimplência Pct:", error);
    return 0;
  }
}

export async function getInadimplencia(): Promise<{ valor: number; percentual: number }> {
  const [valor, percentual] = await Promise.all([
    getInadimplenciaValor(),
    getInadimplenciaPct()
  ]);
  return { valor, percentual };
}

export async function getGrossChurnMrr(): Promise<number> {
  try {
    // Churn = contratos com data_solicitacao_encerramento no mês atual
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valorr::numeric), 0) as churn_mrr
      FROM cup_contratos
      WHERE valorr IS NOT NULL
        AND valorr::numeric > 0
        AND data_solicitacao_encerramento IS NOT NULL 
        AND TO_CHAR(data_solicitacao_encerramento::date, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
    `);
    return parseFloat((result.rows[0] as any)?.churn_mrr || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Gross Churn MRR:", error);
    return 0;
  }
}

export async function getGrossChurnPct(grossChurn?: number, mrrInicioMes?: number): Promise<number> {
  try {
    const gross = grossChurn ?? await getGrossChurnMrr();
    const mrrInicio = mrrInicioMes ?? await getMrrInicioMes();
    
    if (mrrInicio === 0) return 0;
    return (gross / mrrInicio) * 100;
  } catch (error) {
    console.error("[OKR] Error calculating Gross Churn Pct:", error);
    return 0;
  }
}

export async function getExpansionMrr(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH mes_atual AS (
        SELECT 
          id_task,
          id_subtask,
          valorr::numeric as valorr_atual
        FROM cup_data_hist
        WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
          AND status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL
          AND valorr > 0
      ),
      mes_anterior AS (
        SELECT 
          id_task,
          id_subtask,
          valorr::numeric as valorr_anterior
        FROM cup_data_hist
        WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM')
          AND status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL
          AND valorr > 0
      )
      SELECT COALESCE(SUM(
        CASE 
          WHEN ma.valorr_atual > ant.valorr_anterior 
          THEN ma.valorr_atual - ant.valorr_anterior 
          ELSE 0 
        END
      ), 0) as expansion_mrr
      FROM mes_atual ma
      JOIN mes_anterior ant ON ma.id_subtask = ant.id_subtask
    `);
    return parseFloat((result.rows[0] as any)?.expansion_mrr || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Expansion MRR:", error);
    return 0;
  }
}

export async function getNetChurnMrr(grossChurn?: number, expansionMrr?: number): Promise<number> {
  try {
    const gross = grossChurn ?? await getGrossChurnMrr();
    const expansion = expansionMrr ?? await getExpansionMrr();
    return gross - expansion;
  } catch (error) {
    console.error("[OKR] Error calculating Net Churn MRR:", error);
    return 0;
  }
}

export async function getNetChurnPct(netChurn?: number, mrrInicioMes?: number): Promise<number> {
  try {
    const net = netChurn ?? await getNetChurnMrr();
    const mrrInicio = mrrInicioMes ?? await getMrrInicioMes();
    
    if (mrrInicio === 0) return 0;
    return (net / mrrInicio) * 100;
  } catch (error) {
    console.error("[OKR] Error calculating Net Churn Pct:", error);
    return 0;
  }
}

export async function getLogoChurn(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH clientes_cancelados AS (
        SELECT DISTINCT c.id_task
        FROM cup_contratos c
        WHERE c.status = 'cancelado'
          AND c.data_encerramento IS NOT NULL
          AND TO_CHAR(c.data_encerramento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
      ),
      clientes_ainda_ativos AS (
        SELECT DISTINCT id_task
        FROM cup_contratos
        WHERE status IN ('ativo', 'onboarding', 'triagem')
      )
      SELECT COUNT(DISTINCT cc.id_task) as logo_churn
      FROM clientes_cancelados cc
      WHERE cc.id_task NOT IN (SELECT id_task FROM clientes_ainda_ativos WHERE id_task IS NOT NULL)
    `);
    return parseInt((result.rows[0] as any)?.logo_churn || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Logo Churn:", error);
    return 0;
  }
}

export async function getClientesInicioMes(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH primeiro_snapshot_mes AS (
        SELECT MIN(data_snapshot) as data_primeiro
        FROM cup_data_hist
        WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
      )
      SELECT COUNT(DISTINCT h.id_task) as total
      FROM cup_data_hist h
      JOIN primeiro_snapshot_mes ps ON h.data_snapshot = ps.data_primeiro
      WHERE h.status IN ('ativo', 'onboarding', 'triagem')
    `);
    return parseInt((result.rows[0] as any)?.total || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Clientes Inicio Mes:", error);
    return 0;
  }
}

export async function getLogoChurnPct(logoChurn?: number, clientesInicioMes?: number): Promise<number> {
  try {
    const logos = logoChurn ?? await getLogoChurn();
    const clientes = clientesInicioMes ?? await getClientesInicioMes();
    
    if (clientes === 0) return 0;
    return (logos / clientes) * 100;
  } catch (error) {
    console.error("[OKR] Error calculating Logo Churn Pct:", error);
    return 0;
  }
}

export async function getChurnMRR(): Promise<{ 
  gross: number; 
  grossPercentual: number; 
  net: number; 
  netPercentual: number;
  logoChurn: number;
  logoChurnPct: number;
}> {
  try {
    const [grossChurn, mrrInicioMes, expansionMrr, logoChurn, clientesInicioMes] = await Promise.all([
      getGrossChurnMrr(),
      getMrrInicioMes(),
      getExpansionMrr(),
      getLogoChurn(),
      getClientesInicioMes()
    ]);
    
    const grossPercentual = await getGrossChurnPct(grossChurn, mrrInicioMes);
    const netChurn = await getNetChurnMrr(grossChurn, expansionMrr);
    const netPercentual = await getNetChurnPct(netChurn, mrrInicioMes);
    const logoChurnPct = await getLogoChurnPct(logoChurn, clientesInicioMes);
    
    return {
      gross: grossChurn,
      grossPercentual,
      net: netChurn,
      netPercentual,
      logoChurn,
      logoChurnPct
    };
  } catch (error) {
    console.error("[OKR] Error fetching Churn MRR:", error);
    return { gross: 0, grossPercentual: 0, net: 0, netPercentual: 0, logoChurn: 0, logoChurnPct: 0 };
  }
}

export async function getClientesAtivos(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT id_task) as total
      FROM cup_contratos
      WHERE status IN ('ativo', 'onboarding', 'triagem')
    `);
    return parseInt((result.rows[0] as any)?.total || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Clientes Ativos:", error);
    return 0;
  }
}

export async function getHeadcount(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM rh_pessoal
      WHERE status = 'Ativo'
    `);
    return parseInt((result.rows[0] as any)?.total || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Headcount:", error);
    return 0;
  }
}

export async function getNewMrr(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH novos_clientes AS (
        SELECT DISTINCT id_task
        FROM cup_contratos
        WHERE data_inicio IS NOT NULL
          AND TO_CHAR(data_inicio, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
          AND status IN ('ativo', 'onboarding', 'triagem')
      ),
      clientes_existentes AS (
        SELECT DISTINCT id_task
        FROM cup_data_hist
        WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM')
          AND status IN ('ativo', 'onboarding', 'triagem')
      )
      SELECT COALESCE(SUM(c.valorr::numeric), 0) as new_mrr
      FROM cup_contratos c
      JOIN novos_clientes nc ON c.id_task = nc.id_task
      WHERE c.status IN ('ativo', 'onboarding', 'triagem')
        AND c.valorr IS NOT NULL
        AND c.valorr > 0
        AND c.id_task NOT IN (SELECT id_task FROM clientes_existentes WHERE id_task IS NOT NULL)
    `);
    return parseFloat((result.rows[0] as any)?.new_mrr || "0");
  } catch (error) {
    console.error("[OKR] Error fetching New MRR:", error);
    return 0;
  }
}

export async function getNewMrrYTD(): Promise<number> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valorr::numeric), 0) as new_mrr_ytd
      FROM cup_contratos
      WHERE data_inicio IS NOT NULL
        AND EXTRACT(YEAR FROM data_inicio) = ${currentYear}
        AND status IN ('ativo', 'onboarding', 'triagem')
        AND valorr IS NOT NULL
        AND valorr > 0
    `);
    return parseFloat((result.rows[0] as any)?.new_mrr_ytd || "0");
  } catch (error) {
    console.error("[OKR] Error fetching New MRR YTD:", error);
    return 0;
  }
}

export async function getVendasPontual(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valorp::numeric), 0) as vendas_pontual
      FROM cup_contratos
      WHERE data_inicio IS NOT NULL
        AND TO_CHAR(data_inicio, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        AND valorp IS NOT NULL
        AND valorp > 0
    `);
    return parseFloat((result.rows[0] as any)?.vendas_pontual || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Vendas Pontual:", error);
    return 0;
  }
}

export async function getVendasMrr(): Promise<number> {
  try {
    // Vendas MRR = soma de valor_recorrente de deals com stage_name = 'Negócio Ganho' fechados no mês atual
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valor_recorrente::numeric), 0) as vendas_mrr
      FROM crm_deal
      WHERE stage_name = 'Negócio Ganho'
        AND data_fechamento IS NOT NULL
        AND TO_CHAR(data_fechamento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        AND valor_recorrente IS NOT NULL
        AND valor_recorrente > 0
    `);
    return parseFloat((result.rows[0] as any)?.vendas_mrr || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Vendas MRR:", error);
    return 0;
  }
}

export async function getGeracaoCaixa(): Promise<number> {
  try {
    // Geração de Caixa = Receitas - Despesas do mês atual (status QUITADO)
    // Mesma lógica do "Resultado do Mês" em getFinanceiroKPIsCompletos
    const result = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as geracao_caixa
      FROM caz_parcelas
      WHERE TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        AND status = 'QUITADO'
    `);
    return parseFloat((result.rows[0] as any)?.geracao_caixa || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Geração de Caixa:", error);
    return 0;
  }
}

export async function getTurboohReceita(): Promise<number | null> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as receita
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND status = 'QUITADO'
        AND EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento)) = ${currentYear}
        AND (
          categoria_nome ILIKE '%oh%' 
          OR categoria_nome ILIKE '%turbo oh%'
          OR categoria_nome ILIKE '%turbooh%'
          OR categoria_nome ILIKE '%outdoor%'
        )
    `);
    return parseFloat((result.rows[0] as any)?.receita || "0");
  } catch (error) {
    console.error("[OKR] Error fetching TurboOH Receita:", error);
    return null;
  }
}

export async function getTurboohCustos(): Promise<number | null> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as custos
      FROM caz_parcelas
      WHERE tipo_evento = 'DESPESA'
        AND status = 'QUITADO'
        AND EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento)) = ${currentYear}
        AND (
          categoria_nome ILIKE '%oh%' 
          OR categoria_nome ILIKE '%turbo oh%'
          OR categoria_nome ILIKE '%turbooh%'
          OR categoria_nome ILIKE '%outdoor%'
        )
    `);
    return parseFloat((result.rows[0] as any)?.custos || "0");
  } catch (error) {
    console.error("[OKR] Error fetching TurboOH Custos:", error);
    return null;
  }
}

export async function getTurboohResultado(): Promise<number | null> {
  try {
    const [receita, custos] = await Promise.all([
      getTurboohReceita(),
      getTurboohCustos()
    ]);
    
    if (receita === null || custos === null) return null;
    return receita - custos;
  } catch (error) {
    console.error("[OKR] Error calculating TurboOH Resultado:", error);
    return null;
  }
}

export async function getTurboohMargemPct(): Promise<number | null> {
  try {
    const [receita, resultado] = await Promise.all([
      getTurboohReceita(),
      getTurboohResultado()
    ]);
    
    if (receita === null || resultado === null || receita === 0) return null;
    return (resultado / receita) * 100;
  } catch (error) {
    console.error("[OKR] Error calculating TurboOH Margem:", error);
    return null;
  }
}

export async function getTechProjetosEntregues(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM cup_contratos
      WHERE servico ILIKE '%tech%'
        AND status = 'concluido'
        AND EXTRACT(YEAR FROM data_encerramento) = EXTRACT(YEAR FROM NOW())
    `);
    const dbCount = parseInt((result.rows[0] as any)?.total || "0");
    
    if (dbCount > 0) return dbCount;
    
    const manual = (manualMetrics as any)?.tech_projetos_entregues;
    return manual?.value || 0;
  } catch (error) {
    console.error("[OKR] Error fetching Tech Projetos Entregues:", error);
    const manual = (manualMetrics as any)?.tech_projetos_entregues;
    return manual?.value || 0;
  }
}

export async function getTechFreelancersCusto(): Promise<number> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as custo
      FROM caz_parcelas
      WHERE tipo_evento = 'DESPESA'
        AND status = 'QUITADO'
        AND EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento)) = ${currentYear}
        AND (
          categoria_nome ILIKE '%freelancer%'
          OR categoria_nome ILIKE '%freela%'
          OR descricao ILIKE '%freelancer%'
          OR descricao ILIKE '%freela%'
        )
        AND (
          categoria_nome ILIKE '%tech%'
          OR categoria_nome ILIKE '%desenvolvimento%'
          OR categoria_nome ILIKE '%dev%'
          OR descricao ILIKE '%tech%'
          OR descricao ILIKE '%desenvolvimento%'
        )
    `);
    const dbValue = parseFloat((result.rows[0] as any)?.custo || "0");
    
    if (dbValue > 0) return dbValue;
    
    const manual = (manualMetrics as any)?.tech_freelancers_custo;
    return manual?.value || 0;
  } catch (error) {
    console.error("[OKR] Error fetching Tech Freelancers Custo:", error);
    const manual = (manualMetrics as any)?.tech_freelancers_custo;
    return manual?.value || 0;
  }
}

export async function getTechProjetosValor(): Promise<number> {
  try {
    const currentYear = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(COALESCE(valorr::numeric, 0) + COALESCE(valorp::numeric, 0)), 0) as valor
      FROM cup_contratos
      WHERE servico ILIKE '%tech%'
        AND EXTRACT(YEAR FROM data_inicio) = ${currentYear}
    `);
    const dbValue = parseFloat((result.rows[0] as any)?.valor || "0");
    
    if (dbValue > 0) return dbValue;
    
    const manual = (manualMetrics as any)?.tech_projetos_valor;
    return manual?.value || 0;
  } catch (error) {
    console.error("[OKR] Error fetching Tech Projetos Valor:", error);
    const manual = (manualMetrics as any)?.tech_projetos_valor;
    return manual?.value || 0;
  }
}

export async function getTechFreelancersPct(): Promise<number> {
  try {
    const [freelancersCusto, projetosValor] = await Promise.all([
      getTechFreelancersCusto(),
      getTechProjetosValor()
    ]);
    
    if (projetosValor === 0) return 0;
    return (freelancersCusto / projetosValor) * 100;
  } catch (error) {
    console.error("[OKR] Error calculating Tech Freelancers Pct:", error);
    return 0;
  }
}

function getQuarterMonths(quarter: "Q1" | "Q2" | "Q3" | "Q4"): number[] {
  switch (quarter) {
    case "Q1": return [1, 2, 3];
    case "Q2": return [4, 5, 6];
    case "Q3": return [7, 8, 9];
    case "Q4": return [10, 11, 12];
  }
}

function getQuarterEndMonth(quarter: "Q1" | "Q2" | "Q3" | "Q4"): number {
  switch (quarter) {
    case "Q1": return 3;
    case "Q2": return 6;
    case "Q3": return 9;
    case "Q4": return 12;
  }
}

export function getStandardizationCompletionPct(): MetricResult {
  try {
    const initList = (initiatives as any).initiatives || [];
    const standardizationInitiatives = initList.filter((init: any) => 
      init.type === "capability" || 
      init.name?.toLowerCase().includes("padroniza") ||
      init.name?.toLowerCase().includes("standardiz")
    );
    
    if (standardizationInitiatives.length === 0) {
      return { status: "not_ready", value: null };
    }
    
    const completed = standardizationInitiatives.filter((init: any) => 
      init.status === "done" || init.status === "completed"
    ).length;
    
    const pct = (completed / standardizationInitiatives.length) * 100;
    return { status: "ready", value: pct };
  } catch (error) {
    console.error("[OKR] Error calculating Standardization Completion:", error);
    return { status: "not_ready", value: null };
  }
}

async function getMrrSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_snapshots AS (
        SELECT 
          TO_CHAR(data_snapshot, 'YYYY-MM') as month,
          MAX(data_snapshot) as last_snapshot
        FROM cup_data_hist
        WHERE data_snapshot >= ${startDate}::date 
          AND data_snapshot <= ${endDate}::date
        GROUP BY TO_CHAR(data_snapshot, 'YYYY-MM')
      )
      SELECT 
        ms.month as date,
        COALESCE(SUM(h.valorr::numeric), 0) as value
      FROM monthly_snapshots ms
      JOIN cup_data_hist h ON h.data_snapshot = ms.last_snapshot
      WHERE h.status IN ('ativo', 'onboarding', 'triagem')
        AND h.valorr IS NOT NULL
        AND h.valorr > 0
      GROUP BY ms.month
      ORDER BY ms.month
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching MRR series for range:", error);
    return [];
  }
}

async function getRevenueSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
        COALESCE(SUM(valor_pago::numeric), 0) as value
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
        AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
        AND tipo_evento = 'RECEITA'
        AND status = 'QUITADO'
      GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Revenue series for range:", error);
    return [];
  }
}

async function getActiveCustomersSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_snapshots AS (
        SELECT 
          TO_CHAR(data_snapshot, 'YYYY-MM') as month,
          MAX(data_snapshot) as last_snapshot
        FROM cup_data_hist
        WHERE data_snapshot >= ${startDate}::date 
          AND data_snapshot <= ${endDate}::date
        GROUP BY TO_CHAR(data_snapshot, 'YYYY-MM')
      )
      SELECT 
        ms.month as date,
        COUNT(DISTINCT h.id_task) as value
      FROM monthly_snapshots ms
      JOIN cup_data_hist h ON h.data_snapshot = ms.last_snapshot
      WHERE h.status IN ('ativo', 'onboarding', 'triagem')
      GROUP BY ms.month
      ORDER BY ms.month
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseInt(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Active Customers series for range:", error);
    return [];
  }
}

async function getEbitdaSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as value
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
        AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
        AND status = 'QUITADO'
      GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching EBITDA series for range:", error);
    return [];
  }
}

async function getChurnSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(data_encerramento, 'YYYY-MM') as date,
        COALESCE(SUM(valorr::numeric), 0) as value
      FROM cup_contratos
      WHERE status = 'cancelado'
        AND data_encerramento IS NOT NULL
        AND data_encerramento >= ${startDate}::date 
        AND data_encerramento <= ${endDate}::date
        AND valorr IS NOT NULL
        AND valorr > 0
      GROUP BY TO_CHAR(data_encerramento, 'YYYY-MM')
      ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Churn series for range:", error);
    return [];
  }
}

async function getTurboohRevenueSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
        COALESCE(SUM(valor_pago::numeric), 0) as value
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
        AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
        AND tipo_evento = 'RECEITA'
        AND status = 'QUITADO'
        AND (
          categoria_nome ILIKE '%oh%' 
          OR categoria_nome ILIKE '%turbo oh%'
          OR categoria_nome ILIKE '%turbooh%'
          OR categoria_nome ILIKE '%outdoor%'
        )
      GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching TurboOH Revenue series for range:", error);
    return [];
  }
}

async function getNewMrrSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(data_inicio, 'YYYY-MM') as date,
        COALESCE(SUM(valorr::numeric), 0) as value
      FROM cup_contratos
      WHERE data_inicio >= ${startDate}::date 
        AND data_inicio <= ${endDate}::date
        AND status IN ('ativo', 'onboarding', 'triagem')
        AND valorr IS NOT NULL
        AND valorr > 0
      GROUP BY TO_CHAR(data_inicio, 'YYYY-MM')
      ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching New MRR series for range:", error);
    return [];
  }
}

async function getInadimplenciaSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_inad AS (
        SELECT 
          TO_CHAR(data_vencimento, 'YYYY-MM') as date,
          COALESCE(SUM(nao_pago::numeric + COALESCE(perda::numeric, 0)), 0) as valor_inadimplente
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND status NOT IN ('QUITADO', 'PERDIDO')
          AND data_vencimento < NOW()
          AND data_vencimento >= ${startDate}::date 
          AND data_vencimento <= ${endDate}::date
        GROUP BY TO_CHAR(data_vencimento, 'YYYY-MM')
      ),
      monthly_receita AS (
        SELECT 
          TO_CHAR(data_vencimento, 'YYYY-MM') as date,
          COALESCE(SUM(valor_bruto::numeric), 0) as receita_total
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= ${startDate}::date 
          AND data_vencimento <= ${endDate}::date
        GROUP BY TO_CHAR(data_vencimento, 'YYYY-MM')
      )
      SELECT 
        mr.date,
        CASE WHEN mr.receita_total > 0 
          THEN COALESCE((mi.valor_inadimplente / mr.receita_total) * 100, 0)
          ELSE 0 
        END as value
      FROM monthly_receita mr
      LEFT JOIN monthly_inad mi ON mr.date = mi.date
      ORDER BY mr.date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Inadimplencia series for range:", error);
    return [];
  }
}

async function getCashBalanceSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE -valor_pago::numeric END), 0) as value
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
        AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
        AND status = 'QUITADO'
      GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ORDER BY date
    `);
    let runningBalance = 0;
    return (result.rows as any[]).map(row => {
      runningBalance += parseFloat(row.value || "0");
      return {
        date: row.date,
        value: runningBalance
      };
    });
  } catch (error) {
    console.error("[OKR] Error fetching Cash Balance series for range:", error);
    return [];
  }
}

async function getTurboohResultSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as value
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
        AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
        AND status = 'QUITADO'
        AND (
          categoria_nome ILIKE '%oh%' 
          OR categoria_nome ILIKE '%turbo oh%'
          OR categoria_nome ILIKE '%turbooh%'
          OR categoria_nome ILIKE '%outdoor%'
        )
      GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching TurboOH Result series for range:", error);
    return [];
  }
}

async function getExpansionMrrSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_data AS (
        SELECT DISTINCT ON (id_subtask, TO_CHAR(data_snapshot, 'YYYY-MM'))
          id_subtask,
          TO_CHAR(data_snapshot, 'YYYY-MM') as month,
          valorr::numeric as valorr,
          status
        FROM cup_data_hist
        WHERE data_snapshot >= ${startDate}::date 
          AND data_snapshot <= ${endDate}::date
          AND status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL
          AND valorr > 0
        ORDER BY id_subtask, TO_CHAR(data_snapshot, 'YYYY-MM'), data_snapshot DESC
      ),
      expansion_calc AS (
        SELECT 
          curr.month as date,
          COALESCE(SUM(
            CASE 
              WHEN curr.valorr > prev.valorr 
              THEN curr.valorr - prev.valorr 
              ELSE 0 
            END
          ), 0) as value
        FROM monthly_data curr
        JOIN monthly_data prev ON curr.id_subtask = prev.id_subtask
          AND prev.month = TO_CHAR((curr.month || '-01')::date - INTERVAL '1 month', 'YYYY-MM')
        GROUP BY curr.month
      )
      SELECT date, value FROM expansion_calc ORDER BY date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Expansion MRR series for range:", error);
    return [];
  }
}

async function getSgaPctSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_sga AS (
        SELECT 
          TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
          COALESCE(SUM(valor_pago::numeric), 0) as sga_total
        FROM caz_parcelas
        WHERE tipo_evento = 'DESPESA'
          AND status = 'QUITADO'
          AND COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
          AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
          AND (
            categoria_nome ILIKE '%administrativ%'
            OR categoria_nome ILIKE '%admin%'
            OR categoria_nome ILIKE '%geral%'
            OR categoria_nome ILIKE '%despesas gerais%'
            OR categoria_nome ILIKE '%escritório%'
            OR categoria_nome ILIKE '%office%'
            OR categoria_nome ILIKE '%aluguel%'
            OR categoria_nome ILIKE '%utilities%'
            OR categoria_nome ILIKE '%telefone%'
            OR categoria_nome ILIKE '%internet%'
          )
        GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ),
      monthly_receita AS (
        SELECT 
          TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
          COALESCE(SUM(valor_pago::numeric), 0) as receita_total
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND status = 'QUITADO'
          AND COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
          AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
        GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      )
      SELECT 
        mr.date,
        CASE WHEN mr.receita_total > 0 
          THEN COALESCE((ms.sga_total / mr.receita_total) * 100, 0)
          ELSE 0 
        END as value
      FROM monthly_receita mr
      LEFT JOIN monthly_sga ms ON mr.date = ms.date
      ORDER BY mr.date
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching SG&A Pct series for range:", error);
    return [];
  }
}

async function getCacPctSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_cac AS (
        SELECT 
          TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as date,
          COALESCE(SUM(valor_pago::numeric), 0) as cac_total
        FROM caz_parcelas
        WHERE tipo_evento = 'DESPESA'
          AND status = 'QUITADO'
          AND COALESCE(data_quitacao, data_vencimento) >= ${startDate}::date 
          AND COALESCE(data_quitacao, data_vencimento) <= ${endDate}::date
          AND (
            categoria_nome ILIKE '%marketing%'
            OR categoria_nome ILIKE '%publicidade%'
            OR categoria_nome ILIKE '%propaganda%'
            OR categoria_nome ILIKE '%mídia%'
            OR categoria_nome ILIKE '%midia%'
            OR categoria_nome ILIKE '%media%'
            OR categoria_nome ILIKE '%ads%'
            OR categoria_nome ILIKE '%google%'
            OR categoria_nome ILIKE '%facebook%'
            OR categoria_nome ILIKE '%meta%'
            OR categoria_nome ILIKE '%instagram%'
            OR categoria_nome ILIKE '%tiktok%'
            OR categoria_nome ILIKE '%linkedin%'
            OR categoria_nome ILIKE '%vendas%'
            OR categoria_nome ILIKE '%comercial%'
            OR categoria_nome ILIKE '%sales%'
            OR categoria_nome ILIKE '%growth%'
            OR categoria_nome ILIKE '%aquisição%'
            OR categoria_nome ILIKE '%aquisicao%'
            OR categoria_nome ILIKE '%acquisition%'
            OR categoria_nome ILIKE '%tráfego%'
            OR categoria_nome ILIKE '%trafego%'
            OR categoria_nome ILIKE '%traffic%'
            OR categoria_nome ILIKE '%lead%'
            OR categoria_nome ILIKE '%sdr%'
            OR categoria_nome ILIKE '%closer%'
            OR categoria_nome ILIKE '%comissão%'
            OR categoria_nome ILIKE '%comissao%'
            OR categoria_nome ILIKE '%commission%'
            OR categoria_nome ILIKE '%campanha%'
            OR categoria_nome ILIKE '%campaign%'
            OR categoria_nome ILIKE '%anúncio%'
            OR categoria_nome ILIKE '%anuncio%'
            OR categoria_nome ILIKE '%patrocinado%'
            OR categoria_nome ILIKE '%sponsored%'
          )
        GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ),
      monthly_new_mrr AS (
        SELECT 
          TO_CHAR(data_inicio, 'YYYY-MM') as date,
          COALESCE(SUM(valorr::numeric), 0) as new_mrr
        FROM cup_contratos
        WHERE data_inicio >= ${startDate}::date 
          AND data_inicio <= ${endDate}::date
          AND status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL
          AND valorr > 0
        GROUP BY TO_CHAR(data_inicio, 'YYYY-MM')
      ),
      all_months AS (
        SELECT DISTINCT date FROM monthly_new_mrr
        UNION
        SELECT DISTINCT date FROM monthly_cac
      )
      SELECT 
        am.date,
        CASE WHEN COALESCE(mn.new_mrr, 0) > 0 
          THEN COALESCE((COALESCE(mc.cac_total, 0) / mn.new_mrr) * 100, 0)
          ELSE 0 
        END as value
      FROM all_months am
      LEFT JOIN monthly_cac mc ON am.date = mc.date
      LEFT JOIN monthly_new_mrr mn ON am.date = mn.date
      ORDER BY am.date
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) {
      console.warn("[OKR] CAC% series returned no data - no matching expense categories found. Check categoria_nome values in caz_parcelas.");
    } else {
      const nonZeroCount = rows.filter(r => parseFloat(r.value || "0") > 0).length;
      if (nonZeroCount === 0) {
        console.warn("[OKR] CAC% series has all zero values - marketing/sales expenses may not be categorized correctly.");
      }
    }
    return rows.map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching CAC Pct series for range:", error);
    return [];
  }
}

async function getNetMrrChurnPctSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH all_months AS (
        SELECT DISTINCT TO_CHAR(data_snapshot, 'YYYY-MM') as month
        FROM cup_data_hist
        WHERE data_snapshot >= ${startDate}::date 
          AND data_snapshot <= ${endDate}::date
      ),
      prior_month_mrr AS (
        SELECT 
          am.month as current_month,
          TO_CHAR((am.month || '-01')::date - INTERVAL '1 month', 'YYYY-MM') as prior_month
        FROM all_months am
      ),
      monthly_snapshots AS (
        SELECT 
          TO_CHAR(data_snapshot, 'YYYY-MM') as month,
          MAX(data_snapshot) as last_snapshot
        FROM cup_data_hist
        WHERE data_snapshot >= (${startDate}::date - INTERVAL '1 month')
          AND data_snapshot <= ${endDate}::date
        GROUP BY TO_CHAR(data_snapshot, 'YYYY-MM')
      ),
      mrr_by_customer AS (
        SELECT 
          ms.month,
          h.id_subtask,
          COALESCE(MAX(h.valorr::numeric), 0) as valorr
        FROM monthly_snapshots ms
        JOIN cup_data_hist h ON h.data_snapshot = ms.last_snapshot
        WHERE h.status IN ('ativo', 'onboarding', 'triagem')
          AND h.valorr IS NOT NULL
          AND h.valorr > 0
        GROUP BY ms.month, h.id_subtask
      ),
      mrr_beginning AS (
        SELECT 
          pm.current_month as month,
          COALESCE(SUM(mbc.valorr), 0) as mrr_inicio
        FROM prior_month_mrr pm
        LEFT JOIN mrr_by_customer mbc ON mbc.month = pm.prior_month
        GROUP BY pm.current_month
      ),
      churn_by_month AS (
        SELECT 
          TO_CHAR(data_encerramento, 'YYYY-MM') as month,
          COALESCE(SUM(valorr::numeric), 0) as churn_mrr
        FROM cup_contratos
        WHERE status = 'cancelado'
          AND data_encerramento IS NOT NULL
          AND data_encerramento >= ${startDate}::date 
          AND data_encerramento <= ${endDate}::date
          AND valorr IS NOT NULL
          AND valorr > 0
        GROUP BY TO_CHAR(data_encerramento, 'YYYY-MM')
      ),
      expansion_calc AS (
        SELECT 
          curr.month as month,
          COALESCE(SUM(
            CASE 
              WHEN curr.valorr > COALESCE(prev.valorr, 0) 
              THEN curr.valorr - COALESCE(prev.valorr, 0)
              ELSE 0 
            END
          ), 0) as expansion_mrr
        FROM mrr_by_customer curr
        LEFT JOIN mrr_by_customer prev ON curr.id_subtask = prev.id_subtask
          AND prev.month = TO_CHAR((curr.month || '-01')::date - INTERVAL '1 month', 'YYYY-MM')
        WHERE curr.month >= TO_CHAR(${startDate}::date, 'YYYY-MM')
        GROUP BY curr.month
      )
      SELECT 
        mb.month as date,
        CASE WHEN mb.mrr_inicio > 0 
          THEN ((COALESCE(cb.churn_mrr, 0) - COALESCE(ec.expansion_mrr, 0)) / mb.mrr_inicio) * 100
          ELSE NULL
        END as value
      FROM mrr_beginning mb
      LEFT JOIN churn_by_month cb ON mb.month = cb.month
      LEFT JOIN expansion_calc ec ON mb.month = ec.month
      WHERE mb.mrr_inicio > 0
      ORDER BY mb.month
    `);
    const rows = (result.rows as any[]).filter(row => row.value !== null);
    if (rows.length === 0) {
      console.warn("[OKR] Net MRR Churn series returned no valid data - check cup_data_hist snapshots");
    }
    return rows.map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Net MRR Churn Pct series for range:", error);
    return [];
  }
}

async function getLogoChurnPctSeriesForRange(startDate: string, endDate: string): Promise<MetricSeriesPoint[]> {
  try {
    const result = await db.execute(sql`
      WITH monthly_clients_inicio AS (
        SELECT DISTINCT ON (TO_CHAR(data_snapshot, 'YYYY-MM'))
          TO_CHAR(data_snapshot, 'YYYY-MM') as month,
          data_snapshot
        FROM cup_data_hist
        WHERE data_snapshot >= ${startDate}::date 
          AND data_snapshot <= ${endDate}::date
        ORDER BY TO_CHAR(data_snapshot, 'YYYY-MM'), data_snapshot ASC
      ),
      clients_inicio_count AS (
        SELECT 
          mi.month,
          COUNT(DISTINCT h.id_task) as clientes_inicio
        FROM monthly_clients_inicio mi
        JOIN cup_data_hist h ON h.data_snapshot = mi.data_snapshot
        WHERE h.status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY mi.month
      ),
      monthly_logo_churn AS (
        SELECT 
          TO_CHAR(data_encerramento, 'YYYY-MM') as date,
          COUNT(DISTINCT id_task) as logos_churned
        FROM cup_contratos
        WHERE status = 'cancelado'
          AND data_encerramento IS NOT NULL
          AND data_encerramento >= ${startDate}::date 
          AND data_encerramento <= ${endDate}::date
          AND id_task NOT IN (
            SELECT DISTINCT id_task 
            FROM cup_contratos 
            WHERE status IN ('ativo', 'onboarding', 'triagem')
              AND id_task IS NOT NULL
          )
        GROUP BY TO_CHAR(data_encerramento, 'YYYY-MM')
      )
      SELECT 
        ci.month as date,
        CASE WHEN ci.clientes_inicio > 0 
          THEN (COALESCE(lc.logos_churned, 0)::numeric / ci.clientes_inicio) * 100
          ELSE 0 
        END as value
      FROM clients_inicio_count ci
      LEFT JOIN monthly_logo_churn lc ON ci.month = lc.date
      ORDER BY ci.month
    `);
    return (result.rows as any[]).map(row => ({
      date: row.date,
      value: parseFloat(row.value || "0")
    }));
  } catch (error) {
    console.error("[OKR] Error fetching Logo Churn Pct series for range:", error);
    return [];
  }
}

export async function getMetricSeries(
  metricKey: string, 
  startDate: string, 
  endDate: string
): Promise<MetricSeriesPoint[]> {
  try {
    switch (metricKey) {
      case "mrr_active":
        return await getMrrSeriesForRange(startDate, endDate);
      case "revenue_total_billable":
      case "revenue_total":
      case "revenue_net":
        return await getRevenueSeriesForRange(startDate, endDate);
      case "active_customers":
      case "clients_active":
        return await getActiveCustomersSeriesForRange(startDate, endDate);
      case "ebitda":
        return await getEbitdaSeriesForRange(startDate, endDate);
      case "gross_mrr_churn_brl":
      case "gross_churn_mrr":
        return await getChurnSeriesForRange(startDate, endDate);
      case "turbooh_revenue_net":
      case "turbooh_receita":
        return await getTurboohRevenueSeriesForRange(startDate, endDate);
      case "new_mrr_sales":
      case "new_mrr":
        return await getNewMrrSeriesForRange(startDate, endDate);
      case "delinquency_pct":
      case "inadimplencia_pct":
        return await getInadimplenciaSeriesForRange(startDate, endDate);
      case "cash_balance":
      case "cash_generation":
        return await getCashBalanceSeriesForRange(startDate, endDate);
      case "turbooh_result":
      case "turbooh_resultado":
        return await getTurboohResultSeriesForRange(startDate, endDate);
      case "expansion_mrr":
        return await getExpansionMrrSeriesForRange(startDate, endDate);
      case "sga_pct":
        return await getSgaPctSeriesForRange(startDate, endDate);
      case "cac_pct":
        return await getCacPctSeriesForRange(startDate, endDate);
      case "net_mrr_churn_pct":
        return await getNetMrrChurnPctSeriesForRange(startDate, endDate);
      case "logo_churn_pct":
        return await getLogoChurnPctSeriesForRange(startDate, endDate);
      case "turbooh_vacancy_pct":
        console.warn(`[OKR] Metric ${metricKey} not yet implemented for series`);
        return [];
      default:
        console.warn(`[OKR] No series implementation for metric: ${metricKey}`);
        return [];
    }
  } catch (error) {
    console.error(`[OKR] Error fetching metric series for ${metricKey}:`, error);
    return [];
  }
}

function aggregateQuarterValues(
  values: number[], 
  aggregation: AggregationType
): number | null {
  if (values.length === 0) return null;
  
  switch (aggregation) {
    case "quarter_end":
      return values[values.length - 1];
    case "quarter_sum":
      return values.reduce((sum, v) => sum + v, 0);
    case "quarter_avg":
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    case "quarter_max":
      return Math.max(...values);
    case "quarter_min":
      return Math.min(...values);
    default:
      return null;
  }
}

export async function getQuarterAgg(
  metricKey: string,
  year: number,
  aggregation: AggregationType
): Promise<QuarterAggResult> {
  const quarters: ("Q1" | "Q2" | "Q3" | "Q4")[] = ["Q1", "Q2", "Q3", "Q4"];
  const result: QuarterAggResult = { Q1: null, Q2: null, Q3: null, Q4: null };
  
  if (metricKey === "turbooh_vacancy_pct") {
    return result;
  }
  
  if (metricKey === "standardization_completion_pct") {
    const stdResult = getStandardizationCompletionPct();
    if (stdResult.status === "ready" && stdResult.value !== null) {
      result.Q1 = stdResult.value;
      result.Q2 = stdResult.value;
      result.Q3 = stdResult.value;
      result.Q4 = stdResult.value;
    }
    return result;
  }
  
  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const series = await getMetricSeries(metricKey, startDate, endDate);
    
    if (series.length === 0) {
      return result;
    }
    
    for (const quarter of quarters) {
      const months = getQuarterMonths(quarter);
      const quarterValues = series
        .filter(point => {
          const month = parseInt(point.date.split("-")[1]);
          return months.includes(month);
        })
        .map(point => point.value);
      
      result[quarter] = aggregateQuarterValues(quarterValues, aggregation);
    }
    
    return result;
  } catch (error) {
    console.error(`[OKR] Error fetching quarter aggregation for ${metricKey}:`, error);
    return result;
  }
}

const ALL_METRIC_KEYS = [
  "mrr_active",
  "revenue_total_billable",
  "active_customers",
  "new_mrr_sales",
  "expansion_mrr",
  "ebitda",
  "cash_generation",
  "cash_balance",
  "sga_pct",
  "cac_pct",
  "delinquency_pct",
  "net_mrr_churn_pct",
  "logo_churn_pct",
  "gross_mrr_churn_brl",
  "turbooh_revenue_net",
  "turbooh_result",
  "turbooh_vacancy_pct",
  "standardization_completion_pct"
];

export async function getQuarterSummary(
  year: number,
  aggregation: AggregationType = "quarter_end"
): Promise<QuarterSummaryMetric[]> {
  const summaryPromises = ALL_METRIC_KEYS.map(async (metricKey) => {
    const quarters = await getQuarterAgg(metricKey, year, aggregation);
    
    const hasAnyData = Object.values(quarters).some(v => v !== null);
    const hasAllData = Object.values(quarters).every(v => v !== null);
    
    let status: "ready" | "not_ready" | "partial";
    if (hasAllData) {
      status = "ready";
    } else if (hasAnyData) {
      status = "partial";
    } else {
      status = "not_ready";
    }
    
    return {
      metricKey,
      quarters,
      status
    };
  });
  
  return Promise.all(summaryPromises);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    mrrAtivo,
    mrrInicioMes,
    mrrSerie,
    receitaYTD,
    ebitdaYTD,
    caixaAtual,
    inadimplencia,
    churnMRR,
    clientesAtivos,
    clientesInicioMes,
    headcount,
    newMrr,
    newMrrYTD,
    expansionMrr,
    vendasPontual,
    vendasMrr,
    geracaoCaixa,
    turboohReceita,
    turboohCustos,
    turboohResultado,
    turboohMargemPct,
    techProjetosEntregues,
    techFreelancersCusto,
    techProjetosValor,
    techFreelancersPct
  ] = await Promise.all([
    getMrrAtivo(),
    getMrrInicioMes(),
    getMrrSerie(),
    getReceitaYTD(),
    getEbitdaYTD(),
    getCaixaAtual(),
    getInadimplencia(),
    getChurnMRR(),
    getClientesAtivos(),
    getClientesInicioMes(),
    getHeadcount(),
    getNewMrr(),
    getNewMrrYTD(),
    getExpansionMrr(),
    getVendasPontual(),
    getVendasMrr(),
    getGeracaoCaixa(),
    getTurboohReceita(),
    getTurboohCustos(),
    getTurboohResultado(),
    getTurboohMargemPct(),
    getTechProjetosEntregues(),
    getTechFreelancersCusto(),
    getTechProjetosValor(),
    getTechFreelancersPct()
  ]);

  const receitaPorHead = headcount > 0 ? receitaYTD.liquida / headcount : 0;
  const mrrPorHead = headcount > 0 ? mrrAtivo / headcount : 0;

  return {
    mrr_ativo: mrrAtivo,
    mrr_serie: mrrSerie,
    receita_total_ytd: receitaYTD.total,
    receita_liquida_ytd: receitaYTD.liquida,
    ebitda_ytd: ebitdaYTD,
    geracao_caixa_ytd: geracaoCaixa,
    caixa_atual: caixaAtual,
    inadimplencia_valor: inadimplencia.valor,
    inadimplencia_brl: inadimplencia.valor,
    inadimplencia_percentual: inadimplencia.percentual,
    gross_churn_mrr: churnMRR.gross,
    gross_mrr_churn_percentual: churnMRR.grossPercentual,
    net_churn_mrr: churnMRR.net,
    net_churn_mrr_percentual: churnMRR.netPercentual,
    logo_churn: churnMRR.logoChurn,
    logo_churn_percentual: churnMRR.logoChurnPct,
    clientes_ativos: clientesAtivos,
    clientes_inicio_mes: clientesInicioMes,
    receita_recorrente_ytd: receitaYTD.recorrente,
    receita_pontual_ytd: receitaYTD.pontual,
    receita_outras_ytd: receitaYTD.outras,
    mix_is_estimated: receitaYTD.mix_is_estimated,
    new_mrr: newMrr,
    new_mrr_ytd: newMrrYTD,
    expansion_mrr: expansionMrr,
    expansion_mrr_ytd: expansionMrr,
    vendas_pontual: vendasPontual,
    vendas_mrr: vendasMrr,
    headcount,
    receita_por_head: receitaPorHead,
    mrr_por_head: mrrPorHead,
    turbooh_receita: turboohReceita,
    turbooh_receita_liquida_ytd: turboohReceita,
    turbooh_custos: turboohCustos,
    turbooh_resultado: turboohResultado,
    turbooh_resultado_ytd: turboohResultado,
    turbooh_margem_pct: turboohMargemPct,
    tech_projetos_entregues: techProjetosEntregues,
    tech_freelancers_custo: techFreelancersCusto,
    tech_projetos_valor: techProjetosValor,
    tech_freelancers_percentual: techFreelancersPct,
    standardization_completion_pct: getStandardizationCompletionPct().value
  };
}

export async function getDashboardMetricsWithQuarters(): Promise<DashboardMetrics> {
  const [baseMetrics, quarterSummary] = await Promise.all([
    getDashboardMetrics(),
    getQuarterSummary(new Date().getFullYear())
  ]);
  
  return {
    ...baseMetrics,
    quarter_summary: quarterSummary
  };
}

export function getTargets() {
  const getTarget = (metricKey: string) => {
    const kr = krRegistry.find(k => k.metricKey === metricKey);
    if (!kr) return 0;
    return kr.targets.FY || kr.targets.Q4 || 0;
  };

  const getQuarterlyTargets = (metricKey: string) => {
    const kr = krRegistry.find(k => k.metricKey === metricKey);
    if (!kr) return {};
    return {
      Q1: kr.targets.Q1,
      Q2: kr.targets.Q2,
      Q3: kr.targets.Q3,
      Q4: kr.targets.Q4
    };
  };

  return {
    year: 2026,
    company: {
      mrr_ativo: getQuarterlyTargets("mrr_active"),
      receita_liquida_anual: getTarget("revenue_net"),
      ebitda_anual: getTarget("ebitda"),
      inadimplencia_max: getTarget("inadimplencia_pct"),
      gross_mrr_churn_max: getTarget("gross_churn_pct"),
      net_churn_max: getTarget("net_churn_pct"),
      logo_churn_max: getTarget("logo_churn_pct"),
      clientes_eoy: getTarget("clients_active")
    },
    turbooh: {
      receita_liquida_anual: getTarget("turbooh_receita"),
      resultado_anual: getTarget("turbooh_resultado"),
      margem_min: getTarget("turbooh_margem_pct"),
      telas_eoy: getTarget("oh_screens")
    },
    tech: {
      projetos_anual: getTarget("tech_projetos_entregues"),
      freelancers_max_pct: getTarget("tech_freelancers_pct")
    }
  };
}

export function getKRs(): KR[] {
  return krRegistry;
}

export function getOKRConfig() {
  return {
    year: 2026,
    objectives: objectiveRegistry,
    krs: krRegistry,
    metrics: metricRegistry
  };
}

export function getObjectives() {
  return objectiveRegistry;
}

export function getKRsByObjectiveCode(code: string): KR[] {
  return krRegistry.filter(kr => kr.objectiveId === code);
}

export function getInitiatives() {
  return [];
}

export function getManualMetrics() {
  return manualMetrics;
}

export function calculateProgress(atual: number, target: number, direction: string): number {
  if (target === 0) return 0;
  if (direction === "lower" || direction === "lower_is_better") {
    if (atual <= target) return 100;
    return Math.max(0, 100 - ((atual - target) / target) * 100);
  }
  return Math.min(100, (atual / target) * 100);
}

export function getStatus(progress: number, direction: string): "green" | "yellow" | "red" {
  if (direction === "lower" || direction === "lower_is_better") {
    if (progress >= 100) return "green";
    if (progress >= 90) return "yellow";
    return "red";
  }
  if (progress >= 100) return "green";
  if (progress >= 90) return "yellow";
  return "red";
}

export interface KRProgress {
  krId: string;
  actual: number | null;
  target: number | null;
  progress: number | null;
  status: "green" | "yellow" | "red" | "gray";
  delta: number | null;
  direction: string;
}

export async function getKRProgress(krId: string): Promise<KRProgress> {
  const kr = krRegistry.find(k => k.id === krId);
  if (!kr) {
    return { krId, actual: null, target: null, progress: null, status: "gray", delta: null, direction: "higher" };
  }

  const metrics = await getDashboardMetrics();
  let actual: number | null = null;
  let target: number | null = null;

  const quarter = getCurrentQuarter();
  const quarterKey = quarter as keyof typeof kr.targets;

  switch (kr.metricKey) {
    case "mrr_active":
      actual = metrics.mrr_ativo;
      target = kr.targets[quarterKey] || kr.targets.FY || null;
      break;
    case "revenue_net":
      actual = metrics.receita_liquida_ytd;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "clients_active":
      actual = metrics.clientes_ativos;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "revenue_per_head":
      actual = metrics.receita_por_head;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "ebitda":
      actual = metrics.ebitda_ytd;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "cash_balance":
      actual = metrics.caixa_atual;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "inadimplencia_pct":
      actual = metrics.inadimplencia_percentual;
      target = kr.targets[quarterKey] || kr.targets.FY || null;
      break;
    case "gross_churn_pct":
      actual = metrics.gross_mrr_churn_percentual;
      target = kr.targets[quarterKey] || kr.targets.FY || null;
      break;
    case "net_churn_pct":
      actual = metrics.net_churn_mrr_percentual;
      target = kr.targets[quarterKey] || kr.targets.FY || null;
      break;
    case "logo_churn_pct":
      actual = metrics.logo_churn_percentual;
      target = kr.targets[quarterKey] || kr.targets.FY || null;
      break;
    case "turbooh_receita":
      actual = metrics.turbooh_receita;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "turbooh_resultado":
      actual = metrics.turbooh_resultado;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "turbooh_margem_pct":
      actual = metrics.turbooh_margem_pct;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "tech_projetos_entregues":
      actual = metrics.tech_projetos_entregues;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "tech_freelancers_pct":
      actual = metrics.tech_freelancers_percentual;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    case "mrr_por_head":
      actual = metrics.mrr_por_head;
      target = kr.targets.FY || kr.targets.Q4 || null;
      break;
    default:
      actual = null;
      target = kr.targets[quarterKey] || kr.targets.FY || kr.targets.Q4 || null;
  }

  if (actual === null || target === null) {
    return { krId, actual, target, progress: null, status: "gray", delta: null, direction: kr.direction };
  }

  const progress = calculateProgress(actual, target, kr.direction);
  const status = getStatus(progress, kr.direction);
  const delta = actual - target;

  return { krId, actual, target, progress, status, delta, direction: kr.direction };
}

export function getCoverage(): { covered: number; total: number; percentage: number; missing: string[] } {
  const availableMetrics = new Set([
    "mrr_active", "revenue_net", "revenue_total", "ebitda", "cash_balance",
    "inadimplencia_pct", "inadimplencia_valor", "gross_churn_pct", "gross_churn_mrr",
    "net_churn_pct", "net_churn_mrr", "logo_churn", "logo_churn_pct",
    "clients_active", "headcount_total", "revenue_per_head", "mrr_por_head",
    "new_mrr", "expansion_mrr", "vendas_pontual",
    "turbooh_receita", "turbooh_resultado", "turbooh_margem_pct",
    "tech_projetos_entregues", "tech_freelancers_custo", "tech_freelancers_pct"
  ]);

  const requiredMetrics = Object.values(metricRegistry).filter(m => m.required);
  const missing: string[] = [];
  let covered = 0;

  for (const metric of requiredMetrics) {
    if (availableMetrics.has(metric.id)) {
      covered++;
    } else {
      missing.push(metric.id);
    }
  }

  return {
    covered,
    total: requiredMetrics.length,
    percentage: requiredMetrics.length > 0 ? (covered / requiredMetrics.length) * 100 : 0,
    missing
  };
}

export async function getMetricValue(metricKey: string): Promise<MetricValue> {
  const metrics = await getDashboardMetrics();
  const now = new Date().toISOString().split('T')[0];
  
  const metricMap: Record<string, number | null> = {
    mrr_active: metrics.mrr_ativo,
    revenue_net: metrics.receita_liquida_ytd,
    revenue_total: metrics.receita_total_ytd,
    ebitda: metrics.ebitda_ytd,
    cash_balance: metrics.caixa_atual,
    inadimplencia_pct: metrics.inadimplencia_percentual,
    inadimplencia_valor: metrics.inadimplencia_valor,
    gross_churn_pct: metrics.gross_mrr_churn_percentual,
    gross_churn_mrr: metrics.gross_churn_mrr,
    net_churn_pct: metrics.net_churn_mrr_percentual,
    net_churn_mrr: metrics.net_churn_mrr,
    logo_churn: metrics.logo_churn,
    logo_churn_pct: metrics.logo_churn_percentual,
    clients_active: metrics.clientes_ativos,
    new_mrr: metrics.new_mrr,
    expansion_mrr: metrics.expansion_mrr,
    vendas_pontual: metrics.vendas_pontual,
    turbooh_receita: metrics.turbooh_receita,
    turbooh_resultado: metrics.turbooh_resultado,
    turbooh_margem_pct: metrics.turbooh_margem_pct,
    tech_projetos_entregues: metrics.tech_projetos_entregues,
    tech_freelancers_custo: metrics.tech_freelancers_custo,
    tech_freelancers_pct: metrics.tech_freelancers_percentual,
    revenue_per_head: metrics.receita_por_head,
    mrr_por_head: metrics.mrr_por_head,
    headcount_total: metrics.headcount
  };

  const value = metricMap[metricKey] ?? null;
  const spec = metricRegistry[metricKey];
  const formatted = value !== null && spec ? spec.format(value) : undefined;

  return { value, date: now, formatted };
}
