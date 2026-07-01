/**
 * Sync Google Ads da Turbo Partners → schema `google` (próprio do Cortex).
 *
 * Escopo: conta PRÓPRIA da Turbo (customer 3795436039), usando a MCC
 * 5156174278 como login-customer-id. Separado da pipeline multi-conta da
 * agência (`google_ads.*`).
 *
 * Reusa as credenciais OAuth de getGoogleAdsCredentials() (env GOOGLE_ADS_*).
 * API v21 (v20 e anteriores descontinuadas — sondado 2026-06-21: v21..v24 ativas).
 * Usamos a mais antiga ainda ativa (v21) p/ minimizar breaking changes nas GAQL
 * escritas p/ v20; v24 acusou UNRECOGNIZED_FIELD por mudança de schema.
 */

import { google } from 'googleapis';
import { getGoogleAdsCredentials } from '../autoreport/credentials';
import type { Pool } from 'pg';

const API_VERSION = 'v21';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

// Conta própria da Turbo (cliente sob a MCC). A MCC não retorna métricas.
export const TURBO_CUSTOMER_ID = '3795436039';

export interface GoogleSyncResult {
  campaigns: number;
  metrics: number;
  adGroups: number;
  keywords: number;
  keywordMetrics: number;
  ads: number;
  adMetrics: number;
  errors: string[];
}

// Extrai os textos (headlines/descrições) de um anúncio responsivo (RSA/RDA/Demand Gen).
function extractAssetTexts(ad: any): { headlines: string[]; descriptions: string[] } {
  const pick = (arr: any): string[] =>
    Array.isArray(arr) ? arr.map((a: any) => a?.text).filter((t: any): t is string => !!t) : [];
  const rsa = ad?.responsiveSearchAd || {};
  const rda = ad?.responsiveDisplayAd || {};
  const dg = ad?.demandGenMultiAssetAd || ad?.demandGenProductAd || {};
  const headlines = [...pick(rsa.headlines), ...pick(rda.headlines), ...pick(dg.headlines)];
  const descriptions = [...pick(rsa.descriptions), ...pick(rda.descriptions), ...pick(dg.descriptions)];
  return { headlines, descriptions };
}

