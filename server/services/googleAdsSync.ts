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
