/**
 * Backfill inicial do GoHighLevel (GHL).
 *
 * Uso:
 *   npx tsx scripts/ghl-backfill.ts                   # tudo (contacts, tags, campanhas, conversas WhatsApp+Email, mensagens)
 *   npx tsx scripts/ghl-backfill.ts --resource=contacts
 *   npx tsx scripts/ghl-backfill.ts --resource=conversations --days=90
 *   npx tsx scripts/ghl-backfill.ts --resource=messages --max-conversations=500
 *
 * Resources disponíveis: contacts | conversations | messages | campaigns | tags | all
 *
 * Volumes esperados (referência 2026-05-22):
 *   - contacts: ~48.000
 *   - conversations: ~46.000 (todas) / ~7.200 WhatsApp / ~30k+ email
 *   - email campaigns: ~191
 *   - tags: ~191
 *
 * Idempotente — pode ser interrompido e relançado.
 */

import { config } from "dotenv";
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  ghlFetch,
  ghlGetLocation,
  ghlListTags,
  ghlIterateContacts,
  ghlIterateConversations,
  ghlIterateMessages,
  ghlIterateEmailSchedules,
  upsertContact,
  upsertConversation,
  upsertMessage,
  upsertEmailCampaign,
  logSyncRun,
} from "../server/services/goHighLevelSync";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith("--")) out[a.slice(2)] = "true";
  }
  return out;
}

function pct(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "?";
}

async function backfillTags() {
  const t0 = Date.now();
  console.log("[GHL backfill] === Tags ===");
  const tags = await ghlListTags();
  console.log(`[GHL backfill] ${tags.length} tags retornadas`);
  // Salvamos snapshot do dia (não há tabela de tags em si — só snapshot por data)
  const today = new Date().toISOString().slice(0, 10);
  for (const tag of tags) {
    await db.execute(sql`
      INSERT INTO cortex_core.ghl_tags_snapshot (snapshot_date, tag, contact_count)
      VALUES (${today}, ${tag.name}, 0)
      ON CONFLICT DO NOTHING
    `);
  }
  console.log(`[GHL backfill] tags snapshot salvo (${tags.length}) — counts serão preenchidos ao final do contacts`);
  await logSyncRun({
    resource: "tags",
    startedAt: new Date(t0),
    finishedAt: new Date(),
    status: "success",
    recordsProcessed: tags.length,
  });
}

async function backfillContacts() {
  const t0 = Date.now();
  console.log("[GHL backfill] === Contacts ===");
  // Pega total primeiro pra mostrar progresso
  const meta = await ghlFetch<{ meta: { total: number } }>(
    `/contacts/?locationId=${process.env.GHL_LOCATION_ID}&limit=1`,
  );
  const total = meta.meta?.total ?? 0;
  console.log(`[GHL backfill] Total a importar: ${total}`);

  let processed = 0;
  const progressEvery = 500;
  try {
    for await (const c of ghlIterateContacts({ limit: 100 })) {
      await upsertContact(c);
      processed++;
      if (processed % progressEvery === 0) {
        const elapsed = (Date.now() - t0) / 1000;
        console.log(`[GHL backfill] contacts ${processed}/${total} (${pct(processed, total)}) — ${elapsed.toFixed(0)}s`);
      }
    }
    console.log(`[GHL backfill] contacts concluído: ${processed} em ${((Date.now() - t0) / 1000).toFixed(0)}s`);

    // Atualiza tags_snapshot do dia com contagem real por tag (unnest)
    const today = new Date().toISOString().slice(0, 10);
    await db.execute(sql`
      INSERT INTO cortex_core.ghl_tags_snapshot (snapshot_date, tag, contact_count)
      SELECT ${today}::date, t.tag, COUNT(*)::int
      FROM cortex_core.ghl_contacts c, UNNEST(c.tags) AS t(tag)
      GROUP BY t.tag
      ON CONFLICT (snapshot_date, tag) DO UPDATE
        SET contact_count = EXCLUDED.contact_count
    `);
    console.log(`[GHL backfill] tags_snapshot atualizado com contagens reais`);

    await logSyncRun({
      resource: "contacts",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "success",
      recordsProcessed: processed,
    });
  } catch (err) {
    console.error("[GHL backfill] contacts ERROR:", err);
    await logSyncRun({
      resource: "contacts",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "partial",
      recordsProcessed: processed,
      errorMessage: (err as Error).message,
    });
    throw err;
  }
}

