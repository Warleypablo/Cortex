/**
 * TikTok OAuth flow — app "Turbo Cortex" (Marketing API).
 *
 * Dois fluxos independentes:
 *
 *  ADVERTISER (Ads / reporting)
 *    GET /api/oauth/tiktok/advertiser/start     → consent business-api
 *    GET /api/oauth/tiktok/advertiser/callback  → troca auth_code por access_token
 *                                                 (longo, sem refresh) + advertiser_ids
 *
 *  ACCOUNT HOLDER (orgânico: perfil + vídeos + insights)
 *    GET /api/oauth/tiktok/account/start        → consent tiktok.com
 *    GET /api/oauth/tiktok/account/callback      → troca code por access+refresh token
 *                                                 (access ~24h, refresh ~365d) + open_id
 *
 *  GET /api/oauth/tiktok/status                  → lista advertisers + perfis autorizados
 *
 * Tokens encriptados via server/utils/encryption.ts (reusa INSTAGRAM_ENCRYPTION_KEY).
 *
 * São DOIS apps TikTok diferentes (não dá pra usar o mesmo):
 *   - ADVERTISER usa o app de Marketing API (business-api.tiktok.com)
 *       → envs TIKTOK_APP_ID / TIKTOK_APP_SECRET
 *   - ACCOUNT (orgânico) usa um app de Login Kit (developers.tiktok.com), que é o
 *     único tipo com Display API. Tem client_key/secret próprios
 *       → envs TIKTOK_LOGIN_APP_ID / TIKTOK_LOGIN_APP_SECRET
 *         (faz fallback p/ TIKTOK_APP_ID/SECRET se não setados — útil enquanto o app
 *          de Login Kit não existe, mas o fluxo orgânico só funciona de fato com ele)
 *
 * Atenção a 2 convenções diferentes de auth header:
 *   - Marketing API (advertiser): header `Access-Token: <token>`
 *   - Display/Login API (account): header `Authorization: Bearer <token>`
 */

import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { encryptToken } from '../utils/encryption';

// Marketing API (advertiser)
const TT_BIZ_AUTH = 'https://business-api.tiktok.com/portal/auth';
const TT_BIZ_API = 'https://business-api.tiktok.com/open_api/v1.3';
// Login Kit / Display API (account holder)
const TT_USER_AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const TT_USER_TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const TT_USER_API = 'https://open.tiktokapis.com/v2';

// Escopos orgânicos (devem estar aprovados no app).
const TT_ACCOUNT_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.insights',
];

// CSRF: states emitidos no /start, validados no /callback (in-memory, TTL 10 min).
const pendingStates = new Map<string, number>();
function newState(): string {
  const s = crypto.randomBytes(16).toString('hex');
  pendingStates.set(s, Date.now());
  Array.from(pendingStates.entries()).forEach(([k, t]) => {
    if (Date.now() - t > 600_000) pendingStates.delete(k);
  });
  return s;
}
function consumeState(s?: string): boolean {
  if (!s || !pendingStates.has(s)) return false;
  pendingStates.delete(s);
  return true;
}

// Credenciais do app de Login Kit (orgânico). Fallback p/ o app de Marketing API
// só pra não quebrar boot — mas o fluxo orgânico exige um app de Login Kit de verdade.
function loginCreds(): { clientKey?: string; clientSecret?: string } {
  return {
    clientKey: process.env.TIKTOK_LOGIN_APP_ID || process.env.TIKTOK_APP_ID,
    clientSecret: process.env.TIKTOK_LOGIN_APP_SECRET || process.env.TIKTOK_APP_SECRET,
  };
}

function baseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  return `${proto}://${req.get('host')}`;
}

function successHtml(title: string, lines: string[]): string {
  return `
    <html><body style="font-family: -apple-system, sans-serif; padding: 40px; max-width: 640px;">
      <h2>${title}</h2>
      <ul>${lines.length ? lines.map((l) => `<li>${l}</li>`).join('') : '<li>(nada descoberto — confira permissões/contas)</li>'}</ul>
      <p>Pode fechar essa aba.</p>
    </body></html>`;
}

