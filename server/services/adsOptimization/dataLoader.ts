import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { EntitySnapshot, ProductTarget, WindowMetrics } from "./types";
import { extractProduto } from "./playbook";

const TURBO_ACCOUNT_ID = "act_1331413260627780";

const LEARNING_STATUSES = new Set(["LEARNING", "LEARNING_LIMITED"]);

/**
 * Fórmula PSOP: orçamento diário base = (CPMQL alvo ÷ 7) × 3.
 * Um ad é considerado "escalado" quando o gasto diário atual é ≥ 4× a base.
 */
function isScaled(dailySpend: number, cpmqlAlvo: number): boolean {
  if (cpmqlAlvo <= 0 || dailySpend <= 0) return false;
  const base = (cpmqlAlvo / 7) * 3;
  return dailySpend >= 4 * base;
}

/**
 * Carrega snapshots por **ad individual** com 3 janelas (14d, 7d, 3d) de
 * spend/leads/MQLs, idade do ad, status (incluindo learning phase) e flag
 * `isScaled` calculada vs. orçamento base do produto.
 *
 * Granularidade per-ad é fiel ao PSOP: cada hook (variação de criativo)
 * é um ad e tem que ser avaliado separado.
 */
export async function loadEntitySnapshots(
  knownProdutos: string[],
  targets: Record<string, ProductTarget>,
): Promise<EntitySnapshot[]> {
  const adsRows: any = await db.execute(sql`
    SELECT
      a.ad_id,
      a.ad_name,
      a.effective_status,
      a.created_time,
      a.adset_id,
      ads.adset_name,
      a.campaign_id,
      c.campaign_name,
      -- 14d
      COALESCE(SUM(i.spend::numeric)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '14 days'), 0) AS spend_14d,
      COALESCE(SUM(i.conversions)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '14 days'), 0) AS leads_14d,
      -- 7d
      COALESCE(SUM(i.spend::numeric)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '7 days'), 0) AS spend_7d,
      COALESCE(SUM(i.conversions)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '7 days'), 0) AS leads_7d,
      -- 3d
      COALESCE(SUM(i.spend::numeric)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '3 days'), 0) AS spend_3d,
      COALESCE(SUM(i.conversions)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '3 days'), 0) AS leads_3d,
      -- gasto diário atual (média 7d)
      COALESCE(SUM(i.spend::numeric)
        FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '7 days'), 0) / 7.0 AS daily_spend
    FROM meta_ads.meta_ads a
    LEFT JOIN meta_ads.meta_adsets ads ON ads.adset_id = a.adset_id
    LEFT JOIN meta_ads.meta_campaigns c ON c.campaign_id = a.campaign_id
    LEFT JOIN meta_ads.meta_insights_daily i
      ON i.ad_id = a.ad_id
     AND i.date_start >= CURRENT_DATE - INTERVAL '14 days'
    WHERE a.account_id = ${TURBO_ACCOUNT_ID}
      AND a.effective_status NOT IN ('DELETED', 'ARCHIVED')
    GROUP BY a.ad_id, a.ad_name, a.effective_status, a.created_time,
             a.adset_id, ads.adset_name, a.campaign_id, c.campaign_name
    HAVING COALESCE(SUM(i.spend::numeric)
      FILTER (WHERE i.date_start >= CURRENT_DATE - INTERVAL '14 days'), 0) > 0
  `);

  const adIds: string[] = [];
  for (const row of adsRows.rows ?? adsRows) {
    if (row.ad_id) adIds.push(String(row.ad_id));
  }
  if (adIds.length === 0) return [];

  // MQLs por ad (Bitrix.crm_deal.utm_content = ad_id), nas 3 janelas
  const mqlsRows: any = await db.execute(sql`
    SELECT
      utm_content AS ad_id,
      SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '14 days'
            AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) AS mqls_14d,
      SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) AS mqls_7d,
      SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '3 days'
            AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) AS mqls_3d,
      SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '14 days' THEN 1 ELSE 0 END) AS leads_crm_14d,
      SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) AS leads_crm_7d,
      SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '3 days' THEN 1 ELSE 0 END) AS leads_crm_3d
    FROM "Bitrix".crm_deal
    WHERE utm_content IS NOT NULL
      AND utm_content = ANY(${adIds})
      AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
      AND created_at >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY utm_content
  `);

  const mqlsByAd: Record<string, any> = {};
  for (const row of mqlsRows.rows ?? mqlsRows) {
    mqlsByAd[String(row.ad_id)] = row;
  }

  const snapshots: EntitySnapshot[] = [];
  const today = new Date();

  for (const row of adsRows.rows ?? adsRows) {
    const adId = String(row.ad_id);
    const mqlData = mqlsByAd[adId] ?? {};

    const produto = row.campaign_name
      ? extractProduto(String(row.campaign_name), knownProdutos)
      : null;
    const target = produto ? targets[produto] : null;
    const cpmqlAlvo = target?.cpmqlAlvo ?? 0;

    const dailySpend = Number(row.daily_spend ?? 0);
    const createdTime = row.created_time ? new Date(row.created_time) : null;
    const ageInDays = createdTime
      ? Math.max(
          0,
          Math.floor((today.getTime() - createdTime.getTime()) / 86_400_000),
        )
      : 0;

    snapshots.push({
      entityType: "ad",
      entityId: adId,
      entityName: String(row.ad_name ?? adId),
      campaignName: row.campaign_name ? String(row.campaign_name) : null,
      adsetName: row.adset_name ? String(row.adset_name) : null,
      produto,
      status: String(row.effective_status ?? "UNKNOWN"),
      effectiveStatus: String(row.effective_status ?? "UNKNOWN"),
      inLearning: LEARNING_STATUSES.has(String(row.effective_status ?? "")),
      ageInDays,
      dailyBudget: dailySpend > 0 ? dailySpend : null,
      isScaled: cpmqlAlvo > 0 ? isScaled(dailySpend, cpmqlAlvo) : false,
      d14: buildWindow(row.spend_14d, row.leads_14d, mqlData.mqls_14d),
      d7: buildWindow(row.spend_7d, row.leads_7d, mqlData.mqls_7d),
      d3: buildWindow(row.spend_3d, row.leads_3d, mqlData.mqls_3d),
    });
  }

  return snapshots;
}

