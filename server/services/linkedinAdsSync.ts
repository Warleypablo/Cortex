/**
 * Sync de MÍDIA PAGA do LinkedIn (contas + campanhas + métricas diárias) → schema `linkedin`.
 *
 * Usa a credencial OAuth já existente (a mesma do orgânico, re-autorizada com
 * r_ads + r_ads_reporting). Endpoints REST versionados (LinkedIn-Version + Rest.li 2.0):
 *   - adAccountUsers?q=authenticatedUser → contas de anúncio que o membro acessa
 *   - adAccounts/{id}/adCampaigns?q=search → campanhas
 *   - adAnalytics?q=analytics&timeGranularity=DAILY&pivots=List(CAMPAIGN) → métricas/dia
 *
 * adAnalytics DAILY devolve valores do DIA (não cumulativos) → leitura agrega por SUM.
 * Guarda `raw` pra validar o shape (não testável local; token só abre em prod).
 */

import type { Pool } from 'pg';
import { encryptToken, decryptToken } from '../utils/encryption';

const LI_VERSION = '202605';
const LI_API = 'https://api.linkedin.com';
const LI_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';

export interface LinkedinAdsResult {
  accounts: number;
  campaigns: number;
  metricRows: number;
  errors: string[];
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

async function getValidAccessToken(pool: Pool, cred: any): Promise<string> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('LINKEDIN_CLIENT_ID/SECRET ausentes');

  const exp = cred.access_expires_at ? new Date(cred.access_expires_at).getTime() : 0;
  if (exp - Date.now() > 60 * 60 * 1000) return decryptToken(cred.access_token_enc);
  if (!cred.refresh_token_enc) return decryptToken(cred.access_token_enc);

  const res = await fetch(LI_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptToken(cred.refresh_token_enc),
      client_id: clientId, client_secret: clientSecret,
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) return decryptToken(cred.access_token_enc);
  const now = Date.now();
  await pool.query(
    `UPDATE linkedin.credentials SET access_token_enc=$2, refresh_token_enc=$3,
       access_expires_at=$4, refresh_expires_at=$5, last_used_at=NOW() WHERE id=$1`,
    [cred.id, encryptToken(j.access_token),
     j.refresh_token ? encryptToken(j.refresh_token) : cred.refresh_token_enc,
     j.expires_in ? new Date(now + j.expires_in * 1000) : null,
     j.refresh_token_expires_in ? new Date(now + j.refresh_token_expires_in * 1000) : null],
  );
  return j.access_token;
}