export function registerTiktokOAuthRoutes(app: Express, db: any) {
  // =========================================================
  // FLUXO ADVERTISER (Marketing API)
  // =========================================================
  app.get('/api/oauth/tiktok/advertiser/start', (req: Request, res: Response) => {
    const appId = process.env.TIKTOK_APP_ID;
    if (!appId) return res.status(500).json({ error: 'TIKTOK_APP_ID não configurado' });
    const url = new URL(TT_BIZ_AUTH);
    url.searchParams.set('app_id', appId);
    url.searchParams.set('state', newState());
    url.searchParams.set('redirect_uri', `${baseUrl(req)}/api/oauth/tiktok/advertiser/callback`);
    res.redirect(url.toString());
  });

  app.get('/api/oauth/tiktok/advertiser/callback', async (req: Request, res: Response) => {
    const authCode = (req.query.auth_code || req.query.code) as string | undefined;
    const state = req.query.state as string | undefined;
    if (!authCode) return res.status(400).send('Faltou o auth_code do TikTok.');
    if (!consumeState(state)) return res.status(400).send('State inválido ou expirado. Autorize de novo.');

    const appId = process.env.TIKTOK_APP_ID;
    const secret = process.env.TIKTOK_APP_SECRET;
    if (!appId || !secret) return res.status(500).send('TIKTOK_APP_ID/SECRET não configurados.');

    try {
      // 1. Trocar auth_code por access_token (token longo, sem expiração)
      const tokRes = await fetch(`${TT_BIZ_API}/oauth2/access_token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
      });
      const tok = await tokRes.json();
      if (tok.code !== 0 || !tok.data?.access_token) {
        console.error('[tiktok-oauth] advertiser token error:', tok);
        return res.status(400).send(`Falha ao obter token: ${JSON.stringify(tok)}`);
      }
      const accessToken: string = tok.data.access_token;
      const scope = Array.isArray(tok.data.scope) ? tok.data.scope.join(',') : String(tok.data.scope || '');

      // 2. Salvar credencial (1 linha por fluxo advertiser, atualizada a cada auth)
      const credRes = await db.execute(sql`
        INSERT INTO tiktok.credentials
          (kind, identity, access_token_enc, scopes, authorized_at, last_used_at, active)
        VALUES ('advertiser', 'advertiser', ${encryptToken(accessToken)}, ${scope}, NOW(), NOW(), TRUE)
        ON CONFLICT (kind, identity) DO UPDATE SET
          access_token_enc = EXCLUDED.access_token_enc,
          scopes           = EXCLUDED.scopes,
          authorized_at    = NOW(),
          last_used_at     = NOW(),
          active           = TRUE
        RETURNING id
      `);
      const credentialId = (credRes as any).rows?.[0]?.id ?? (credRes as any)[0]?.id;

      // 3. Descobrir contas de anúncio via oauth2/advertiser/get (canônico — retorna
      //    advertiser_id COMO STRING + advertiser_name; evita o bug de precisão de
      //    número grande e o campo errado da resposta do token).
      const linked: string[] = [];
      try {
        const advRes = await fetch(
          `${TT_BIZ_API}/oauth2/advertiser/get/?app_id=${appId}&secret=${secret}`,
          { headers: { 'Access-Token': accessToken } },
        );
        const adv = await advRes.json();
        if (adv.code !== 0) throw new Error(`advertiser/get: ${JSON.stringify(adv).slice(0, 300)}`);
        const list: any[] = adv.data?.list || []; // [{advertiser_id, advertiser_name}]

        // Enriquecer com detalhes (currency/timezone/status) em lote.
        const details: Record<string, any> = {};
        if (list.length) {
          const ids = list.map((a) => String(a.advertiser_id));
          const params = new URLSearchParams({
            advertiser_ids: JSON.stringify(ids),
            fields: JSON.stringify(['advertiser_id', 'advertiser_name', 'company', 'currency', 'timezone', 'status']),
          });
          const infoRes = await fetch(`${TT_BIZ_API}/advertiser/info/?${params}`, {
            headers: { 'Access-Token': accessToken },
          });
          const info = await infoRes.json();
          for (const d of info.data?.list || []) details[String(d.advertiser_id)] = d;
        }

        for (const a of list) {
          const id = String(a.advertiser_id);
          const d = details[id] || {};
          await db.execute(sql`
            INSERT INTO tiktok.advertisers
              (advertiser_id, name, company, currency, timezone, status, credential_id, synced_at)
            VALUES (${id}, ${d.advertiser_name || a.advertiser_name || null}, ${d.company || null},
                    ${d.currency || null}, ${d.timezone || null}, ${d.status || null}, ${credentialId}, NOW())
            ON CONFLICT (advertiser_id) DO UPDATE SET
              name = EXCLUDED.name, company = EXCLUDED.company, currency = EXCLUDED.currency,
              timezone = EXCLUDED.timezone, status = EXCLUDED.status,
              credential_id = EXCLUDED.credential_id, synced_at = NOW()
          `);
          linked.push(`${d.advertiser_name || a.advertiser_name || '(sem nome)'} — ${id} (${d.currency || '?'})`);
        }
      } catch (e: any) {
        console.error('[tiktok-oauth] descoberta de advertisers falhou:', e.message);
        return res.status(200).send(successHtml(
          '⚠️ Token salvo, mas não listei as contas de anúncio',
          [e.message],
        ));
      }

      res.status(200).send(successHtml('✅ Advertiser autorizado', linked));
    } catch (e: any) {
      console.error('[tiktok-oauth] advertiser callback error:', e);
      res.status(500).send(`Erro no callback: ${e.message}`);
    }
  });

  // =========================================================
  // FLUXO ACCOUNT HOLDER (orgânico)
  // =========================================================
  app.get('/api/oauth/tiktok/account/start', (req: Request, res: Response) => {
    const { clientKey } = loginCreds();
    if (!clientKey) return res.status(500).json({ error: 'TIKTOK_LOGIN_APP_ID não configurado' });
    const url = new URL(TT_USER_AUTH);
    url.searchParams.set('client_key', clientKey);
    url.searchParams.set('scope', TT_ACCOUNT_SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', `${baseUrl(req)}/api/oauth/tiktok/account/callback`);
    url.searchParams.set('state', newState());
    res.redirect(url.toString());
  });

  app.get('/api/oauth/tiktok/account/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;
    if (error) return res.status(400).send(`Autorização recusada: ${error}`);
    if (!code) return res.status(400).send('Faltou o code do TikTok.');
    if (!consumeState(state)) return res.status(400).send('State inválido ou expirado. Autorize de novo.');

    const { clientKey, clientSecret } = loginCreds();
    if (!clientKey || !clientSecret) return res.status(500).send('TIKTOK_LOGIN_APP_ID/SECRET não configurados.');

    try {
      // 1. Trocar code por tokens
      const tokRes = await fetch(TT_USER_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${baseUrl(req)}/api/oauth/tiktok/account/callback`,
        }),
      });
      const tok = await tokRes.json();
      if (!tokRes.ok || !tok.access_token) {
        console.error('[tiktok-oauth] account token error:', tok);
        return res.status(400).send(`Falha ao obter token: ${JSON.stringify(tok)}`);
      }

      const now = Date.now();
      const accessExpiresAt = tok.expires_in ? new Date(now + tok.expires_in * 1000) : null;
      const refreshExpiresAt = tok.refresh_expires_in ? new Date(now + tok.refresh_expires_in * 1000) : null;
      const openId: string = tok.open_id;

      // 2. Salvar credencial
      const credRes = await db.execute(sql`
        INSERT INTO tiktok.credentials
          (kind, identity, access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at,
           scopes, authorized_at, last_used_at, active)
        VALUES ('account', ${openId}, ${encryptToken(tok.access_token)},
                ${tok.refresh_token ? encryptToken(tok.refresh_token) : null},
                ${accessExpiresAt}, ${refreshExpiresAt}, ${tok.scope || TT_ACCOUNT_SCOPES.join(',')},
                NOW(), NOW(), TRUE)
        ON CONFLICT (kind, identity) DO UPDATE SET
          access_token_enc   = EXCLUDED.access_token_enc,
          refresh_token_enc  = EXCLUDED.refresh_token_enc,
          access_expires_at  = EXCLUDED.access_expires_at,
          refresh_expires_at = EXCLUDED.refresh_expires_at,
          scopes             = EXCLUDED.scopes,
          authorized_at      = NOW(),
          last_used_at       = NOW(),
          active             = TRUE
        RETURNING id
      `);
      const credentialId = (credRes as any).rows?.[0]?.id ?? (credRes as any)[0]?.id;

      // 3. Descobrir perfil (resiliente)
      const linked: string[] = [];
      try {
        const fields = 'open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count';
        const uRes = await fetch(`${TT_USER_API}/user/info/?fields=${fields}`, {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        const u = await uRes.json();
        const user = u.data?.user;
        if (user) {
          await db.execute(sql`
            INSERT INTO tiktok.accounts
              (open_id, union_id, display_name, avatar_url, follower_count, following_count,
               likes_count, video_count, credential_id, synced_at)
            VALUES (${user.open_id || openId}, ${user.union_id || null}, ${user.display_name || null},
                    ${user.avatar_url || null}, ${user.follower_count ?? null}, ${user.following_count ?? null},
                    ${user.likes_count ?? null}, ${user.video_count ?? null}, ${credentialId}, NOW())
            ON CONFLICT (open_id) DO UPDATE SET
              union_id = EXCLUDED.union_id, display_name = EXCLUDED.display_name,
              avatar_url = EXCLUDED.avatar_url, follower_count = EXCLUDED.follower_count,
              following_count = EXCLUDED.following_count, likes_count = EXCLUDED.likes_count,
              video_count = EXCLUDED.video_count, credential_id = EXCLUDED.credential_id, synced_at = NOW()
          `);
          linked.push(`${user.display_name || '(sem nome)'} — ${user.follower_count ?? '?'} seguidores, ${user.video_count ?? '?'} vídeos`);
        }
      } catch (e: any) {
        console.error('[tiktok-oauth] user/info falhou:', e.message);
        return res.status(200).send(successHtml('⚠️ Token salvo, mas não consegui ler o perfil', [e.message]));
      }

      res.status(200).send(successHtml('✅ Conta TikTok autorizada', linked));
    } catch (e: any) {
      console.error('[tiktok-oauth] account callback error:', e);
      res.status(500).send(`Erro no callback: ${e.message}`);
    }
  });

  // =========================================================
  // STATUS
  // =========================================================
  app.get('/api/oauth/tiktok/status', async (_req: Request, res: Response) => {
    try {
      const adv = await db.execute(sql`
        SELECT a.advertiser_id, a.name, a.currency, a.status, a.synced_at,
               c.authorized_at, c.active
        FROM tiktok.advertisers a
        LEFT JOIN tiktok.credentials c ON c.id = a.credential_id
        ORDER BY a.name
      `);
      const acc = await db.execute(sql`
        SELECT ac.open_id, ac.display_name, ac.follower_count, ac.video_count, ac.synced_at,
               c.authorized_at, c.access_expires_at, c.active
        FROM tiktok.accounts ac
        LEFT JOIN tiktok.credentials c ON c.id = ac.credential_id
        ORDER BY ac.display_name
      `);
      res.json({
        advertisers: (adv as any).rows || adv,
        accounts: (acc as any).rows || acc,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
