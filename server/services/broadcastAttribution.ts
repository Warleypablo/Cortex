/**
 * Atribuição lead-a-lead de respostas de broadcast.
 *
 * Para cada resposta (inbound WhatsApp) no período:
 *  1. acha o disparo de origem = último outbound `source IN (workflow|bulk_actions|campaign)`
 *     na MESMA conversation_id antes da resposta → reconstrói o broadcast_id no mesmo
 *     formato de listBroadcasts (wa-YYYYMMDD-source-hash8);
 *  2. classifica o sentimento da resposta (replyClassifier);
 *  3. resolve telefone do contato GHL (fallback: phone do raw da conversa, pois o sync
 *     de contatos é incompleto) → "Bitrix".crm_contact → crm_deal.contact_id;
 *  4. faz upsert em cortex_core.broadcast_lead_events (idempotente por reply_message_id).
 *
 * As etapas reunião/comparecimento/venda NÃO entram aqui — são lidas live do crm_deal
 * pelos endpoints de funil.
 */

import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import { normalizePhoneBR } from "../../shared/ghl-broadcast/phone";
import { classificarResposta } from "./replyClassifier";

interface ReplyRow {
  reply_message_id: string;
  conversation_id: string | null;
  ghl_contact_id: string | null;
  reply_body: string | null;
  reply_at: Date | string | null;
  broadcast_id: string | null;
  origem_body: string | null;
  lead_phone: string | null;
}

export interface AttributionResult {
  replies: number;       // respostas com disparo atribuído no período
  classified: number;    // respostas classificadas nesta execução
  matchedDeals: number;  // respostas ligadas a um deal do Bitrix
  unmatchedPhones: number;
}

/**
 * Roda a atribuição. Por padrão pula respostas já gravadas (idempotente/barato);
 * passe `reclassify: true` pra reprocessar tudo no período.
 */