async function getAccessToken(): Promise<string> {
  const creds = getGoogleAdsCredentials();
  const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2.setCredentials({ refresh_token: creds.refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  return credentials.access_token || '';
}

async function gaql(customerId: string, query: string): Promise<any[]> {
  const creds = getGoogleAdsCredentials();
  const accessToken = await getAccessToken();
  const cleanId = customerId.replace(/\D/g, '');
  const loginId = creds.loginCustomerId.replace(/\D/g, '');
  const out: any[] = [];
  let pageToken: string | undefined;
  do {
    const body: any = { query }; // v20 não aceita pageSize
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': creds.developerToken,
        'login-customer-id': loginId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GAQL ${res.status}: ${t.slice(0, 400)}`);
    }
    const data = await res.json();
    out.push(...(data.results || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export async function syncGoogleTurbo(
  pool: Pool,
  options?: { customerId?: string; since?: string; until?: string },
): Promise<GoogleSyncResult> {
  const result: GoogleSyncResult = { campaigns: 0, metrics: 0, adGroups: 0, keywords: 0, keywordMetrics: 0, ads: 0, adMetrics: 0, errors: [] };
  const customerId = options?.customerId || TURBO_CUSTOMER_ID;
  const since = options?.since || new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const until = options?.until || new Date().toISOString().slice(0, 10);

  const runRes = await pool.query(
    `INSERT INTO google.sync_runs (status, since_date, until_date) VALUES ('running', $1, $2) RETURNING id`,
    [since, until],
  );
  const runId = runRes.rows[0].id;

  try {
    // 1. Conta (metadata) → upsert
    const info = await gaql(customerId, `
      SELECT customer.id, customer.descriptive_name, customer.currency_code,
             customer.time_zone, customer.manager
      FROM customer`);
    const c = info[0]?.customer;
    await pool.query(
      `INSERT INTO google.accounts (customer_id, descriptive_name, currency_code, time_zone, status, is_manager, synced_at)
       VALUES ($1, $2, $3, $4, 'ENABLED', $5, NOW())
       ON CONFLICT (customer_id) DO UPDATE
         SET descriptive_name = EXCLUDED.descriptive_name,
             currency_code = EXCLUDED.currency_code,
             time_zone = EXCLUDED.time_zone,
             is_manager = EXCLUDED.is_manager,
             synced_at = NOW()`,
      [customerId, c?.descriptiveName || 'Turbo Partners', c?.currencyCode || null, c?.timeZone || null, !!c?.manager],
    );

    // 2. Campanhas (+ orçamento) → upsert
    const camps = await gaql(customerId, `
      SELECT campaign.id, campaign.name, campaign.status,
             campaign.advertising_channel_type, campaign.advertising_channel_sub_type,
             campaign.bidding_strategy_type, campaign.start_date, campaign.end_date,
             campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'`);
    for (const row of camps) {
      const c2 = row.campaign || {};
      if (!c2.id) continue;
      const budgetMicros = row.campaignBudget?.amountMicros ?? null;
      await pool.query(
        `INSERT INTO google.campaigns
           (campaign_id, customer_id, name, status, advertising_channel_type,
            advertising_channel_subtype, bidding_strategy_type, budget_amount_micros, start_date, end_date, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (campaign_id) DO UPDATE
           SET name = EXCLUDED.name, status = EXCLUDED.status,
               advertising_channel_type = EXCLUDED.advertising_channel_type,
               advertising_channel_subtype = EXCLUDED.advertising_channel_subtype,
               bidding_strategy_type = EXCLUDED.bidding_strategy_type,
               budget_amount_micros = EXCLUDED.budget_amount_micros,
               start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, updated_at = NOW()`,
        [
          String(c2.id), customerId, c2.name || '(sem nome)', c2.status || 'UNKNOWN',
          c2.advertisingChannelType || null, c2.advertisingChannelSubType || null,
          c2.biddingStrategyType || null, budgetMicros != null ? String(budgetMicros) : null,
          c2.startDate || null, c2.endDate || null,
        ],
      );
      result.campaigns++;
    }

    // 3. Métricas diárias → upsert
    const metrics = await gaql(customerId, `
      SELECT segments.date, segments.device, segments.ad_network_type, campaign.id,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value, metrics.video_views
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status != 'REMOVED' AND metrics.impressions > 0`);
    for (const row of metrics) {
      const m = row.metrics || {};
      const campaignId = row.campaign?.id;
      if (!campaignId) continue;
      await pool.query(
        `INSERT INTO google.campaign_daily_metrics
           (report_date, campaign_id, device_type, network_type,
            impressions, clicks, cost_micros, conversions, conversion_value, video_views, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (report_date, campaign_id, device_type, network_type) DO UPDATE
           SET impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
               cost_micros = EXCLUDED.cost_micros, conversions = EXCLUDED.conversions,
               conversion_value = EXCLUDED.conversion_value, video_views = EXCLUDED.video_views,
               synced_at = NOW()`,
        [
          row.segments?.date, String(campaignId), row.segments?.device || 'UNSPECIFIED',
          row.segments?.adNetworkType || 'UNSPECIFIED',
          parseInt(m.impressions || '0', 10), parseInt(m.clicks || '0', 10),
          parseInt(m.costMicros || '0', 10), parseFloat(m.conversions || '0'),
          parseFloat(m.conversionsValue || '0'), parseInt(m.videoViews || '0', 10),
        ],
      );
      result.metrics++;
    }

    // 4. Ad groups → upsert
    const adGroups = await gaql(customerId, `
      SELECT ad_group.id, ad_group.campaign, ad_group.name, ad_group.status
      FROM ad_group
      WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'`);
    for (const row of adGroups) {
      const ag = row.adGroup || {};
      if (!ag.id) continue;
      const campaignId = ag.campaign ? String(ag.campaign).split('/').pop() : null;
      if (!campaignId) continue;
      await pool.query(
        `INSERT INTO google.ad_groups (ad_group_id, campaign_id, name, status, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (ad_group_id) DO UPDATE
           SET campaign_id = EXCLUDED.campaign_id, name = EXCLUDED.name,
               status = EXCLUDED.status, updated_at = NOW()`,
        [String(ag.id), campaignId, ag.name || null, ag.status || null],
      );
      result.adGroups++;
    }

    // 5. Keywords → upsert
    const kws = await gaql(customerId, `
      SELECT ad_group.id, ad_group_criterion.criterion_id,
             ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
             ad_group_criterion.status, ad_group_criterion.negative,
             ad_group_criterion.quality_info.quality_score
      FROM keyword_view
      WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'`);
    for (const row of kws) {
      const agId = row.adGroup?.id;
      const crit = row.adGroupCriterion?.criterionId;
      if (!agId || !crit) continue;
      await pool.query(
        `INSERT INTO google.keywords (ad_group_id, criterion_id, text, match_type, status, negative, quality_score, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (ad_group_id, criterion_id) DO UPDATE
           SET text = EXCLUDED.text, match_type = EXCLUDED.match_type, status = EXCLUDED.status,
               negative = EXCLUDED.negative, quality_score = EXCLUDED.quality_score, updated_at = NOW()`,
        [
          String(agId), String(crit), row.adGroupCriterion?.keyword?.text || null,
          row.adGroupCriterion?.keyword?.matchType || null, row.adGroupCriterion?.status || null,
          row.adGroupCriterion?.negative || false, row.adGroupCriterion?.qualityInfo?.qualityScore ?? null,
        ],
      );
      result.keywords++;
    }

    // 6. Métricas diárias de keyword → upsert
    const kwMetrics = await gaql(customerId, `
      SELECT segments.date, segments.device, segments.ad_network_type,
             ad_group.id, ad_group_criterion.criterion_id,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value,
             ad_group_criterion.quality_info.quality_score
      FROM keyword_view
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
        AND metrics.impressions > 0`);
    for (const row of kwMetrics) {
      const agId = row.adGroup?.id;
      const crit = row.adGroupCriterion?.criterionId;
      if (!agId || !crit) continue;
      const m = row.metrics || {};
      await pool.query(
        `INSERT INTO google.keyword_daily_metrics
           (report_date, ad_group_id, criterion_id, device_type, network_type,
            impressions, clicks, cost_micros, conversions, conversion_value, quality_score, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (report_date, ad_group_id, criterion_id, device_type, network_type) DO UPDATE
           SET impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks, cost_micros = EXCLUDED.cost_micros,
               conversions = EXCLUDED.conversions, conversion_value = EXCLUDED.conversion_value,
               quality_score = EXCLUDED.quality_score, synced_at = NOW()`,
        [
          row.segments?.date, String(agId), String(crit),
          row.segments?.device || 'UNSPECIFIED', row.segments?.adNetworkType || 'UNSPECIFIED',
          parseInt(m.impressions || '0', 10), parseInt(m.clicks || '0', 10), parseInt(m.costMicros || '0', 10),
          parseFloat(m.conversions || '0'), parseFloat(m.conversionsValue || '0'),
          row.adGroupCriterion?.qualityInfo?.qualityScore ?? null,
        ],
      );
      result.keywordMetrics++;
    }

    // 7. Anúncios (ad_group_ad) → upsert. PMax não tem ad_group_ad (usa asset groups) → fica de fora.
    const ads = await gaql(customerId, `
      SELECT ad_group.id, campaign.id,
             ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
             ad_group_ad.status, ad_group_ad.ad.final_urls,
             ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions,
             ad_group_ad.ad.responsive_display_ad.headlines,
             ad_group_ad.ad.responsive_display_ad.descriptions
      FROM ad_group_ad
      WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
        AND ad_group_ad.status != 'REMOVED'`);
    for (const row of ads) {
      const ga2 = row.adGroupAd || {};
      const ad = ga2.ad || {};
      const adId = ad.id;
      const agId = row.adGroup?.id;
      if (!adId || !agId) continue;
      const campaignId = row.campaign?.id ? String(row.campaign.id) : null;
      const finalUrls = Array.isArray(ad.finalUrls) ? ad.finalUrls : [];
      const { headlines, descriptions } = extractAssetTexts(ad);
      await pool.query(
        `INSERT INTO google.ads
           (ad_id, ad_group_id, campaign_id, name, ad_type, status, final_urls, headlines, descriptions, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (ad_id) DO UPDATE
           SET ad_group_id = EXCLUDED.ad_group_id, campaign_id = EXCLUDED.campaign_id,
               name = EXCLUDED.name, ad_type = EXCLUDED.ad_type, status = EXCLUDED.status,
               final_urls = EXCLUDED.final_urls, headlines = EXCLUDED.headlines,
               descriptions = EXCLUDED.descriptions, updated_at = NOW()`,
        [
          String(adId), String(agId), campaignId,
          ad.name || null, ad.type || null, ga2.status || null,
          finalUrls.length ? JSON.stringify(finalUrls) : null,
          headlines.length ? JSON.stringify(headlines) : null,
          descriptions.length ? JSON.stringify(descriptions) : null,
        ],
      );
      result.ads++;
    }

    // 8. Métricas diárias de anúncio → upsert.
    const adMetrics = await gaql(customerId, `
      SELECT segments.date, segments.device, segments.ad_network_type,
             ad_group_ad.ad.id,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value, metrics.video_views,
             metrics.view_through_conversions, metrics.all_conversions,
             metrics.interactions, metrics.engagements
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
        AND metrics.impressions > 0`);
    for (const row of adMetrics) {
      const adId = row.adGroupAd?.ad?.id;
      if (!adId) continue;
      const m = row.metrics || {};
      await pool.query(
        `INSERT INTO google.ad_daily_metrics
           (report_date, ad_id, device_type, network_type,
            impressions, clicks, cost_micros, conversions, conversion_value, video_views,
            view_through_conversions, all_conversions, interactions, engagements, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         ON CONFLICT (report_date, ad_id, device_type, network_type) DO UPDATE
           SET impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
               cost_micros = EXCLUDED.cost_micros, conversions = EXCLUDED.conversions,
               conversion_value = EXCLUDED.conversion_value, video_views = EXCLUDED.video_views,
               view_through_conversions = EXCLUDED.view_through_conversions,
               all_conversions = EXCLUDED.all_conversions,
               interactions = EXCLUDED.interactions, engagements = EXCLUDED.engagements,
               synced_at = NOW()`,
        [
          row.segments?.date, String(adId), row.segments?.device || 'UNSPECIFIED',
          row.segments?.adNetworkType || 'UNSPECIFIED',
          parseInt(m.impressions || '0', 10), parseInt(m.clicks || '0', 10),
          parseInt(m.costMicros || '0', 10), parseFloat(m.conversions || '0'),
          parseFloat(m.conversionsValue || '0'), parseInt(m.videoViews || '0', 10),
          parseInt(m.viewThroughConversions || '0', 10), parseFloat(m.allConversions || '0'),
          parseInt(m.interactions || '0', 10), parseInt(m.engagements || '0', 10),
        ],
      );
      result.adMetrics++;
    }

    // 9. Impression Share por AD GROUP (a API só expõe IS em campaign/ad_group, nunca
    // em ad_group_ad). Guardado por dia p/ permitir ponderação por impressões no período.
    const agMetrics = await gaql(customerId, `
      SELECT segments.date, ad_group.id,
             metrics.impressions,
             metrics.search_impression_share,
             metrics.search_top_impression_share,
             metrics.search_absolute_top_impression_share
      FROM ad_group
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
        AND metrics.impressions > 0`);
    for (const row of agMetrics) {
      const adGroupId = row.adGroup?.id;
      if (!adGroupId) continue;
      const m = row.metrics || {};
      // IS pode não vir (campanhas non-search): grava NULL, não 0, p/ não poluir a média.
      const numOrNull = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
      await pool.query(
        `INSERT INTO google.ad_group_daily_metrics
           (report_date, ad_group_id, impressions,
            search_impression_share, search_top_impression_share, search_absolute_top_impression_share, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (report_date, ad_group_id) DO UPDATE
           SET impressions = EXCLUDED.impressions,
               search_impression_share = EXCLUDED.search_impression_share,
               search_top_impression_share = EXCLUDED.search_top_impression_share,
               search_absolute_top_impression_share = EXCLUDED.search_absolute_top_impression_share,
               synced_at = NOW()`,
        [
          row.segments?.date, String(adGroupId), parseInt(m.impressions || '0', 10),
          numOrNull(m.searchImpressionShare), numOrNull(m.searchTopImpressionShare),
          numOrNull(m.searchAbsoluteTopImpressionShare),
        ],
      );
    }

    await pool.query(
      `UPDATE google.sync_runs SET status='ok', campaigns=$2, metrics=$3, finished_at=NOW() WHERE id=$1`,
      [runId, result.campaigns, result.metrics],
    );
  } catch (err: any) {
    result.errors.push(err.message);
    await pool.query(
      `UPDATE google.sync_runs SET status='error', error=$2, campaigns=$3, metrics=$4, finished_at=NOW() WHERE id=$1`,
      [runId, err.message, result.campaigns, result.metrics],
    );
    console.error('[google-sync] erro:', err.message);
  }

  console.log(`[google-sync] Turbo: ${result.campaigns} campanhas, ${result.metrics} métricas, ${result.adGroups} ad_groups, ${result.keywords} keywords, ${result.keywordMetrics} kw-métricas, ${result.ads} ads, ${result.adMetrics} ad-métricas, ${result.errors.length} erros`);
  return result;
}
