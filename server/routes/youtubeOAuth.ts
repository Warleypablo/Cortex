/**
 * YouTube OAuth flow.
 *
 *  GET /api/oauth/youtube/start
 *      → redireciona pro consent do Google. Cada admin abre uma vez com a
 *        conta Google que gerencia o(s) canal(is).
 *
 *  GET /api/oauth/youtube/callback
 *      → recebe o code, troca por refresh_token + access_token, descobre
 *        qual canal foi selecionado (seletor de marca) e salva UMA credencial
 *        POR CANAL em youtube.credentials, linkando youtube.channels.
 *        Como a mesma conta (ex.: ferramentas@) gerencia vários canais Brand
 *        Account, cada autorização traz o mesmo google_user_id mas um
 *        refresh_token distinto — por isso a credencial é chaveada por channel_id,
 *        não por google_user_id (senão a 2ª autorização sobrescrevia a 1ª).
 *
 *  GET /api/oauth/youtube/status
 *      → lista canais autorizados e estado das credenciais.
 *
 * Reaproveita o OAuth client "Data Central" (mesmas credenciais já usadas pelo
 * Google Ads), porém com escopos específicos do YouTube.
 */

import type { Express, Request, Response } from 'express';
import { google } from 'googleapis';
import { sql } from 'drizzle-orm';
import { encryptToken } from '../utils/encryption';

const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'openid',
  'email',
];

