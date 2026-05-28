/**
 * CRM Instagram — Ingestão de DMs do GHL + dedup "já é contato/cliente".
 *
 * O GHL já está espelhado no Postgres (ghl_messages/ghl_contacts via
 * goHighLevelSync.ts). Aqui lemos as DMs de Instagram INBOUND e as
 * transformamos em interações `spontaneous_dm` nos prospects, ligando o
 * ghl_contact_id e marcando isExistingContact (dedup).
 *
 * ⚠️ A confirmar com dados reais (rodar o dev server): o valor exato de
 * `message_type` para Instagram no GHL e a melhor fonte do @handle. O código é
 * defensivo: filtra IG por message_type='IG' OU ILIKE '%insta%', e deriva o
 * handle de contact_name (fallback). Ajustar GHL_IG_TYPES / deriveHandle se a
 * inspeção mostrar outro formato.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { prospectingProfiles, prospectingInteractions } from "../../shared/schema";

const LOOKBACK_DAYS = 45; // janela processada a cada run (idempotente por external_ref)

function deriveHandle(contactName: string | null, fallbackId: string): string | null {
  if (!contactName) return null;
  const cleaned = contactName.trim().replace(/^@/, "");
  if (!cleaned) return null;
  // Handles de IG não têm espaço; se vier um nome de exibição com espaço,
  // ainda assim usamos como chave normalizada (melhor ligar que perder).
  return cleaned.toLowerCase();
}

export async function runCrmInstagramGhlIngest(): Promise<void> {
  const startedAt = new Date();
  try {
    // DMs de Instagram inbound recentes + dados do contato
    const rows = (await db.execute(sql`
      SELECT m.id            AS message_id,
             m.contact_id    AS contact_id,
             m.body          AS body,
             m.date_added    AS date_added,
             c.contact_name  AS contact_name,
             c.tags          AS tags
      FROM cortex_core.ghl_messages m
      LEFT JOIN cortex_core.ghl_contacts c ON c.id = m.contact_id
      WHERE m.direction = 'inbound'
        AND (m.message_type = 'IG' OR m.message_type ILIKE '%insta%')
        AND m.date_added >= NOW() - (${LOOKBACK_DAYS} || ' days')::interval
      ORDER BY m.date_added ASC
    `)).rows as Array<{
      message_id: string;
      contact_id: string | null;
      body: string | null;
      date_added: string | Date | null;
      contact_name: string | null;
      tags: string[] | null;
    }>;

    let newInteractions = 0;
    let skippedNoHandle = 0;

    for (const r of rows) {
      const handle = deriveHandle(r.contact_name, r.contact_id || r.message_id);
      if (!handle) { skippedNoHandle++; continue; }

      const occurredAt = r.date_added && !isNaN(new Date(r.date_added).getTime())
        ? new Date(r.date_added)
        : new Date();

      // Upsert do prospect — DM marca isExistingContact (já está no CRM de marketing)
      const upserted = await db
        .insert(prospectingProfiles)
        .values({
          igUsername: handle,
          ghlContactId: r.contact_id || undefined,
          isExistingContact: true,
          lastInteractionAt: occurredAt,
          firstSeen: occurredAt,
          icpTags: r.tags || undefined,
        })
        .onConflictDoUpdate({
          target: prospectingProfiles.igUsername,
          set: {
            lastInteractionAt: sql`GREATEST(${prospectingProfiles.lastInteractionAt}, ${occurredAt})`,
            ghlContactId: sql`COALESCE(${prospectingProfiles.ghlContactId}, ${r.contact_id})`,
            isExistingContact: true,
            updatedAt: new Date(),
          },
        })
        .returning({ id: prospectingProfiles.id });

      const profile = upserted[0];
      if (!profile) continue;

      const res = await db
        .insert(prospectingInteractions)
        .values({
          profileId: profile.id,
          type: "spontaneous_dm",
          text: r.body?.slice(0, 1000),
          source: "dm",
          externalRef: r.message_id,
          occurredAt,
        })
        .onConflictDoNothing({ target: prospectingInteractions.externalRef })
        .returning({ id: prospectingInteractions.id });
      if (res.length > 0) newInteractions++;
    }

    (globalThis as any).__crmInstagramGhlIngestStatus = {
      lastRun: startedAt.toISOString(),
      status: "ok",
      messagesSeen: rows.length,
      newInteractions,
      skippedNoHandle,
      durationMs: Date.now() - startedAt.getTime(),
    };
    console.log(
      `[crm-instagram] GHL ingest ok: ${rows.length} DMs IG, ${newInteractions} novas interações, ${skippedNoHandle} sem handle`
    );
  } catch (err: any) {
    console.error("[crm-instagram] GHL ingest erro:", err.message);
    (globalThis as any).__crmInstagramGhlIngestStatus = {
      lastRun: startedAt.toISOString(),
      status: "error",
      error: err.message,
    };
  }
}
