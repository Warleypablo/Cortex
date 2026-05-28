/**
 * CRM Instagram — Coletor de comentários (Graph API) + contexto de perfil.
 *
 * Puxa comentários nominais das mídias recentes das contas conectadas e os
 * transforma em prospects (prospecting_profiles) + interações idempotentes
 * (prospecting_interactions). Contexto de perfil (bio/seguidores) é best-effort
 * via Business Discovery — pode não estar disponível na superfície Instagram
 * Login API; nesse caso o prospect fica só com username + sinais.
 *
 * Decisão (plano CRM Instagram): stack oficial + ISCA. Sinais nominais reais =
 * comentário (aqui) + DM (via GHL, ver crmInstagramGhlIngest.ts).
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { instagramConnections, prospectingProfiles, prospectingInteractions } from "../../shared/schema";
import { decryptToken } from "../utils/encryption";
import { syncMedia, fetchMediaComments, fetchBusinessProfile, type IgComment } from "./instagramSync";

const MEDIA_LIMIT = 30; // últimas N mídias por conta
const MAX_ENRICH_PER_RUN = 15; // teto de chamadas Business Discovery por execução

export async function runCrmInstagramCollector(): Promise<void> {
  const startedAt = new Date();
  try {
    const connections = await db
      .select()
      .from(instagramConnections)
      .where(eq(instagramConnections.isActive, true));

    if (connections.length === 0) {
      (globalThis as any).__crmInstagramCollectorStatus = {
        lastRun: startedAt.toISOString(),
        status: "skipped",
        reason: "no active connections",
      };
      return;
    }

    let newInteractions = 0;
    let commentsSeen = 0;
    let commentsSemUsername = 0;
    let enrichCalls = 0;

    for (const conn of connections) {
      let token: string;
      try {
        token = decryptToken(conn.accessToken);
      } catch (e: any) {
        console.warn(`[crm-instagram] token de @${conn.username} não descriptografou: ${e.message}`);
        continue;
      }

      const media = await syncMedia(conn.igUserId, token, MEDIA_LIMIT);

      for (const m of media) {
        if (!m?.id) continue;
        // Pula mídias sem comentários (economiza chamadas)
        if (typeof m.comments_count === "number" && m.comments_count === 0) continue;

        const comments = await fetchMediaComments(m.id, token);
        commentsSeen += comments.length;

        // Agrupa por username (1 upsert de perfil por usuário, N interações)
        const byUser = new Map<string, IgComment[]>();
        for (const c of comments) {
          if (!c.username) { commentsSemUsername++; continue; }
          const key = c.username.toLowerCase();
          if (!byUser.has(key)) byUser.set(key, []);
          byUser.get(key)!.push(c);
        }

        for (const [username, userComments] of Array.from(byUser.entries())) {
          // Não prospectar a própria conta
          if (username === conn.username?.toLowerCase()) continue;

          const lastTs = userComments
            .map((c) => (c.timestamp ? new Date(c.timestamp) : null))
            .filter((d): d is Date => !!d && !isNaN(d.getTime()))
            .sort((a, b) => b.getTime() - a.getTime())[0] || new Date();
          const igUserId = userComments.find((c) => c.fromId)?.fromId || null;

          // Upsert perfil (toca last_interaction_at, completa ig_user_id se faltava)
          const upserted = await db
            .insert(prospectingProfiles)
            .values({
              igUsername: username,
              igUserId: igUserId || undefined,
              lastInteractionAt: lastTs,
              firstSeen: lastTs,
            })
            .onConflictDoUpdate({
              target: prospectingProfiles.igUsername,
              set: {
                lastInteractionAt: sql`GREATEST(${prospectingProfiles.lastInteractionAt}, ${lastTs})`,
                igUserId: sql`COALESCE(${prospectingProfiles.igUserId}, ${igUserId})`,
                updatedAt: new Date(),
              },
            })
            .returning({ id: prospectingProfiles.id, followersCount: prospectingProfiles.followersCount });

          const profile = upserted[0];
          if (!profile) continue;

          // Insere interações (idempotente por external_ref = id do comentário)
          for (const c of userComments) {
            const occurredAt = c.timestamp && !isNaN(new Date(c.timestamp).getTime())
              ? new Date(c.timestamp)
              : new Date();
            const res = await db
              .insert(prospectingInteractions)
              .values({
                profileId: profile.id,
                type: "comment",
                igMediaId: m.id,
                text: c.text?.slice(0, 1000),
                source: "organic",
                externalRef: c.id,
                occurredAt,
              })
              .onConflictDoNothing({ target: prospectingInteractions.externalRef })
              .returning({ id: prospectingInteractions.id });
            if (res.length > 0) newInteractions++;
          }

          // Enriquecimento best-effort: só perfis sem followers_count, com teto por run
          if (profile.followersCount == null && enrichCalls < MAX_ENRICH_PER_RUN) {
            enrichCalls++;
            const ctx = await fetchBusinessProfile(conn.igUserId, username, token);
            if (ctx) {
              await db
                .update(prospectingProfiles)
                .set({
                  bio: ctx.bio,
                  followersCount: ctx.followersCount,
                  profilePictureUrl: ctx.profilePictureUrl,
                  lastMediaPermalink: ctx.lastMediaPermalink,
                  updatedAt: new Date(),
                })
                .where(eq(prospectingProfiles.id, profile.id));
            }
          }
        }
      }
    }

    (globalThis as any).__crmInstagramCollectorStatus = {
      lastRun: startedAt.toISOString(),
      status: "ok",
      commentsSeen,
      commentsSemUsername,
      newInteractions,
      enrichCalls,
      durationMs: Date.now() - startedAt.getTime(),
    };
    console.log(
      `[crm-instagram] coletor ok: ${commentsSeen} comentários, ${newInteractions} novas interações, ${commentsSemUsername} sem username, ${enrichCalls} enrich`
    );
  } catch (err: any) {
    console.error("[crm-instagram] coletor erro:", err.message);
    (globalThis as any).__crmInstagramCollectorStatus = {
      lastRun: startedAt.toISOString(),
      status: "error",
      error: err.message,
    };
  }
}
