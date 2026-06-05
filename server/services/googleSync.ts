/**
 * Sync Google Ads da Turbo Partners → schema `google` (próprio do Cortex).
 *
 * Escopo: conta PRÓPRIA da Turbo (customer 3795436039), usando a MCC
 * 5156174278 como login-customer-id. Separado da pipeline multi-conta da
 * agência (`google_ads.*`).
 *
 * Reusa as credenciais OAuth de getGoogleAdsCredentials() (env GOOGLE_ADS_*).
 * API v20 (v18/v19 foram descontinuadas pelo Google).
 */

import { google } from 'googleapis';
import { getGoogleAdsCredentials } from '../autoreport/credentials';
import type { Pool } from 'pg';

const API_VERSION = 'v20';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

// Conta própria da Turbo (cliente sob a MCC). A MCC não retorna métricas.
export const TURBO_CUSTOMER_ID = '3795436039';

export interface GoogleSyncResult {
  campaigns: number;
  metrics: number;
  errors: string[];
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
  const result: GoogleSyncResult = { campaigns: 0, metrics: 0, errors: [] };
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

    // 2. Campanhas → upsert
    const camps = await gaql(customerId, `
      SELECT campaign.id, campaign.name, campaign.status,
             campaign.advertising_channel_type, campaign.advertising_channel_sub_type,
             campaign.bidding_strategy_type, campaign.start_date, campaign.end_date
      FROM campaign
      WHERE campaign.status != 'REMOVED'`);
    for (const row of camps) {
      const c2 = row.campaign || {};
      if (!c2.id) continue;
      await pool.query(
        `INSERT INTO google.campaigns
           (campaign_id, customer_id, name, status, advertising_channel_type,
            advertising_channel_subtype, bidding_strategy_type, start_date, end_date, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (campaign_id) DO UPDATE
           SET name = EXCLUDED.name, status = EXCLUDED.status,
               advertising_channel_type = EXCLUDED.advertising_channel_type,
               advertising_channel_subtype = EXCLUDED.advertising_channel_subtype,
               bidding_strategy_type = EXCLUDED.bidding_strategy_type,
               start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, updated_at = NOW()`,
        [
          String(c2.id), customerId, c2.name || '(sem nome)', c2.status || 'UNKNOWN',
          c2.advertisingChannelType || null, c2.advertisingChannelSubType || null,
          c2.biddingStrategyType || null, c2.startDate || null, c2.endDate || null,
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

  console.log(`[google-sync] Turbo: ${result.campaigns} campanhas, ${result.metrics} métricas, ${result.errors.length} erros`);
  return result;
}
