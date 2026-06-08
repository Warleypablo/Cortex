/**
 * Sync orgânico do LinkedIn (Company Page) → schema `linkedin`.
 *
 * Para cada organização em linkedin.organizations:
 *   - networkSizes               → total de seguidores  → follower_stats_daily
 *   - organizationPageStatistics → page views (lifetime) → page_stats_daily
 *   - organizationalEntityShareStatistics → engajamento  → share_stats_daily
 *
 * Estratégia v1: SNAPSHOT diário dos totais (lifetime). O histórico nasce dos
 * snapshots ao longo do tempo. Guarda o JSON cru em `raw` pra validar o shape.
 * (Breakdown diário verdadeiro via timeIntervals pode vir depois.)
 *
 * Token (~60 dias) refrescado com o refresh_token salvo. Roda em PROD
 * (token encriptado com a chave de prod; não testável local).
 */

import type { Pool } from 'pg';
import { encryptToken, decryptToken } from '../utils/encryption';

const LI_VERSION = '202605';
const LI_API = 'https://api.linkedin.com';
const LI_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';

export interface LinkedinSyncResult {
  organizations: number;
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
  if (!cred.refresh_token_enc) return decryptToken(cred.access_token_enc); // tenta o atual

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
  if (!res.ok || !j.access_token) {
    // se o refresh falhar, tenta o token atual (pode ainda estar válido)
    return decryptToken(cred.access_token_enc);
  }
  const now = Date.now();
  await pool.query(
    `UPDATE linkedin.credentials SET access_token_enc=$2, refresh_token_enc=$3,
       access_expires_at=$4, refresh_expires_at=$5, last_used_at=NOW() WHERE id=$1`,
    [
      cred.id, encryptToken(j.access_token),
      j.refresh_token ? encryptToken(j.refresh_token) : cred.refresh_token_enc,
      j.expires_in ? new Date(now + j.expires_in * 1000) : null,
      j.refresh_token_expires_in ? new Date(now + j.refresh_token_expires_in * 1000) : null,
    ],
  );
  return j.access_token;
}

