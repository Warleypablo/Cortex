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
import { BASE_TAG_MAP, contatoSatisfazBase, expandLegacyAliases, type BaseFiltro } from "@shared/ghl-broadcast/base-tag-map";
import { analisarCopy, gerarCopies, buscarTopPerformers } from "../services/ghlCopyAi";

// ─── Helpers ──────────────────────────────────────────────────────────────

function parsePeriod(req: Request): { from: Date; to: Date } {
  const toStr = (req.query.to as string) || undefined;
  const fromStr = (req.query.from as string) || undefined;
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// Sources que contam como "marketing" (broadcast/automação) vs 1:1
const MARKETING_SOURCES = ["workflow", "bulk_actions", "campaign"] as const;

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
          ${sources ? sql`AND source IN (${sql.join(sources.map((s) => sql`${s}`), sql`,`)})` : sql``}
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
        ${sources ? sql`AND source IN (${sql.join(sources.map((s) => sql`${s}`), sql`,`)})` : sql``}
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
 * GET /api/ghl/lists
 * Pra cada base nominal do BASE_TAG_MAP, conta contatos atuais que satisfazem
 * o filtro de tags + novos contatos criados nos últimos 7 dias.
 * Roda 1 query por base em paralelo (18 queries).
 */
async function getLists(_req: Request, res: Response) {
  try {
    const bases = Object.entries(BASE_TAG_MAP);
    const results = await Promise.all(
      bases.map(async ([baseName, filtro]) => {
        const whereTags = buildTagFilterSql(filtro);
        try {
          const r = await db.execute(sql`
            SELECT
              COUNT(*)::int AS contacts,
              COUNT(*) FILTER (WHERE date_added > NOW() - INTERVAL '7 days')::int AS new_leads_7d
            FROM cortex_core.ghl_contacts
            WHERE ${whereTags}
          `);
          const row = (r as any).rows?.[0] ?? {};
          return {
            list: baseName,
            contacts: row.contacts ?? 0,
            new_leads_7d: row.new_leads_7d ?? 0,
            tags_all: filtro.tagsAll ?? [],
            tags_any: filtro.tagsAny ?? [],
            tags_not: filtro.tagsNot ?? [],
          };
        } catch (e: any) {
          return {
            list: baseName,
            contacts: 0,
            new_leads_7d: 0,
            tags_all: filtro.tagsAll ?? [],
            tags_any: filtro.tagsAny ?? [],
            tags_not: filtro.tagsNot ?? [],
            error: e.message,
          };
        }
      }),
    );
    results.sort((a, b) => (b.contacts ?? 0) - (a.contacts ?? 0));
    res.json({ lists: results });
  } catch (err: any) {
    console.error("[GHL] lists error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/tags?limit=50
 * Distribuição atual de contatos por tag + novos leads nos últimos 7d
 * (contatos com date_added > NOW() - 7d que têm a tag).
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
      new_leads_7d AS (
        SELECT tag, COUNT(*)::int AS new_count
        FROM cortex_core.ghl_contacts, UNNEST(tags) AS tag
        WHERE date_added > NOW() - INTERVAL '7 days'
        GROUP BY tag
      )
      SELECT
        t.tag,
        t.contact_count::int AS current_count,
        COALESCE(n.new_count, 0)::int AS new_leads_7d
      FROM today t
      LEFT JOIN new_leads_7d n ON n.tag = t.tag
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
  const arrayLiteral = (arr: string[]): SQL<unknown> =>
    sql`ARRAY[${sql.join(arr.map((t) => sql`${t}`), sql`,`)}]::text[]`;
  const parts: SQL<unknown>[] = [];
  // Expande aliases legacy pra cobrir contatos com tags ainda não migradas.
  // tagsAll vira tags && (qualquer alias) — porque qualquer um dos aliases
  // serve como prova de que o contato é "daquela tag canônica".
  if (filtro.tagsAll && filtro.tagsAll.length) {
    for (const canonical of filtro.tagsAll) {
      const variants = expandLegacyAliases([canonical]);
      parts.push(sql`tags && ${arrayLiteral(variants)}`);
    }
  }
  if (filtro.tagsAny && filtro.tagsAny.length) {
    const variants = expandLegacyAliases(filtro.tagsAny);
    parts.push(sql`tags && ${arrayLiteral(variants)}`);
  }
  if (filtro.tagsNot && filtro.tagsNot.length) {
    const variants = expandLegacyAliases(filtro.tagsNot);
    parts.push(sql`NOT (tags && ${arrayLiteral(variants)})`);
  }
  if (parts.length === 0) return sql`true`;
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
        AND source IN ('workflow', 'bulk_actions', 'campaign')
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
 * POST /api/ghl/copy/analyze
 * Body: { texto: string, canal?: "WhatsApp" | "Email" }
 */
async function postCopyAnalyze(req: Request, res: Response) {
  try {
    const { texto, canal } = req.body ?? {};
    if (!texto || typeof texto !== "string") return res.status(400).json({ error: 'Campo "texto" obrigatório' });
    const result = await analisarCopy(texto, canal === "Email" ? "Email" : "WhatsApp");
    res.json(result);
  } catch (err: any) {
    console.error("[GHL] copy/analyze error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/ghl/copy/generate
 * Body: { objetivo, base, tom, tamanho, contexto?, padraoAlvo?, usarTopPerformers?: bool }
 */
async function postCopyGenerate(req: Request, res: Response) {
  try {
    const { objetivo, base, tom, tamanho, contexto, padraoAlvo, usarTopPerformers, topPerformers } = req.body ?? {};
    if (!objetivo || !base || !tom || !tamanho) {
      return res.status(400).json({ error: "Campos obrigatórios: objetivo, base, tom, tamanho" });
    }
    let exemplos = topPerformers;
    if (!exemplos && usarTopPerformers) {
      exemplos = await buscarTopPerformers(5);
    }
    const result = await gerarCopies({ objetivo, base, tom, tamanho, contexto, padraoAlvo, topPerformers: exemplos });
    res.json(result);
  } catch (err: any) {
    console.error("[GHL] copy/generate error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/copy/top-performers — sample de mensagens com mais respostas.
 */
async function getTopPerformers(_req: Request, res: Response) {
  try {
    const items = await buscarTopPerformers(5);
    res.json({ topPerformers: items });
  } catch (err: any) {
    console.error("[GHL] copy/top-performers error:", err);
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
 * GET /api/ghl/broadcasts
 *   ?from=&to=
 *   &channel=Email|WhatsApp|all
 *   &status=complete|scheduled|all
 *   &search=<texto em name+subject+body>
 *   &limit=50 &offset=0
 *
 * Lista unificada de broadcasts:
 *   - Email: cada linha de cortex_core.ghl_email_campaigns no período
 *   - WhatsApp: agrupa ghl_messages outbound source IN (workflow,bulk,campaign)
 *               por (dia, source, md5(body)) com HAVING distinct contacts >= 10
 *
 * Pra cada broadcast retorna:
 *   id, channel, date, status, name, subject, preview, source, campaign_type,
 *   list_size, delivered, delivery_pct, open_pct, conversations_generated,
 *   meetings_scheduled (TODO Fase 2 — null por enquanto, depende do Bitrix)
 *
 * Conversas geradas = recipients que enviaram >=1 msg inbound em até 7d após o envio.
 */
async function listBroadcasts(req: Request, res: Response) {
  try {
    const { from, to } = parsePeriod(req);
    const channel = (req.query.channel as string) || "all";
    const status = (req.query.status as string) || "all";
    const search = ((req.query.search as string) || "").trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const wantEmail = channel === "all" || channel === "Email";
    const wantWa = channel === "all" || channel === "WhatsApp";

    const emailWhere = sql`COALESCE(c.scheduled_at, c.date_added) BETWEEN ${from} AND ${to}
      ${status === "complete" || status === "scheduled" || status === "draft"
        ? sql`AND c.status = ${status}`
        : sql``}
      ${search
        ? sql`AND (COALESCE(c.name, '') ILIKE ${`%${search}%`} OR COALESCE(c.subject, '') ILIKE ${`%${search}%`})`
        : sql``}`;

    const waWhere = sql`direction = 'outbound'
      AND source IN ('workflow', 'bulk_actions', 'campaign')
      AND date_added BETWEEN ${from} AND ${to}
      AND body IS NOT NULL AND body <> ''
      ${search
        ? sql`AND body ILIKE ${`%${search}%`}`
        : sql``}`;

    const r = await db.execute(sql`
      WITH email_broadcasts AS (
        SELECT
          c.id AS id,
          'Email' AS channel,
          COALESCE(c.scheduled_at, c.date_added) AS date,
          c.status AS status,
          c.name AS name,
          c.subject AS subject,
          LEFT(COALESCE(c.subject, ''), 240) AS preview,
          c.campaign_type AS campaign_type,
          NULL::text AS source,
          NULL::text AS body_hash,
          c.total_count::int AS list_size,
          COALESCE(c.success_count, 0)::int AS delivered
        FROM cortex_core.ghl_email_campaigns c
        WHERE ${wantEmail ? emailWhere : sql`false`}
      ),
      wa_grouped AS (
        SELECT
          DATE_TRUNC('day', date_added) AS bday,
          source,
          MD5(COALESCE(body, '')) AS body_hash,
          MIN(date_added) AS first_date,
          MIN(body) AS sample_body,
          COUNT(DISTINCT contact_id)::int AS distinct_contacts
        FROM cortex_core.ghl_messages
        WHERE ${wantWa ? waWhere : sql`false`}
        GROUP BY DATE_TRUNC('day', date_added), source, MD5(COALESCE(body, ''))
        HAVING COUNT(DISTINCT contact_id) >= 10
      ),
      wa_broadcasts AS (
        SELECT
          'wa-' || TO_CHAR(bday, 'YYYYMMDD') || '-' || source || '-' || SUBSTR(body_hash, 1, 8) AS id,
          'WhatsApp' AS channel,
          first_date AS date,
          'concluido' AS status,
          NULL::text AS name,
          NULL::text AS subject,
          LEFT(COALESCE(sample_body, ''), 240) AS preview,
          NULL::text AS campaign_type,
          source,
          body_hash,
          distinct_contacts AS list_size,
          distinct_contacts AS delivered
        FROM wa_grouped
      ),
      all_b AS (
        SELECT * FROM email_broadcasts
        UNION ALL
        SELECT * FROM wa_broadcasts
      )
      SELECT *, COUNT(*) OVER ()::int AS total_count
      FROM all_b
      ORDER BY date DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);
    const rows = ((r as any).rows ?? []) as Array<{
      id: string; channel: string; date: Date | string | null; status: string | null;
      name: string | null; subject: string | null; preview: string | null;
      campaign_type: string | null; source: string | null; body_hash: string | null;
      list_size: number; delivered: number; total_count: number;
    }>;
    const total = rows[0]?.total_count ?? 0;

    // Totals globais do filtro inteiro (não só da página) pros KPI cards.
    // Roda uma query separada sem LIMIT/OFFSET pra contar email + WA broadcasts.
    const totalsRes = await db.execute(sql`
      WITH email_broadcasts AS (
        SELECT
          c.id,
          c.total_count::int AS list_size,
          COALESCE(c.success_count, 0)::int AS delivered
        FROM cortex_core.ghl_email_campaigns c
        WHERE ${wantEmail ? emailWhere : sql`false`}
      ),
      wa_grouped AS (
        SELECT
          DATE_TRUNC('day', date_added) AS bday, source,
          MD5(COALESCE(body, '')) AS body_hash,
          COUNT(DISTINCT contact_id)::int AS distinct_contacts
        FROM cortex_core.ghl_messages
        WHERE ${wantWa ? waWhere : sql`false`}
        GROUP BY DATE_TRUNC('day', date_added), source, MD5(COALESCE(body, ''))
        HAVING COUNT(DISTINCT contact_id) >= 10
      )
      SELECT
        (SELECT COUNT(*)::int FROM email_broadcasts) AS email_count,
        (SELECT COUNT(*)::int FROM wa_grouped) AS wa_count,
        (SELECT COALESCE(SUM(list_size), 0)::int FROM email_broadcasts) AS email_sent,
        (SELECT COALESCE(SUM(distinct_contacts), 0)::int FROM wa_grouped) AS wa_sent,
        (SELECT COALESCE(SUM(delivered), 0)::int FROM email_broadcasts) AS email_delivered,
        (SELECT COALESCE(SUM(distinct_contacts), 0)::int FROM wa_grouped) AS wa_delivered
    `);
    const t = (totalsRes as any).rows?.[0] ?? {};
    const total_sent = (t.email_sent ?? 0) + (t.wa_sent ?? 0);
    const total_delivered = (t.email_delivered ?? 0) + (t.wa_delivered ?? 0);
    const avg_delivery_pct = total_sent > 0 ? (total_delivered / total_sent) * 100 : null;

    // Conversas totais sobre TODOS os broadcasts do filtro (não só página)
    // Roda 2 queries: email recipients → inbound em 7d; WA recipients → inbound em 7d
    const filterTotalConversationsRes = await db.execute(sql`
      WITH email_filter AS (
        SELECT c.id, COALESCE(c.scheduled_at, c.date_added) AS broadcast_ts
        FROM cortex_core.ghl_email_campaigns c
        WHERE ${wantEmail ? emailWhere : sql`false`}
      ),
      email_conv AS (
        SELECT COUNT(DISTINCT (e.campaign_id, e.contact_id))::int AS conv
        FROM cortex_core.ghl_email_events e
        JOIN email_filter f ON f.id = e.campaign_id
        JOIN cortex_core.ghl_messages m
          ON m.contact_id = e.contact_id
          AND m.direction = 'inbound'
          AND m.date_added > f.broadcast_ts
          AND m.date_added <= f.broadcast_ts + INTERVAL '7 days'
        WHERE e.event_type = 'EmailDelivered'
      ),
      wa_grouped AS (
        SELECT
          DATE_TRUNC('day', date_added) AS bday, source,
          MD5(COALESCE(body, '')) AS body_hash,
          MIN(date_added) AS broadcast_ts
        FROM cortex_core.ghl_messages
        WHERE ${wantWa ? waWhere : sql`false`}
        GROUP BY DATE_TRUNC('day', date_added), source, MD5(COALESCE(body, ''))
        HAVING COUNT(DISTINCT contact_id) >= 10
      ),
      wa_recipients AS (
        SELECT DISTINCT g.bday, g.source, g.body_hash, g.broadcast_ts, m.contact_id
        FROM wa_grouped g
        JOIN cortex_core.ghl_messages m
          ON DATE_TRUNC('day', m.date_added) = g.bday
          AND m.source = g.source
          AND MD5(COALESCE(m.body, '')) = g.body_hash
        WHERE m.direction = 'outbound' AND m.contact_id IS NOT NULL
      ),
      wa_conv AS (
        SELECT COUNT(DISTINCT (r.bday, r.source, r.body_hash, r.contact_id))::int AS conv
        FROM wa_recipients r
        JOIN cortex_core.ghl_messages mi
          ON mi.contact_id = r.contact_id
          AND mi.direction = 'inbound'
          AND mi.date_added > r.broadcast_ts
          AND mi.date_added <= r.broadcast_ts + INTERVAL '7 days'
      )
      SELECT
        (SELECT COALESCE(conv, 0) FROM email_conv) AS email_conv,
        (SELECT COALESCE(conv, 0) FROM wa_conv) AS wa_conv
    `);
    const tc = (filterTotalConversationsRes as any).rows?.[0] ?? {};
    const total_conversations = (tc.email_conv ?? 0) + (tc.wa_conv ?? 0);

    // Aggregate email events (open rate) só pros campaigns da página atual
    const emailIds = rows.filter((r) => r.channel === "Email").map((r) => r.id);
    const openRateMap = new Map<string, { delivered_events: number; unique_opens: number; bounced: number; clicked: number }>();
    if (emailIds.length) {
      const eventsRes = await db.execute(sql`
        SELECT
          campaign_id,
          COUNT(*) FILTER (WHERE event_type = 'EmailDelivered')::int AS delivered_events,
          COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'EmailOpened')::int AS unique_opens,
          COUNT(*) FILTER (WHERE event_type = 'EmailBounced')::int AS bounced,
          COUNT(*) FILTER (WHERE event_type = 'EmailClicked')::int AS clicked
        FROM cortex_core.ghl_email_events
        WHERE campaign_id IN (${sql.join(emailIds.map((id) => sql`${id}`), sql`,`)})
        GROUP BY campaign_id
      `);
      for (const row of ((eventsRes as any).rows ?? [])) {
        openRateMap.set(row.campaign_id, {
          delivered_events: row.delivered_events ?? 0,
          unique_opens: row.unique_opens ?? 0,
          bounced: row.bounced ?? 0,
          clicked: row.clicked ?? 0,
        });
      }
    }

    // Conversas geradas em 7d
    // Email: recipients vêm de ghl_email_events EmailDelivered (precisa webhook ativo)
    // WhatsApp: recipients = distinct contact_ids do agrupamento (dia, source, body_hash)
    const conversationsMap = new Map<string, number>();

    if (emailIds.length) {
      const convEmailRes = await db.execute(sql`
        WITH recipients AS (
          SELECT DISTINCT campaign_id, contact_id
          FROM cortex_core.ghl_email_events
          WHERE campaign_id IN (${sql.join(emailIds.map((id) => sql`${id}`), sql`,`)})
            AND event_type = 'EmailDelivered'
            AND contact_id IS NOT NULL
        ),
        campaign_dates AS (
          SELECT id, COALESCE(scheduled_at, date_added) AS broadcast_ts
          FROM cortex_core.ghl_email_campaigns
          WHERE id IN (${sql.join(emailIds.map((id) => sql`${id}`), sql`,`)})
        )
        SELECT
          r.campaign_id,
          COUNT(DISTINCT r.contact_id)::int AS conversations
        FROM recipients r
        JOIN campaign_dates cd ON cd.id = r.campaign_id
        JOIN cortex_core.ghl_messages m
          ON m.contact_id = r.contact_id
          AND m.direction = 'inbound'
          AND m.date_added > cd.broadcast_ts
          AND m.date_added <= cd.broadcast_ts + INTERVAL '7 days'
        GROUP BY r.campaign_id
      `);
      for (const row of ((convEmailRes as any).rows ?? [])) {
        conversationsMap.set(row.campaign_id, row.conversations ?? 0);
      }
    }

    const waRows = rows.filter((r) => r.channel === "WhatsApp");
    if (waRows.length) {
      // Pra cada WA broadcast da página, replico o agrupamento e cruzo com inbound em 7d.
      // Usamos VALUES tuples (broadcast_id, day, source, body_hash, broadcast_ts).
      const tuples = waRows.map((b) => {
        const d = new Date(b.date as any);
        const dayStr = d.toISOString().slice(0, 10);
        return sql`(${b.id}, ${dayStr}::date, ${b.source}, ${b.body_hash}, ${b.date as any}::timestamptz)`;
      });
      const tuplesJoined = tuples.reduce((acc, t, i) => (i === 0 ? t : sql`${acc}, ${t}`));

      const convWaRes = await db.execute(sql`
        WITH targets(broadcast_id, day, src, body_hash, broadcast_ts) AS (
          VALUES ${tuplesJoined}
        ),
        recipients AS (
          SELECT DISTINCT t.broadcast_id, m.contact_id, t.broadcast_ts
          FROM targets t
          JOIN cortex_core.ghl_messages m
            ON DATE_TRUNC('day', m.date_added)::date = t.day
            AND m.source = t.src
            AND MD5(COALESCE(m.body, '')) = t.body_hash
          WHERE m.direction = 'outbound'
            AND m.contact_id IS NOT NULL
        )
        SELECT
          r.broadcast_id,
          COUNT(DISTINCT r.contact_id)::int AS conversations
        FROM recipients r
        JOIN cortex_core.ghl_messages mi
          ON mi.contact_id = r.contact_id
          AND mi.direction = 'inbound'
          AND mi.date_added > r.broadcast_ts
          AND mi.date_added <= r.broadcast_ts + INTERVAL '7 days'
        GROUP BY r.broadcast_id
      `);
      for (const row of ((convWaRes as any).rows ?? [])) {
        conversationsMap.set(row.broadcast_id, row.conversations ?? 0);
      }
    }

    // Inferência de base por broadcast (via tags dos recipients × BASE_TAG_MAP)
    // Tags de recipients de email = quem teve EmailDelivered (precisa webhook ativo)
    // Tags de recipients de WA = contatos do agrupamento (dia, source, body_hash)
    const recipientsTagsMap = new Map<string, string[][]>();

    if (emailIds.length) {
      const tagsRes = await db.execute(sql`
        SELECT e.campaign_id, c.tags
        FROM cortex_core.ghl_email_events e
        JOIN cortex_core.ghl_contacts c ON c.id = e.contact_id
        WHERE e.campaign_id IN (${sql.join(emailIds.map((id) => sql`${id}`), sql`,`)})
          AND e.event_type = 'EmailDelivered'
          AND c.tags IS NOT NULL
      `);
      for (const row of ((tagsRes as any).rows ?? [])) {
        const arr = recipientsTagsMap.get(row.campaign_id) ?? [];
        arr.push(row.tags ?? []);
        recipientsTagsMap.set(row.campaign_id, arr);
      }
    }

    if (waRows.length) {
      const tuples = waRows.map((b) => {
        const d = new Date(b.date as any);
        const dayStr = d.toISOString().slice(0, 10);
        return sql`(${b.id}, ${dayStr}::date, ${b.source}, ${b.body_hash})`;
      });
      const tuplesJoined = tuples.reduce((acc, t, i) => (i === 0 ? t : sql`${acc}, ${t}`));
      const tagsRes = await db.execute(sql`
        WITH targets(broadcast_id, day, src, body_hash) AS (
          VALUES ${tuplesJoined}
        ),
        recipients AS (
          SELECT DISTINCT t.broadcast_id, m.contact_id
          FROM targets t
          JOIN cortex_core.ghl_messages m
            ON DATE_TRUNC('day', m.date_added)::date = t.day
            AND m.source = t.src
            AND MD5(COALESCE(m.body, '')) = t.body_hash
          WHERE m.direction = 'outbound' AND m.contact_id IS NOT NULL
        )
        SELECT r.broadcast_id, c.tags
        FROM recipients r
        JOIN cortex_core.ghl_contacts c ON c.id = r.contact_id
        WHERE c.tags IS NOT NULL
      `);
      for (const row of ((tagsRes as any).rows ?? [])) {
        const arr = recipientsTagsMap.get(row.broadcast_id) ?? [];
        arr.push(row.tags ?? []);
        recipientsTagsMap.set(row.broadcast_id, arr);
      }
    }

    // Preços vigentes (busca a entrada mais recente pra cada canal, com effective_from <= NOW())
    const pricingRes = await db.execute(sql`
      SELECT DISTINCT ON (channel) channel, unit_cost_brl::float AS unit_cost_brl
      FROM cortex_core.ghl_pricing
      WHERE effective_from <= NOW()
      ORDER BY channel, effective_from DESC
    `);
    const priceMap = new Map<string, number>();
    for (const row of ((pricingRes as any).rows ?? [])) {
      priceMap.set(row.channel, row.unit_cost_brl);
    }

    // Anotações manuais (Feedback do SDR + override de gasto)
    const broadcastIds = rows.map((r) => r.id);
    const annotationMap = new Map<string, { sdr_feedback: string | null; manual_spend_brl: number | null }>();
    if (broadcastIds.length) {
      const annRes = await db.execute(sql`
        SELECT broadcast_id, sdr_feedback, manual_spend_brl::float AS manual_spend_brl
        FROM cortex_core.ghl_broadcast_annotations
        WHERE broadcast_id IN (${sql.join(broadcastIds.map((id) => sql`${id}`), sql`,`)})
      `);
      for (const row of ((annRes as any).rows ?? [])) {
        annotationMap.set(row.broadcast_id, {
          sdr_feedback: row.sdr_feedback,
          manual_spend_brl: row.manual_spend_brl,
        });
      }
    }

    // Pra cada broadcast, retorna as 3 tags mais frequentes nos recipients com sua % de cobertura.
    // Mostra DADOS BRUTOS, não infere base — quem decide o significado é o usuário.
    const topTagsForBroadcast = (broadcastId: string): Array<{ tag: string; pct: number }> => {
      const contactsTags = recipientsTagsMap.get(broadcastId);
      if (!contactsTags?.length) return [];
      const counts = new Map<string, number>();
      for (const tags of contactsTags) {
        for (const t of tags) {
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
      const total = contactsTags.length;
      return Array.from(counts.entries())
        .map(([tag, n]) => ({ tag, pct: (n / total) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3);
    };

    // Monta o response final
    const broadcasts = rows.map((r) => {
      const isEmail = r.channel === "Email";
      const evt = isEmail ? openRateMap.get(r.id) : undefined;
      const list = r.list_size ?? 0;
      const delivered = isEmail
        ? (evt && evt.delivered_events > 0 ? evt.delivered_events : r.delivered)
        : r.delivered;
      const delivery_pct = list > 0 ? (delivered / list) * 100 : null;
      const open_pct =
        isEmail && evt && evt.delivered_events > 0
          ? (evt.unique_opens / evt.delivered_events) * 100
          : null;
      const topTags = topTagsForBroadcast(r.id);
      const annotation = annotationMap.get(r.id);
      const unitCost = priceMap.get(r.channel) ?? 0;
      const auto_spend_brl = unitCost > 0 && delivered > 0 ? unitCost * delivered : null;
      const spend_brl = annotation?.manual_spend_brl ?? auto_spend_brl;
      return {
        id: r.id,
        top_tags: topTags,
        sdr_feedback: annotation?.sdr_feedback ?? null,
        spend_brl,
        spend_is_manual: annotation?.manual_spend_brl != null,
        channel: r.channel,
        date: r.date,
        status: r.status,
        name: r.name,
        subject: r.subject,
        preview: r.preview,
        campaign_type: r.campaign_type,
        source: r.source,
        list_size: list,
        delivered,
        delivery_pct,
        open_pct,
        conversations_generated: conversationsMap.get(r.id) ?? 0,
        meetings_scheduled: null as number | null, // Fase 2 — depende de cruzamento Bitrix
        has_open_tracking: isEmail ? (evt?.delivered_events ?? 0) > 0 : false,
      };
    });

    res.json({
      broadcasts,
      total,
      limit,
      offset,
      period: { from, to },
      totals: {
        email_count: t.email_count ?? 0,
        wa_count: t.wa_count ?? 0,
        total_sent,
        total_delivered,
        avg_delivery_pct,
        total_conversations,
      },
    });
  } catch (err: any) {
    console.error("[GHL] listBroadcasts error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ghl/broadcasts/:id — detalhes pro modal.
 *
 *   - Email broadcast (id é um UUID/text de campaign): retorna a campanha
 *     completa + agregados de events + sample de 1 mensagem.
 *   - WA broadcast (id começa com "wa-"): parsea (day, source, hash) e retorna
 *     1 mensagem amostra + agregados.
 */
async function getBroadcastDetail(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id obrigatório" });

    if (id.startsWith("wa-")) {
      // wa-YYYYMMDD-{source}-{hash8}
      const rest = id.slice(3);
      const firstDash = rest.indexOf("-");
      const lastDash = rest.lastIndexOf("-");
      if (firstDash === -1 || lastDash === -1 || firstDash === lastDash) {
        return res.status(400).json({ error: "wa broadcast id inválido" });
      }
      const dayRaw = rest.slice(0, firstDash);
      const source = rest.slice(firstDash + 1, lastDash);
      const hash8 = rest.slice(lastDash + 1);
      // dayRaw: YYYYMMDD → YYYY-MM-DD
      const dayIso = `${dayRaw.slice(0, 4)}-${dayRaw.slice(4, 6)}-${dayRaw.slice(6, 8)}`;

      const r = await db.execute(sql`
        WITH sample AS (
          SELECT id, body, contact_id, date_added
          FROM cortex_core.ghl_messages
          WHERE direction = 'outbound'
            AND source = ${source}
            AND DATE_TRUNC('day', date_added)::date = ${dayIso}::date
            AND SUBSTR(MD5(COALESCE(body, '')), 1, 8) = ${hash8}
            AND body IS NOT NULL AND body <> ''
          ORDER BY date_added ASC
          LIMIT 1
        ),
        recipients AS (
          SELECT DISTINCT contact_id, MIN(date_added) AS first_sent_at
          FROM cortex_core.ghl_messages
          WHERE direction = 'outbound'
            AND source = ${source}
            AND DATE_TRUNC('day', date_added)::date = ${dayIso}::date
            AND SUBSTR(MD5(COALESCE(body, '')), 1, 8) = ${hash8}
            AND contact_id IS NOT NULL
          GROUP BY contact_id
        )
        SELECT
          (SELECT body FROM sample) AS body,
          (SELECT date_added FROM sample) AS first_date,
          (SELECT COUNT(*)::int FROM recipients) AS list_size
      `);
      const row = (r as any).rows?.[0] ?? {};
      return res.json({
        broadcast: {
          id,
          channel: "WhatsApp" as const,
          source,
          day: dayIso,
          first_date: row.first_date,
          list_size: row.list_size ?? 0,
          body: row.body ?? null,
          content_type: "text/plain",
        },
      });
    }

    // Email broadcast (campaign id)
    const r = await db.execute(sql`
      WITH events AS (
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'EmailDelivered')::int AS delivered,
          COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'EmailOpened')::int AS unique_opens,
          COUNT(*) FILTER (WHERE event_type = 'EmailOpened')::int AS opens,
          COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'EmailClicked')::int AS unique_clicks,
          COUNT(*) FILTER (WHERE event_type = 'EmailClicked')::int AS clicks,
          COUNT(*) FILTER (WHERE event_type = 'EmailBounced')::int AS bounced,
          COUNT(*) FILTER (WHERE event_type = 'EmailUnsubscribed')::int AS unsubscribed,
          COUNT(*) FILTER (WHERE event_type = 'EmailComplained')::int AS complained
        FROM cortex_core.ghl_email_events
        WHERE campaign_id = ${id}
      ),
      sample_body AS (
        SELECT body, content_type
        FROM cortex_core.ghl_messages
        WHERE direction = 'outbound'
          AND message_type = 'TYPE_EMAIL'
          AND contact_id IN (
            SELECT DISTINCT contact_id FROM cortex_core.ghl_email_events
            WHERE campaign_id = ${id} LIMIT 1
          )
        ORDER BY date_added DESC
        LIMIT 1
      )
      SELECT
        c.*,
        (SELECT row_to_json(events.*) FROM events) AS events,
        (SELECT body FROM sample_body) AS sample_body,
        (SELECT content_type FROM sample_body) AS sample_content_type
      FROM cortex_core.ghl_email_campaigns c
      WHERE c.id = ${id}
    `);
    const row = (r as any).rows?.[0];
    if (!row) return res.status(404).json({ error: "Broadcast não encontrado" });
    return res.json({ broadcast: { ...row, channel: "Email" as const } });
  } catch (err: any) {
    console.error("[GHL] getBroadcastDetail error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/ghl/broadcasts/:id/annotations
 * Body: { sdr_feedback?: string | null, manual_spend_brl?: number | null }
 * Upsert na cortex_core.ghl_broadcast_annotations.
 */
async function patchBroadcastAnnotation(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id obrigatório" });
    const { sdr_feedback, manual_spend_brl } = req.body ?? {};
    const userEmail = ((req as any).user?.email as string) || null;

    await db.execute(sql`
      INSERT INTO cortex_core.ghl_broadcast_annotations
        (broadcast_id, sdr_feedback, manual_spend_brl, updated_at, updated_by)
      VALUES (${id},
              ${sdr_feedback ?? null},
              ${manual_spend_brl ?? null},
              NOW(),
              ${userEmail})
      ON CONFLICT (broadcast_id) DO UPDATE SET
        sdr_feedback     = EXCLUDED.sdr_feedback,
        manual_spend_brl = EXCLUDED.manual_spend_brl,
        updated_at       = NOW(),
        updated_by       = EXCLUDED.updated_by
    `);

    res.json({ ok: true, broadcast_id: id });
  } catch (err: any) {
    console.error("[GHL] patchBroadcastAnnotation error:", err);
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
  app.get("/api/ghl/lists", getLists);
  app.get("/api/ghl/overview", getOverview);
  app.get("/api/ghl/diagnostico", getDiagnostico);
  app.get("/api/ghl/messages", listMessages);
  app.get("/api/ghl/messages/:id", getMessageDetail);
  app.get("/api/ghl/broadcasts", listBroadcasts);
  app.get("/api/ghl/broadcasts/:id", getBroadcastDetail);
  app.patch("/api/ghl/broadcasts/:id/annotations", patchBroadcastAnnotation);
  app.get("/api/ghl/calendar", getCalendar);
  app.post("/api/ghl/copy/analyze", postCopyAnalyze);
  app.post("/api/ghl/copy/generate", postCopyGenerate);
  app.get("/api/ghl/copy/top-performers", getTopPerformers);
}
