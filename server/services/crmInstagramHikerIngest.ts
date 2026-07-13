/**
 * CRM Instagram — Ingestão de CURTIDAS e SEGUIDORES via HikerAPI (scraping gerenciado).
 *
 * Substitui a via Apify (mesmo dado, ~280× mais barato). O read layer do CRM já
 * suporta os tipos `like` e `follow` (ver shared/crmInstagramScoring.ts e a query do
 * pipeline) — aqui só produzimos as interações. Zero mudança de schema.
 *
 * Idempotência: `prospecting_interactions.external_ref` único (ON CONFLICT DO NOTHING),
 * então re-rodar não duplica e "novo seguidor / nova curtida" só grava na 1ª vez.
 *
 * Gating por env:
 *  - CURTIDAS: roda se HIKERAPI_TOKEN existir.
 *  - SEGUIDORES: roda se HIKERAPI_TOKEN existir E HIKERAPI_FOLLOWERS_ENABLED='true'
 *    (off por padrão — depende de base legal LGPD documentada + decisão do Ichino).
 *
 * ⚠️ LGPD: todo registro daqui leva source='scraper' (auditoria/expurgo). Trata dado
 * pessoal de quem não consentiu — não ligar seguidores sem parecer jurídico.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  mediaLikers,
  mediaPkFromCode,
  shortcodeFromPermalink,
  userFollowersChunk,
  userIdByUsername,
  type HikerUser,
} from "./hikerapi";

// @perfil da Turbo cujos posts/seguidores são a fonte do garimpo.
const TURBO_USERNAME = (process.env.CRM_IG_USERNAME || "turbo.partners").replace(/^@/, "");

type NormUser = { username: string; fullName: string | null; igUserId: string | null; picUrl: string | null };

function normalize(u: HikerUser): NormUser | null {
  const username = (u?.username || "").trim().replace(/^@/, "").toLowerCase();
  if (!username) return null;
  return {
    username,
    fullName: (u.full_name ?? "").toString().trim() || null,
    igUserId: u.pk ? String(u.pk) : null,
    picUrl: u.profile_pic_url ?? null,
  };
}

/**
 * Upsert do perfil (dedup por ig_username) + interação idempotente.
 * IMPORTANTE: last_interaction_at só sobe quando a interação é NOVA — re-scrapear o
 * mesmo liker/seguidor não "esquenta" o lead artificialmente (temperatura é por recência).
 * Retorna true se gravou interação nova.
 */
async function ingestInteraction(
  u: NormUser,
  opts: { type: "like" | "follow"; igMediaId: string | null; externalRef: string },
): Promise<boolean> {
  const profile = (await db.execute(sql`
    INSERT INTO cortex_core.prospecting_profiles
      (ig_username, display_name, ig_user_id, profile_picture_url, stage, first_seen, last_interaction_at)
    VALUES (${u.username}, ${u.fullName || u.username}, ${u.igUserId}, ${u.picUrl}, 'engajador', NOW(), NOW())
    ON CONFLICT (ig_username) DO UPDATE
      SET display_name = COALESCE(cortex_core.prospecting_profiles.display_name, EXCLUDED.display_name),
          ig_user_id = COALESCE(cortex_core.prospecting_profiles.ig_user_id, EXCLUDED.ig_user_id),
          profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, cortex_core.prospecting_profiles.profile_picture_url)
    RETURNING id
  `)).rows[0] as any;
  if (!profile) return false;

  const r: any = await db.execute(sql`
    INSERT INTO cortex_core.prospecting_interactions (profile_id, type, ig_media_id, source, external_ref, occurred_at)
    VALUES (${profile.id}, ${opts.type}, ${opts.igMediaId}, 'scraper', ${opts.externalRef}, NOW())
    ON CONFLICT (external_ref) DO NOTHING
  `);
  const isNew = (r.rowCount ?? 0) > 0;
  if (isNew) {
    await db.execute(sql`
      UPDATE cortex_core.prospecting_profiles SET last_interaction_at = NOW() WHERE id = ${profile.id}
    `);
  }
  return isNew;
}

// Posts recentes (permalink + id do Graph) pra escanear likers.
async function recentPosts(limit = 12): Promise<{ permalink: string; graphId: string | null }[]> {
  const rows = (await db.execute(sql`
    SELECT permalink, ig_media_id FROM cortex_core.instagram_post_metrics
    WHERE permalink IS NOT NULL ORDER BY posted_at DESC NULLS LAST LIMIT ${limit}
  `)).rows as any[];
  return rows.map((r) => ({ permalink: r.permalink, graphId: r.ig_media_id ?? null }));
}

