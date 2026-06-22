/**
 * GoHighLevel (GHL) integration — Cortex
 *
 * Auth: Private Integration Token (PIT) — sublocation única "Turbo Partners".
 * Docs do projeto: docs/handover-ghl-integracao.md
 *
 * Endpoints REST mapeados em 2026-05-22. Open/Click/Bounce de email não existem
 * via REST — chegam por webhook (ver server/routes/ghlWebhook.ts).
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = process.env.GHL_API_VERSION || "2021-07-28";

// Rate limit GHL: 100 req / 10s por location. Mantemos uma janela móvel
// com margem (90 req / 10s) e damos um pequeno espaçamento entre requests.
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 90;
const requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    const wait = RATE_LIMIT_WINDOW_MS - (now - requestTimestamps[0]) + 50;
    await new Promise((r) => setTimeout(r, wait));
    return throttle();
  }
  requestTimestamps.push(Date.now());
}

function getConfig() {
  const token = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new Error("GHL_PIT_TOKEN and GHL_LOCATION_ID must be set");
  }
  return { token, locationId };
}

export async function ghlFetch<T = any>(
  path: string,
  init: RequestInit = {},
  retries = 4,
): Promise<T> {
  const { token } = getConfig();
  await throttle();

  const url = path.startsWith("http") ? path : `${GHL_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Version: GHL_API_VERSION,
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
    console.warn(`[GHL] 429 rate limited, retrying in ${retryAfter}s (path=${path})`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return ghlFetch<T>(path, init, retries - 1);
  }

  if (res.status >= 500 && retries > 0) {
    const backoff = 2000 * (5 - retries);
    console.warn(`[GHL] ${res.status} server error, retrying in ${backoff}ms`);
    await new Promise((r) => setTimeout(r, backoff));
    return ghlFetch<T>(path, init, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[GHL] ${res.status} ${res.statusText} on ${path} — ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface GhlContactApi {
  id: string;
  locationId: string;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  type: string | null;
  source: string | null;
  tags: string[];
  country: string | null;
  city: string | null;
  state: string | null;
  dateAdded: string;
  dateUpdated: string;
  attributions?: unknown;
  customFields?: unknown;
}

export interface GhlConversationApi {
  id: string;
  locationId: string;
  contactId: string | null;
  lastMessageType: string | null;
  lastMessageDirection: string | null;
  lastMessageDate: number;
  unreadCount: number;
  dateAdded: number;
  dateUpdated: number;
}

export interface GhlMessageApi {
  id: string;
  conversationId?: string;
  contactId?: string;
  locationId: string;
  direction: string;
  messageType: string;
  type: number;
  status: string;
  source?: string;
  body?: string;
  contentType?: string;
  dateAdded: string;
  meta?: { email?: { messageIds?: string[]; subject?: string; direction?: string } };
}

export interface GhlEmailScheduleApi {
  id: string;
  locationId: string;
  name: string;
  subject: string;
  campaignType: string;
  status: string;
  templateId?: string;
  templateType?: string;
  totalCount?: number;
  success?: number;
  successCount?: number;
  failed?: number;
  error?: number;
  processed?: number;
  queuedCount?: number;
  hasTracking?: boolean;
  hasUtmTracking?: boolean;
  isPlainText?: boolean;
  dateScheduled?: number | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GhlTagApi {
  id: string;
  name: string;
  locationId: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────

export async function ghlGetLocation() {
  const { locationId } = getConfig();
  return ghlFetch<{ location: any }>(`/locations/${locationId}`);
}

export async function ghlListTags(): Promise<GhlTagApi[]> {
  const { locationId } = getConfig();
  const data = await ghlFetch<{ tags: GhlTagApi[] }>(`/locations/${locationId}/tags`);
  return data.tags || [];
}

export async function* ghlIterateContacts(opts: {
  limit?: number;
  startAfter?: number;
  startAfterId?: string;
} = {}): AsyncGenerator<GhlContactApi> {
  const { locationId } = getConfig();
  const limit = opts.limit ?? 100;
  let startAfter = opts.startAfter;
  let startAfterId = opts.startAfterId;

  while (true) {
    const params = new URLSearchParams({ locationId, limit: String(limit) });
    if (startAfter !== undefined) params.set("startAfter", String(startAfter));
    if (startAfterId) params.set("startAfterId", startAfterId);

    const data = await ghlFetch<{
      contacts: GhlContactApi[];
      meta: { total: number; nextPageUrl?: string; startAfter?: number; startAfterId?: string };
    }>(`/contacts/?${params.toString()}`);

    if (!data.contacts?.length) return;
    for (const c of data.contacts) yield c;

    if (!data.meta?.nextPageUrl) return;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
}

/**
 * Itera contatos via POST /contacts/search ordenado por dateUpdated DESC,
 * paginando pelo cursor `searchAfter` que a própria API devolve em cada item.
 *
 * Diferença crucial pro GET /contacts/ (que devolve por dateAdded DESC): este
 * endpoint traz à frente contatos ANTIGOS que acabaram de ser atualizados
 * (tag adicionada, import em massa, edição) — exatamente o que um sync
 * incremental precisa ver primeiro. Validado contra a API real em 2026-06-11.
 */
