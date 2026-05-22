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
import { sql } from "drizzle-orm";
import { db } from "../db";

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
}
