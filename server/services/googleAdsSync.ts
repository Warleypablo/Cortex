import { google } from 'googleapis';
import { getGoogleAdsCredentials } from '../autoreport/credentials';
import type { Pool } from 'pg';

const API_VERSION = 'v18';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

export interface GoogleAdsSyncResult {
  keywords: number;
  keywordMetrics: number;
  errors: string[];
}

export interface GoogleAdsCampaignSyncResult {
  campaigns: number;
  campaignMetrics: number;
  errors: string[];
}

async function getAccessToken(): Promise<string> {
  const creds = getGoogleAdsCredentials();
  const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token || '';
}

async function gaqlSearch(
  customerId: string,
  query: string,
  accessToken: string,
  developerToken: string,
  loginCustomerId: string,
): Promise<any[]> {
  const cleanId = customerId.replace(/\D/g, '');
  const url = `${API_BASE}/customers/${cleanId}/googleAds:search`;
  const allResults: any[] = [];
  let pageToken: string | undefined;

  do {
    const body: any = { query, pageSize: 10000 };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'login-customer-id': loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GAQL ${response.status}: ${errText.substring(0, 500)}`);
    }

    const data = await response.json();
    const results = data.results || [];
    allResults.push(...results);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allResults;
}

export async function syncGoogleAdsKeywords(
  pool: Pool,
  options?: { since?: string; until?: string },
): Promise<GoogleAdsSyncResult> {
  const result: GoogleAdsSyncResult = { keywords: 0, keywordMetrics: 0, errors: [] };

  try {
    const creds = getGoogleAdsCredentials();
    const accessToken = await getAccessToken();

    // 1. Get customer IDs from accounts table
    const accountsRes = await pool.query(
      `SELECT customer_id FROM google_ads.accounts WHERE status != 'REMOVED'`,
    );
    const customerIds = accountsRes.rows.map((r: any) => String(r.customer_id));

    if (customerIds.length === 0) {
      result.errors.push('No Google Ads accounts found');
      return result;
    }
    console.log(`[google-ads-sync] Found ${customerIds.length} accounts`);

    // 2. Build ad_group_id -> ad_group_key mapping
    const adGroupsRes = await pool.query(
      'SELECT ad_group_key, ad_group_id FROM google_ads.ad_groups',
    );
    const adGroupMap = new Map<string, number>();
    for (const row of adGroupsRes.rows) {
      adGroupMap.set(String(row.ad_group_id), row.ad_group_key);
    }
    console.log(`[google-ads-sync] Loaded ${adGroupMap.size} ad_group mappings`);

    // 3. Sync keywords for each customer
    for (const customerId of customerIds) {
      try {
        const keywordQuery = `
          SELECT
            ad_group.id,
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            ad_group_criterion.negative,
            ad_group_criterion.effective_cpc_bid_micros,
            ad_group_criterion.quality_info.quality_score
          FROM keyword_view
          WHERE campaign.status != 'REMOVED'
            AND ad_group.status != 'REMOVED'
        `;

        const rows = await gaqlSearch(customerId, keywordQuery, accessToken, creds.developerToken, creds.loginCustomerId);
        console.log(`[google-ads-sync] Customer ${customerId}: ${rows.length} keywords fetched`);

        for (const row of rows) {
          const adGroupId = row.adGroup?.id;
          const criterionId = row.adGroupCriterion?.criterionId;
          const text = row.adGroupCriterion?.keyword?.text;
          const matchType = row.adGroupCriterion?.keyword?.matchType;
          const status = row.adGroupCriterion?.status;
          const negative = row.adGroupCriterion?.negative || false;
          const cpcBidMicros = row.adGroupCriterion?.effectiveCpcBidMicros || null;
          const qualityScore = row.adGroupCriterion?.qualityInfo?.qualityScore || null;

          const adGroupKey = adGroupMap.get(String(adGroupId));
          if (!adGroupKey || !criterionId || !text) continue;

          await pool.query(
            `INSERT INTO google_ads.keywords
              (ad_group_key, criterion_id, text, match_type, status, negative, cpc_bid_micros, quality_score, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (ad_group_key, criterion_id)
             DO UPDATE SET text = $3, match_type = $4, status = $5, negative = $6,
                           cpc_bid_micros = $7, quality_score = $8, updated_at = NOW()`,
            [adGroupKey, criterionId, text, matchType, status, negative, cpcBidMicros, qualityScore],
          );
          result.keywords++;
        }
      } catch (err: any) {
        result.errors.push(`Keywords ${customerId}: ${err.message}`);
        console.error(`[google-ads-sync] Keywords error for ${customerId}:`, err.message);
      }
    }

    // 4. Build keyword mapping for metrics: (ad_group_key:criterion_id) -> keyword_key
    const keywordMapRes = await pool.query(
      'SELECT keyword_key, ad_group_key, criterion_id FROM google_ads.keywords',
    );
    const keywordMap = new Map<string, number>();
    for (const row of keywordMapRes.rows) {
      keywordMap.set(`${row.ad_group_key}:${row.criterion_id}`, row.keyword_key);
    }
    console.log(`[google-ads-sync] Loaded ${keywordMap.size} keyword mappings for metrics`);

    if (keywordMap.size === 0) {
      console.log('[google-ads-sync] No keywords found, skipping metrics sync');
      return result;
    }

    // 5. Sync keyword daily metrics (default: last 90 days)
    const since = options?.since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = options?.until || new Date().toISOString().split('T')[0];
    console.log(`[google-ads-sync] Fetching metrics from ${since} to ${until}`);

    for (const customerId of customerIds) {
      try {
        const metricsQuery = `
          SELECT
            segments.date,
            segments.device,
            segments.ad_network_type,
            ad_group.id,
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.match_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            ad_group_criterion.quality_info.quality_score
          FROM keyword_view
          WHERE segments.date BETWEEN '${since}' AND '${until}'
            AND campaign.status != 'REMOVED'
            AND ad_group.status != 'REMOVED'
            AND metrics.impressions > 0
        `;

        const rows = await gaqlSearch(customerId, metricsQuery, accessToken, creds.developerToken, creds.loginCustomerId);
        console.log(`[google-ads-sync] Customer ${customerId}: ${rows.length} keyword metric rows`);

        for (const row of rows) {
          const adGroupId = row.adGroup?.id;
          const criterionId = row.adGroupCriterion?.criterionId;
          const adGroupKey = adGroupMap.get(String(adGroupId));
          if (!adGroupKey) continue;

          const keywordKey = keywordMap.get(`${adGroupKey}:${criterionId}`);
          if (!keywordKey) continue;

          const reportDate = row.segments?.date;
          const deviceType = row.segments?.device || 'UNSPECIFIED';
          const networkType = row.segments?.adNetworkType || 'UNSPECIFIED';
          const matchType = row.adGroupCriterion?.keyword?.matchType || 'UNSPECIFIED';
          const impressions = parseInt(row.metrics?.impressions || '0');
          const clicks = parseInt(row.metrics?.clicks || '0');
          const costMicros = parseInt(row.metrics?.costMicros || '0');
          const conversions = parseFloat(row.metrics?.conversions || '0');
          const conversionValue = parseFloat(row.metrics?.conversionsValue || '0');
          const qualityScore = row.adGroupCriterion?.qualityInfo?.qualityScore || null;

          await pool.query(
            `INSERT INTO google_ads.keyword_daily_metrics
              (report_date, keyword_key, device_type, network_type, match_type,
               impressions, clicks, cost_micros, conversions, conversion_value, quality_score)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (report_date, keyword_key, device_type, network_type, match_type)
             DO UPDATE SET impressions = $6, clicks = $7, cost_micros = $8,
                           conversions = $9, conversion_value = $10, quality_score = $11`,
            [reportDate, keywordKey, deviceType, networkType, matchType,
             impressions, clicks, costMicros, conversions, conversionValue, qualityScore],
          );
          result.keywordMetrics++;
        }
      } catch (err: any) {
        result.errors.push(`Metrics ${customerId}: ${err.message}`);
        console.error(`[google-ads-sync] Metrics error for ${customerId}:`, err.message);
      }
    }

    console.log(`[google-ads-sync] Complete: ${result.keywords} keywords, ${result.keywordMetrics} metric rows, ${result.errors.length} errors`);
  } catch (err: any) {
    result.errors.push(`Fatal: ${err.message}`);
    console.error('[google-ads-sync] Fatal error:', err.message);
  }

  return result;
}

// ============================================================
// Sync de CAMPANHAS (metadata + métricas diárias)
//
// Popula:
//   - google_ads.campaigns (1 linha por campanha)
//   - google_ads.campaign_daily_metrics (1 linha por dia × campanha × device × network)
//
// Schema esperado:
//   campaigns: campaign_key (serial), account_key, campaign_id (unique),
//              name, status, advertising_channel_type, ...
//   campaign_daily_metrics: report_date, campaign_key, device_type, network_type,
//              impressions, clicks, cost_micros, conversions, conversion_value, ...
// ============================================================

export async function syncGoogleAdsCampaigns(
  pool: Pool,
  options?: { customerId?: string; since?: string; until?: string },
): Promise<GoogleAdsCampaignSyncResult> {
  const result: GoogleAdsCampaignSyncResult = { campaigns: 0, campaignMetrics: 0, errors: [] };

  try {
    const creds = getGoogleAdsCredentials();
    const accessToken = await getAccessToken();

    // 1. Resolve customers a sincronizar (default: todos ativos)
    const customerQuery = options?.customerId
      ? `SELECT account_key, customer_id FROM google_ads.accounts WHERE customer_id = '${options.customerId}'`
      : `SELECT account_key, customer_id FROM google_ads.accounts WHERE status != 'REMOVED'`;
    const accountsRes = await pool.query(customerQuery);
    if (accountsRes.rows.length === 0) {
      result.errors.push('Nenhum account encontrado');
      return result;
    }
    console.log(`[google-ads-sync] Campanhas: ${accountsRes.rows.length} account(s) a processar`);

    // 2. Sync metadata das campanhas por account
    for (const acct of accountsRes.rows) {
      const customerId = String(acct.customer_id);
      const accountKey = acct.account_key;
      try {
        const query = `
          SELECT
            campaign.id,
            campaign.resource_name,
            campaign.name,
            campaign.status,
            campaign.serving_status,
            campaign.advertising_channel_type,
            campaign.advertising_channel_sub_type,
            campaign.bidding_strategy_type,
            campaign.base_campaign,
            campaign.start_date,
            campaign.end_date
          FROM campaign
          WHERE campaign.status != 'REMOVED'
        `;
        const rows = await gaqlSearch(customerId, query, accessToken, creds.developerToken, creds.loginCustomerId);
        console.log(`[google-ads-sync] Customer ${customerId}: ${rows.length} campanhas`);

        for (const row of rows) {
          const c = row.campaign || {};
          const campaignId = c.id;
          if (!campaignId) continue;
          const baseCampaignId = c.baseCampaign
            ? String(c.baseCampaign).split('/').pop()
            : null;
          await pool.query(
            `INSERT INTO google_ads.campaigns
               (account_key, campaign_id, resource_name, name, status, serving_status,
                advertising_channel_type, advertising_channel_subtype, bidding_strategy_type,
                base_campaign_id, start_date, end_date, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             ON CONFLICT (campaign_id) DO UPDATE
               SET name = EXCLUDED.name,
                   status = EXCLUDED.status,
                   serving_status = EXCLUDED.serving_status,
                   advertising_channel_type = EXCLUDED.advertising_channel_type,
                   advertising_channel_subtype = EXCLUDED.advertising_channel_subtype,
                   bidding_strategy_type = EXCLUDED.bidding_strategy_type,
                   base_campaign_id = EXCLUDED.base_campaign_id,
                   start_date = EXCLUDED.start_date,
                   end_date = EXCLUDED.end_date,
                   updated_at = NOW()`,
            [
              accountKey,
              campaignId,
              c.resourceName || null,
              c.name || '(sem nome)',
              c.status || 'UNKNOWN',
              c.servingStatus || null,
              c.advertisingChannelType || 'UNSPECIFIED',
              c.advertisingChannelSubType || null,
              c.biddingStrategyType || null,
              baseCampaignId,
              c.startDate || null,
              c.endDate || null,
            ],
          );
          result.campaigns++;
        }
      } catch (err: any) {
        result.errors.push(`Campanhas ${customerId}: ${err.message}`);
        console.error(`[google-ads-sync] Campanhas error ${customerId}:`, err.message);
      }
    }

    // 3. Build campaign mapping (campaign_id -> campaign_key) pra métricas
    const customerIds = accountsRes.rows.map((r: any) => String(r.customer_id));
    const accountKeys = accountsRes.rows.map((r: any) => r.account_key);
    const campMapRes = await pool.query(
      `SELECT campaign_key, campaign_id FROM google_ads.campaigns WHERE account_key = ANY($1)`,
      [accountKeys],
    );
    const campMap = new Map<string, number>();
    for (const row of campMapRes.rows) {
      campMap.set(String(row.campaign_id), row.campaign_key);
    }
    if (campMap.size === 0) {
      console.log('[google-ads-sync] sem campanhas → pulando métricas');
      return result;
    }

    // 4. Sync métricas diárias por campanha (default últimos 90 dias)
    const since = options?.since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = options?.until || new Date().toISOString().split('T')[0];
    console.log(`[google-ads-sync] Métricas campanhas: ${since} → ${until}`);

    for (const customerId of customerIds) {
      try {
        const metricsQuery = `
          SELECT
            segments.date,
            segments.device,
            segments.ad_network_type,
            campaign.id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.all_conversions,
            metrics.view_through_conversions,
            metrics.interactions,
            metrics.engagement_rate,
            metrics.video_views
          FROM campaign
          WHERE segments.date BETWEEN '${since}' AND '${until}'
            AND campaign.status != 'REMOVED'
            AND metrics.impressions > 0
        `;
        const rows = await gaqlSearch(customerId, metricsQuery, accessToken, creds.developerToken, creds.loginCustomerId);
        console.log(`[google-ads-sync] Customer ${customerId}: ${rows.length} linhas de métricas`);

        for (const row of rows) {
          const campaignId = row.campaign?.id;
          const campaignKey = campMap.get(String(campaignId));
          if (!campaignKey) continue;

          const reportDate = row.segments?.date;
          const deviceType = row.segments?.device || 'UNSPECIFIED';
          const networkType = row.segments?.adNetworkType || 'UNSPECIFIED';
          const m = row.metrics || {};

          await pool.query(
            `INSERT INTO google_ads.campaign_daily_metrics
               (report_date, campaign_key, device_type, network_type,
                impressions, clicks, cost_micros, conversions, conversion_value,
                all_conversions, view_through_conversions, interactions, engagement_rate, video_views)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (report_date, campaign_key, device_type, network_type)
             DO UPDATE SET impressions = EXCLUDED.impressions,
                           clicks = EXCLUDED.clicks,
                           cost_micros = EXCLUDED.cost_micros,
                           conversions = EXCLUDED.conversions,
                           conversion_value = EXCLUDED.conversion_value,
                           all_conversions = EXCLUDED.all_conversions,
                           view_through_conversions = EXCLUDED.view_through_conversions,
                           interactions = EXCLUDED.interactions,
                           engagement_rate = EXCLUDED.engagement_rate,
                           video_views = EXCLUDED.video_views`,
            [
              reportDate,
              campaignKey,
              deviceType,
              networkType,
              parseInt(m.impressions || '0', 10),
              parseInt(m.clicks || '0', 10),
              parseInt(m.costMicros || '0', 10),
              parseFloat(m.conversions || '0'),
              parseFloat(m.conversionsValue || '0'),
              parseFloat(m.allConversions || '0'),
              parseInt(m.viewThroughConversions || '0', 10),
              parseInt(m.interactions || '0', 10),
              parseFloat(m.engagementRate || '0'),
              parseInt(m.videoViews || '0', 10),
            ],
          );
          result.campaignMetrics++;
        }
      } catch (err: any) {
        result.errors.push(`Métricas ${customerId}: ${err.message}`);
        console.error(`[google-ads-sync] Métricas error ${customerId}:`, err.message);
      }
    }

    console.log(`[google-ads-sync] Campanhas: ${result.campaigns} upserts, ${result.campaignMetrics} métricas, ${result.errors.length} erros`);
  } catch (err: any) {
    result.errors.push(`Fatal: ${err.message}`);
    console.error('[google-ads-sync] Fatal error campanhas:', err.message);
  }

  return result;
}
