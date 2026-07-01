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

// Só sincronizamos a conta de ads da própria Turbo. Bready (Hevo) e Suburb são
// advertisers de CLIENTES geridos pela Turbo no mesmo token — fora do escopo do
// dashboard (a leitura em growth.ts já filtra por esse mesmo ID).
const TURBO_ADVERTISER_IDS = ['7065303755092131842'];

// Métricas pedidas no report. TODAS confirmadas válidas na conta Turbo via
// scripts/probe-tiktok-metrics.ts. `raw` (JSONB) guarda a resposta inteira; as
// colunas tipadas cobrem as principais. cpc/cpm/ctr também vêm da API mas seguimos
// derivando na leitura (spend/impressions/clicks). total_landing_page_view = LPV
// nativo → habilita o Connect Rate real do TikTok.
const REPORT_METRICS = [
  'spend', 'impressions', 'clicks', 'conversion', 'cost_per_conversion', 'conversion_rate_v2',
  'ctr', 'cpc', 'cpm', 'reach', 'frequency', 'total_landing_page_view',
  'video_play_actions', 'video_watched_2s', 'video_watched_6s', 'average_video_play',
  'video_views_p25', 'video_views_p50', 'video_views_p75', 'video_views_p100',
  'likes', 'comments', 'shares', 'follows', 'profile_visits', 'engagements',
  'onsite_shopping', 'total_onsite_shopping_value',
];
// Nível de anúncio usa o mesmo conjunto.
const AD_REPORT_METRICS = REPORT_METRICS;