// ────────────────────────────────────────────────────────────────────────────
// CURTIDAS
// ────────────────────────────────────────────────────────────────────────────
export async function ingestHikerLikers(opts?: { postLimit?: number }): Promise<{
  ok: boolean; message?: string; posts: number; scanned: number; newInteractions: number;
}> {
  if (!process.env.HIKERAPI_TOKEN) {
    return { ok: false, message: "HIKERAPI_TOKEN não configurado.", posts: 0, scanned: 0, newInteractions: 0 };
  }
  const posts = await recentPosts(opts?.postLimit ?? 12);
  if (!posts.length) {
    return { ok: false, message: "Nenhum post com permalink pra escanear.", posts: 0, scanned: 0, newInteractions: 0 };
  }

  let scanned = 0;
  let newInteractions = 0;
  let done = 0;
  for (const post of posts) {
    const code = shortcodeFromPermalink(post.permalink);
    if (!code) continue;
    try {
      const pk = await mediaPkFromCode(code);
      if (!pk) continue;
      const likers = await mediaLikers(pk);
      for (const raw of likers) {
        const u = normalize(raw);
        if (!u) continue;
        scanned++;
        // dedup por par mídia+usuário; usa o pk (estável) e cai no username se faltar.
        const ref = `hiker_like:${pk}:${u.igUserId || u.username}`;
        if (await ingestInteraction(u, { type: "like", igMediaId: post.graphId, externalRef: ref })) {
          newInteractions++;
        }
      }
      done++;
    } catch (e: any) {
      console.error(`[crm-instagram hiker] falha no post ${code}:`, e.message);
    }
  }

  console.log(`[crm-instagram hiker] curtidas: posts=${done}/${posts.length} likers=${scanned} novos=${newInteractions}`);
  return { ok: true, posts: done, scanned, newInteractions };
}

// ────────────────────────────────────────────────────────────────────────────
// SEGUIDORES  (gated: HIKERAPI_FOLLOWERS_ENABLED='true')
// Varredura "mais novos primeiro" CAPADA: só olha os `maxToScan` seguidores mais
// recentes — nunca despeja os ~50k antigos no garimpo. O dedup idempotente garante
// que cada seguidor só entra na 1ª vez que aparece.
// ────────────────────────────────────────────────────────────────────────────
export async function ingestHikerFollowers(opts?: { maxToScan?: number }): Promise<{
  ok: boolean; message?: string; scanned: number; newInteractions: number;
}> {
  if (!process.env.HIKERAPI_TOKEN) {
    return { ok: false, message: "HIKERAPI_TOKEN não configurado.", scanned: 0, newInteractions: 0 };
  }
  if (process.env.HIKERAPI_FOLLOWERS_ENABLED !== "true") {
    return { ok: false, message: "Seguidores desligado (HIKERAPI_FOLLOWERS_ENABLED != 'true'). Aguarda base legal LGPD.", scanned: 0, newInteractions: 0 };
  }

  const maxToScan = opts?.maxToScan ?? 500;
  const userId = await userIdByUsername(TURBO_USERNAME);
  if (!userId) {
    return { ok: false, message: `Não resolveu user_id de @${TURBO_USERNAME}.`, scanned: 0, newInteractions: 0 };
  }

  let scanned = 0;
  let newInteractions = 0;
  let maxId = "";
  // Segue paginando (mais novos primeiro) até bater o teto ou acabar a lista.
  while (scanned < maxToScan) {
    const { users, nextMaxId } = await userFollowersChunk(userId, maxId);
    if (!users.length) break;
    for (const raw of users) {
      if (scanned >= maxToScan) break;
      const u = normalize(raw);
      if (!u) continue;
      scanned++;
      const ref = `hiker_follow:${u.igUserId || u.username}`;
      if (await ingestInteraction(u, { type: "follow", igMediaId: null, externalRef: ref })) {
        newInteractions++;
      }
    }
    if (!nextMaxId) break;
    maxId = nextMaxId;
  }

  console.log(`[crm-instagram hiker] seguidores: escaneados=${scanned} novos=${newInteractions}`);
  return { ok: true, scanned, newInteractions };
}
