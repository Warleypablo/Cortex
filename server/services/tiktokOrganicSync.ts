/**
 * Sync orgânico do TikTok (perfil + vídeos + métricas) → schema `tiktok`.
 *
 * Usa a credencial do fluxo "account" (Display API, open.tiktokapis.com):
 *   - refresca o access_token (expira ~24h) com o refresh_token salvo
 *   - perfil  → tiktok.accounts + snapshot diário em tiktok.account_metrics
 *   - vídeos  → tiktok.videos + snapshot diário em tiktok.video_metrics
 *
 * TikTok Display API dá contadores CUMULATIVOS (não histórico), por isso
 * guardamos um snapshot por dia; o histórico nasce dos snapshots ao longo do tempo.
 */

import type { Pool } from 'pg';
import { encryptToken, decryptToken } from '../utils/encryption';

const TT_TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const TT_API = 'https://open.tiktokapis.com/v2';

const VIDEO_FIELDS = [
  'id', 'title', 'video_description', 'duration', 'cover_image_url',
  'share_url', 'view_count', 'like_count', 'comment_count', 'share_count', 'create_time',
];
const USER_FIELDS = [
  'open_id', 'union_id', 'avatar_url', 'display_name',
  'follower_count', 'following_count', 'likes_count', 'video_count',
];

export interface TiktokOrganicResult {
  account: string | null;
  videos: number;
  videoMetrics: number;
  errors: string[];
}