export async function* ghlIterateContactsByUpdated(opts: { pageLimit?: number } = {}): AsyncGenerator<GhlContactApi> {
  const { locationId } = getConfig();
  const pageLimit = opts.pageLimit ?? 100;
  let searchAfter: unknown[] | undefined;

  while (true) {
    const data = await ghlFetch<{ contacts: (GhlContactApi & { searchAfter?: unknown[] })[]; total: number }>(
      "/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          locationId,
          pageLimit,
          sort: [{ field: "dateUpdated", direction: "desc" }],
          ...(searchAfter ? { searchAfter } : {}),
        }),
      },
    );
    const contacts = data.contacts || [];
    if (!contacts.length) return;
    for (const c of contacts) yield c;
    if (contacts.length < pageLimit) return;
    searchAfter = contacts[contacts.length - 1].searchAfter;
    if (!searchAfter) return;
  }
}

export async function* ghlIterateConversations(opts: {
  limit?: number;
  lastMessageType?: "TYPE_EMAIL" | "TYPE_WHATSAPP" | "TYPE_SMS" | "TYPE_PHONE";
  startAfterDate?: number;
  sortBy?: "last_message_date" | "score_profile";
  sort?: "asc" | "desc";
} = {}): AsyncGenerator<GhlConversationApi> {
  const { locationId } = getConfig();
  const limit = opts.limit ?? 100;
  let startAfterDate = opts.startAfterDate;
  // Sort ascending por lastMessageDate pra paginar com cursor de data crescente
  const sortBy = opts.sortBy ?? "last_message_date";
  const sort = opts.sort ?? "asc";

  while (true) {
    const params = new URLSearchParams({ locationId, limit: String(limit), sortBy, sort });
    if (opts.lastMessageType) params.set("lastMessageType", opts.lastMessageType);
    if (startAfterDate !== undefined) params.set("startAfterDate", String(startAfterDate));

    const data = await ghlFetch<{
      conversations: GhlConversationApi[];
      total: number;
    }>(`/conversations/search?${params.toString()}`);

    const convs = data.conversations || [];
    if (!convs.length) return;
    for (const c of convs) yield c;

    if (convs.length < limit) return;
    const last = convs[convs.length - 1];
    if (sort === "asc") {
      if (!last.lastMessageDate || last.lastMessageDate === startAfterDate) return;
      startAfterDate = last.lastMessageDate;
    } else {
      // se a API ignorar startAfterDate em desc, encerramos
      return;
    }
  }
}

export async function* ghlIterateMessages(conversationId: string, opts: { limit?: number } = {}): AsyncGenerator<GhlMessageApi> {
  const limit = opts.limit ?? 100;
  let lastMessageId: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (lastMessageId) params.set("lastMessageId", lastMessageId);

    const data = await ghlFetch<{
      messages: { messages: GhlMessageApi[]; lastMessageId?: string; nextPage?: boolean };
    }>(`/conversations/${conversationId}/messages?${params.toString()}`);

    const inner = data.messages;
    if (!inner?.messages?.length) return;
    for (const m of inner.messages) yield { ...m, conversationId };

    if (!inner.nextPage) return;
    lastMessageId = inner.lastMessageId;
    if (!lastMessageId) return;
  }
}

