import { db } from "../db";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import krsJson from "./krs.json";
import initiatives from "./initiatives.json";
import manualMetrics from "./manualMetrics.json";
import { OKR_CONFIG, getAllKRs, getKRsByObjective, getAllObjectives } from "./okrConfig";
import { METRICS_REGISTRY, getRequiredMetrics, getMetricSpec } from "./metricsRegistry";

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
  inadimplencia_percentual: number;
  gross_mrr_churn_percentual: number;
  net_churn_mrr_percentual: number | null;
  logo_churn_percentual: number | null;
  clientes_ativos: number;
  receita_recorrente_ytd: number | null;
  receita_pontual_ytd: number | null;
  receita_outras_ytd: number | null;
  mix_is_estimated: boolean;
  new_mrr_ytd: number;
  expansion_mrr_ytd: number | null;
  headcount: number;
  receita_por_head: number;
  mrr_por_head: number;
  turbooh_receita_liquida_ytd: number | null;
  turbooh_resultado_ytd: number | null;
  tech_projetos_entregues: number;
  tech_freelancers_custo: number;
  tech_freelancers_percentual: number;
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function getQuarterTarget(metric: string): number {
  const quarter = getCurrentQuarter();
  const kr = OKR_CONFIG.krs.KR1_MRR_EOQ;
  const mrrTargets = kr.targets || {};
  return mrrTargets[quarter] || 0;
}

export async function getMrrAtivo(): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH ultimo_snapshot AS (
        SELECT MAX(data_snapshot) as data_ultimo
        FROM ${schema.cupDataHist}
      )
      SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
      FROM ${schema.cupDataHist} h
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

