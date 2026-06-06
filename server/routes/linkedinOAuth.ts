/**
 * LinkedIn OAuth flow — analytics ORGÂNICO de Company Page.
 *
 *  GET /api/oauth/linkedin/start
 *      → redireciona pro consent do LinkedIn. Um admin da Company Page abre uma vez.
 *
 *  GET /api/oauth/linkedin/callback
 *      → troca o code por access_token + refresh_token, identifica o membro (OIDC
 *        userinfo), descobre as organizações que ele administra (organizationAcls)
 *        e salva tudo encriptado em linkedin.credentials / _organizations.
 *
 *  GET /api/oauth/linkedin/status
 *      → lista organizações autorizadas e estado das credenciais.
 *
 * Tokens encriptados via server/utils/encryption.ts (reusa INSTAGRAM_ENCRYPTION_KEY).
 * Requer envs LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET.
 *
 * NOTA: LinkedIn REST exige os headers LinkedIn-Version (YYYYMM) e
 * X-Restli-Protocol-Version: 2.0.0 em todas as chamadas /rest/*.
 */

import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { encryptToken } from '../utils/encryption';

const LI_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LI_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LI_API = 'https://api.linkedin.com';
const LI_VERSION = '202605'; // versão da REST API YYYYMM (LinkedIn mantém ~12 meses; bumpar quando der NONEXISTENT_VERSION)

// Escopos: OpenID (identificação) + orgânico de Company Page + Ads (Advertising API).
// Confira em Auth → "OAuth 2.0 scopes" quais o app realmente tem acesso.
// r_ads + r_ads_reporting exigem o produto "Advertising API" habilitado no app
// (Turbo Cortex já tem — Development Tier). Re-autorizar o admin após adicionar.
const LI_SCOPES = [
  'openid',
  'profile',
  'email',
  'r_organization_social',
  'rw_organization_admin',
  'r_ads',
  'r_ads_reporting',
];

// CSRF: states emitidos no /start, validados no /callback (in-memory, TTL curto).
const pendingStates = new Map<string, number>();
function newState(): string {
  const s = crypto.randomBytes(16).toString('hex');
  pendingStates.set(s, Date.now());
  // limpa states com mais de 10 min
  Array.from(pendingStates.entries()).forEach(([k, t]) => {
    if (Date.now() - t > 600_000) pendingStates.delete(k);
  });
  return s;
}

