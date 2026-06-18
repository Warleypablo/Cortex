/**
 * CRM Instagram — Ingestão de CURTIDAS via Apify (actor "Post Likers").
 *
 * Roda o actor nos posts recentes do @turbo.partners, pega quem curtiu e grava
 * como interação `like` nos prospects. Dedup por handle (índice único em
 * ig_username) + external_ref idempotente (re-rodar não duplica).
 *
 * Config por env (sem isso o job é no-op):
 *  - APIFY_TOKEN
 *  - APIFY_POST_LIKERS_ACTOR_ID   (ex: "apify/instagram-post-likes-scraper")
 *
 * ⚠️ AJUSTAR quando vier a saída real do actor:
 *  - normalizeLiker(): nomes dos campos de username/fullName/post
 *  - buildInput(): formato de input do actor (directUrls? postUrls? resultsLimit?)
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

const APIFY_BASE = "https://api.apify.com/v2";

type Liker = {
  username: string;
  fullName: string | null;
  postRef: string;
  igUserId: string | null;
  picUrl: string | null;
};

// Normaliza um item do dataset do datadoping/instagram-likes-scraper.
// Campos confirmados: username, full_name, id, profile_pic_url, liked_post, post_url.
function normalizeLiker(item: any): Liker | null {
  const rawUser = item?.username ?? item?.ownerUsername;
  if (!rawUser || typeof rawUser !== "string") return null;
  const username = rawUser.trim().replace(/^@/, "").toLowerCase();
  if (!username) return null;

  return {
    username,
    fullName: (item?.full_name ?? item?.fullName ?? "").toString().trim() || null,
    postRef: String(item?.liked_post ?? item?.post_url ?? "post"),
    igUserId: item?.id ? String(item.id) : null,
    picUrl: item?.profile_pic_url ?? null,
  };
}

// Monta o input do actor datadoping/instagram-likes-scraper.
// ⚠️ Confirmar as chaves exatas na aba Input → toggle "JSON" do actor.
function buildInput(postUrls: string[]) {
  return { urls: postUrls, maxLikers: 1000 };
}

// Roda o actor de forma síncrona e devolve os itens do dataset.
async function runActorGetItems(actorId: string, input: unknown, token: string): Promise<any[]> {
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify run falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Posts recentes nossos pra escanear likers (usa permalinks já coletados pela
// sincronização do Instagram Analytics em instagram_post_metrics).
async function recentPostUrls(limit = 12): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT permalink FROM cortex_core.instagram_post_metrics
    WHERE permalink IS NOT NULL
    ORDER BY posted_at DESC NULLS LAST
    LIMIT ${limit}
  `)).rows as any[];
  return rows.map((r) => r.permalink).filter(Boolean);
}

// Upsert do liker (dedup por handle) + interação `like` idempotente.
async function ingestLiker(liker: Liker): Promise<boolean> {
  const profile = (await db.execute(sql`
    INSERT INTO cortex_core.prospecting_profiles
      (ig_username, display_name, ig_user_id, profile_picture_url, stage, first_seen, last_interaction_at)
    VALUES (${liker.username}, ${liker.fullName || liker.username}, ${liker.igUserId}, ${liker.picUrl}, 'engajador', NOW(), NOW())
    ON CONFLICT (ig_username) DO UPDATE
      SET last_interaction_at = NOW(),
          display_name = COALESCE(cortex_core.prospecting_profiles.display_name, EXCLUDED.display_name),
          ig_user_id = COALESCE(cortex_core.prospecting_profiles.ig_user_id, EXCLUDED.ig_user_id),
          profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, cortex_core.prospecting_profiles.profile_picture_url)
    RETURNING id
  `)).rows[0] as any;
  if (!profile) return false;

  const externalRef = `apify_like:${liker.postRef}:${liker.username}`;
  const r: any = await db.execute(sql`
    INSERT INTO cortex_core.prospecting_interactions (profile_id, type, ig_media_id, source, external_ref, occurred_at)
    VALUES (${profile.id}, 'like', ${liker.postRef}, 'organic', ${externalRef}, NOW())
    ON CONFLICT (external_ref) DO NOTHING
  `);
  return (r.rowCount ?? 0) > 0;
}

export async function ingestApifyPostLikers(opts?: { postUrls?: string[] }): Promise<{
  ok: boolean;
  message?: string;
  scanned: number;
  newInteractions: number;
  posts: number;
}> {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_POST_LIKERS_ACTOR_ID;
  if (!token || !actorId) {
    return { ok: false, message: "APIFY_TOKEN / APIFY_POST_LIKERS_ACTOR_ID não configurados.", scanned: 0, newInteractions: 0, posts: 0 };
  }

  const postUrls = opts?.postUrls?.length ? opts.postUrls : await recentPostUrls();
  if (!postUrls.length) {
    return { ok: false, message: "Nenhum post com permalink pra escanear.", scanned: 0, newInteractions: 0, posts: 0 };
  }

  const items = await runActorGetItems(actorId, buildInput(postUrls), token);

  let newInteractions = 0;
  let scanned = 0;
  for (const item of items) {
    const liker = normalizeLiker(item);
    if (!liker) continue;
    scanned++;
    if (await ingestLiker(liker)) newInteractions++;
  }

  console.log(`[crm-instagram apify] posts=${postUrls.length} likers=${scanned} novos=${newInteractions}`);
  return { ok: true, scanned, newInteractions, posts: postUrls.length };
}
