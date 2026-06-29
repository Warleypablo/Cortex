import type { Express } from "express";
import { randomBytes } from "crypto";
import { pool } from "../db";
import { isGrowthTeam } from "../../shared/growth-team";

// ============================================================================
// Encurtador de links da Turbo — backend (Fase 2)
//
// Arquitetura híbrida (ver docs/encurtador-links-plano.md):
//  - O redirect roda num Cloudflare Worker na borda (marketing.turbopartners.com.br).
//  - Aqui no Cortex ficam: criar o link (a partir do UTM Builder), gerir, e receber
//    o clique do Worker pra gravar no Postgres e cruzar com Bitrix/Meta por UTM.
//  - short_links é a fonte de verdade do cadastro; o KV do Cloudflare é só cache de redirect.
//
// Rotas:
//  POST /api/links/shorten  (Growth + admins) — cria slug, grava em short_links + KV
//  GET  /api/links          (Growth + admins) — lista links + contagem de cliques
//  POST /api/clicks         (header secreto)  — recebe clique do Worker → short_link_clicks
// ============================================================================

const SHORTENER_BASE_URL = (process.env.SHORTENER_BASE_URL || "https://marketing.turbopartners.com.br").replace(/\/+$/, "");

// Slugs reservados (rotas utilitárias que o Worker pode querer pra si)
const RESERVED_SLUGS = new Set(["api", "favicon.ico", "robots.txt", "health", "_health", "s", "l", "go", "admin"]);

// Slug aleatório (quando o usuário não digita um nome) — 8 chars hex, fácil de ditar.
function randomSlug(): string {
  return randomBytes(4).toString("hex");
}

// Slug: estrito [a-z0-9-], 2..80, sem acento, sem hífen nas pontas.
function sanitizeSlug(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extrai a UTM desmembrada do target_url pra gravar nas colunas (cruzar com Bitrix/Meta).
function parseUtmFromUrl(rawUrl: string): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
} {
  const empty = { utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null };
  try {
    const u = new URL(rawUrl);
    const p = u.searchParams;
    return {
      utmSource: p.get("utm_source"),
      utmMedium: p.get("utm_medium"),
      utmCampaign: p.get("utm_campaign"),
      utmTerm: p.get("utm_term"),
      utmContent: p.get("utm_content"),
    };
  } catch {
    return empty;
  }
}

// Grava slug → target_url no KV do Cloudflare (fonte do redirect na borda).
// Best-effort: se as env vars do CF não estiverem setadas (ex.: local), apenas
// loga e retorna false — o cadastro no Postgres continua funcionando pra testar.
async function writeToCloudflareKV(slug: string, targetUrl: string): Promise<boolean> {
  const { CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_KV_NAMESPACE_ID || !CF_API_TOKEN) {
    console.warn("[shortener] CF_* não configurado — pulando escrita no KV (link só no Postgres).");
    return false;
  }
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${encodeURIComponent(slug)}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "text/plain" },
      body: targetUrl,
    });
    if (!resp.ok) {
      console.error(`[shortener] KV write falhou (${resp.status}):`, await resp.text());
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[shortener] KV write erro:", err.message);
    return false;
  }
}