async function getJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: headers(token) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 250)}`);
  return JSON.parse(text);
}

// Extrai o ID numérico do fim de uma URN (urn:li:sponsoredCampaign:123 → "123").
const urnId = (urn: string) => String(urn || '').split(':').pop() || '';
const numOrNull = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));

/**
 * @param days janela de dias para trás (default 30).
 */
export async function syncLinkedinAds(pool: Pool, days = 30): Promise<LinkedinAdsResult> {
  const result: LinkedinAdsResult = { accounts: 0, campaigns: 0, metricRows: 0, errors: [] };

  const runRes = await pool.query(`INSERT INTO linkedin.sync_runs (kind, status) VALUES ('ads','running') RETURNING id`);
  const runId = runRes.rows[0].id;

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const dateRange =
    `(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),` +
    `end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`;

  try {
    const credRes = await pool.query(
      `SELECT id, access_token_enc, refresh_token_enc, access_expires_at
       FROM linkedin.credentials WHERE active = TRUE ORDER BY id DESC LIMIT 1`,
    );
    if (credRes.rows.length === 0) throw new Error('Nenhuma credencial LinkedIn ativa');
    const token = await getValidAccessToken(pool, credRes.rows[0]);
    const credId = credRes.rows[0].id;

    // 1. Descobrir contas de anúncio que o membro acessa.
    const accData = await getJson(`${LI_API}/rest/adAccountUsers?q=authenticatedUser`, token);
    const accElems: any[] = accData.elements || [];
    const accountIds: string[] = [];
    for (const el of accElems) {
      const accId = urnId(el.account); // urn:li:sponsoredAccount:510789514
      if (!accId) continue;
      // Detalhes da conta (nome/moeda/status).
      let det: any = {};
      try { det = await getJson(`${LI_API}/rest/adAccounts/${accId}`, token); } catch { /* segue com o básico */ }
      await pool.query(
        `INSERT INTO linkedin.ad_accounts (account_id, name, currency, status, type, credential_id, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW())
         ON CONFLICT (account_id) DO UPDATE SET
           name=EXCLUDED.name, currency=EXCLUDED.currency, status=EXCLUDED.status,
           type=EXCLUDED.type, credential_id=EXCLUDED.credential_id, synced_at=NOW()`,
        [accId, det.name || null, det.currency || null, det.status || null, det.type || null, credId],
      );
      accountIds.push(accId);
      result.accounts++;
    }

    for (const accId of accountIds) {
      try {
        // 2. Campanhas da conta.
        const campData = await getJson(`${LI_API}/rest/adAccounts/${accId}/adCampaigns?q=search`, token);
        for (const c of (campData.elements || [])) {
          const campaignId = String(c.id ?? urnId(c.campaign));
          if (!campaignId) continue;
          await pool.query(
            `INSERT INTO linkedin.ad_campaigns
               (campaign_id, account_id, campaign_name, status, type, objective_type, cost_type, raw, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
             ON CONFLICT (campaign_id) DO UPDATE SET
               account_id=EXCLUDED.account_id, campaign_name=EXCLUDED.campaign_name, status=EXCLUDED.status,
               type=EXCLUDED.type, objective_type=EXCLUDED.objective_type, cost_type=EXCLUDED.cost_type,
               raw=EXCLUDED.raw, synced_at=NOW()`,
            [campaignId, accId, c.name || null, c.status || null, c.type || null,
             c.objectiveType || null, c.costType || null, JSON.stringify(c)],
          );
          result.campaigns++;
        }

        // 3. Métricas diárias por campanha (adAnalytics, pivot CAMPAIGN).
        const acctUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accId}`);
        const fields = 'impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues';
        const url = `${LI_API}/rest/adAnalytics?q=analytics&dateRange=${dateRange}` +
          `&timeGranularity=DAILY&pivots=List(CAMPAIGN)&accounts=List(${acctUrn})&fields=${fields}`;
        const an = await getJson(url, token);
        for (const row of (an.elements || [])) {
          const campaignUrn = (row.pivotValues || [])[0];
          const campaignId = urnId(campaignUrn);
          const d = row.dateRange?.start;
          if (!campaignId || !d) continue;
          const statDate = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
          // FK exige a campanha; cria stub se o analytics trouxe campanha não listada.
          await pool.query(
            `INSERT INTO linkedin.ad_campaigns (campaign_id, account_id, synced_at)
             VALUES ($1,$2, NOW()) ON CONFLICT (campaign_id) DO NOTHING`,
            [campaignId, accId],
          );
          await pool.query(
            `INSERT INTO linkedin.ad_metrics_daily
               (campaign_id, stat_date, account_id, spend, impressions, clicks, conversions, raw, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
             ON CONFLICT (campaign_id, stat_date) DO UPDATE SET
               account_id=EXCLUDED.account_id, spend=EXCLUDED.spend, impressions=EXCLUDED.impressions,
               clicks=EXCLUDED.clicks, conversions=EXCLUDED.conversions, raw=EXCLUDED.raw, synced_at=NOW()`,
            [campaignId, statDate, accId,
             numOrNull(row.costInLocalCurrency), numOrNull(row.impressions), numOrNull(row.clicks),
             numOrNull(row.externalWebsiteConversions), JSON.stringify(row)],
          );
          result.metricRows++;
        }
      } catch (e: any) {
        result.errors.push(`account ${accId}: ${e.message}`);
        console.error(`[linkedin-ads] account ${accId}:`, e.message);
      }
    }

    await pool.query(
      `UPDATE linkedin.sync_runs SET status=$2, rows_upserted=$3, finished_at=NOW() WHERE id=$1`,
      [runId, result.errors.length ? 'partial' : 'ok', result.metricRows],
    );
  } catch (err: any) {
    result.errors.push(err.message);
    await pool.query(
      `UPDATE linkedin.sync_runs SET status='error', error=$2, rows_upserted=$3, finished_at=NOW() WHERE id=$1`,
      [runId, err.message, result.metricRows],
    );
    console.error('[linkedin-ads] erro:', err.message);
  }

  console.log(`[linkedin-ads] ${result.accounts} contas, ${result.campaigns} campanhas, ${result.metricRows} linhas, ${result.errors.length} erros`);
  return result;
}