function buildWindow(spendRaw: any, leadsRaw: any, mqlsRaw: any): WindowMetrics {
  const spend = Number(spendRaw ?? 0);
  const leads = Number(leadsRaw ?? 0);
  const mqls = Number(mqlsRaw ?? 0);
  const cpl = leads > 0 ? spend / leads : null;
  const cpmql = mqls > 0 ? spend / mqls : null;
  const percMql = leads > 0 ? (mqls / leads) * 100 : null;
  return { spend, leads, mqls, cpmql, percMql, cpl };
}

export async function getRecentlyTouchedEntityIds(
  cooldownHoras: number,
): Promise<Set<string>> {
  const rows: any = await db.execute(sql`
    SELECT DISTINCT
      COALESCE(final_entity_id, proposed_entity_id) AS entity_id
    FROM meta_optimization_proposals
    WHERE executed_at IS NOT NULL
      AND executed_at >= NOW() - (${cooldownHoras} || ' hours')::interval
  `);
  const set = new Set<string>();
  for (const r of rows.rows ?? rows) set.add(String(r.entity_id));
  return set;
}

/**
 * Reduz cada snapshot a um payload compacto pro LLM. Inclui janelas e flags
 * que o agente precisa pra aplicar R0-R5 (sem expor os 14k+ rows raw).
 */
export function summarizeForAgent(
  snapshots: EntitySnapshot[],
  targets: Record<string, ProductTarget>,
): {
  payload: Array<Record<string, unknown>>;
  ignored: { id: string; name: string; reason: string }[];
} {
  const payload: Array<Record<string, unknown>> = [];
  const ignored: { id: string; name: string; reason: string }[] = [];

  for (const s of snapshots) {
    if (!s.produto) {
      ignored.push({
        id: s.entityId,
        name: s.entityName,
        reason: "produto_nao_identificado",
      });
      continue;
    }
    const target = targets[s.produto];
    if (!target) {
      ignored.push({
        id: s.entityId,
        name: s.entityName,
        reason: "produto_sem_target_no_mes",
      });
      continue;
    }
    if (s.inLearning) {
      ignored.push({
        id: s.entityId,
        name: s.entityName,
        reason: `learning_phase (${s.effectiveStatus})`,
      });
      continue;
    }

    payload.push({
      entity_type: s.entityType,
      entity_id: s.entityId,
      entity_name: s.entityName,
      adset_name: s.adsetName,
      campaign_name: s.campaignName,
      produto: s.produto,
      effective_status: s.effectiveStatus,
      age_in_days: s.ageInDays,
      daily_spend: round(s.dailyBudget ?? 0, 2),
      is_scaled: s.isScaled,
      cpmql_alvo: target.cpmqlAlvo,
      mql_min_pct: target.mqlMinPct,
      cpl_alvo: target.cplAlvo,
      cpmql_alvo_50pct: round(target.cpmqlAlvo * 0.5, 2),
      cpmql_alvo_zona_verde: round(target.cpmqlAlvo * 0.9, 2),
      cpmql_alvo_zona_vermelha: round(target.cpmqlAlvo * 1.1, 2),
      d14: serializeWindow(s.d14, target.cpmqlAlvo),
      d7: serializeWindow(s.d7, target.cpmqlAlvo),
      d3: serializeWindow(s.d3, target.cpmqlAlvo),
    });
  }
  return { payload, ignored };
}

function serializeWindow(w: WindowMetrics, cpmqlAlvo: number) {
  const cpmqlPctAlvo =
    w.cpmql !== null && cpmqlAlvo > 0
      ? round((w.cpmql / cpmqlAlvo) * 100, 1)
      : null;
  return {
    spend: round(w.spend, 2),
    leads: w.leads,
    mqls: w.mqls,
    cpl: w.cpl !== null ? round(w.cpl, 2) : null,
    cpmql: w.cpmql !== null ? round(w.cpmql, 2) : null,
    perc_mql: w.percMql !== null ? round(w.percMql, 1) : null,
    cpmql_pct_alvo: cpmqlPctAlvo,
    zona: zonaForCpmql(w.cpmql, cpmqlAlvo),
  };
}

function zonaForCpmql(cpmql: number | null, alvo: number): string | null {
  if (cpmql === null || alvo <= 0) return null;
  const ratio = cpmql / alvo;
  if (ratio < 0.9) return "verde";
  if (ratio <= 1.1) return "laranja";
  return "vermelha";
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