/** Garante um access_token válido: refresca se faltam <10min e persiste os novos tokens. */
async function getValidAccessToken(pool: Pool, cred: any): Promise<string> {
  // Orgânico usa o app de Login Kit (developers.tiktok.com), não o de Marketing API.
  // Fallback p/ TIKTOK_APP_ID/SECRET só pra compat; o refresh real exige o app de Login Kit.
  const appId = process.env.TIKTOK_LOGIN_APP_ID || process.env.TIKTOK_APP_ID;
  const secret = process.env.TIKTOK_LOGIN_APP_SECRET || process.env.TIKTOK_APP_SECRET;
  if (!appId || !secret) throw new Error('TIKTOK_LOGIN_APP_ID/SECRET ausentes');

  const expiresAt = cred.access_expires_at ? new Date(cred.access_expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 10 * 60 * 1000) {
    return decryptToken(cred.access_token_enc); // ainda válido
  }
  if (!cred.refresh_token_enc) throw new Error('Sem refresh_token pra renovar — re-autorize o TikTok');

  const refreshToken = decryptToken(cred.refresh_token_enc);
  const res = await fetch(TT_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: appId, client_secret: secret,
      grant_type: 'refresh_token', refresh_token: refreshToken,
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(`refresh TikTok falhou: ${JSON.stringify(j).slice(0, 200)}`);

  const now = Date.now();
  await pool.query(
    `UPDATE tiktok.credentials SET
       access_token_enc = $2, refresh_token_enc = $3,
       access_expires_at = $4, refresh_expires_at = $5, last_used_at = NOW()
     WHERE id = $1`,
    [
      cred.id, encryptToken(j.access_token),
      j.refresh_token ? encryptToken(j.refresh_token) : cred.refresh_token_enc,
      j.expires_in ? new Date(now + j.expires_in * 1000) : null,
      j.refresh_expires_in ? new Date(now + j.refresh_expires_in * 1000) : null,
    ],
  );
  return j.access_token;
}

export async function syncTiktokOrganic(pool: Pool): Promise<TiktokOrganicResult> {
  const result: TiktokOrganicResult = { account: null, videos: 0, videoMetrics: 0, errors: [] };
  const today = new Date().toISOString().slice(0, 10);

  const runRes = await pool.query(
    `INSERT INTO tiktok.sync_runs (kind, status) VALUES ('organic', 'running') RETURNING id`,
  );
  const runId = runRes.rows[0].id;

  try {
    const credRes = await pool.query(
      `SELECT id, access_token_enc, refresh_token_enc, access_expires_at
       FROM tiktok.credentials WHERE kind = 'account' AND active = TRUE
       ORDER BY id DESC LIMIT 1`,
    );
    if (credRes.rows.length === 0) throw new Error('Nenhuma credencial TikTok "account" ativa');
    const accessToken = await getValidAccessToken(pool, credRes.rows[0]);

    // 1. Perfil → upsert account + snapshot
    const uRes = await fetch(`${TT_API}/user/info/?fields=${USER_FIELDS.join(',')}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = await uRes.json();
    const user = u.data?.user;
    if (!user?.open_id) throw new Error(`user/info falhou: ${JSON.stringify(u).slice(0, 200)}`);
    const openId: string = user.open_id;
    result.account = user.display_name || openId;

    await pool.query(
      `INSERT INTO tiktok.accounts
         (open_id, union_id, display_name, avatar_url, follower_count, following_count, likes_count, video_count, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
       ON CONFLICT (open_id) DO UPDATE SET
         union_id = EXCLUDED.union_id, display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url,
         follower_count = EXCLUDED.follower_count, following_count = EXCLUDED.following_count,
         likes_count = EXCLUDED.likes_count, video_count = EXCLUDED.video_count, synced_at = NOW()`,
      [openId, user.union_id || null, user.display_name || null, user.avatar_url || null,
       user.follower_count ?? null, user.following_count ?? null, user.likes_count ?? null, user.video_count ?? null],
    );
    await pool.query(
      `INSERT INTO tiktok.account_metrics (open_id, snapshot_date, follower_count, following_count, likes_count, video_count, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6, NOW())
       ON CONFLICT (open_id, snapshot_date) DO UPDATE SET
         follower_count = EXCLUDED.follower_count, following_count = EXCLUDED.following_count,
         likes_count = EXCLUDED.likes_count, video_count = EXCLUDED.video_count, synced_at = NOW()`,
      [openId, today, user.follower_count ?? null, user.following_count ?? null, user.likes_count ?? null, user.video_count ?? null],
    );

    // 2. Vídeos (paginado) → upsert vídeo + snapshot de métricas
    let cursor: number | undefined;
    let guard = 0;
    do {
      const body: any = { max_count: 20 };
      if (cursor) body.cursor = cursor;
      const vRes = await fetch(`${TT_API}/video/list/?fields=${VIDEO_FIELDS.join(',')}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const v = await vRes.json();
      if (!vRes.ok) throw new Error(`video/list falhou: ${JSON.stringify(v).slice(0, 200)}`);
      const videos: any[] = v.data?.videos || [];

      for (const vid of videos) {
        const videoId = String(vid.id);
        const createTime = vid.create_time ? new Date(vid.create_time * 1000) : null;
        await pool.query(
          `INSERT INTO tiktok.videos
             (video_id, open_id, title, description, create_time, cover_image_url, share_url, duration, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
           ON CONFLICT (video_id) DO UPDATE SET
             title = EXCLUDED.title, description = EXCLUDED.description, create_time = EXCLUDED.create_time,
             cover_image_url = EXCLUDED.cover_image_url, share_url = EXCLUDED.share_url,
             duration = EXCLUDED.duration, synced_at = NOW()`,
          [videoId, openId, vid.title || null, vid.video_description || null, createTime,
           vid.cover_image_url || null, vid.share_url || null, vid.duration ?? null],
        );
        result.videos++;

        await pool.query(
          `INSERT INTO tiktok.video_metrics
             (video_id, snapshot_date, view_count, like_count, comment_count, share_count, raw, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
           ON CONFLICT (video_id, snapshot_date) DO UPDATE SET
             view_count = EXCLUDED.view_count, like_count = EXCLUDED.like_count,
             comment_count = EXCLUDED.comment_count, share_count = EXCLUDED.share_count,
             raw = EXCLUDED.raw, synced_at = NOW()`,
          [videoId, today, vid.view_count ?? null, vid.like_count ?? null,
           vid.comment_count ?? null, vid.share_count ?? null, JSON.stringify(vid)],
        );
        result.videoMetrics++;
      }

      cursor = v.data?.has_more ? v.data?.cursor : undefined;
    } while (cursor && ++guard < 50);

    await pool.query(
      `UPDATE tiktok.sync_runs SET status='ok', rows_upserted=$2, finished_at=NOW() WHERE id=$1`,
      [runId, result.videos],
    );
  } catch (err: any) {
    result.errors.push(err.message);
    await pool.query(
      `UPDATE tiktok.sync_runs SET status='error', error=$2, rows_upserted=$3, finished_at=NOW() WHERE id=$1`,
      [runId, err.message, result.videos],
    );
    console.error('[tiktok-organic] erro:', err.message);
  }

  console.log(`[tiktok-organic] ${result.account}: ${result.videos} vídeos, ${result.videoMetrics} métricas, ${result.errors.length} erros`);
  return result;
}
