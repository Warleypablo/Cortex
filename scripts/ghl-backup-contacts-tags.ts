/**
 * Backup completo das tags de cada contato GHL antes da migração de padronização.
 *
 * Salva em `cortex_core.ghl_contacts_tags_backup` (contact_id, tags TEXT[], backup_at).
 * Idempotente: chamadas múltiplas geram backups com `backup_at` distintos —
 * use o mais recente pra rollback.
 *
 * Uso:
 *   npx tsx scripts/ghl-backup-contacts-tags.ts
 *   npx tsx scripts/ghl-backup-contacts-tags.ts --label="pre-apply-2026-05-23"
 */

import { config } from "dotenv";
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { logSyncRun } from "../server/services/goHighLevelSync";

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

async function ensureBackupTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.ghl_contacts_tags_backup (
      id BIGSERIAL PRIMARY KEY,
      contact_id TEXT NOT NULL,
      tags TEXT[] NOT NULL,
      label TEXT,
      backup_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ghl_contacts_tags_backup_contact_idx
      ON cortex_core.ghl_contacts_tags_backup (contact_id, backup_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ghl_contacts_tags_backup_label_idx
      ON cortex_core.ghl_contacts_tags_backup (label, backup_at DESC)
  `);
}

async function main() {
  const args = parseArgs();
  const label = args.label || `backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}`;
  const t0 = Date.now();

  console.log("[GHL backup] === Backup de tags de contatos ===");
  console.log(`[GHL backup] label: ${label}`);

  await ensureBackupTable();

  const r = await db.execute<{ n: number }>(sql`
    INSERT INTO cortex_core.ghl_contacts_tags_backup (contact_id, tags, label)
    SELECT id, tags, ${label}
    FROM cortex_core.ghl_contacts
    WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
    RETURNING contact_id
  `);
  const rows = (r as any).rows?.length ?? 0;

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[GHL backup] ${rows} contatos com tags salvos (${elapsed}s)`);

  await logSyncRun({
    resource: "tags_backup",
    startedAt: new Date(t0),
    finishedAt: new Date(),
    status: "success",
    recordsProcessed: rows,
    cursor: label,
  });

  console.log("[GHL backup] Para rollback, use o label:", label);
  process.exit(0);
}

main().catch((err) => {
  console.error("[GHL backup] Erro:", err);
  process.exit(1);
});