export async function attributeBroadcastReplies(opts: {
  from: Date;
  to: Date;
  broadcastId?: string;
  reclassify?: boolean;
}): Promise<AttributionResult> {
  const { from, to, broadcastId, reclassify } = opts;

  // 1) Respostas + disparo de origem (na mesma conversa) + telefone do contato GHL.
  const r = await db.execute(sql`
    WITH replies AS (
      SELECT m.id AS reply_message_id, m.conversation_id, m.contact_id AS ghl_contact_id,
             m.body AS reply_body, m.date_added AS reply_at
      FROM cortex_core.ghl_messages m
      WHERE m.direction = 'inbound'
        AND m.message_type = 'TYPE_WHATSAPP'
        AND m.date_added BETWEEN ${from} AND ${to}
    ),
    attributed AS (
      SELECT r.*, o.broadcast_id, o.origem_body
      FROM replies r
      LEFT JOIN LATERAL (
        SELECT 'wa-' || TO_CHAR(DATE_TRUNC('day', o.date_added), 'YYYYMMDD') || '-'
               || o.source || '-' || SUBSTR(MD5(COALESCE(o.body, '')), 1, 8) AS broadcast_id,
               o.body AS origem_body
        FROM cortex_core.ghl_messages o
        WHERE o.conversation_id = r.conversation_id
          AND o.direction = 'outbound'
          AND o.source IN ('workflow', 'bulk_actions', 'campaign')
          AND o.date_added < r.reply_at
        ORDER BY o.date_added DESC
        LIMIT 1
      ) o ON true
    )
    SELECT a.reply_message_id, a.conversation_id, a.ghl_contact_id, a.reply_body,
           a.reply_at, a.broadcast_id, a.origem_body,
           COALESCE(c.phone, cv.raw->>'phone') AS lead_phone
    FROM attributed a
    LEFT JOIN cortex_core.ghl_contacts c ON c.id = a.ghl_contact_id
    LEFT JOIN cortex_core.ghl_conversations cv ON cv.id = a.conversation_id
    WHERE a.broadcast_id IS NOT NULL
      ${broadcastId ? sql`AND a.broadcast_id = ${broadcastId}` : sql``}
  `);
  const rows = ((r as any).rows ?? []) as ReplyRow[];

  if (rows.length === 0) {
    return { replies: 0, classified: 0, matchedDeals: 0, unmatchedPhones: 0 };
  }

  // 2) Pula as já gravadas — MAS reprocessa as que ficaram com sentimento de fallback
  //    (classificação IA falhou no passado, ex.: chave inválida) e as que ficaram sem
  //    telefone mas que agora dá pra resolver (contato sincronizado depois, ou fallback
  //    pelo phone da conversa). Self-heal.
  let pending = rows;
  if (!reclassify) {
    const ids = rows.map((x) => x.reply_message_id);
    const phoneNow = new Map(rows.map((x) => [x.reply_message_id, x.lead_phone]));
    // node-pg liga o array como $1::text[] (o template sql do drizzle não casa array em ANY()).
    const existing = await pool.query(
      `SELECT reply_message_id, sentiment_motivo, lead_phone FROM cortex_core.broadcast_lead_events WHERE reply_message_id = ANY($1::text[])`,
      [ids],
    );
    // "OK" = já gravada, sentimento não veio de falha de IA, e não há telefone novo a ganhar.
    const okSeen = new Set(
      (existing.rows ?? [])
        .filter((x: any) => !/falha|indispon/i.test(x.sentiment_motivo ?? ""))
        .filter((x: any) => !(x.lead_phone == null && phoneNow.get(x.reply_message_id) != null))
        .map((x: any) => x.reply_message_id),
    );
    pending = rows.filter((x) => !okSeen.has(x.reply_message_id));
  }

  // 3) Resolve telefone → Bitrix em lote (telefone normalizado → contact_id + deal mais recente).
  const phoneToNorm = new Map<string, string>(); // reply_message_id → phone_norm
  const norms = new Set<string>();
  for (const row of pending) {
    const norm = normalizePhoneBR(row.lead_phone);
    if (norm) {
      phoneToNorm.set(row.reply_message_id, norm);
      norms.add(norm);
    }
  }
  const normToBitrix = new Map<string, { contactId: number; dealId: number | null }>();
  if (norms.size > 0) {
    const bx = await pool.query(
      `SELECT DISTINCT ON (ct.phone_normalized)
              ct.phone_normalized, ct.id AS contact_id, d.id AS deal_id
       FROM "Bitrix".crm_contact ct
       LEFT JOIN "Bitrix".crm_deal d ON d.contact_id = ct.id
       WHERE ct.phone_normalized = ANY($1::text[])
       ORDER BY ct.phone_normalized, d.date_create DESC NULLS LAST`,
      [Array.from(norms)],
    );
    for (const b of (bx.rows ?? []) as any[]) {
      normToBitrix.set(b.phone_normalized, {
        contactId: Number(b.contact_id),
        dealId: b.deal_id != null ? Number(b.deal_id) : null,
      });
    }
  }

  // 4) Classifica + upsert.
  let classified = 0;
  let matchedDeals = 0;
  let unmatchedPhones = 0;
  for (const row of pending) {
    const cls = await classificarResposta(row.reply_body || "", row.origem_body);
    classified++;
    const norm = phoneToNorm.get(row.reply_message_id) ?? null;
    const bx = norm ? normToBitrix.get(norm) : undefined;
    if (norm && !bx) unmatchedPhones++;
    if (bx?.dealId != null) matchedDeals++;

    await db.execute(sql`
      INSERT INTO cortex_core.broadcast_lead_events (
        broadcast_id, conversation_id, ghl_contact_id, lead_phone, lead_phone_norm,
        reply_message_id, reply_body, reply_at, sentiment, sentiment_motivo, sentiment_fonte,
        bitrix_contact_id, bitrix_deal_id, attributed_at
      ) VALUES (
        ${row.broadcast_id}, ${row.conversation_id}, ${row.ghl_contact_id}, ${row.lead_phone}, ${norm},
        ${row.reply_message_id}, ${row.reply_body}, ${row.reply_at}, ${cls.sentiment}, ${cls.motivo}, ${cls.fonte},
        ${bx?.contactId ?? null}, ${bx?.dealId ?? null}, NOW()
      )
      ON CONFLICT (reply_message_id) DO UPDATE SET
        broadcast_id = EXCLUDED.broadcast_id,
        conversation_id = EXCLUDED.conversation_id,
        ghl_contact_id = EXCLUDED.ghl_contact_id,
        lead_phone = EXCLUDED.lead_phone,
        lead_phone_norm = EXCLUDED.lead_phone_norm,
        reply_body = EXCLUDED.reply_body,
        reply_at = EXCLUDED.reply_at,
        sentiment = EXCLUDED.sentiment,
        sentiment_motivo = EXCLUDED.sentiment_motivo,
        sentiment_fonte = EXCLUDED.sentiment_fonte,
        bitrix_contact_id = EXCLUDED.bitrix_contact_id,
        bitrix_deal_id = EXCLUDED.bitrix_deal_id,
        attributed_at = NOW()
    `);
  }

  return { replies: rows.length, classified, matchedDeals, unmatchedPhones };
}