export async function* ghlIterateEmailSchedules(opts: { limit?: number } = {}): AsyncGenerator<GhlEmailScheduleApi> {
  const { locationId } = getConfig();
  const limit = opts.limit ?? 100;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({ locationId, limit: String(limit), offset: String(offset) });
    const data = await ghlFetch<{
      schedules: GhlEmailScheduleApi[];
      total: Array<{ total: number }>;
      count: number;
    }>(`/emails/schedule?${params.toString()}`);

    const items = data.schedules || [];
    if (!items.length) return;
    for (const it of items) yield it;

    if (items.length < limit) return;
    offset += items.length;
  }
}

// ─── Persistência ─────────────────────────────────────────────────────────

function tsFromUnixMs(v: number | string | undefined | null): Date | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Date.parse(v) : v;
  if (!n || Number.isNaN(n)) return null;
  return new Date(n);
}

// Drizzle's sql template doesn't auto-convert undefined to null, which generates
// invalid SQL ("syntax error at or near ,"). Use this on any optional field.
function nz<T>(v: T | undefined): T | null {
  return v === undefined ? null : v;
}

// Drizzle binds JS arrays as composite type (record), not as text[]. Build a
// Postgres array literal and cast explicitly via ${tagsLiteral(...)}::text[].
function tagsLiteral(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const escaped = tags.map((t) => '"' + String(t).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"').join(",");
  return "{" + escaped + "}";
}

export async function upsertContact(c: GhlContactApi): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.ghl_contacts (
      id, location_id, email, phone, contact_name, first_name, last_name,
      company_name, type, source, tags, country, city, state,
      date_added, date_updated, attributions, custom_fields, raw, synced_at
    ) VALUES (
      ${c.id}, ${c.locationId}, ${nz(c.email)}, ${nz(c.phone)}, ${nz(c.contactName)},
      ${nz(c.firstName)}, ${nz(c.lastName)}, ${nz(c.companyName)}, ${nz(c.type)}, ${nz(c.source)},
      ${tagsLiteral(c.tags)}::text[], ${nz(c.country)}, ${nz(c.city)}, ${nz(c.state)},
      ${tsFromUnixMs(c.dateAdded)}, ${tsFromUnixMs(c.dateUpdated)},
      ${JSON.stringify(c.attributions ?? null)}::jsonb,
      ${JSON.stringify(c.customFields ?? null)}::jsonb,
      ${JSON.stringify(c)}::jsonb, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      contact_name = EXCLUDED.contact_name,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      company_name = EXCLUDED.company_name,
      type = EXCLUDED.type,
      source = EXCLUDED.source,
      tags = EXCLUDED.tags,
      country = EXCLUDED.country,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      date_updated = EXCLUDED.date_updated,
      attributions = EXCLUDED.attributions,
      custom_fields = EXCLUDED.custom_fields,
      raw = EXCLUDED.raw,
      synced_at = NOW()
  `);
}

export async function upsertConversation(c: GhlConversationApi): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.ghl_conversations (
      id, location_id, contact_id, last_message_type, last_message_direction,
      last_message_date, unread_count, date_added, date_updated, raw, synced_at
    ) VALUES (
      ${c.id}, ${c.locationId}, ${nz(c.contactId)}, ${nz(c.lastMessageType)}, ${nz(c.lastMessageDirection)},
      ${tsFromUnixMs(c.lastMessageDate)}, ${c.unreadCount ?? 0},
      ${tsFromUnixMs(c.dateAdded)}, ${tsFromUnixMs(c.dateUpdated)},
      ${JSON.stringify(c)}::jsonb, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      contact_id = EXCLUDED.contact_id,
      last_message_type = EXCLUDED.last_message_type,
      last_message_direction = EXCLUDED.last_message_direction,
      last_message_date = EXCLUDED.last_message_date,
      unread_count = EXCLUDED.unread_count,
      date_updated = EXCLUDED.date_updated,
      raw = EXCLUDED.raw,
      synced_at = NOW()
  `);
}

