import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { bitrixDealAdd } from "../services/bitrixClient";
import { temperatureFrom, leadScore } from "../../shared/crmInstagramScoring";
import { BLOCKING_TAGS, isQualificationTag } from "../../shared/crmInstagramTags";

const STAGES = ["engajador", "oportunidade", "negocio"] as const;
const SUBCATEGORIES = ["creator_ugc", "job_candidate", "competitor", "poor_fit"] as const;
const LOCK_TTL_MIN = 15;

export function registerCrmInstagramRoutes(app: Express, db: any, _storage: IStorage) {
  // ── Lista de prospects (kanban) — priorização + temperatura + dedup ──
  app.get("/api/crm-instagram/profiles", async (req, res) => {
    try {
      const stage = typeof req.query.stage === "string" ? req.query.stage : null;
      const owner = typeof req.query.owner === "string" ? req.query.owner : null;
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : null;
      // scope=all → aba Qualificação (mostra todos, inclusive bloqueados).
      // Default (Pipeline) → esconde tags de bloqueio (colaborador/desqualificado).
      const includeBlocked = req.query.scope === "all";

      const result = await db.execute(sql`
        SELECT p.id, p.ig_username, p.display_name, p.ig_user_id, p.bio, p.followers_count,
               p.profile_picture_url, p.last_media_permalink, p.stage, p.subcategory, p.qualification,
               p.owner_user_id, p.locked_by, p.locked_at, p.bitrix_deal_id,
               p.ghl_contact_id, p.is_existing_contact, p.icp_tags,
               p.first_seen, p.last_interaction_at,
               u.name AS owner_name,
               COALESCE(i.comment_count, 0) AS comment_count,
               COALESCE(i.dm_count, 0) AS dm_count,
               i.last_text
        FROM cortex_core.prospecting_profiles p
        LEFT JOIN cortex_core.auth_users u ON u.id = p.owner_user_id
        LEFT JOIN (
          SELECT profile_id,
                 COUNT(*) FILTER (WHERE type = 'comment') AS comment_count,
                 COUNT(*) FILTER (WHERE type = 'spontaneous_dm') AS dm_count,
                 (ARRAY_AGG(text ORDER BY occurred_at DESC) FILTER (WHERE text IS NOT NULL))[1] AS last_text
          FROM cortex_core.prospecting_interactions
          GROUP BY profile_id
        ) i ON i.profile_id = p.id
        WHERE (${stage}::text IS NULL OR p.stage = ${stage})
          AND (${owner}::text IS NULL OR p.owner_user_id = ${owner})
          AND (${q}::text IS NULL OR LOWER(COALESCE(p.ig_username, p.display_name)) LIKE '%' || ${q} || '%')
          AND (${includeBlocked} OR p.qualification IS NULL OR p.qualification NOT IN (${sql.join(BLOCKING_TAGS.map((t) => sql`${t}`), sql`, `)}))
      `);

      const now = Date.now();
      const rows = (result.rows as any[]).map((r) => {
        const dmCount = Number(r.dm_count);
        const commentCount = Number(r.comment_count);
        return {
          id: r.id,
          igUsername: r.ig_username,
          displayName: r.display_name,
          igUserId: r.ig_user_id,
          bio: r.bio,
          followersCount: r.followers_count,
          profilePictureUrl: r.profile_picture_url,
          lastMediaPermalink: r.last_media_permalink,
          stage: r.stage,
          subcategory: r.subcategory,
          qualification: r.qualification,
          ownerUserId: r.owner_user_id,
          ownerName: r.owner_name,
          lockedBy: r.locked_by,
          lockedAt: r.locked_at,
          isLocked: !!r.locked_by && r.locked_at && (now - new Date(r.locked_at).getTime()) < LOCK_TTL_MIN * 60_000,
          bitrixDealId: r.bitrix_deal_id,
          ghlContactId: r.ghl_contact_id,
          // Location única do GHL (env). Todo lead de DM tem thread → roteia pro GHL.
          ghlLocationId: r.ghl_contact_id ? (process.env.GHL_LOCATION_ID || null) : null,
          isExistingContact: r.is_existing_contact,
          icpTags: r.icp_tags,
          firstSeen: r.first_seen,
          lastInteractionAt: r.last_interaction_at,
          commentCount,
          dmCount,
          lastText: r.last_text,
          temperature: temperatureFrom(r.last_interaction_at, now),
          score: leadScore({
            dmCount,
            commentCount,
            lastInteractionAt: r.last_interaction_at,
            followersCount: r.followers_count,
            subcategory: r.subcategory,
          }, now),
        };
      });
      // Ordena pela qualificação (score desc), recência como desempate.
      rows.sort((a, b) =>
        b.score - a.score ||
        new Date(b.lastInteractionAt || 0).getTime() - new Date(a.lastInteractionAt || 0).getTime(),
      );
      res.json(rows);
    } catch (err: any) {
      console.error("[crm-instagram] GET /profiles erro:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Detalhe: timeline de interações + log de estágios ──
  app.get("/api/crm-instagram/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const profile = (await db.execute(sql`
        SELECT * FROM cortex_core.prospecting_profiles WHERE id = ${id}
      `)).rows[0];
      if (!profile) return res.status(404).json({ message: "não encontrado" });

      const interactions = (await db.execute(sql`
        SELECT id, type, ig_media_id, text, source, occurred_at
        FROM cortex_core.prospecting_interactions
        WHERE profile_id = ${id}
        ORDER BY occurred_at DESC
        LIMIT 200
      `)).rows;

      const log = (await db.execute(sql`
        SELECT from_stage, to_stage, by_user, at
        FROM cortex_core.prospecting_status_log
        WHERE profile_id = ${id}
        ORDER BY at DESC
      `)).rows;

      res.json({ profile, interactions, log });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Mover de estágio (exige lock ou ser dono) ──
  app.post("/api/crm-instagram/profiles/:id/stage", async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id, 10);
      const toStage = req.body?.toStage;
      if (!STAGES.includes(toStage)) return res.status(400).json({ message: "estágio inválido" });

      const profile = (await db.execute(sql`
        SELECT id, stage, owner_user_id, locked_by, locked_at
        FROM cortex_core.prospecting_profiles WHERE id = ${id}
      `)).rows[0];
      if (!profile) return res.status(404).json({ message: "não encontrado" });

      const lockHeldByOther =
        profile.locked_by && profile.locked_by !== user.id &&
        profile.locked_at && (Date.now() - new Date(profile.locked_at).getTime()) < LOCK_TTL_MIN * 60_000;
      if (lockHeldByOther) return res.status(409).json({ message: "prospect travado por outro operador" });

      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET stage = ${toStage}, updated_at = NOW()
        WHERE id = ${id}
      `);
      await db.execute(sql`
        INSERT INTO cortex_core.prospecting_status_log (profile_id, from_stage, to_stage, by_user)
        VALUES (${id}, ${profile.stage}, ${toStage}, ${user?.id || null})
      `);
      res.json({ ok: true, stage: toStage });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Qualificar (tag do SDR; colaborador/desqualificado = blocklist do Pipeline) ──
  app.post("/api/crm-instagram/profiles/:id/qualification", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const qualification = req.body?.qualification ?? null;
      if (qualification !== null && !isQualificationTag(qualification)) {
        return res.status(400).json({ message: "tag de qualificação inválida" });
      }
      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET qualification = ${qualification}, updated_at = NOW()
        WHERE id = ${id}
      `);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Descartar (subcategoria não-oportunidade) ──
  app.post("/api/crm-instagram/profiles/:id/subcategory", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const subcategory = req.body?.subcategory;
      if (subcategory !== null && !SUBCATEGORIES.includes(subcategory)) {
        return res.status(400).json({ message: "subcategoria inválida" });
      }
      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET subcategory = ${subcategory}, updated_at = NOW()
        WHERE id = ${id}
      `);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Reivindicar dono (atômico) ──
  app.post("/api/crm-instagram/profiles/:id/claim", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "não autenticado" });
      const id = parseInt(req.params.id, 10);
      // "Pegar" = virar dono E travar pra mim numa ação só (combinado no plano).
      const updated = (await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET owner_user_id = ${user.id},
            locked_by = ${user.id},
            locked_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id} AND owner_user_id IS NULL
        RETURNING id
      `)).rows;
      if (updated.length === 0) return res.status(409).json({ message: "prospect já tem dono" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Soltar (devolve pra fila: limpa dono + trava; só o dono ou admin) ──
  app.post("/api/crm-instagram/profiles/:id/release", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "não autenticado" });
      const id = parseInt(req.params.id, 10);
      const updated = (await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET owner_user_id = NULL, locked_by = NULL, locked_at = NULL, updated_at = NOW()
        WHERE id = ${id} AND (owner_user_id = ${user.id} OR ${user.role === "admin"})
        RETURNING id
      `)).rows;
      if (updated.length === 0) return res.status(403).json({ message: "só o dono pode soltar" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Travar (atômico, expira lock antigo) ──
  app.post("/api/crm-instagram/profiles/:id/lock", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "não autenticado" });
      const id = parseInt(req.params.id, 10);
      const updated = (await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET locked_by = ${user.id}, locked_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
          AND (locked_by IS NULL
               OR locked_by = ${user.id}
               OR locked_at < NOW() - (${LOCK_TTL_MIN} || ' minutes')::interval)
        RETURNING id
      `)).rows;
      if (updated.length === 0) return res.status(409).json({ message: "travado por outro operador" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Destravar (só o dono do lock ou admin) ──
  app.post("/api/crm-instagram/profiles/:id/unlock", async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id, 10);
      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET locked_by = NULL, locked_at = NULL, updated_at = NOW()
        WHERE id = ${id} AND (locked_by = ${user.id} OR ${user.role === "admin"})
      `);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Criar no Bitrix (botão explícito, idempotente) ──
  app.post("/api/crm-instagram/profiles/:id/bitrix", async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id, 10);
      const { nome, telefone, email, valor, responsavel } = req.body || {};

      const profile = (await db.execute(sql`
        SELECT id, ig_username, display_name, bio, last_media_permalink, bitrix_deal_id, stage
        FROM cortex_core.prospecting_profiles WHERE id = ${id}
      `)).rows[0];
      if (!profile) return res.status(404).json({ message: "não encontrado" });

      if (profile.bitrix_deal_id) {
        return res.json({ alreadyExists: true, dealId: profile.bitrix_deal_id });
      }

      // Identidade: @handle real se houver (via comentário); senão o nome de exibição.
      const ident = profile.ig_username ? `@${profile.ig_username}` : (profile.display_name || "lead IG");

      const comments = [
        `Origem: Instagram (CRM Instagram / garimpo)`,
        ident,
        profile.last_media_permalink ? `Último post: ${profile.last_media_permalink}` : null,
        profile.bio ? `Bio: ${profile.bio}` : null,
        telefone ? `Telefone: ${telefone}` : null,
        email ? `Email: ${email}` : null,
        responsavel ? `Responsável (sugerido): ${responsavel}` : null,
      ].filter(Boolean).join("\n");

      const dealId = await bitrixDealAdd({
        TITLE: nome ? `${nome} (${ident})` : `IG Garimpo - ${ident}`,
        SOURCE_ID: "instagram_organic",
        UTM_SOURCE: "instagram",
        UTM_MEDIUM: "organic",
        UTM_CAMPAIGN: "garimpo_engajamento",
        OPPORTUNITY: valor ? Number(valor) : undefined,
        COMMENTS: comments,
      });

      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET bitrix_deal_id = ${dealId}, stage = 'negocio', updated_at = NOW()
        WHERE id = ${id}
      `);
      await db.execute(sql`
        INSERT INTO cortex_core.prospecting_status_log (profile_id, from_stage, to_stage, by_user)
        VALUES (${id}, ${profile.stage}, 'negocio', ${user?.id || null})
      `);

      res.json({ ok: true, dealId });
    } catch (err: any) {
      console.error("[crm-instagram] POST /bitrix erro:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Analytics por post (aba Social Media) ──
  app.get("/api/crm-instagram/analytics", async (_req, res) => {
    try {
      // Métricas dos posts (já coletadas) + engajadores por post (do garimpo)
      const posts = (await db.execute(sql`
        SELECT pm.ig_media_id, pm.caption, pm.permalink, pm.thumbnail_url,
               pm.media_type, pm.posted_at, pm.likes, pm.comments, pm.saves,
               pm.shares, pm.reach, pm.total_interactions,
               COALESCE(eng.engagers, 0) AS engagers
        FROM cortex_core.instagram_post_metrics pm
        LEFT JOIN (
          SELECT ig_media_id, COUNT(DISTINCT profile_id) AS engagers
          FROM cortex_core.prospecting_interactions
          WHERE ig_media_id IS NOT NULL
          GROUP BY ig_media_id
        ) eng ON eng.ig_media_id = pm.ig_media_id
        ORDER BY pm.posted_at DESC NULLS LAST
        LIMIT 60
      `)).rows;

      // Funil agregado do garimpo
      const funnel = (await db.execute(sql`
        SELECT stage, COUNT(*)::int AS n
        FROM cortex_core.prospecting_profiles
        GROUP BY stage
      `)).rows;

      res.json({ posts, funnel });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
