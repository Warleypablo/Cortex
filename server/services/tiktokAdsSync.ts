/**
 * Sync de MÍDIA PAGA do TikTok (campanhas + métricas diárias) → schema `tiktok`.
 *
 * Usa a credencial do fluxo "advertiser" (Marketing API, business-api.tiktok.com):
 *   - token longo, sem refresh → header `Access-Token: <token>`
 *   - campanhas → tiktok.ad_campaigns (metadados: nome, objetivo, status, budget)
 *   - métricas  → tiktok.ad_metrics_daily (gasto/impressões/cliques/conversões por dia)
 *
 * report/integrated/get com dimensão stat_time_day devolve métricas DIÁRIAS REAIS
 * (não cumulativas como o orgânico) → a leitura no dashboard agrega por SUM.
 */

import type { Pool } from 'pg';
import { decryptToken } from '../utils/encryption';

const TT_BIZ_API = 'https://business-api.tiktok.com/open_api/v1.3';

// Métricas básicas pedidas no report. cpc/cpm/ctr são derivados na leitura.
const REPORT_METRICS = ['spend', 'impressions', 'clicks', 'conversion'];

export interface TiktokAdsResult {
  advertisers: number;
  campaigns: number;
  metricRows: number;
  errors: string[];
}

function ttHeaders(token: string) {
  return { 'Access-Token': token, 'Content-Type': 'application/json' };
}

/** GET na Business API com params (arrays viram JSON). Lança em code != 0. */
async function ttGet(path: string, token: string, params: Record<string, any>): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${TT_BIZ_API}${path}?${qs.toString()}`, { headers: ttHeaders(token) });
  const j = await res.json();
  if (j.code !== 0) throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
}

const numOrNull = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));

/**
 * @param days janela de dias para trás a sincronizar (default 30).
 */
export async function syncTiktokAds(pool: Pool, days = 30): Promise<TiktokAdsResult> {
  const result: TiktokAdsResult = { advertisers: 0, campaigns: 0, metricRows: 0, errors: [] };

  const runRes = await pool.query(
    `INSERT INTO tiktok.sync_runs (kind, status) VALUES ('ads', 'running') RETURNING id`,
  );
  const runId = runRes.rows[0].id;

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  try {
    const credRes = await pool.query(
      `SELECT id, access_token_enc FROM tiktok.credentials
       WHERE kind = 'advertiser' AND active = TRUE ORDER BY id DESC LIMIT 1`,
    );
    if (credRes.rows.length === 0) throw new Error('Nenhuma credencial TikTok "advertiser" ativa — autorize o fluxo de Ads');
    const token = decryptToken(credRes.rows[0].access_token_enc);

    const advRes = await pool.query(`SELECT advertiser_id FROM tiktok.advertisers`);
    if (advRes.rows.length === 0) throw new Error('Nenhum advertiser descoberto — re-autorize o TikTok advertiser');

    for (const { advertiser_id } of advRes.rows) {
      try {
        // 1. Campanhas (metadados) — paginado.
        let cpage = 1;
        let cguard = 0;
        do {
          const data = await ttGet('/campaign/get/', token, {
            advertiser_id,
            fields: ['campaign_id', 'campaign_name', 'objective_type', 'operation_status', 'budget', 'budget_mode'],
            page: cpage,
            page_size: 100,
          });
          const list: any[] = data?.list || [];
          for (const c of list) {
            await pool.query(
              `INSERT INTO tiktok.ad_campaigns
                 (campaign_id, advertiser_id, campaign_name, objective_type, operation_status, budget, budget_mode, raw, synced_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
               ON CONFLICT (campaign_id) DO UPDATE SET
                 advertiser_id = EXCLUDED.advertiser_id, campaign_name = EXCLUDED.campaign_name,
                 objective_type = EXCLUDED.objective_type, operation_status = EXCLUDED.operation_status,
                 budget = EXCLUDED.budget, budget_mode = EXCLUDED.budget_mode, raw = EXCLUDED.raw, synced_at = NOW()`,
              [String(c.campaign_id), String(advertiser_id), c.campaign_name || null,
               c.objective_type || null, c.operation_status || null,
               numOrNull(c.budget), c.budget_mode || null, JSON.stringify(c)],
            );
            result.campaigns++;
          }
          const pageInfo = data?.page_info || {};
          cpage = (pageInfo.total_page && cpage < pageInfo.total_page) ? cpage + 1 : 0;
        } while (cpage && ++cguard < 50);

        // 2. Métricas diárias por campanha — report/integrated/get, paginado.
        let mpage = 1;
        let mguard = 0;
        do {
          const data = await ttGet('/report/integrated/get/', token, {
            advertiser_id,
            report_type: 'BASIC',
            data_level: 'AUCTION_CAMPAIGN',
            dimensions: ['campaign_id', 'stat_time_day'],
            metrics: REPORT_METRICS,
            start_date: startDate,
            end_date: endDate,
            page: mpage,
            page_size: 1000,
          });
          const list: any[] = data?.list || [];
          for (const row of list) {
            const dim = row.dimensions || {};
            const met = row.metrics || {};
            const campaignId = String(dim.campaign_id);
            const statDate = String(dim.stat_time_day || '').slice(0, 10);
            if (!campaignId || !statDate) continue;
            // FK exige a campanha existir; se o report trouxe campanha não listada, garante stub.
            await pool.query(
              `INSERT INTO tiktok.ad_campaigns (campaign_id, advertiser_id, synced_at)
               VALUES ($1,$2, NOW()) ON CONFLICT (campaign_id) DO NOTHING`,
              [campaignId, String(advertiser_id)],
            );
            await pool.query(
              `INSERT INTO tiktok.ad_metrics_daily
                 (campaign_id, stat_date, advertiser_id, spend, impressions, clicks, conversions, raw, synced_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
               ON CONFLICT (campaign_id, stat_date) DO UPDATE SET
                 advertiser_id = EXCLUDED.advertiser_id, spend = EXCLUDED.spend,
                 impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
                 conversions = EXCLUDED.conversions, raw = EXCLUDED.raw, synced_at = NOW()`,
              [campaignId, statDate, String(advertiser_id),
               numOrNull(met.spend), numOrNull(met.impressions), numOrNull(met.clicks),
               numOrNull(met.conversion), JSON.stringify(row)],
            );
            result.metricRows++;
          }
          const pageInfo = data?.page_info || {};
          mpage = (pageInfo.total_page && mpage < pageInfo.total_page) ? mpage + 1 : 0;
        } while (mpage && ++mguard < 100);

        result.advertisers++;
      } catch (e: any) {
        result.errors.push(`advertiser ${advertiser_id}: ${e.message}`);
        console.error(`[tiktok-ads] advertiser ${advertiser_id}:`, e.message);
      }
    }

    await pool.query(
      `UPDATE tiktok.sync_runs SET status=$2, rows_upserted=$3, finished_at=NOW() WHERE id=$1`,
      [runId, result.errors.length ? 'partial' : 'ok', result.metricRows],
    );
  } catch (err: any) {
    result.errors.push(err.message);
    await pool.query(
      `UPDATE tiktok.sync_runs SET status='error', error=$2, rows_upserted=$3, finished_at=NOW() WHERE id=$1`,
      [runId, err.message, result.metricRows],
    );
    console.error('[tiktok-ads] erro:', err.message);
  }

  console.log(`[tiktok-ads] ${result.advertisers} advertisers, ${result.campaigns} campanhas, ${result.metricRows} linhas de métrica, ${result.errors.length} erros`);
  return result;
}
