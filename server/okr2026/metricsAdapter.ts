import { db } from "../db";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import targets from "./targets.json";
import krs from "./krs.json";
import initiatives from "./initiatives.json";
import manualMetrics from "./manualMetrics.json";

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
  const mrrTargets = targets.company.mrr_ativo as Record<string, number>;
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
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND categoria_dfc NOT ILIKE '%imposto%' THEN valor_pago::numeric ELSE 0 END), 0) as liquida
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
      SELECT COALESCE(SUM(saldo::numeric), 0) as saldo
      FROM caz_bancos
      WHERE ativo = true
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
      SELECT COUNT(DISTINCT cliente) as total
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
  return targets;
}

export function getKRs() {
  return krs;
}

export function getInitiatives() {
  return initiatives;
}

export function getManualMetrics() {
  return manualMetrics;
}

export function calculateProgress(atual: number, target: number, direction: string): number {
  if (target === 0) return 0;
  if (direction === "lower_is_better") {
    if (atual <= target) return 100;
    return Math.max(0, 100 - ((atual - target) / target) * 100);
  }
  return Math.min(100, (atual / target) * 100);
}

export function getStatus(progress: number, direction: string): "green" | "yellow" | "red" {
  if (direction === "lower_is_better") {
    if (progress >= 100) return "green";
    if (progress >= 90) return "yellow";
    return "red";
  }
  if (progress >= 100) return "green";
  if (progress >= 90) return "yellow";
  return "red";
}