export async function upsertMessage(m: GhlMessageApi): Promise<void> {
  const emailMessageId = m.meta?.email?.messageIds?.[0] ?? null;
  const subject = m.meta?.email?.subject ?? null;
  await db.execute(sql`
    INSERT INTO cortex_core.ghl_messages (
      id, conversation_id, contact_id, location_id, direction, message_type,
      status, source, body, subject, email_message_id, content_type,
      date_added, meta, synced_at
    ) VALUES (
      ${m.id}, ${m.conversationId ?? null}, ${m.contactId ?? null}, ${m.locationId},
      ${nz(m.direction)}, ${nz(m.messageType)}, ${nz(m.status)}, ${m.source ?? null},
      ${m.body ?? null}, ${subject}, ${emailMessageId}, ${m.contentType ?? null},
      ${tsFromUnixMs(m.dateAdded)},
      ${JSON.stringify(m.meta ?? null)}::jsonb, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      body = EXCLUDED.body,
      meta = EXCLUDED.meta,
      synced_at = NOW()
  `);
}

export async function upsertEmailCampaign(c: GhlEmailScheduleApi): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.ghl_email_campaigns (
      id, location_id, name, subject, campaign_type, status, template_id, template_type,
      total_count, success_count, failed_count, error_count, processed_count, queued_count,
      has_tracking, has_utm_tracking, is_plain_text, scheduled_at, date_added, date_updated,
      raw, synced_at
    ) VALUES (
      ${c.id}, ${c.locationId}, ${nz(c.name)}, ${nz(c.subject)}, ${nz(c.campaignType)}, ${nz(c.status)},
      ${c.templateId ?? null}, ${c.templateType ?? null},
      ${c.totalCount ?? 0}, ${c.successCount ?? c.success ?? 0}, ${c.failed ?? 0}, ${c.error ?? 0},
      ${c.processed ?? 0}, ${c.queuedCount ?? 0},
      ${c.hasTracking ?? false}, ${c.hasUtmTracking ?? false}, ${c.isPlainText ?? false},
      ${tsFromUnixMs(c.dateScheduled)},
      ${tsFromUnixMs(c.createdAt)}, ${tsFromUnixMs(c.updatedAt)},
      ${JSON.stringify(c)}::jsonb, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      subject = EXCLUDED.subject,
      status = EXCLUDED.status,
      total_count = EXCLUDED.total_count,
      success_count = EXCLUDED.success_count,
      failed_count = EXCLUDED.failed_count,
      error_count = EXCLUDED.error_count,
      processed_count = EXCLUDED.processed_count,
      queued_count = EXCLUDED.queued_count,
      date_updated = EXCLUDED.date_updated,
      raw = EXCLUDED.raw,
      synced_at = NOW()
  `);
}

export async function logSyncRun(params: {
  resource: string;
  startedAt: Date;
  finishedAt: Date;
  status: "success" | "error" | "partial";
  recordsProcessed: number;
  errorMessage?: string;
  cursor?: string;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.ghl_sync_runs (
      resource, started_at, finished_at, status, records_processed, error_message, cursor
    ) VALUES (
      ${params.resource}, ${params.startedAt}, ${params.finishedAt},
      ${params.status}, ${params.recordsProcessed},
      ${params.errorMessage ?? null}, ${params.cursor ?? null}
    )
  `);
}

export async function getLastSyncedAt(resource: string): Promise<Date | null> {
  const r = await db.execute<{ finished_at: Date | null }>(sql`
    SELECT finished_at FROM cortex_core.ghl_sync_runs
    WHERE resource = ${resource} AND status = 'success'
    ORDER BY finished_at DESC LIMIT 1
  `);
  return (r as any).rows?.[0]?.finished_at ?? null;
}

// ─── Jobs (chamados pelo scheduler no index.ts) ──────────────────────────

/**
 * Sync incremental rodado a cada hora. Pega:
 *  - Contatos atualizados desde última sync (via dateUpdated)
 *  - Campanhas de email atualizadas (counts mudam até ~72h após envio)
 *  - Conversas recentes (últimas 48h, para pegar novas mensagens)
 *
 * Idempotente — usa ON CONFLICT DO UPDATE.
 */
