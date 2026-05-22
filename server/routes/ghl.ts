/**
 * Routes para integração GoHighLevel (GHL).
 *
 * Estrutura:
 *  - POST /webhooks/ghl                    (público — chamado pelo GHL com eventos de email/WA)
 *  - GET  /api/ghl/email-campaigns         (autenticado)
 *  - GET  /api/ghl/whatsapp-metrics        (autenticado)
 *  - GET  /api/ghl/tags                    (autenticado)
 *  - GET  /api/ghl/overview                (autenticado — counts + última sync)
 *
 * Docs: docs/handover-ghl-integracao.md
 */

import type { Express, Request, Response } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { BASE_TAG_MAP, type BaseFiltro } from "@shared/ghl-broadcast/base-tag-map";

// ─── Helpers ──────────────────────────────────────────────────────────────

function parsePeriod(req: Request): { from: Date; to: Date } {
  const toStr = (req.query.to as string) || undefined;
  const fromStr = (req.query.from as string) || undefined;
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// Sources que contam como "marketing" (broadcast/automação) vs 1:1
const MARKETING_SOURCES = ["workflow", "bulk", "campaign"] as const;

// ─── Handlers ─────────────────────────────────────────────────────────────

/**
 * POST /webhooks/ghl
 * Recebe eventos do GHL. Os eventos relevantes pra métricas são:
 *   - Email Events: EmailDelivered, EmailOpened, EmailClicked, EmailBounced,
 *                   EmailUnsubscribed, EmailComplained, EmailDropped
 *   - (futuro) OutboundMessage status updates para WhatsApp
 *
 * Persiste em cortex_core.ghl_email_events (dedup por event_id).
 *
 * NOTA: GHL não envia signature header em webhooks customizados (Settings →
 * Webhooks). Se quiser validação, configurar via Workflow Builder com
 * "Webhook Trigger" + secret no header.
 */
async function handleWebhook(req: Request, res: Response) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const eventType = (payload.type || payload.event || payload.eventType) as string | undefined;
    const eventId = (payload.id || payload.event_id || payload.eventId) as string | undefined;

    // Email events
    if (eventType && /^Email/.test(eventType)) {
      const messageId = payload.messageId || payload.message_id || payload.emailMessageId;
      const contactId = payload.contactId || payload.contact_id;
      const campaignId = payload.campaignId || payload.campaign_id;
      const occurredAt = payload.timestamp || payload.occurredAt || payload.date || new Date().toISOString();
      const clickedLink = payload.clickedLink || payload.url || payload.link;

      await db.execute(sql`
        INSERT INTO cortex_core.ghl_email_events (
          event_id, message_id, contact_id, campaign_id, event_type,
          occurred_at, clicked_link, payload, received_at
        ) VALUES (
          ${eventId ?? null}, ${messageId ?? null}, ${contactId ?? null}, ${campaignId ?? null},
          ${eventType}, ${new Date(occurredAt)}, ${clickedLink ?? null},
          ${JSON.stringify(payload)}::jsonb, NOW()
        )
        ON CONFLICT (event_id) DO NOTHING
      `);

      return res.json({ ok: true, event: eventType });
    }

    // Evento não reconhecido — armazena mesmo assim pra inspeção
    console.warn("[GHL webhook] Evento não reconhecido:", eventType, "payload keys:", Object.keys(payload));
    await db.execute(sql`
      INSERT INTO cortex_core.ghl_email_events (
        event_id, event_type, payload, received_at
      ) VALUES (
        ${eventId ?? null}, ${eventType ?? "unknown"}, ${JSON.stringify(payload)}::jsonb, NOW()
      )
      ON CONFLICT (event_id) DO NOTHING
    `);
    return res.json({ ok: true, event: "unknown_stored" });
  } catch (err: any) {
    console.error("[GHL webhook] Erro:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/email-campaigns?from=...&to=...
 * Lista campanhas no período + agregação de eventos quando disponível.
 */
async function listEmailCampaigns(req: Request, res: Response) {
  try {
    const { from, to } = parsePeriod(req);
    const r = await db.execute(sql`
      WITH event_agg AS (
        SELECT
          campaign_id,
          COUNT(*) FILTER (WHERE event_type = 'EmailDelivered') AS delivered,
          COUNT(*) FILTER (WHERE event_type = 'EmailOpened') AS opened,
          COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'EmailOpened') AS unique_opens,
          COUNT(*) FILTER (WHERE event_type = 'EmailClicked') AS clicked,
          COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'EmailClicked') AS unique_clicks,
          COUNT(*) FILTER (WHERE event_type = 'EmailBounced') AS bounced,
          COUNT(*) FILTER (WHERE event_type = 'EmailUnsubscribed') AS unsubscribed,
          COUNT(*) FILTER (WHERE event_type = 'EmailComplained') AS complained
        FROM cortex_core.ghl_email_events
        GROUP BY campaign_id
      )
      SELECT
        c.id, c.name, c.subject, c.campaign_type, c.status,
        c.total_count, c.success_count, c.failed_count, c.processed_count,
        c.scheduled_at, c.date_added,
        c.has_tracking, c.has_utm_tracking,
        COALESCE(ea.delivered, 0)::int AS delivered_events,
        COALESCE(ea.opened, 0)::int AS opened_events,
        COALESCE(ea.unique_opens, 0)::int AS unique_opens,
        COALESCE(ea.clicked, 0)::int AS clicked_events,
        COALESCE(ea.unique_clicks, 0)::int AS unique_clicks,
        COALESCE(ea.bounced, 0)::int AS bounced_events,
        COALESCE(ea.unsubscribed, 0)::int AS unsubscribed_events,
        COALESCE(ea.complained, 0)::int AS complained_events
      FROM cortex_core.ghl_email_campaigns c
      LEFT JOIN event_agg ea ON ea.campaign_id = c.id
      WHERE COALESCE(c.scheduled_at, c.date_added) BETWEEN ${from} AND ${to}
      ORDER BY COALESCE(c.scheduled_at, c.date_added) DESC NULLS LAST
      LIMIT 500
    `);
    const rows = (r as any).rows;
    res.json({ campaigns: rows, period: { from, to }, count: rows.length });
  } catch (err: any) {
    console.error("[GHL] email-campaigns error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/whatsapp-metrics?from=...&to=...&source=marketing|all
 * Métricas agregadas de WhatsApp por dia.
 */
async function getWhatsappMetrics(req: Request, res: Response) {
  try {
    const { from, to } = parsePeriod(req);
    const sourceFilter = (req.query.source as string) || "marketing"; // marketing | all
    const sources = sourceFilter === "marketing" ? MARKETING_SOURCES : null;

    const r = await db.execute(sql`
      WITH base AS (
        SELECT
          DATE_TRUNC('day', date_added) AS day,
          direction,
          source,
          contact_id,
          id
        FROM cortex_core.ghl_messages
        WHERE message_type = 'TYPE_WHATSAPP'
          AND date_added BETWEEN ${from} AND ${to}
          ${sources ? sql`AND source = ANY(${sources as any}::text[])` : sql``}
      )
      SELECT
        day,
        COUNT(*) FILTER (WHERE direction = 'outbound')::int AS sent,
        COUNT(*) FILTER (WHERE direction = 'inbound')::int AS received,
        COUNT(DISTINCT contact_id) FILTER (WHERE direction = 'outbound')::int AS unique_outbound_contacts,
        COUNT(DISTINCT contact_id) FILTER (WHERE direction = 'inbound')::int AS unique_inbound_contacts
      FROM base
      GROUP BY day
      ORDER BY day ASC
    `);
    const daily = (r as any).rows;

    const tot = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE direction = 'outbound')::int AS sent_total,
        COUNT(*) FILTER (WHERE direction = 'inbound')::int AS received_total,
        COUNT(DISTINCT contact_id) FILTER (WHERE direction = 'outbound')::int AS unique_outbound_total,
        COUNT(DISTINCT contact_id) FILTER (WHERE direction = 'inbound')::int AS unique_inbound_total,
        COUNT(DISTINCT source) FILTER (WHERE source IS NOT NULL)::int AS sources_used
      FROM cortex_core.ghl_messages
      WHERE message_type = 'TYPE_WHATSAPP'
        AND date_added BETWEEN ${from} AND ${to}
        ${sources ? sql`AND source = ANY(${sources as any}::text[])` : sql``}
    `);
    const totals = (tot as any).rows[0] ?? {};

    // Breakdown por source
    const bySrc = await db.execute(sql`
      SELECT source, direction, COUNT(*)::int as n
      FROM cortex_core.ghl_messages
      WHERE message_type = 'TYPE_WHATSAPP'
        AND date_added BETWEEN ${from} AND ${to}
      GROUP BY source, direction
      ORDER BY n DESC
    `);

    res.json({
      period: { from, to },
      sourceFilter,
      daily,
      totals,
      bySource: (bySrc as any).rows,
    });
  } catch (err: any) {
    console.error("[GHL] whatsapp-metrics error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/tags?limit=50
 * Distribuição atual de contatos por tag + evolução 7d se houver histórico.
 */
async function getTags(req: Request, res: Response) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const r = await db.execute(sql`
      WITH today AS (
        SELECT tag, contact_count
        FROM cortex_core.ghl_tags_snapshot
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM cortex_core.ghl_tags_snapshot)
      ),
      week_ago AS (
        SELECT tag, contact_count
        FROM cortex_core.ghl_tags_snapshot
        WHERE snapshot_date = (
          SELECT MAX(snapshot_date) FROM cortex_core.ghl_tags_snapshot
          WHERE snapshot_date <= CURRENT_DATE - 7
        )
      )
      SELECT
        t.tag,
        t.contact_count::int AS current_count,
        COALESCE(w.contact_count, 0)::int AS week_ago_count,
        (t.contact_count - COALESCE(w.contact_count, 0))::int AS delta_7d
      FROM today t
      LEFT JOIN week_ago w ON w.tag = t.tag
      ORDER BY t.contact_count DESC
      LIMIT ${limit}
    `);

    res.json({ tags: (r as any).rows });
  } catch (err: any) {
    console.error("[GHL] tags error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Monta um SQL fragment WHERE pra filtrar contatos da tabela
 * `cortex_core.ghl_contacts` (coluna `tags TEXT[]`) por um BaseFiltro.
 * Usa operadores nativos de array do Postgres (@> e &&).
 *
 *   tagsAll → tags @> ARRAY[...]    (precisa ter todas)
 *   tagsAny → tags && ARRAY[...]    (precisa ter pelo menos uma)
 *   tagsNot → NOT (tags && ARRAY[...])  (não pode ter nenhuma)
 */
function buildTagFilterSql(filtro: BaseFiltro): SQL<unknown> {
  const parts: SQL<unknown>[] = [];
  if (filtro.tagsAll && filtro.tagsAll.length) {
    parts.push(sql`tags @> ${filtro.tagsAll}::text[]`);
  }
  if (filtro.tagsAny && filtro.tagsAny.length) {
    parts.push(sql`tags && ${filtro.tagsAny}::text[]`);
  }
  if (filtro.tagsNot && filtro.tagsNot.length) {
    parts.push(sql`NOT (tags && ${filtro.tagsNot}::text[])`);
  }
  if (parts.length === 0) return sql`true`;
  // join with AND
  return parts.reduce((acc, part, i) => (i === 0 ? part : sql`${acc} AND ${part}`));
}

/**
 * GET /api/ghl/diagnostico?from=...&to=...
 * Performance de cada base nominal Turbo no período.
 * Pra cada base do BASE_TAG_MAP, calcula: contatos, msgs WA out/in, msgs email out.
 * Roda 1 query por base em paralelo.
 */
async function getDiagnostico(req: Request, res: Response) {
  try {
    const { from, to } = parsePeriod(req);
    const bases = Object.entries(BASE_TAG_MAP);

    const results = await Promise.all(
      bases.map(async ([baseName, filtro]) => {
        const whereTags = buildTagFilterSql(filtro);
        try {
          const r = await db.execute(sql`
            WITH base_contacts AS (
              SELECT id FROM cortex_core.ghl_contacts WHERE ${whereTags}
            )
            SELECT
              (SELECT COUNT(*)::int FROM base_contacts) AS contacts,
              COUNT(*) FILTER (WHERE m.message_type = 'TYPE_WHATSAPP' AND m.direction = 'outbound')::int AS wa_sent,
              COUNT(*) FILTER (WHERE m.message_type = 'TYPE_WHATSAPP' AND m.direction = 'inbound')::int AS wa_received,
              COUNT(*) FILTER (WHERE m.message_type = 'TYPE_EMAIL' AND m.direction = 'outbound')::int AS email_sent,
              COUNT(DISTINCT m.contact_id) FILTER (WHERE m.message_type = 'TYPE_WHATSAPP' AND m.direction = 'outbound')::int AS wa_contacts_reached
            FROM base_contacts bc
            LEFT JOIN cortex_core.ghl_messages m
              ON m.contact_id = bc.id
              AND m.date_added BETWEEN ${from} AND ${to}
          `);
          const row = (r as any).rows?.[0] ?? {};
          return { base: baseName, ...row };
        } catch (e: any) {
          return { base: baseName, error: e.message, contacts: 0, wa_sent: 0, wa_received: 0, email_sent: 0, wa_contacts_reached: 0 };
        }
      }),
    );

    res.json({ period: { from, to }, bases: results });
  } catch (err: any) {
    console.error("[GHL] diagnostico error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/messages
 *   ?from=&to=&channel=TYPE_WHATSAPP|TYPE_EMAIL|all
 *   &source=workflow,bulk|all
 *   &direction=outbound|inbound|all
 *   &base=<base-name>  (opcional — filtra contatos pela base do BASE_TAG_MAP)
 *   &search=<texto livre, busca em body+subject>
 *   &limit=50 &offset=0
 *
 * Lista mensagens com filtros + paginação.
 */
async function listMessages(req: Request, res: Response) {
  try {
    const { from, to } = parsePeriod(req);
    const channel = (req.query.channel as string) || "all";
    const sourceStr = (req.query.source as string) || "all";
    const direction = (req.query.direction as string) || "all";
    const base = (req.query.base as string) || "";
    const search = ((req.query.search as string) || "").trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const filters: SQL<unknown>[] = [sql`m.date_added BETWEEN ${from} AND ${to}`];

    if (channel === "TYPE_WHATSAPP" || channel === "TYPE_EMAIL" || channel === "TYPE_SMS") {
      filters.push(sql`m.message_type = ${channel}`);
    }
    if (direction === "outbound" || direction === "inbound") {
      filters.push(sql`m.direction = ${direction}`);
    }
    if (sourceStr !== "all") {
      const sources = sourceStr.split(",").map((s) => s.trim()).filter(Boolean);
      if (sources.length) {
        filters.push(sql`m.source = ANY(${sources}::text[])`);
      }
    }
    if (search) {
      filters.push(sql`(COALESCE(m.body, '') ILIKE ${`%${search}%`} OR COALESCE(m.subject, '') ILIKE ${`%${search}%`})`);
    }

    // Filtro por base: usa subquery de contatos que satisfazem o BaseFiltro
    let baseJoin: SQL<unknown> = sql``;
    if (base && BASE_TAG_MAP[base]) {
      const baseWhere = buildTagFilterSql(BASE_TAG_MAP[base]);
      baseJoin = sql`AND m.contact_id IN (SELECT id FROM cortex_core.ghl_contacts WHERE ${baseWhere})`;
    }

    const whereSql = filters.reduce((acc, f, i) => (i === 0 ? f : sql`${acc} AND ${f}`));

    const total = await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM cortex_core.ghl_messages m
      WHERE ${whereSql} ${baseJoin}
    `);
    const totalCount = ((total as any).rows?.[0]?.n ?? 0) as number;

    const r = await db.execute(sql`
      SELECT
        m.id, m.conversation_id, m.contact_id,
        m.direction, m.message_type, m.status, m.source,
        m.subject, m.email_message_id, m.content_type,
        m.date_added,
        LEFT(COALESCE(m.body, ''), 240) AS body_preview,
        LENGTH(COALESCE(m.body, ''))::int AS body_length,
        c.contact_name, c.email AS contact_email, c.phone AS contact_phone, c.tags AS contact_tags
      FROM cortex_core.ghl_messages m
      LEFT JOIN cortex_core.ghl_contacts c ON c.id = m.contact_id
      WHERE ${whereSql} ${baseJoin}
      ORDER BY m.date_added DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);
    const messages = (r as any).rows;

    res.json({ messages, total: totalCount, limit, offset, period: { from, to } });
  } catch (err: any) {
    console.error("[GHL] listMessages error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/calendar?from=&to=
 *
 * Detecta "broadcasts" para calendário editorial:
 *  - Email: usa ghl_email_campaigns no período (broadcasts são objetos oficiais).
 *  - WhatsApp: agrega ghl_messages outbound source IN (workflow,bulk,campaign) por
 *    (data, source). Dias com >= 30 mensagens são considerados broadcasts detectados.
 *
 * Retorna lista única ordenada por data com tipo distinto pra UI agrupar.
 */
async function getCalendar(req: Request, res: Response) {
  try {
    const { from, to } = parsePeriod(req);

    // Email broadcasts — campanhas oficiais
    const emailRes = await db.execute(sql`
      SELECT
        id, name, subject,
        COALESCE(scheduled_at, date_added) AS date,
        campaign_type, status,
        total_count, success_count, failed_count
      FROM cortex_core.ghl_email_campaigns
      WHERE COALESCE(scheduled_at, date_added) BETWEEN ${from} AND ${to}
      ORDER BY COALESCE(scheduled_at, date_added) DESC NULLS LAST
    `);
    const emailBroadcasts = ((emailRes as any).rows ?? []).map((r: any) => ({
      kind: "email_campaign" as const,
      id: r.id,
      date: r.date,
      name: r.name,
      subject: r.subject,
      campaign_type: r.campaign_type,
      status: r.status,
      total_count: r.total_count,
      success_count: r.success_count,
      failed_count: r.failed_count,
    }));

    // WhatsApp broadcasts detectados: agrupa por dia × source
    const waRes = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', date_added)::date AS date,
        source,
        COUNT(*)::int AS messages,
        COUNT(DISTINCT contact_id)::int AS contacts_reached
      FROM cortex_core.ghl_messages
      WHERE message_type = 'TYPE_WHATSAPP'
        AND direction = 'outbound'
        AND source IN ('workflow', 'bulk', 'campaign')
        AND date_added BETWEEN ${from} AND ${to}
      GROUP BY DATE_TRUNC('day', date_added)::date, source
      HAVING COUNT(*) >= 30
      ORDER BY date DESC
    `);
    const waBroadcasts = ((waRes as any).rows ?? []).map((r: any) => ({
      kind: "wa_broadcast" as const,
      id: `wa-${r.date.toISOString?.()?.slice(0, 10) ?? r.date}-${r.source}`,
      date: r.date,
      source: r.source,
      messages: r.messages,
      contacts_reached: r.contacts_reached,
    }));

    // Agrupado por data
    const all = [...emailBroadcasts, ...waBroadcasts].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db_ = new Date(b.date).getTime();
      return db_ - da;
    });

    res.json({ period: { from, to }, broadcasts: all, counts: { email: emailBroadcasts.length, whatsapp: waBroadcasts.length } });
  } catch (err: any) {
    console.error("[GHL] calendar error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/messages/:id — detalhe completo (body inteiro).
 */
async function getMessageDetail(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const r = await db.execute(sql`
      SELECT
        m.*,
        c.contact_name, c.email AS contact_email, c.phone AS contact_phone, c.tags AS contact_tags
      FROM cortex_core.ghl_messages m
      LEFT JOIN cortex_core.ghl_contacts c ON c.id = m.contact_id
      WHERE m.id = ${id}
      LIMIT 1
    `);
    const message = (r as any).rows?.[0];
    if (!message) return res.status(404).json({ error: "Mensagem não encontrada" });
    res.json({ message });
  } catch (err: any) {
    console.error("[GHL] getMessageDetail error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/overview
 * Counts gerais + última sync por resource.
 */
async function getOverview(_req: Request, res: Response) {
  try {
    const counts = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM cortex_core.ghl_contacts)::int AS contacts,
        (SELECT COUNT(*) FROM cortex_core.ghl_conversations)::int AS conversations,
        (SELECT COUNT(*) FROM cortex_core.ghl_messages)::int AS messages,
        (SELECT COUNT(*) FROM cortex_core.ghl_email_campaigns)::int AS email_campaigns,
        (SELECT COUNT(*) FROM cortex_core.ghl_email_events)::int AS email_events,
        (SELECT COUNT(DISTINCT tag) FROM cortex_core.ghl_tags_snapshot WHERE snapshot_date = CURRENT_DATE)::int AS tags
    `);
    const runs = await db.execute(sql`
      SELECT DISTINCT ON (resource)
        resource, status, finished_at, records_processed
      FROM cortex_core.ghl_sync_runs
      ORDER BY resource, started_at DESC
    `);
    res.json({
      counts: (counts as any).rows[0],
      lastSyncs: (runs as any).rows,
    });
  } catch (err: any) {
    console.error("[GHL] overview error:", err);
    res.status(500).json({ error: err.message });
  }
}

// ─── Registration ─────────────────────────────────────────────────────────

export function registerGhlPublicRoutes(app: Express) {
  // Webhook precisa ficar fora do /api (sem auth)
  app.post("/webhooks/ghl", handleWebhook);
}

export function registerGhlApiRoutes(app: Express) {
  // Estes ficam sob /api → herdam isAuthenticated do app.use("/api", isAuthenticated)
  app.get("/api/ghl/email-campaigns", listEmailCampaigns);
  app.get("/api/ghl/whatsapp-metrics", getWhatsappMetrics);
  app.get("/api/ghl/tags", getTags);
  app.get("/api/ghl/overview", getOverview);
  app.get("/api/ghl/diagnostico", getDiagnostico);
  app.get("/api/ghl/messages", listMessages);
  app.get("/api/ghl/messages/:id", getMessageDetail);
  app.get("/api/ghl/calendar", getCalendar);
}