export function registerShortenerRoutes(app: Express) {
  const getUserId = (req: any): string => {
    const user = req.user as any;
    return user?.googleId || user?.id || "";
  };

  const requireGrowthOrAdmin = (req: any, res: any, next: any) => {
    const user = req.user as any;
    const isAdmin = user?.role === "admin";
    const isGrowth = isGrowthTeam(user?.email);
    if (!user || (!isAdmin && !isGrowth)) {
      return res.status(403).json({ error: "Acesso restrito ao time de Growth e admins." });
    }
    next();
  };

  // POST /api/links/shorten
  // body: { slug, targetUrl, generatedUtmLinkId? }
  // A UTM desmembrada é extraída do próprio targetUrl (sempre bate com o destino).
  app.post("/api/links/shorten", requireGrowthOrAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const { slug: rawSlug, targetUrl: rawTarget, generatedUtmLinkId } = req.body as Record<string, string | undefined>;

      if (!rawTarget) return res.status(400).json({ error: "targetUrl é obrigatório" });
      const targetUrl = rawTarget.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ error: "targetUrl deve começar com http:// ou https://" });
      }

      // Slug custom (digitado) vs aleatório (campo vazio → auto-encurtar todo link).
      const customSlug = sanitizeSlug(rawSlug || "");
      const isCustom = (rawSlug || "").trim().length > 0;
      if (isCustom) {
        if (customSlug.length < 2) {
          return res.status(400).json({ error: "Nome do link deve ter ao menos 2 caracteres (letras, números e hífen)." });
        }
        if (RESERVED_SLUGS.has(customSlug)) {
          return res.status(400).json({ error: `"${customSlug}" é reservado. Escolha outro.` });
        }
      }

      const utm = parseUtmFromUrl(targetUrl);

      // Dedup: a UTM é única e centraliza os cliques. Se esse destino exato já tem
      // um link curto, reusa o mesmo (garante o KV) em vez de criar outro slug.
      const existing = await pool.query(
        `SELECT id, slug, target_url AS "targetUrl"
         FROM cortex_core.short_links
         WHERE target_url = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [targetUrl]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const kvSynced = await writeToCloudflareKV(row.slug, targetUrl);
        return res.json({
          id: row.id,
          slug: row.slug,
          shortUrl: `${SHORTENER_BASE_URL}/${row.slug}`,
          targetUrl: row.targetUrl,
          kvSynced,
          deduped: true,
        });
      }

      // Custom = 1 tentativa (409 se ocupado). Aleatório = algumas tentativas até achar livre.
      let insertedRow: any = null;
      let slug = "";
      const maxTries = isCustom ? 1 : 6;
      for (let i = 0; i < maxTries; i++) {
        const candidate = isCustom ? customSlug : randomSlug();
        if (!isCustom && RESERVED_SLUGS.has(candidate)) continue;
        const insert = await pool.query(
          `INSERT INTO cortex_core.short_links
             (slug, target_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, generated_utm_link_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (slug) DO NOTHING
           RETURNING id, slug, target_url AS "targetUrl", created_at AS "createdAt"`,
          [
            candidate,
            targetUrl,
            utm.utmSource,
            utm.utmMedium,
            utm.utmCampaign,
            utm.utmTerm,
            utm.utmContent,
            generatedUtmLinkId || null,
            userId,
          ]
        );
        if (insert.rows.length > 0) {
          insertedRow = insert.rows[0];
          slug = candidate;
          break;
        }
      }

      if (!insertedRow) {
        if (isCustom) {
          return res.status(409).json({ error: `O nome "${customSlug}" já está em uso. Escolha outro.` });
        }
        return res.status(500).json({ error: "Não foi possível gerar um nome único. Tente de novo." });
      }

      const kvSynced = await writeToCloudflareKV(slug, targetUrl);

      res.json({
        id: insertedRow.id,
        slug,
        shortUrl: `${SHORTENER_BASE_URL}/${slug}`,
        targetUrl: insertedRow.targetUrl,
        kvSynced, // false em local sem CF_* — link existe no banco mas ainda não redireciona
      });
    } catch (error: any) {
      console.error("[shortener] POST shorten error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/links — lista links (todos do time) + contagem de cliques
  app.get("/api/links", requireGrowthOrAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          sl.id,
          sl.slug,
          sl.target_url AS "targetUrl",
          sl.utm_source AS "utmSource",
          sl.utm_medium AS "utmMedium",
          sl.utm_campaign AS "utmCampaign",
          sl.utm_content AS "utmContent",
          sl.is_active AS "isActive",
          sl.expires_at AS "expiresAt",
          sl.created_at AS "createdAt",
          u.name AS "createdByName",
          COALESCE(c.cnt, 0)::int AS "clickCount"
        FROM cortex_core.short_links sl
        LEFT JOIN cortex_core.auth_users u ON u.id = sl.created_by
        LEFT JOIN (
          SELECT slug, COUNT(*) AS cnt
          FROM cortex_core.short_link_clicks
          GROUP BY slug
        ) c ON c.slug = sl.slug
        ORDER BY sl.created_at DESC
        LIMIT 500
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[shortener] GET links error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/clicks — ingestão de clique vinda do Cloudflare Worker.
  // Sem sessão: protegido por header secreto compartilhado (CLICK_INGEST_SECRET).
  app.post("/api/clicks", async (req, res) => {
    try {
      const secret = process.env.CLICK_INGEST_SECRET;
      if (secret) {
        const provided = req.header("x-click-secret");
        if (provided !== secret) return res.status(401).json({ error: "unauthorized" });
      } else {
        console.warn("[shortener] CLICK_INGEST_SECRET não configurado — aceitando clique sem auth (dev).");
      }

      const { slug: rawSlug, country, ipHash, userAgent, referrer } = req.body as Record<string, string | undefined>;
      const slug = sanitizeSlug(rawSlug || "");
      if (!slug) return res.status(400).json({ error: "slug é obrigatório" });

      await pool.query(
        `INSERT INTO cortex_core.short_link_clicks (slug, country, ip_hash, user_agent, referrer)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          slug,
          country ? country.slice(0, 2).toUpperCase() : null,
          ipHash ? ipHash.slice(0, 64) : null,
          userAgent || null,
          referrer || null,
        ]
      );

      res.status(204).end();
    } catch (error: any) {
      console.error("[shortener] POST clicks error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
