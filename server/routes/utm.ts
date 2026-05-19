import type { Express } from "express";
import { pool } from "../db";
import {
  UTM_MEDIUMS,
  UTM_SOURCES_BY_MEDIUM,
  isValidMedium,
  isValidSource,
  type UtmMedium,
} from "../../shared/utm-vocabulary";
import { sanitizeUtmValue, sanitizeBaseUrl, buildUtmUrl } from "../../shared/utm-sanitize";
import { isGrowthTeam } from "../../shared/growth-team";

export function registerUtmRoutes(app: Express) {
  const getUserId = (req: any): string => {
    const user = req.user as any;
    return user?.googleId || user?.id || "";
  };

  const requireVocabularyEditor = (req: any, res: any, next: any) => {
    const user = req.user as any;
    const isAdmin = user?.role === "admin";
    const isGrowth = isGrowthTeam(user?.email);
    if (!user || (!isAdmin && !isGrowth)) {
      return res.status(403).json({ error: "Acesso restrito ao time de Growth e admins." });
    }
    next();
  };

  // GET /api/utm/vocabulary?field=campaign&medium=organic&source=instagram
  // Lista valores ativos para popular o dropdown da aba "Gerar".
  app.get("/api/utm/vocabulary", async (req, res) => {
    try {
      const { field, medium, source } = req.query as {
        field?: string;
        medium?: string;
        source?: string;
      };

      if (!field || (field !== "campaign" && field !== "term")) {
        return res.status(400).json({ error: "field deve ser 'campaign' ou 'term'" });
      }
      if (!medium || !isValidMedium(medium)) {
        return res.status(400).json({ error: "medium inválido" });
      }

      // source NULL no banco = vale pra qualquer source do medium
      const params: any[] = [field, medium];
      let sourceFilter = "(source IS NULL";
      if (source) {
        params.push(source);
        sourceFilter += ` OR source = $${params.length}`;
      }
      sourceFilter += ")";

      const result = await pool.query(
        `SELECT id, value, label_pt as "labelPt", source
         FROM cortex_core.utm_vocabulary
         WHERE field = $1 AND medium = $2 AND ${sourceFilter} AND is_active = TRUE
         ORDER BY label_pt`,
        params
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error("[utm] GET vocabulary error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/utm/base-urls — sugestões de URL base (domínios já usados)
  app.get("/api/utm/base-urls", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT base_url, COUNT(*) as uses
         FROM cortex_core.generated_utm_links
         WHERE created_at > NOW() - INTERVAL '90 days'
         GROUP BY base_url
         ORDER BY uses DESC, base_url
         LIMIT 20`
      );
      res.json(result.rows.map((r) => r.base_url));
    } catch (error: any) {
      console.error("[utm] GET base-urls error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/utm/generate
  // Sanitiza, valida, grava em generated_utm_links, retorna { url, id }.
  app.post("/api/utm/generate", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const {
        baseUrl: rawBaseUrl,
        utmSource: rawSource,
        utmMedium: rawMedium,
        utmCampaign: rawCampaign,
        utmTerm: rawTerm,
        utmContent: rawContent,
      } = req.body as Record<string, string | undefined>;

      if (!rawBaseUrl || !rawSource || !rawMedium) {
        return res.status(400).json({ error: "baseUrl, utmSource e utmMedium são obrigatórios" });
      }

      const baseUrl = sanitizeBaseUrl(rawBaseUrl);
      if (!/^https?:\/\//i.test(baseUrl)) {
        return res.status(400).json({ error: "baseUrl deve começar com http:// ou https://" });
      }

      const utmMedium = sanitizeUtmValue(rawMedium);
      if (!isValidMedium(utmMedium)) {
        return res.status(400).json({ error: `utm_medium inválido. Permitidos: ${UTM_MEDIUMS.join(", ")}` });
      }

      const utmSource = sanitizeUtmValue(rawSource);
      if (!isValidSource(utmMedium as UtmMedium, utmSource)) {
        return res.status(400).json({
          error: `utm_source "${utmSource}" não é válido para utm_medium "${utmMedium}".`,
        });
      }

      const utmCampaign = rawCampaign ? sanitizeUtmValue(rawCampaign) : null;
      const utmTerm = rawTerm ? sanitizeUtmValue(rawTerm) : null;
      const utmContent = rawContent ? sanitizeUtmValue(rawContent) : null;

      // is_adhoc = true se campaign ou term não estão cadastrados em utm_vocabulary
      let isAdhoc = false;
      if (utmCampaign || utmTerm) {
        const checkSql = `
          SELECT
            ($1::text IS NULL OR EXISTS (
              SELECT 1 FROM cortex_core.utm_vocabulary
              WHERE field = 'campaign' AND medium = $3
                AND (source IS NULL OR source = $4) AND value = $1 AND is_active
            )) AS campaign_ok,
            ($2::text IS NULL OR EXISTS (
              SELECT 1 FROM cortex_core.utm_vocabulary
              WHERE field = 'term' AND medium = $3
                AND (source IS NULL OR source = $4) AND value = $2 AND is_active
            )) AS term_ok
        `;
        const { rows } = await pool.query(checkSql, [utmCampaign, utmTerm, utmMedium, utmSource]);
        isAdhoc = !(rows[0].campaign_ok && rows[0].term_ok);
      }

      const fullUrl = buildUtmUrl({
        baseUrl,
        utmSource,
        utmMedium,
        utmCampaign: utmCampaign || undefined,
        utmTerm: utmTerm || undefined,
        utmContent: utmContent || undefined,
      });

      const insertResult = await pool.query(
        `INSERT INTO cortex_core.generated_utm_links
         (user_id, base_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, full_url, is_adhoc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, full_url as "fullUrl", is_adhoc as "isAdhoc"`,
        [userId, baseUrl, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, fullUrl, isAdhoc]
      );

      res.json({
        id: insertResult.rows[0].id,
        url: insertResult.rows[0].fullUrl,
        isAdhoc: insertResult.rows[0].isAdhoc,
      });
    } catch (error: any) {
      console.error("[utm] POST generate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/utm/history?medium=&source=&q=&page=&onlyAdhoc=
  app.get("/api/utm/history", async (req, res) => {
    try {
      const { medium, source, q, onlyAdhoc } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const wheres: string[] = [];
      const params: any[] = [];

      if (medium) {
        params.push(medium);
        wheres.push(`g.utm_medium = $${params.length}`);
      }
      if (source) {
        params.push(source);
        wheres.push(`g.utm_source = $${params.length}`);
      }
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        wheres.push(
          `(LOWER(g.utm_campaign) LIKE $${params.length} OR LOWER(g.utm_content) LIKE $${params.length} OR LOWER(g.utm_term) LIKE $${params.length} OR LOWER(g.base_url) LIKE $${params.length})`
        );
      }
      if (onlyAdhoc === "true") {
        wheres.push(`g.is_adhoc = TRUE`);
      }

      const whereClause = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";

      params.push(pageSize);
      params.push(offset);

      const sql = `
        SELECT
          g.id,
          g.base_url AS "baseUrl",
          g.utm_source AS "utmSource",
          g.utm_medium AS "utmMedium",
          g.utm_campaign AS "utmCampaign",
          g.utm_term AS "utmTerm",
          g.utm_content AS "utmContent",
          g.full_url AS "fullUrl",
          g.is_adhoc AS "isAdhoc",
          g.created_at AS "createdAt",
          u.name AS "userName",
          u.email AS "userEmail"
        FROM cortex_core.generated_utm_links g
        LEFT JOIN cortex_core.auth_users u ON u.id = g.user_id
        ${whereClause}
        ORDER BY g.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const result = await pool.query(sql, params);
      res.json({ rows: result.rows, page, pageSize });
    } catch (error: any) {
      console.error("[utm] GET history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================================================
  // ADMIN — Configurar valores (Aba 3)
  // ==========================================================================

  // GET /api/utm/vocabulary/all?field=&medium=&source=&active=
  app.get("/api/utm/vocabulary/all", requireVocabularyEditor, async (req, res) => {
    try {
      const { field, medium, source, active } = req.query as Record<string, string | undefined>;
      const wheres: string[] = [];
      const params: any[] = [];

      if (field) {
        params.push(field);
        wheres.push(`field = $${params.length}`);
      }
      if (medium) {
        params.push(medium);
        wheres.push(`medium = $${params.length}`);
      }
      if (source) {
        params.push(source);
        wheres.push(`source = $${params.length}`);
      }
      if (active === "true") wheres.push(`is_active = TRUE`);
      if (active === "false") wheres.push(`is_active = FALSE`);

      const whereClause = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";

      const result = await pool.query(
        `SELECT id, field, medium, source, value, label_pt AS "labelPt", is_active AS "isActive", created_at AS "createdAt"
         FROM cortex_core.utm_vocabulary
         ${whereClause}
         ORDER BY field, medium, COALESCE(source, ''), label_pt`,
        params
      );
      res.json(result.rows);
    } catch (error: any) {
      console.error("[utm] GET vocabulary/all error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/utm/vocabulary — cadastrar novo valor
  app.post("/api/utm/vocabulary", requireVocabularyEditor, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { field, medium, source, value, labelPt } = req.body as Record<string, string | undefined>;

      if (!field || (field !== "campaign" && field !== "term")) {
        return res.status(400).json({ error: "field deve ser 'campaign' ou 'term'" });
      }
      if (!medium || !isValidMedium(medium)) {
        return res.status(400).json({ error: "medium inválido" });
      }
      const cleanValue = sanitizeUtmValue(value || "");
      if (!cleanValue) {
        return res.status(400).json({ error: "value é obrigatório" });
      }
      if (!labelPt || labelPt.trim().length === 0) {
        return res.status(400).json({ error: "labelPt é obrigatório" });
      }

      const cleanSource = source && source.trim().length > 0 ? source.trim() : null;

      const result = await pool.query(
        `INSERT INTO cortex_core.utm_vocabulary (field, medium, source, value, label_pt, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (field, medium, (COALESCE(source, '')), value) DO UPDATE
           SET label_pt = EXCLUDED.label_pt, is_active = TRUE, updated_at = NOW()
         RETURNING id, field, medium, source, value, label_pt AS "labelPt", is_active AS "isActive"`,
        [field, medium, cleanSource, cleanValue, labelPt.trim(), userId]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[utm] POST vocabulary error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/utm/vocabulary/:id — editar label / ativar-desativar
  app.patch("/api/utm/vocabulary/:id", requireVocabularyEditor, async (req, res) => {
    try {
      const { id } = req.params;
      const { labelPt, isActive } = req.body as { labelPt?: string; isActive?: boolean };

      const sets: string[] = ["updated_at = NOW()"];
      const params: any[] = [];

      if (typeof labelPt === "string" && labelPt.trim().length > 0) {
        params.push(labelPt.trim());
        sets.push(`label_pt = $${params.length}`);
      }
      if (typeof isActive === "boolean") {
        params.push(isActive);
        sets.push(`is_active = $${params.length}`);
      }
      if (params.length === 0) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }
      params.push(id);

      const result = await pool.query(
        `UPDATE cortex_core.utm_vocabulary
         SET ${sets.join(", ")}
         WHERE id = $${params.length}
         RETURNING id, field, medium, source, value, label_pt AS "labelPt", is_active AS "isActive"`,
        params
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Não encontrado" });
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[utm] PATCH vocabulary error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/utm/adhoc-pending — lista valores ad-hoc ainda não cadastrados
  // (já cadastrado ATIVO ou INATIVO = não aparece aqui — "dispensar" cria entrada inativa)
  app.get("/api/utm/adhoc-pending", requireVocabularyEditor, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT
          field,
          medium,
          source,
          value,
          first_seen,
          uses
        FROM (
          SELECT 'campaign' AS field, g.utm_medium AS medium, g.utm_source AS source, g.utm_campaign AS value,
                 MIN(g.created_at) AS first_seen, COUNT(*) AS uses
            FROM cortex_core.generated_utm_links g
           WHERE g.is_adhoc = TRUE AND g.utm_campaign IS NOT NULL
             AND NOT EXISTS (
                  SELECT 1 FROM cortex_core.utm_vocabulary v
                   WHERE v.field = 'campaign' AND v.medium = g.utm_medium
                     AND (v.source IS NULL OR v.source = g.utm_source)
                     AND v.value = g.utm_campaign
                )
           GROUP BY g.utm_medium, g.utm_source, g.utm_campaign
          UNION ALL
          SELECT 'term' AS field, g.utm_medium AS medium, g.utm_source AS source, g.utm_term AS value,
                 MIN(g.created_at) AS first_seen, COUNT(*) AS uses
            FROM cortex_core.generated_utm_links g
           WHERE g.is_adhoc = TRUE AND g.utm_term IS NOT NULL
             AND NOT EXISTS (
                  SELECT 1 FROM cortex_core.utm_vocabulary v
                   WHERE v.field = 'term' AND v.medium = g.utm_medium
                     AND (v.source IS NULL OR v.source = g.utm_source)
                     AND v.value = g.utm_term
                )
           GROUP BY g.utm_medium, g.utm_source, g.utm_term
        ) t
        ORDER BY first_seen DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[utm] GET adhoc-pending error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/utm/adhoc-dismiss — dispensa um valor pendente sem oficializar
  // Cria entrada como inativa em utm_vocabulary (some das pendências, mas não vai pro dropdown)
  app.post("/api/utm/adhoc-dismiss", requireVocabularyEditor, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { field, medium, source, value } = req.body as Record<string, string | null | undefined>;

      if (!field || (field !== "campaign" && field !== "term")) {
        return res.status(400).json({ error: "field deve ser 'campaign' ou 'term'" });
      }
      if (!medium || !isValidMedium(medium)) {
        return res.status(400).json({ error: "medium inválido" });
      }
      const cleanValue = sanitizeUtmValue(value || "");
      if (!cleanValue) {
        return res.status(400).json({ error: "value é obrigatório" });
      }
      const cleanSource = source && source.trim().length > 0 ? source.trim() : null;

      const result = await pool.query(
        `INSERT INTO cortex_core.utm_vocabulary (field, medium, source, value, label_pt, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, FALSE, $6)
         ON CONFLICT (field, medium, (COALESCE(source, '')), value) DO UPDATE
           SET is_active = FALSE, updated_at = NOW()
         RETURNING id, field, medium, source, value, is_active AS "isActive"`,
        [field, medium, cleanSource, cleanValue, `[dispensado] ${cleanValue}`, userId]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[utm] POST adhoc-dismiss error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