async function backfillEmailCampaigns() {
  const t0 = Date.now();
  console.log("[GHL backfill] === Email Campaigns ===");
  let processed = 0;
  for await (const c of ghlIterateEmailSchedules({ limit: 100 })) {
    await upsertEmailCampaign(c);
    processed++;
  }
  console.log(`[GHL backfill] email campaigns: ${processed} em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await logSyncRun({
    resource: "email_campaigns",
    startedAt: new Date(t0),
    finishedAt: new Date(),
    status: "success",
    recordsProcessed: processed,
  });
}

async function backfillConversations(opts: { days?: number; lastMessageType?: "TYPE_EMAIL" | "TYPE_WHATSAPP" | "TYPE_SMS" } = {}) {
  const t0 = Date.now();
  const label = opts.lastMessageType ? `Conversations (${opts.lastMessageType})` : "Conversations (all)";
  console.log(`[GHL backfill] === ${label} ===`);
  // startAfterDate em ms — se days passado, limita janela
  const startAfterDate = opts.days
    ? Date.now() - opts.days * 24 * 60 * 60 * 1000
    : undefined;

  let processed = 0;
  const progressEvery = 500;
  try {
    for await (const c of ghlIterateConversations({ limit: 100, lastMessageType: opts.lastMessageType, startAfterDate })) {
      await upsertConversation(c);
      processed++;
      if (processed % progressEvery === 0) {
        console.log(`[GHL backfill] ${label}: ${processed} — ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }
    console.log(`[GHL backfill] ${label} concluído: ${processed} em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await logSyncRun({
      resource: `conversations${opts.lastMessageType ? `:${opts.lastMessageType}` : ""}`,
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "success",
      recordsProcessed: processed,
    });
  } catch (err) {
    console.error(`[GHL backfill] ${label} ERROR:`, err);
    await logSyncRun({
      resource: `conversations${opts.lastMessageType ? `:${opts.lastMessageType}` : ""}`,
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "partial",
      recordsProcessed: processed,
      errorMessage: (err as Error).message,
    });
    throw err;
  }
}

async function backfillMessages(opts: { maxConversations?: number; days?: number } = {}) {
  const t0 = Date.now();
  console.log("[GHL backfill] === Messages (de cada conversation) ===");
  const sinceMs = opts.days ? Date.now() - opts.days * 24 * 60 * 60 * 1000 : 0;

  // Lê conversas já no banco (ordenadas por lastMessageDate desc) e baixa mensagens
  const limit = opts.maxConversations ?? 5000;
  const result = await db.execute(sql`
    SELECT id, last_message_date FROM cortex_core.ghl_conversations
    WHERE last_message_date IS NOT NULL
      AND last_message_date >= ${new Date(sinceMs)}
    ORDER BY last_message_date DESC
    LIMIT ${limit}
  `);
  const conversations = (result as any).rows as Array<{ id: string; last_message_date: Date }>;
  console.log(`[GHL backfill] Vai puxar mensagens de ${conversations.length} conversations`);

  let convsDone = 0;
  let msgsTotal = 0;
  try {
    for (const conv of conversations) {
      let msgsInThisConv = 0;
      for await (const m of ghlIterateMessages(conv.id, { limit: 100 })) {
        await upsertMessage(m);
        msgsInThisConv++;
        msgsTotal++;
      }
      convsDone++;
      if (convsDone % 50 === 0) {
        console.log(`[GHL backfill] messages: ${convsDone}/${conversations.length} conversations — ${msgsTotal} mensagens — ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }
    console.log(`[GHL backfill] messages concluído: ${msgsTotal} mensagens de ${convsDone} conversations em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await logSyncRun({
      resource: "messages",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "success",
      recordsProcessed: msgsTotal,
    });
  } catch (err) {
    console.error("[GHL backfill] messages ERROR:", err);
    await logSyncRun({
      resource: "messages",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      status: "partial",
      recordsProcessed: msgsTotal,
      errorMessage: (err as Error).message,
    });
    throw err;
  }
}

async function main() {
  const args = parseArgs();
  const resource = args.resource ?? "all";
  const days = args.days ? parseInt(args.days, 10) : undefined;
  const maxConversations = args["max-conversations"] ? parseInt(args["max-conversations"], 10) : undefined;

  console.log("[GHL backfill] Iniciando — resource=" + resource + (days ? ` days=${days}` : "") + (maxConversations ? ` max-conversations=${maxConversations}` : ""));
  const loc = await ghlGetLocation();
  console.log(`[GHL backfill] Conectado em location: ${loc.location?.name} (${loc.location?.id})`);

  switch (resource) {
    case "tags":
      await backfillTags();
      break;
    case "contacts":
      await backfillContacts();
      break;
    case "campaigns":
      await backfillEmailCampaigns();
      break;
    case "conversations":
      await backfillConversations({ days });
      break;
    case "conversations:whatsapp":
      await backfillConversations({ days, lastMessageType: "TYPE_WHATSAPP" });
      break;
    case "conversations:email":
      await backfillConversations({ days, lastMessageType: "TYPE_EMAIL" });
      break;
    case "messages":
      await backfillMessages({ days, maxConversations });
      break;
    case "all":
      await backfillTags();
      await backfillEmailCampaigns();
      await backfillContacts();
      await backfillConversations({ days });
      await backfillMessages({ days, maxConversations });
      break;
    default:
      throw new Error(`Resource desconhecido: ${resource}`);
  }
  console.log("[GHL backfill] FIM");
  process.exit(0);
}

main().catch((err) => {
  console.error("[GHL backfill] FATAL:", err);
  process.exit(1);
});