async function getJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: headers(token) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 250)}`);
  return JSON.parse(text);
}

export async function syncLinkedin(pool: Pool): Promise<LinkedinSyncResult> {
  const result: LinkedinSyncResult = { organizations: 0, errors: [] };
  const today = new Date().toISOString().slice(0, 10);

  const runRes = await pool.query(`INSERT INTO linkedin.sync_runs (kind, status) VALUES ('organic','running') RETURNING id`);
  const runId = runRes.rows[0].id;

  try {
    const orgsRes = await pool.query(`
      SELECT o.org_id, c.id AS cred_id, c.access_token_enc, c.refresh_token_enc, c.access_expires_at
      FROM linkedin.organizations o
      JOIN linkedin.credentials c ON c.id = o.credential_id AND c.active = TRUE`);
    if (orgsRes.rows.length === 0) throw new Error('Nenhuma organização LinkedIn com credencial ativa');

    for (const row of orgsRes.rows) {
      const orgId = String(row.org_id);
      const urn = `urn:li:organization:${orgId}`;
      const encUrn = encodeURIComponent(urn);
      try {
        const token = await getValidAccessToken(pool, {
          id: row.cred_id, access_token_enc: row.access_token_enc,
          refresh_token_enc: row.refresh_token_enc, access_expires_at: row.access_expires_at,
        });

        // 1. Total de seguidores (networkSizes)
        let totalFollowers: number | null = null;
        try {
          const ns = await getJson(`${LI_API}/rest/networkSizes/${encUrn}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`, token);
          totalFollowers = ns.firstDegreeSize ?? null;
        } catch (e: any) { result.errors.push(`networkSizes ${orgId}: ${e.message}`); }

        // 2. Page views (lifetime)
        try {
          const ps = await getJson(`${LI_API}/rest/organizationPageStatistics?q=organization&organization=${encUrn}`, token);
          const v = ps.elements?.[0]?.totalPageStatistics?.views || {};
          await pool.query(
            `INSERT INTO linkedin.page_stats_daily
               (org_id, stat_date, all_page_views, unique_page_views, desktop_page_views, mobile_page_views, raw, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
             ON CONFLICT (org_id, stat_date) DO UPDATE SET
               all_page_views=EXCLUDED.all_page_views, unique_page_views=EXCLUDED.unique_page_views,
               desktop_page_views=EXCLUDED.desktop_page_views, mobile_page_views=EXCLUDED.mobile_page_views,
               raw=EXCLUDED.raw, synced_at=NOW()`,
            [orgId, today,
             v.allPageViews?.pageViews ?? null, v.allPageViews?.uniquePageViews ?? v.allPageViews?.uniqueDailyVisitors ?? null,
             v.desktopPageViews?.pageViews ?? null, v.mobilePageViews?.pageViews ?? null,
             JSON.stringify(ps.elements?.[0] ?? ps)],
          );
        } catch (e: any) { result.errors.push(`pageStats ${orgId}: ${e.message}`); }

        // 3. Seguidores (snapshot do total)
        await pool.query(
          `INSERT INTO linkedin.follower_stats_daily (org_id, stat_date, total_followers, raw, synced_at)
           VALUES ($1,$2,$3,$4, NOW())
           ON CONFLICT (org_id, stat_date) DO UPDATE SET total_followers=EXCLUDED.total_followers, raw=EXCLUDED.raw, synced_at=NOW()`,
          [orgId, today, totalFollowers, JSON.stringify({ firstDegreeSize: totalFollowers })],
        );

        // 4. Engajamento (lifetime)
        try {
          const ss = await getJson(`${LI_API}/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encUrn}`, token);
          const t = ss.elements?.[0]?.totalShareStatistics || {};
          await pool.query(
            `INSERT INTO linkedin.share_stats_daily
               (org_id, stat_date, impressions, unique_impressions, clicks, likes, comments, shares, engagement, raw, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
             ON CONFLICT (org_id, stat_date) DO UPDATE SET
               impressions=EXCLUDED.impressions, unique_impressions=EXCLUDED.unique_impressions, clicks=EXCLUDED.clicks,
               likes=EXCLUDED.likes, comments=EXCLUDED.comments, shares=EXCLUDED.shares,
               engagement=EXCLUDED.engagement, raw=EXCLUDED.raw, synced_at=NOW()`,
            [orgId, today,
             t.impressionCount ?? null, t.uniqueImpressionsCount ?? null, t.clickCount ?? null,
             t.likeCount ?? null, t.commentCount ?? null, t.shareCount ?? null, t.engagement ?? null,
             JSON.stringify(ss.elements?.[0] ?? ss)],
          );
        } catch (e: any) { result.errors.push(`shareStats ${orgId}: ${e.message}`); }

        // 5. Posts publicados (Posts API, q=author) — exige r_organization_social no token.
        // Paginação start/count; busca os mais recentes e faz upsert. O histórico se
        // acumula na tabela ao longo das execuções; o dashboard conta por created_at.
        try {
          const pageSize = 50;
          const maxPages = 6; // ~300 posts mais recentes por execução
          for (let page = 0; page < maxPages; page++) {
            const start = page * pageSize;
            const pr = await getJson(
              `${LI_API}/rest/posts?q=author&author=${encUrn}&count=${pageSize}&start=${start}&sortBy=LAST_MODIFIED`,
              token,
            );
            const elements: any[] = pr.elements || [];
            if (elements.length === 0) break;
            for (const p of elements) {
              const createdMs = p.createdAt ?? p.firstPublishedAt ?? null;
              const modifiedMs = p.lastModifiedAt ?? null;
              await pool.query(
                `INSERT INTO linkedin.posts
                   (post_urn, org_id, created_at, last_modified_at, lifecycle_state, visibility, commentary, raw, synced_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
                 ON CONFLICT (post_urn) DO UPDATE SET
                   last_modified_at=EXCLUDED.last_modified_at, lifecycle_state=EXCLUDED.lifecycle_state,
                   visibility=EXCLUDED.visibility, commentary=EXCLUDED.commentary, raw=EXCLUDED.raw, synced_at=NOW()`,
                [
                  p.id, orgId,
                  createdMs ? new Date(createdMs) : null,
                  modifiedMs ? new Date(modifiedMs) : null,
                  p.lifecycleState ?? null,
                  typeof p.visibility === 'string' ? p.visibility : JSON.stringify(p.visibility ?? null),
                  (typeof p.commentary === 'string' ? p.commentary : '').slice(0, 2000),
                  JSON.stringify(p),
                ],
              );
            }
            if (elements.length < pageSize) break;
          }
        } catch (e: any) { result.errors.push(`posts ${orgId}: ${e.message}`); }

        // atualiza follower_count na organização
        if (totalFollowers != null) {
          await pool.query(`UPDATE linkedin.organizations SET follower_count=$2, synced_at=NOW() WHERE org_id=$1`, [orgId, totalFollowers]);
        }
        result.organizations++;
      } catch (e: any) {
        result.errors.push(`org ${orgId}: ${e.message}`);
      }
    }

    await pool.query(`UPDATE linkedin.sync_runs SET status='ok', rows_upserted=$2, finished_at=NOW() WHERE id=$1`, [runId, result.organizations]);
  } catch (err: any) {
    result.errors.push(err.message);
    await pool.query(`UPDATE linkedin.sync_runs SET status='error', error=$2, finished_at=NOW() WHERE id=$1`, [runId, err.message]);
    console.error('[linkedin-sync] erro:', err.message);
  }

  console.log(`[linkedin-sync] ${result.organizations} orgs, ${result.errors.length} erros`);
  return result;
}