function redirectUri(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}/api/oauth/linkedin/callback`;
}

function liRestHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

export function registerLinkedinOAuthRoutes(app: Express, db: any) {
  // --- START ---
  app.get('/api/oauth/linkedin/start', (req: Request, res: Response) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'LINKEDIN_CLIENT_ID não configurado' });
    }
    const url = new URL(LI_AUTH_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri(req));
    url.searchParams.set('scope', LI_SCOPES.join(' '));
    url.searchParams.set('state', newState());
    res.redirect(url.toString());
  });

  // --- CALLBACK ---
  app.get('/api/oauth/linkedin/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;
    const errorDesc = req.query.error_description as string | undefined;

    if (error) return res.status(400).send(`Autorização recusada: ${error} — ${errorDesc || ''}`);
    if (!code) return res.status(400).send('Faltou o code do LinkedIn.');
    if (!state || !pendingStates.has(state)) {
      return res.status(400).send('State inválido ou expirado. Tente autorizar de novo.');
    }
    pendingStates.delete(state);

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).send('LINKEDIN_CLIENT_ID/SECRET não configurados.');
    }

    try {
      // 1. Trocar code por tokens
      const tokenRes = await fetch(LI_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(req),
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok || !token.access_token) {
        console.error('[linkedin-oauth] token error:', tokenRes.status, token);
        return res.status(400).send(`Falha ao obter token: ${JSON.stringify(token)}`);
      }

      const now = Date.now();
      const accessExpiresAt = token.expires_in ? new Date(now + token.expires_in * 1000) : null;
      const refreshExpiresAt = token.refresh_token_expires_in
        ? new Date(now + token.refresh_token_expires_in * 1000)
        : null;

      // 2. Identificar o membro (OpenID Connect userinfo)
      let memberId = `unknown_${now}`;
      let memberEmail: string | null = null;
      let memberName: string | null = null;
      try {
        const uiRes = await fetch(`${LI_API}/v2/userinfo`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const ui = await uiRes.json();
        if (uiRes.ok) {
          memberId = ui.sub || memberId;
          memberEmail = ui.email || null;
          memberName = ui.name || null;
        }
      } catch (e: any) {
        console.warn('[linkedin-oauth] userinfo falhou:', e.message);
      }

      // 3. Salvar credenciais (tokens encriptados)
      const credRes = await db.execute(sql`
        INSERT INTO linkedin.credentials
          (member_id, member_email, member_name, access_token_enc, refresh_token_enc,
           access_expires_at, refresh_expires_at, scopes, authorized_at, last_used_at, active)
        VALUES (
          ${memberId}, ${memberEmail}, ${memberName},
          ${encryptToken(token.access_token)},
          ${token.refresh_token ? encryptToken(token.refresh_token) : null},
          ${accessExpiresAt}, ${refreshExpiresAt}, ${token.scope || LI_SCOPES.join(' ')},
          NOW(), NOW(), TRUE
        )
        ON CONFLICT (member_id) DO UPDATE SET
          member_email       = EXCLUDED.member_email,
          member_name        = EXCLUDED.member_name,
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

      // 4. Descobrir organizações administradas (resiliente — token já salvo)
      const linked: string[] = [];
      try {
        const aclUrl = `${LI_API}/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`;
        const aclRes = await fetch(aclUrl, { headers: liRestHeaders(token.access_token) });
        const acl = await aclRes.json();
        if (!aclRes.ok) throw new Error(`organizationAcls ${aclRes.status}: ${JSON.stringify(acl).slice(0, 300)}`);

        for (const el of acl.elements || []) {
          const orgUrn: string = el.organization || el['organization~']?.id || '';
          const orgId = Number(String(orgUrn).split(':').pop());
          if (!orgId) continue;

          // detalhes da organização
          let name: string | null = null;
          let vanity: string | null = null;
          let description: string | null = null;
          try {
            const oRes = await fetch(`${LI_API}/rest/organizations/${orgId}`, {
              headers: liRestHeaders(token.access_token),
            });
            const o = await oRes.json();
            if (oRes.ok) {
              name = o.localizedName || o.name?.localized?.['pt_BR'] || null;
              vanity = o.vanityName || null;
              description = o.localizedDescription || null;
            }
          } catch (e: any) {
            console.warn(`[linkedin-oauth] detalhes org ${orgId} falhou:`, e.message);
          }

          // total de seguidores (networkSizes)
          let followerCount: number | null = null;
          try {
            const nsRes = await fetch(
              `${LI_API}/rest/networkSizes/urn:li:organization:${orgId}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
              { headers: liRestHeaders(token.access_token) },
            );
            const ns = await nsRes.json();
            if (nsRes.ok) followerCount = ns.firstDegreeSize ?? null;
          } catch { /* opcional */ }

          await db.execute(sql`
            INSERT INTO linkedin.organizations
              (org_id, vanity_name, name, description, follower_count, credential_id, synced_at)
            VALUES (${orgId}, ${vanity}, ${name}, ${description}, ${followerCount}, ${credentialId}, NOW())
            ON CONFLICT (org_id) DO UPDATE SET
              vanity_name    = EXCLUDED.vanity_name,
              name           = EXCLUDED.name,
              description    = EXCLUDED.description,
              follower_count = EXCLUDED.follower_count,
              credential_id  = EXCLUDED.credential_id,
              synced_at      = NOW()
          `);
          linked.push(`${name || '(sem nome)'} — org ${orgId}${followerCount != null ? ` (${followerCount} seguidores)` : ''}`);
        }
      } catch (e: any) {
        console.error('[linkedin-oauth] descoberta de orgs falhou:', e.message);
        return res.status(200).send(`
          <html><body style="font-family: -apple-system, sans-serif; padding: 40px; max-width: 640px;">
            <h2>⚠️ Token salvo, mas não consegui listar as organizações</h2>
            <p>Provavelmente falta o escopo de organização ou você não é admin da página.</p>
            <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${e.message}</pre>
            <p>Me manda esse erro que eu ajusto.</p>
          </body></html>
        `);
      }

      res.status(200).send(`
        <html><body style="font-family: -apple-system, sans-serif; padding: 40px; max-width: 640px;">
          <h2>✅ Autorização concluída</h2>
          <p><b>Membro:</b> ${memberName || memberEmail || memberId}</p>
          <p><b>Organizações autorizadas:</b></p>
          <ul>${linked.length ? linked.map((c) => `<li>${c}</li>`).join('') : '<li>(nenhuma — verifique se você é admin da Company Page)</li>'}</ul>
          <p>Pode fechar essa aba.</p>
        </body></html>
      `);
    } catch (e: any) {
      console.error('[linkedin-oauth] callback error:', e);
      res.status(500).send(`Erro no callback: ${e.message}`);
    }
  });

  // --- STATUS ---
  app.get('/api/oauth/linkedin/status', async (_req: Request, res: Response) => {
    try {
      const r = await db.execute(sql`
        SELECT o.org_id, o.name, o.vanity_name, o.follower_count, o.synced_at,
               c.member_email, c.member_name, c.authorized_at, c.access_expires_at,
               c.refresh_expires_at, c.active
        FROM linkedin.organizations o
        LEFT JOIN linkedin.credentials c ON c.id = o.credential_id
        ORDER BY o.name
      `);
      res.json((r as any).rows || r);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