function getOauthClient(req: Request) {
  // Client OAuth DEDICADO do YouTube (projeto GCP próprio, consent screen External +
  // verificado) — permite que donos de canal externos (sem e-mail @turbopartners)
  // autorizem com a própria conta. Enquanto esse client não existir, faz fallback pro
  // client "Data Central" (GOOGLE_CLIENT_ID, Internal — só @turbopartners).
  // NÃO usar o GOOGLE_ADS_CLIENT_ID (client de Ads, server-to-server, em outro projeto
  // e sem essa redirect → redirect_uri_mismatch).
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID/SECRET (ou fallback GOOGLE_CLIENT_ID/SECRET) não configurados');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  const redirectUri = `${proto}://${host}/api/oauth/youtube/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Rotas PÚBLICAS (registradas ANTES do isAuthenticated): o dono do canal autoriza
// com a própria conta Google sem precisar de login no Cortex — igual ao módulo Instagram.
export function registerYoutubeOAuthPublicRoutes(app: Express, db: any) {
  // --- START ---
  app.get('/api/oauth/youtube/start', (req: Request, res: Response) => {
    try {
      const oauth2 = getOauthClient(req);
      const url = oauth2.generateAuthUrl({
        access_type: 'offline',
        // prompt=consent + SEM include_granted_scopes: consentimento limpo só de YouTube.
        // include_granted_scopes mesclava escopos antigos (ex: Google Ads) e suprimia o
        // seletor de canal de Brand Account — por isso só vinha o canal pessoal.
        prompt: 'consent',
        scope: YT_SCOPES,
      });
      res.redirect(url);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- CALLBACK ---
  app.get('/api/oauth/youtube/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    if (error) return res.status(400).send(`Autorização recusada: ${error}`);
    if (!code) return res.status(400).send('Faltou o code do Google.');

    try {
      const oauth2 = getOauthClient(req);
      const { tokens } = await oauth2.getToken(code);
      if (!tokens.refresh_token) {
        return res.status(400).send(
          'O Google não retornou refresh_token. Provavelmente essa conta já autorizou antes — ' +
          'revogue o acesso em https://myaccount.google.com/permissions e tente de novo.'
        );
      }
      oauth2.setCredentials(tokens);

      const oauth = google.oauth2({ version: 'v2', auth: oauth2 });
      const userinfo = await oauth.userinfo.get();
      const googleUserId = userinfo.data.id!;
      const googleEmail = userinfo.data.email || null;

      const refreshTokenEnc = encryptToken(tokens.refresh_token);

      // Descobre o canal ANTES de gravar a credencial: com o seletor de marca,
      // channels.list(mine=true) retorna o canal selecionado nesta autorização.
      // O refresh_token só é válido para esse canal, então gravamos uma credencial
      // por canal (chave channel_id).
      const yt = google.youtube({ version: 'v3', auth: oauth2 });
      const list = await yt.channels.list({
        part: ['id', 'snippet', 'statistics'],
        mine: true,
        maxResults: 50,
      });

      const channels = list.data.items || [];
      if (channels.length === 0) {
        return res.status(400).send(
          'Nenhum canal encontrado para essa conta/seleção. Se for Brand Account, ' +
          'confirme que a conta foi adicionada como Proprietário/Gerente do canal e ' +
          'que você escolheu o canal certo no seletor de marca.'
        );
      }

      const linked: string[] = [];
      for (const ch of channels) {
        const channelId = ch.id!;
        const snippet = ch.snippet || {};
        const stats = ch.statistics || {};

        // 1) Credencial POR CANAL — re-autorizar o mesmo canal atualiza só o token dele.
        const credRes = await db.execute(sql`
          INSERT INTO youtube.credentials
            (google_user_id, google_email, channel_id, refresh_token_enc, scopes, authorized_at, last_used_at, active)
          VALUES (${googleUserId}, ${googleEmail}, ${channelId}, ${refreshTokenEnc}, ${YT_SCOPES.join(' ')}, NOW(), NOW(), TRUE)
          ON CONFLICT (channel_id) DO UPDATE
            SET refresh_token_enc = EXCLUDED.refresh_token_enc,
                google_user_id    = EXCLUDED.google_user_id,
                google_email      = EXCLUDED.google_email,
                scopes            = EXCLUDED.scopes,
                authorized_at     = NOW(),
                active            = TRUE
          RETURNING id
        `);
        const credentialId = (credRes as any).rows?.[0]?.id ?? (credRes as any)[0]?.id;

        // 2) Upsert do canal, linkando à sua credencial.
        await db.execute(sql`
          INSERT INTO youtube.channels (
            channel_id, title, custom_url, description, thumbnail_url, country,
            published_at, subscriber_count, view_count, video_count, hidden_subscriber_count,
            credential_id, synced_at
          ) VALUES (
            ${channelId},
            ${snippet.title || null},
            ${snippet.customUrl || null},
            ${snippet.description || null},
            ${snippet.thumbnails?.default?.url || null},
            ${snippet.country || null},
            ${snippet.publishedAt ? new Date(snippet.publishedAt) : null},
            ${stats.subscriberCount ? Number(stats.subscriberCount) : null},
            ${stats.viewCount ? Number(stats.viewCount) : null},
            ${stats.videoCount ? Number(stats.videoCount) : null},
            ${stats.hiddenSubscriberCount ?? null},
            ${credentialId},
            NOW()
          )
          ON CONFLICT (channel_id) DO UPDATE
            SET title = EXCLUDED.title,
                custom_url = EXCLUDED.custom_url,
                description = EXCLUDED.description,
                thumbnail_url = EXCLUDED.thumbnail_url,
                country = EXCLUDED.country,
                published_at = EXCLUDED.published_at,
                subscriber_count = EXCLUDED.subscriber_count,
                view_count = EXCLUDED.view_count,
                video_count = EXCLUDED.video_count,
                hidden_subscriber_count = EXCLUDED.hidden_subscriber_count,
                credential_id = EXCLUDED.credential_id,
                synced_at = NOW()
        `);
        linked.push(`${snippet.title} (${channelId})`);
      }

      res.status(200).send(`
        <html><body style="font-family: -apple-system, sans-serif; padding: 40px; max-width: 600px;">
          <h2>✅ Autorização concluída</h2>
          <p><b>Usuário:</b> ${googleEmail || googleUserId}</p>
          <p><b>Canais autorizados:</b></p>
          <ul>${linked.map((c) => `<li>${c}</li>`).join('')}</ul>
          <p>Pode fechar essa aba.</p>
        </body></html>
      `);
    } catch (e: any) {
      console.error('[youtube-oauth] callback error:', e);
      res.status(500).send(`Erro no callback: ${e.message}`);
    }
  });
}

// Rota PROTEGIDA (fica atrás do isAuthenticated): lista os canais autorizados.
export function registerYoutubeOAuthStatusRoute(app: Express, db: any) {
  // --- STATUS ---
  app.get('/api/oauth/youtube/status', async (_req: Request, res: Response) => {
    try {
      const r = await db.execute(sql`
        SELECT c.channel_id, c.title, c.subscriber_count, c.video_count,
               cred.google_email, cred.authorized_at, cred.last_used_at, cred.active
        FROM youtube.channels c
        LEFT JOIN youtube.credentials cred ON cred.id = c.credential_id
        ORDER BY c.title
      `);
      res.json((r as any).rows || r);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
