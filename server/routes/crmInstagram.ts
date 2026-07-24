import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { bitrixDealAdd, bitrixFindUserIdByEmail } from "../services/bitrixClient";

// Campo customizado "SDR" no Bitrix (tipo employee). Responsável = ASSIGNED_BY_ID.
const BITRIX_SDR_FIELD = "UF_CRM_1752257983";
import {
  temperatureFrom, leadScore, interactionPoints,
  DEFAULT_SCORING_CONFIG, normalizeScoringConfig, type ScoringConfig,
} from "../../shared/crmInstagramScoring";
import { BLOCKING_TAGS, isQualificationTag } from "../../shared/crmInstagramTags";

const STAGES = ["engajador", "oportunidade", "negocio"] as const;
const SUBCATEGORIES = ["creator_ugc", "job_candidate", "competitor", "poor_fit"] as const;
const LOCK_TTL_MIN = 15;

// Quem pode SALVAR mudanças no lead scoring (config é global). Admins sempre podem.
const SCORING_EDITOR_EMAILS = new Set([
  "vinicius.ichino@turbopartners.com.br",
  "lucas.pereira@turbopartners.com.br",
]);

function canEditScoring(user: any): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return SCORING_EDITOR_EMAILS.has(String(user.email || "").toLowerCase());
}