export interface TiktokAdsResult {
  advertisers: number;
  campaigns: number;
  metricRows: number;
  adGroups: number;
  ads: number;
  adMetricRows: number;
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

// Colunas estendidas gravadas em ad_metrics_daily e ad_insights_daily (mesma ordem
// nas duas). video_views (=video_play_actions) é tratado à parte no INSERT.
const EXT_COLS = 'landing_page_views, reach, frequency, video_watched_2s, video_watched_6s, video_views_p25, video_views_p50, video_views_p75, video_views_p100, average_video_play, likes, comments, shares, follows, profile_visits, engagements';
const EXT_SET = EXT_COLS.split(', ').map((c) => `${c} = EXCLUDED.${c}`).join(', ');
const extVals = (met: any) => [
  numOrNull(met.total_landing_page_view), numOrNull(met.reach), numOrNull(met.frequency),
  numOrNull(met.video_watched_2s), numOrNull(met.video_watched_6s),
  numOrNull(met.video_views_p25), numOrNull(met.video_views_p50),
  numOrNull(met.video_views_p75), numOrNull(met.video_views_p100),
  numOrNull(met.average_video_play),
  numOrNull(met.likes), numOrNull(met.comments), numOrNull(met.shares),
  numOrNull(met.follows), numOrNull(met.profile_visits), numOrNull(met.engagements),
];

/**
 * @param days janela de dias para trás a sincronizar (default 30).
 */
export async function syncTiktokAds(pool: Pool, days = 30): Promise<TiktokAdsResult> {
  const result: TiktokAdsResult = { advertisers: 0, campaigns: 0, metricRows: 0, adGroups: 0, ads: 0, adMetricRows: 0, errors: [] };

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

    const advRes = await pool.query(
      `SELECT advertiser_id FROM tiktok.advertisers WHERE advertiser_id = ANY($1)`,
      [TURBO_ADVERTISER_IDS],
    );
    if (advRes.rows.length === 0) throw new Error('Advertiser Turbo (7065303755092131842) não encontrado em tiktok.advertisers — re-autorize o TikTok advertiser');

    for (const { advertiser_id } of advRes.rows) {
      try {
        // Nível-campanha (tiktok.ad_campaigns + ad_metrics_daily) são owned por `postgres`. Quando o
        // app conecta como `growth_dev` SEM grant nessas tabelas, a escrita falha com "permission
        // denied" — e isso NÃO pode abortar o nível-anúncio (ads/adgroups/insights, owned por
        // growth_dev), que é o que alimenta a aba Criativos. Best-effort: registra e segue.
        // Correção definitiva: GRANT em tiktok.ad_campaigns/ad_metrics_daily p/ growth_dev (ver SQL no PR).
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
                   (campaign_id, stat_date, advertiser_id, spend, impressions, clicks, conversions, video_views, ${EXT_COLS}, raw, synced_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, NOW())
                 ON CONFLICT (campaign_id, stat_date) DO UPDATE SET
                   advertiser_id = EXCLUDED.advertiser_id, spend = EXCLUDED.spend,
                   impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
                   conversions = EXCLUDED.conversions, video_views = EXCLUDED.video_views,
                   ${EXT_SET}, raw = EXCLUDED.raw, synced_at = NOW()`,
                [campaignId, statDate, String(advertiser_id),
                 numOrNull(met.spend), numOrNull(met.impressions), numOrNull(met.clicks),
                 numOrNull(met.conversion), numOrNull(met.video_play_actions), ...extVals(met),
                 JSON.stringify(row)],
              );
              result.metricRows++;
            }
            const pageInfo = data?.page_info || {};
            mpage = (pageInfo.total_page && mpage < pageInfo.total_page) ? mpage + 1 : 0;
          } while (mpage && ++mguard < 100);
        } catch (campErr: any) {
          // Sem grant em ad_campaigns/ad_metrics_daily (owned por postgres): pula o nível-campanha e
          // segue p/ adgroups/ads/insights. A aba Criativos passa a mostrar os anúncios (nome da
          // campanha cai no fallback campaign_id) mesmo sem o GRANT.
          result.errors.push(`advertiser ${advertiser_id} (nível-campanha, best-effort): ${campErr.message}`);
          console.warn(`[tiktok-ads] nível-campanha pulado p/ advertiser ${advertiser_id}:`, campErr.message);
        }

        // 3. Ad groups (conjuntos) — metadados, paginado.
        let gpage = 1, gguard = 0;
        do {
          const data = await ttGet('/adgroup/get/', token, {
            advertiser_id,
            fields: ['adgroup_id', 'adgroup_name', 'campaign_id', 'operation_status', 'budget', 'budget_mode'],
            page: gpage,
            page_size: 100,
          });
          const list: any[] = data?.list || [];
          for (const g of list) {
            if (!g.campaign_id) continue;
            await pool.query(
              `INSERT INTO tiktok.ad_groups
                 (adgroup_id, campaign_id, advertiser_id, adgroup_name, operation_status, budget, budget_mode, raw, synced_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
               ON CONFLICT (adgroup_id) DO UPDATE SET
                 campaign_id = EXCLUDED.campaign_id, advertiser_id = EXCLUDED.advertiser_id,
                 adgroup_name = EXCLUDED.adgroup_name, operation_status = EXCLUDED.operation_status,
                 budget = EXCLUDED.budget, budget_mode = EXCLUDED.budget_mode, raw = EXCLUDED.raw, synced_at = NOW()`,
              [String(g.adgroup_id), String(g.campaign_id), String(advertiser_id), g.adgroup_name || null,
               g.operation_status || null, numOrNull(g.budget), g.budget_mode || null, JSON.stringify(g)],
            );
            result.adGroups++;
          }
          const pageInfo = data?.page_info || {};
          gpage = (pageInfo.total_page && gpage < pageInfo.total_page) ? gpage + 1 : 0;
        } while (gpage && ++gguard < 100);

        // 4. Anúncios — metadados, paginado.
        let apage = 1, aguard = 0;
        do {
          const data = await ttGet('/ad/get/', token, {
            advertiser_id,
            fields: ['ad_id', 'ad_name', 'adgroup_id', 'campaign_id', 'operation_status', 'ad_format', 'landing_page_url'],
            page: apage,
            page_size: 100,
          });
          const list: any[] = data?.list || [];
          for (const ad of list) {
            if (!ad.adgroup_id || !ad.campaign_id) continue;
            // garante adgroup (FK) caso não tenha vindo no /adgroup/get/
            await pool.query(
              `INSERT INTO tiktok.ad_groups (adgroup_id, campaign_id, advertiser_id, synced_at)
               VALUES ($1,$2,$3, NOW()) ON CONFLICT (adgroup_id) DO NOTHING`,
              [String(ad.adgroup_id), String(ad.campaign_id), String(advertiser_id)],
            );
            await pool.query(
              `INSERT INTO tiktok.ads
                 (ad_id, adgroup_id, campaign_id, advertiser_id, ad_name, operation_status, ad_format, landing_page_url, raw, synced_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
               ON CONFLICT (ad_id) DO UPDATE SET
                 adgroup_id = EXCLUDED.adgroup_id, campaign_id = EXCLUDED.campaign_id, advertiser_id = EXCLUDED.advertiser_id,
                 ad_name = EXCLUDED.ad_name, operation_status = EXCLUDED.operation_status, ad_format = EXCLUDED.ad_format,
                 landing_page_url = EXCLUDED.landing_page_url, raw = EXCLUDED.raw, synced_at = NOW()`,
              [String(ad.ad_id), String(ad.adgroup_id), String(ad.campaign_id), String(advertiser_id),
               ad.ad_name || null, ad.operation_status || null, ad.ad_format || null, ad.landing_page_url || null, JSON.stringify(ad)],
            );
            result.ads++;
          }
          const pageInfo = data?.page_info || {};
          apage = (pageInfo.total_page && apage < pageInfo.total_page) ? apage + 1 : 0;
        } while (apage && ++aguard < 200);

        // 5. Métricas diárias por ANÚNCIO — report/integrated/get, data_level=AUCTION_AD.
        let ampage = 1, amguard = 0;
        do {
          const data = await ttGet('/report/integrated/get/', token, {
            advertiser_id,
            report_type: 'BASIC',
            data_level: 'AUCTION_AD',
            dimensions: ['ad_id', 'stat_time_day'],
            metrics: AD_REPORT_METRICS,
            start_date: startDate,
            end_date: endDate,
            page: ampage,
            page_size: 1000,
          });
          const list: any[] = data?.list || [];
          for (const row of list) {
            const dim = row.dimensions || {};
            const met = row.metrics || {};
            const adId = String(dim.ad_id || '');
            const statDate = String(dim.stat_time_day || '').slice(0, 10);
            if (!adId || !statDate) continue;
            // só insere métrica se o anúncio existe (FK). Anúncios excluídos podem aparecer no
            // report mas não no /ad/get/ — nesses casos pulamos a métrica.
            const adExists = await pool.query(`SELECT 1 FROM tiktok.ads WHERE ad_id = $1`, [adId]);
            if (adExists.rowCount === 0) continue;
            await pool.query(
              `INSERT INTO tiktok.ad_insights_daily
                 (ad_id, stat_date, advertiser_id, spend, impressions, clicks, conversions, video_views, ${EXT_COLS}, raw, synced_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, NOW())
               ON CONFLICT (ad_id, stat_date) DO UPDATE SET
                 advertiser_id = EXCLUDED.advertiser_id, spend = EXCLUDED.spend,
                 impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
                 conversions = EXCLUDED.conversions, video_views = EXCLUDED.video_views,
                 ${EXT_SET}, raw = EXCLUDED.raw, synced_at = NOW()`,
              [adId, statDate, String(advertiser_id),
               numOrNull(met.spend), numOrNull(met.impressions), numOrNull(met.clicks),
               numOrNull(met.conversion), numOrNull(met.video_play_actions), ...extVals(met),
               JSON.stringify(row)],
            );
            result.adMetricRows++;
          }
          const pageInfo = data?.page_info || {};
          ampage = (pageInfo.total_page && ampage < pageInfo.total_page) ? ampage + 1 : 0;
        } while (ampage && ++amguard < 200);

        result.advertisers++;
      } catch (e: any) {
        result.errors.push(`advertiser ${advertiser_id}: ${e.message}`);
        console.error(`[tiktok-ads] advertiser ${advertiser_id}:`, e.message);
      }
    }

    await pool.query(
      `UPDATE tiktok.sync_runs SET status=$2, rows_upserted=$3, error=$4, finished_at=NOW() WHERE id=$1`,
      [runId, result.errors.length ? 'partial' : 'ok', result.metricRows,
       result.errors.length ? result.errors.join(' | ').slice(0, 2000) : null],
    );
  } catch (err: any) {
    result.errors.push(err.message);
    await pool.query(
      `UPDATE tiktok.sync_runs SET status='error', error=$2, rows_upserted=$3, finished_at=NOW() WHERE id=$1`,
      [runId, err.message, result.metricRows],
    );
    console.error('[tiktok-ads] erro:', err.message);
  }

  console.log(`[tiktok-ads] ${result.advertisers} advertisers, ${result.campaigns} campanhas, ${result.adGroups} adgroups, ${result.ads} anúncios, ${result.metricRows} métricas campanha, ${result.adMetricRows} métricas anúncio, ${result.errors.length} erros`);
  return result;
}