export async function getMrrSerie(): Promise<{ month: string; value: number }[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(data_snapshot, 'YYYY-MM') as month,
        COALESCE(SUM(valorr::numeric), 0) as mrr
      FROM ${schema.cupDataHist}
      WHERE status IN ('ativo', 'onboarding', 'triagem')
        AND valorr IS NOT NULL
        AND valorr > 0
        AND data_snapshot >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(data_snapshot, 'YYYY-MM')
      ORDER BY month
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

export async function getInadimplencia(): Promise<{ valor: number; percentual: number }> {
  try {
    const result = await db.execute(sql`
      WITH inadimplente AS (
        SELECT COALESCE(SUM(nao_pago::numeric + COALESCE(perda::numeric, 0)), 0) as valor_inadimplente
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND status NOT IN ('QUITADO', 'PERDIDO')
          AND data_vencimento < NOW()
      ),
      receita_mes AS (
        SELECT COALESCE(SUM(valor_bruto::numeric), 0) as receita_total
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND TO_CHAR(data_vencimento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
      )
      SELECT 
        i.valor_inadimplente,
        CASE WHEN r.receita_total > 0 
          THEN (i.valor_inadimplente / r.receita_total) * 100 
          ELSE 0 
        END as percentual
      FROM inadimplente i, receita_mes r
    `);
    return {
      valor: parseFloat((result.rows[0] as any)?.valor_inadimplente || "0"),
      percentual: parseFloat((result.rows[0] as any)?.percentual || "0")
    };
  } catch (error) {
    console.error("[OKR] Error fetching Inadimplência:", error);
    return { valor: 0, percentual: 0 };
  }
}

export async function getChurnMRR(): Promise<{ gross: number; grossPercentual: number; net: number | null; netPercentual: number | null }> {
  try {
    const result = await db.execute(sql`
      WITH mes_atual AS (
        SELECT 
          COALESCE(SUM(valorr::numeric), 0) as churn_mrr
        FROM ${schema.cupContratos}
        WHERE data_encerramento IS NOT NULL
          AND TO_CHAR(data_encerramento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
          AND valorr IS NOT NULL
          AND valorr > 0
      ),
      mes_anterior AS (
        SELECT COALESCE(SUM(valorr::numeric), 0) as mrr_anterior
        FROM ${schema.cupDataHist}
        WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM')
          AND status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL
          AND valorr > 0
      )
      SELECT 
        ma.churn_mrr,
        CASE WHEN ant.mrr_anterior > 0 
          THEN (ma.churn_mrr / ant.mrr_anterior) * 100 
          ELSE 0 
        END as churn_percentual,
        ant.mrr_anterior
      FROM mes_atual ma, mes_anterior ant
    `);
    
    const grossChurn = parseFloat((result.rows[0] as any)?.churn_mrr || "0");
    const grossPercentual = parseFloat((result.rows[0] as any)?.churn_percentual || "0");
    
    return {
      gross: grossChurn,
      grossPercentual,
      net: null,
      netPercentual: null
    };
  } catch (error) {
    console.error("[OKR] Error fetching Churn MRR:", error);
    return { gross: 0, grossPercentual: 0, net: null, netPercentual: null };
  }
}

export async function getClientesAtivos(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT id_task) as total
      FROM ${schema.cupContratos}
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
      FROM ${schema.rhPessoal}
      WHERE status = 'Ativo'
    `);
    return parseInt((result.rows[0] as any)?.total || "0");
  } catch (error) {
    console.error("[OKR] Error fetching Headcount:", error);
    return 0;
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    mrrAtivo,
    mrrSerie,
    receitaYTD,
    ebitdaYTD,
    caixaAtual,
    inadimplencia,
    churnMRR,
    clientesAtivos,
    headcount
  ] = await Promise.all([
    getMrrAtivo(),
    getMrrSerie(),
    getReceitaYTD(),
    getEbitdaYTD(),
    getCaixaAtual(),
    getInadimplencia(),
    getChurnMRR(),
    getClientesAtivos(),
    getHeadcount()
  ]);

  const receitaPorHead = headcount > 0 ? receitaYTD.liquida / headcount : 0;
  const mrrPorHead = headcount > 0 ? mrrAtivo / headcount : 0;

  return {
    mrr_ativo: mrrAtivo,
    mrr_serie: mrrSerie,
    receita_total_ytd: receitaYTD.total,
    receita_liquida_ytd: receitaYTD.liquida,
    ebitda_ytd: ebitdaYTD,
    geracao_caixa_ytd: ebitdaYTD * 0.6,
    caixa_atual: caixaAtual,
    inadimplencia_percentual: inadimplencia.percentual,
    gross_mrr_churn_percentual: churnMRR.grossPercentual,
    net_churn_mrr_percentual: churnMRR.netPercentual,
    logo_churn_percentual: null,
    clientes_ativos: clientesAtivos,
    receita_recorrente_ytd: receitaYTD.recorrente,
    receita_pontual_ytd: receitaYTD.pontual,
    receita_outras_ytd: receitaYTD.outras,
    mix_is_estimated: receitaYTD.mix_is_estimated,
    new_mrr_ytd: 0,
    expansion_mrr_ytd: null,
    headcount,
    receita_por_head: receitaPorHead,
    mrr_por_head: mrrPorHead,
    turbooh_receita_liquida_ytd: null,
    turbooh_resultado_ytd: null,
    tech_projetos_entregues: 0,
    tech_freelancers_custo: 0,
    tech_freelancers_percentual: 0
  };
}

export function getTargets() {
  const krs = OKR_CONFIG.krs;
  return {
    year: OKR_CONFIG.year,
    company: {
      mrr_ativo: krs.KR1_MRR_EOQ.targets || {},
      receita_liquida_anual: krs.KR2_NET_REVENUE_YTD.target || 0,
      ebitda_anual: krs.KR1_EBITDA_YTD.target || 0,
      inadimplencia_max: krs.KR1_INADIMPLENCIA_MAX.target || 0,
      gross_mrr_churn_max: krs.KR2_GROSS_CHURN_MAX.target || 0,
      clientes_eoy: krs.KR3_CLIENTS_EOY.target || 0
    },
    turbooh: {
      receita_liquida_anual: krs.KR2_OH_NETREV_YTD.target || 0,
      resultado_anual: krs.KR3_OH_RESULT_YTD.target || 0,
      clientes_eoy: krs.KR1_OH_SCREENS_EOY.target || 0
    },
    tech: {
      projetos_anual: krs.KR1_TECH_DELIVERED_YTD.target || 0,
      freelancers_max_pct: krs.KR2_TECH_FREELA_GUARDRAIL.target || 0
    }
  };
}

export function getKRs() {
  return krsJson;
}

export function getOKRConfig() {
  return OKR_CONFIG;
}

export function getObjectives() {
  return getAllObjectives();
}

export function getKRsByObjectiveCode(code: string) {
  return getKRsByObjective(code);
}

export function getInitiatives() {
  return initiatives;
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
  const kr = Object.values(OKR_CONFIG.krs).find(k => k.id === krId);
  if (!kr) {
    return { krId, actual: null, target: null, progress: null, status: "gray", delta: null, direction: "higher" };
  }

  const metrics = await getDashboardMetrics();
  let actual: number | null = null;
  let target: number | null = null;

  switch (kr.metric_key) {
    case "mrr_active":
      actual = metrics.mrr_ativo;
      const quarter = getCurrentQuarter();
      target = (kr.targets as Record<string, number>)?.[quarter] || (kr.target as number) || null;
      break;
    case "revenue_net":
      actual = metrics.receita_liquida_ytd;
      target = kr.target as number || null;
      break;
    case "clients_active":
      actual = metrics.clientes_ativos;
      target = kr.target as number || null;
      break;
    case "revenue_per_head":
      actual = metrics.receita_por_head;
      target = kr.target as number || null;
      break;
    case "ebitda":
      actual = metrics.ebitda_ytd;
      target = kr.target as number || null;
      break;
    case "cash_balance_end":
      actual = metrics.caixa_atual;
      target = kr.target as number || null;
      break;
    case "inadimplencia_pct":
      actual = metrics.inadimplencia_percentual;
      target = kr.target as number || null;
      break;
    case "gross_mrr_churn_pct":
      actual = metrics.gross_mrr_churn_percentual;
      target = kr.target as number || null;
      break;
    default:
      actual = null;
      target = kr.target as number || null;
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
  const required = getRequiredMetrics();
  const availableMetrics = new Set([
    "mrr_active", "revenue_net", "revenue_total_billable", "ebitda", "cash_balance_end",
    "inadimplencia_pct", "gross_mrr_churn_pct", "clients_active", "headcount_total", "revenue_per_head"
  ]);

  const missing: string[] = [];
  let covered = 0;

  for (const metric of required) {
    if (availableMetrics.has(metric.id)) {
      covered++;
    } else {
      missing.push(metric.id);
    }
  }

  return {
    covered,
    total: required.length,
    percentage: required.length > 0 ? (covered / required.length) * 100 : 0,
    missing
  };
}