export async function runGhlHourlySync(): Promise<{
  contacts: number;
  campaigns: number;
  conversations: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const t0 = Date.now();
  let contacts = 0;
  let campaigns = 0;
  let conversations = 0;

  // Campaigns — refresh full (são poucas: ~200)
  try {
    for await (const c of ghlIterateEmailSchedules({ limit: 100 })) {
      await upsertEmailCampaign(c);
      campaigns++;
    }
    await logSyncRun({
      resource: "hourly:campaigns",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "success",
      recordsProcessed: campaigns,
    });
  } catch (err) {
    errors.push(`campaigns: ${(err as Error).message}`);
    console.error("[GHL hourly] campaigns error:", err);
  }

  // Conversations atualizadas nas últimas 48h
  try {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    for await (const c of ghlIterateConversations({ limit: 100, startAfterDate: cutoff })) {
      await upsertConversation(c);
      conversations++;
      // pega também as mensagens recentes de cada conversa atualizada
      try {
        for await (const m of ghlIterateMessages(c.id, { limit: 50 })) {
          await upsertMessage(m);
          // limita a 50 mais recentes pra não estourar rate-limit no hourly
        }
      } catch (e) {
        // continua o ciclo, não bloqueia
      }
    }
    await logSyncRun({
      resource: "hourly:conversations",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "success",
      recordsProcessed: conversations,
    });
  } catch (err) {
    errors.push(`conversations: ${(err as Error).message}`);
    console.error("[GHL hourly] conversations error:", err);
  }

  // Contatos: incremental por dateUpdated DESC (/contacts/search) com marca d'água
  // lida do próprio espelho. À prova de buracos: se o job ficar horas sem rodar, o
  // próximo run pagina até alcançar o último date_updated conhecido — a versão
  // antiga (janela fixa de 90min sobre lista ordenada por dateAdded) perdia
  // contatos antigos atualizados e tudo que caísse em gaps entre execuções.
  try {
    const hwRes = await db.execute(sql`SELECT MAX(date_updated) AS hw FROM cortex_core.ghl_contacts`);
    const hwRaw = (hwRes as any).rows?.[0]?.hw as string | Date | null;
    // 10 min de margem pra escritas concorrentes; espelho vazio → janela de 7 dias
    const watermarkMs = hwRaw
      ? new Date(hwRaw).getTime() - 10 * 60 * 1000
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const MAX_CONTACTS = 20_000; // teto de segurança por run; o resto fica pro próximo
    for await (const ct of ghlIterateContactsByUpdated({ pageLimit: 100 })) {
      const ts = Date.parse(ct.dateUpdated || ct.dateAdded || "");
      if (ts && ts < watermarkMs) break;
      await upsertContact(ct);
      contacts++;
      if (contacts >= MAX_CONTACTS) {
        console.warn(`[GHL hourly] contacts: teto de ${MAX_CONTACTS} atingido — restante no próximo run`);
        break;
      }
    }
    await logSyncRun({
      resource: "hourly:contacts",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "success",
      recordsProcessed: contacts,
    });
  } catch (err) {
    errors.push(`contacts: ${(err as Error).message}`);
    console.error("[GHL hourly] contacts error:", err);
  }

  return { contacts, campaigns, conversations, errors };
}

/**
 * Snapshot diário de tags — rodar 1× por dia (00:10 horário do servidor).
 * Insere uma linha por (tag, hoje) com a contagem atual de contatos.
 */
export async function runGhlDailyTagsSnapshot(): Promise<{ tags: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const r = await db.execute(sql`
    INSERT INTO cortex_core.ghl_tags_snapshot (snapshot_date, tag, contact_count)
    SELECT ${today}::date, t.tag, COUNT(*)::int
    FROM cortex_core.ghl_contacts c, UNNEST(c.tags) AS t(tag)
    GROUP BY t.tag
    ON CONFLICT (snapshot_date, tag) DO UPDATE
      SET contact_count = EXCLUDED.contact_count
    RETURNING tag
  `);
  const tags = ((r as any).rows ?? []).length;
  await logSyncRun({
    resource: "daily:tags_snapshot",
    startedAt: new Date(),
    finishedAt: new Date(),
    status: "success",
    recordsProcessed: tags,
  });
  return { tags };
}
