/**
 * CRM Instagram — Ingestão de DMs do GHL + dedup "já é contato/cliente".
 *
 * O GHL já está espelhado no Postgres (ghl_messages/ghl_contacts via
 * goHighLevelSync.ts). Aqui lemos as DMs de Instagram INBOUND e as
 * transformamos em interações `spontaneous_dm` nos prospects, ligando o
 * ghl_contact_id e marcando isExistingContact (dedup).
 *
 * message_type confirmado em produção (2026-06): DMs de IG são 'TYPE_INSTAGRAM'
 * (inbound). Comentários vêm como 'TYPE_INSTAGRAM_COMMENT' e NÃO entram aqui —
 * são coletados via Graph API em crmInstagramCollector. Por isso o filtro é
 * exato (= 'TYPE_INSTAGRAM'), não ILIKE '%insta%'. O @handle é derivado de
 * contact_name (fallback em deriveHandle).
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { prospectingProfiles, prospectingInteractions } from "../../shared/schema";

const LOOKBACK_DAYS = 45; // janela processada a cada run (idempotente por external_ref)

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
        AND m.message_type = 'TYPE_INSTAGRAM'
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
      // Chave de dedup estável = ghl_contact_id (o GHL não entrega @handle real).
      // Sem contact_id não há como deduplicar com segurança → pula.
      const ghlContactId = r.contact_id;
      if (!ghlContactId) { skippedNoHandle++; continue; }
      const displayName = r.contact_name?.trim() || `contato ${ghlContactId.slice(0, 6)}`;

      const occurredAt = r.date_added && !isNaN(new Date(r.date_added).getTime())
        ? new Date(r.date_added)
        : new Date();

      // Upsert do prospect — dedup por ghl_contact_id. ig_username (handle real) fica
      // null até a via de comentário preencher; display_name é o rótulo humano.
      const upserted = await db
        .insert(prospectingProfiles)
        .values({
          displayName,
          ghlContactId,
          isExistingContact: true,
          lastInteractionAt: occurredAt,
          firstSeen: occurredAt,
          icpTags: r.tags || undefined,
        })
        .onConflictDoUpdate({
          target: prospectingProfiles.ghlContactId,
          set: {
            displayName,
            lastInteractionAt: sql`GREATEST(${prospectingProfiles.lastInteractionAt}, ${occurredAt})`,
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