export function registerCrmInstagramRoutes(app: Express, db: any, _storage: IStorage) {
  // Carrega o config de scoring do banco (linha id=1) ou cai no default.
  async function loadScoringConfig(): Promise<ScoringConfig> {
    try {
      const row = (await db.execute(sql`
        SELECT config FROM cortex_core.crm_instagram_scoring_config WHERE id = 1
      `)).rows[0];
      return row ? normalizeScoringConfig(row.config) : DEFAULT_SCORING_CONFIG;
    } catch {
      return DEFAULT_SCORING_CONFIG;
    }
  }

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
               p.profile_picture_url, p.last_media_permalink, p.stage, p.subcategory, p.qualification, p.observacao,
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
                 COUNT(*) FILTER (WHERE type = 'like') AS like_count,
                 COUNT(*) FILTER (WHERE type = 'like_ad') AS like_ad_count,
                 COUNT(*) FILTER (WHERE type = 'follow') AS follow_count,
                 COUNT(DISTINCT ig_media_id) AS distinct_posts,
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
      const cfg = await loadScoringConfig();
      const rows = (result.rows as any[]).map((r) => {
        const dmCount = Number(r.dm_count);
        const commentCount = Number(r.comment_count);
        const likeCount = Number(r.like_count) || 0;
        const likeAdCount = Number(r.like_ad_count) || 0;
        const followCount = Number(r.follow_count) || 0;
        const distinctPosts = Number(r.distinct_posts) || 0;
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
          observacao: r.observacao,
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
          likeCount,
          likeAdCount,
          followCount,
          distinctPosts,
          lastText: r.last_text,
          temperature: temperatureFrom(r.last_interaction_at, now, cfg.hotDays, cfg.warmDays),
          score: leadScore({
            counts: { spontaneous_dm: dmCount, comment: commentCount, like: likeCount, like_ad: likeAdCount, follow: followCount },
            distinctPosts,
          }, cfg),
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

      const interactionRows = (await db.execute(sql`
        SELECT pi.id, pi.type, pi.ig_media_id, pi.text, pi.source, pi.occurred_at,
               pm.caption AS post_caption
        FROM cortex_core.prospecting_interactions pi
        LEFT JOIN cortex_core.instagram_post_metrics pm ON pm.ig_media_id = pi.ig_media_id
        WHERE pi.profile_id = ${id}
        ORDER BY pi.occurred_at DESC
        LIMIT 200
      `)).rows;

      const cfg = await loadScoringConfig();
      const interactions = (interactionRows as any[]).map((r) => ({
        id: r.id,
        type: r.type,
        igMediaId: r.ig_media_id,
        text: r.text,
        source: r.source,
        occurredAt: r.occurred_at,
        postCaption: r.post_caption,
        points: interactionPoints(r.type, cfg),
      }));

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

  // ── Observação livre do SDR (persistente; vai pro Bitrix na criação) ──
  app.post("/api/crm-instagram/profiles/:id/observacao", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const raw = req.body?.observacao;
      const observacao = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 2000) : null;
      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET observacao = ${observacao}, updated_at = NOW()
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
      const { nome, telefone, email, observacao } = req.body || {};

      const profile = (await db.execute(sql`
        SELECT id, ig_username, display_name, bio, last_media_permalink, bitrix_deal_id, stage, observacao
        FROM cortex_core.prospecting_profiles WHERE id = ${id}
      `)).rows[0];
      if (!profile) return res.status(404).json({ message: "não encontrado" });

      if (profile.bitrix_deal_id) {
        return res.json({ alreadyExists: true, dealId: profile.bitrix_deal_id });
      }

      // Identidade: @handle real se houver (via comentário); senão o nome de exibição.
      const ident = profile.ig_username ? `@${profile.ig_username}` : (profile.display_name || "lead IG");

      // Observação: usa a do modal se veio, senão a já salva no perfil.
      const obs = (typeof observacao === "string" && observacao.trim())
        ? observacao.trim().slice(0, 2000)
        : (profile.observacao || null);

      const comments = [
        `Origem: Instagram (CRM Instagram / garimpo)`,
        ident,
        profile.last_media_permalink ? `Último post: ${profile.last_media_permalink}` : null,
        profile.bio ? `Bio: ${profile.bio}` : null,
        telefone ? `Telefone: ${telefone}` : null,
        email ? `Email: ${email}` : null,
        obs ? `Observação do SDR: ${obs}` : null,
      ].filter(Boolean).join("\n");

      // Atribui Responsável + SDR ao próprio SDR logado (best-effort por e-mail).
      const sdrBitrixId = await bitrixFindUserIdByEmail(user?.email);

      const dealId = await bitrixDealAdd({
        TITLE: nome ? `${nome} (${ident})` : `IG Garimpo - ${ident}`,
        SOURCE_ID: "instagram_organic",
        UTM_SOURCE: "instagram",
        UTM_MEDIUM: "organic",
        UTM_CAMPAIGN: "garimpo_engajamento",
        ...(sdrBitrixId ? { ASSIGNED_BY_ID: sdrBitrixId, [BITRIX_SDR_FIELD]: sdrBitrixId } : {}),
        COMMENTS: comments,
      });

      await db.execute(sql`
        UPDATE cortex_core.prospecting_profiles
        SET bitrix_deal_id = ${dealId}, stage = 'negocio', observacao = ${obs}, updated_at = NOW()
        WHERE id = ${id}
      `);
      await db.execute(sql`
        INSERT INTO cortex_core.prospecting_status_log (profile_id, from_stage, to_stage, by_user)
        VALUES (${id}, ${profile.stage}, 'negocio', ${user?.id || null})
      `);

      res.json({ ok: true, dealId, assigned: !!sdrBitrixId });
    } catch (err: any) {
      console.error("[crm-instagram] POST /bitrix erro:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Analytics por post (aba Social Media) ──
  // ── Lead scoring: ler config (todos) e salvar (só editores) ──
  app.get("/api/crm-instagram/scoring-config", async (req, res) => {
    try {
      const row = (await db.execute(sql`
        SELECT config, updated_by, updated_at FROM cortex_core.crm_instagram_scoring_config WHERE id = 1
      `)).rows[0];
      res.json({
        config: row ? normalizeScoringConfig(row.config) : DEFAULT_SCORING_CONFIG,
        defaults: DEFAULT_SCORING_CONFIG,
        isDefault: !row,
        updatedBy: row?.updated_by || null,
        updatedAt: row?.updated_at || null,
        canEdit: canEditScoring(req.user),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/crm-instagram/scoring-config", async (req, res) => {
    try {
      const user = req.user as any;
      if (!canEditScoring(user)) {
        return res.status(403).json({ message: "Sem permissão para alterar o lead scoring." });
      }
      const config = normalizeScoringConfig(req.body?.config);
      const by = user?.email || user?.id || null;
      await db.execute(sql`
        INSERT INTO cortex_core.crm_instagram_scoring_config (id, config, updated_by, updated_at)
        VALUES (1, ${JSON.stringify(config)}::jsonb, ${by}, NOW())
        ON CONFLICT (id) DO UPDATE
          SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `);
      res.json({ ok: true, config });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Apify: sincronizar curtidas (Post Likers) — trigger manual (gasta crédito) ──
  app.post("/api/crm-instagram/apify/sync-likers", async (req, res) => {
    try {
      if (!canEditScoring(req.user)) {
        return res.status(403).json({ message: "Sem permissão para rodar a sincronização." });
      }
      const { ingestApifyPostLikers } = await import("../services/crmInstagramApifyIngest");
      const postUrls = Array.isArray(req.body?.postUrls) ? req.body.postUrls : undefined;
      const result = await ingestApifyPostLikers({ postUrls });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // HikerAPI — curtidas (roda com HIKERAPI_TOKEN). Substitui o Apify a ~1/280 do custo.
  app.post("/api/crm-instagram/hiker/sync-likers", async (req, res) => {
    try {
      if (!canEditScoring(req.user)) {
        return res.status(403).json({ message: "Sem permissão para rodar a sincronização." });
      }
      const { ingestHikerLikers } = await import("../services/crmInstagramHikerIngest");
      const postLimit = Number.isFinite(req.body?.postLimit) ? Number(req.body.postLimit) : undefined;
      const result = await ingestHikerLikers({ postLimit });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // HikerAPI — seguidores (extra-gated por HIKERAPI_FOLLOWERS_ENABLED; LGPD).
  app.post("/api/crm-instagram/hiker/sync-followers", async (req, res) => {
    try {
      if (!canEditScoring(req.user)) {
        return res.status(403).json({ message: "Sem permissão para rodar a sincronização." });
      }
      const { ingestHikerFollowers } = await import("../services/crmInstagramHikerIngest");
      const maxToScan = Number.isFinite(req.body?.maxToScan) ? Number(req.body.maxToScan) : undefined;
      const result = await ingestHikerFollowers({ maxToScan });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

}
