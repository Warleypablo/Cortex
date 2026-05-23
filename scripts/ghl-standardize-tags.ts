/**
 * Padroniza as tags do GoHighLevel conforme `TAG_MIGRATION_MAP`.
 *
 * Modos:
 *   npx tsx scripts/ghl-standardize-tags.ts
 *     → DRY-RUN. Gera `out/ghl-tag-migration-plan.csv` com o impacto por tag.
 *       Não chama API. Use pra Marketing revisar.
 *
 *   npx tsx scripts/ghl-standardize-tags.ts --apply
 *     → Aplica a migração nos contatos via GHL API:
 *       para cada contato com tag antiga, faz POST add (nova) + DELETE remove (antiga).
 *       Logado em cortex_core.ghl_sync_runs.
 *
 *   npx tsx scripts/ghl-standardize-tags.ts --only="[creators]"
 *     → Pilot mode: aplica migração SÓ pros contatos que têm esta tag específica.
 *       Útil pra validar antes do --apply completo.
 *
 *   npx tsx scripts/ghl-standardize-tags.ts --cleanup-empty
 *     → Depois do --apply + novo snapshot, deleta tags GHL com 0 contatos
 *       via DELETE /locations/{id}/tags/{tagId}.
 *
 *   npx tsx scripts/ghl-standardize-tags.ts --rollback --label="<backup_label>"
 *     → Restaura tags de cada contato a partir de `ghl_contacts_tags_backup`.
 *
 * Pré-requisitos:
 *   - Backup das tags rodado antes (npx tsx scripts/ghl-backup-contacts-tags.ts)
 *   - Workflows publicados desativados manualmente quando necessário
 */

import { config } from "dotenv";
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { db } from "../server/db";
import {
  ghlFetch,
  ghlListTags,
  logSyncRun,
} from "../server/services/goHighLevelSync";
import { TAG_MIGRATION_MAP, diffContactTags } from "../shared/ghl-broadcast/tag-migration-map";

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

function getLocationId(): string {
  const id = process.env.GHL_LOCATION_ID;
  if (!id) throw new Error("GHL_LOCATION_ID not set");
  return id;
}

async function dryRun(): Promise<void> {
  console.log("[GHL standardize] === DRY-RUN ===");

  const snapshot = await db.execute<{ tag: string; contact_count: number }>(sql`
    SELECT tag, contact_count
    FROM cortex_core.ghl_tags_snapshot
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM cortex_core.ghl_tags_snapshot)
    ORDER BY contact_count DESC
  `);

  const rows = (snapshot as any).rows as { tag: string; contact_count: number }[];
  console.log(`[GHL standardize] ${rows.length} tags no último snapshot`);

  const csvLines = ["tag_old,tag_new,action,contacts_affected"];
  let toRename = 0;
  let toDelete = 0;
  let toKeep = 0;
  let unmapped = 0;

  for (const { tag, contact_count } of rows) {
    if (!(tag in TAG_MIGRATION_MAP)) {
      unmapped++;
      csvLines.push(
        `${csv(tag)},${csv(tag)},UNMAPPED_KEEP,${contact_count}`,
      );
      continue;
    }
    const newTag = TAG_MIGRATION_MAP[tag];
    if (newTag === null) {
      toDelete++;
      csvLines.push(`${csv(tag)},,DELETE,${contact_count}`);
    } else if (newTag === tag) {
      toKeep++;
      csvLines.push(`${csv(tag)},${csv(newTag)},KEEP,${contact_count}`);
    } else {
      toRename++;
      csvLines.push(`${csv(tag)},${csv(newTag)},RENAME,${contact_count}`);
    }
  }

  const outPath = "out/ghl-tag-migration-plan.csv";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csvLines.join("\n"), "utf8");

  console.log(`\n[GHL standardize] Resumo:`);
  console.log(`  RENAME : ${toRename}`);
  console.log(`  KEEP   : ${toKeep}`);
  console.log(`  DELETE : ${toDelete}`);
  console.log(`  UNMAPPED (mantém como está) : ${unmapped}`);
  console.log(`\nCSV gerado em ${outPath}`);

  // Também salva lista de workflows publicados pra Ichino conferir
  try {
    const { locationId } = { locationId: getLocationId() };
    const wf = await ghlFetch<{ workflows: { id: string; name: string; status: string }[] }>(
      `/workflows/?locationId=${locationId}`,
    );
    const pub = (wf.workflows || []).filter((w) => w.status === "published");
    const wfPath = "out/ghl-workflows-published.txt";
    writeFileSync(wfPath, pub.map((w) => `${w.name}\t${w.id}`).join("\n") + "\n", "utf8");
    console.log(`\n${pub.length} workflows publicados → ${wfPath}`);
  } catch (e: any) {
    console.warn("[GHL standardize] Não consegui listar workflows:", e.message);
  }
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Itera todos os contatos que têm pelo menos uma das `targetOldTags`.
 * Quando `targetOldTags` é null, itera todos com qualquer tag antiga
 * (presente nas chaves do TAG_MIGRATION_MAP que mudam ou apagam).
 */
async function* iterateContactsWithOldTags(
  targetOldTags: string[] | null,
): AsyncGenerator<{ id: string; tags: string[] }> {
  const oldTagsToTouch = targetOldTags
    ? targetOldTags
    : Object.entries(TAG_MIGRATION_MAP)
        .filter(([oldT, newT]) => newT === null || newT !== oldT)
        .map(([oldT]) => oldT);

  const BATCH = 1000;
  let offset = 0;
  while (true) {
    const r = await db.execute<{ id: string; tags: string[] }>(sql`
      SELECT id, tags
      FROM cortex_core.ghl_contacts
      WHERE tags && ${oldTagsToTouch}::text[]
      ORDER BY id
      OFFSET ${offset}
      LIMIT ${BATCH}
    `);
    const rows = (r as any).rows as { id: string; tags: string[] }[];
    if (!rows.length) return;
    for (const row of rows) yield row;
    if (rows.length < BATCH) return;
    offset += BATCH;
  }
}

async function applyMigration(only: string | null): Promise<void> {
  const targetOldTags = only ? [only] : null;
  const t0 = Date.now();
  console.log(
    `[GHL standardize] === APPLY ${only ? `(only="${only}")` : "(all)"} ===`,
  );

  let processed = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let errors = 0;

  for await (const contact of iterateContactsWithOldTags(targetOldTags)) {
    try {
      const { add, remove } = diffContactTags(contact.tags || []);
      if (add.length === 0 && remove.length === 0) {
        processed++;
        continue;
      }
      if (add.length) {
        await ghlFetch(`/contacts/${contact.id}/tags`, {
          method: "POST",
          body: JSON.stringify({ tags: add }),
        });
        totalAdded += add.length;
      }
      if (remove.length) {
        await ghlFetch(`/contacts/${contact.id}/tags`, {
          method: "DELETE",
          body: JSON.stringify({ tags: remove }),
        });
        totalRemoved += remove.length;
      }
      // Atualiza o array local imediatamente — o sync diário recoloca,
      // mas mantém o Cortex consistente durante a janela.
      const newTags = [...new Set([...contact.tags.filter((t) => !remove.includes(t)), ...add])];
      await db.execute(sql`
        UPDATE cortex_core.ghl_contacts SET tags = ${newTags}::text[] WHERE id = ${contact.id}
      `);

      processed++;
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        const rate = (processed / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1);
        console.log(
          `[GHL standardize] processed=${processed} added=${totalAdded} removed=${totalRemoved} errors=${errors} elapsed=${elapsed}s rate=${rate}/s`,
        );
      }
    } catch (err: any) {
      errors++;
      console.error(`[GHL standardize] erro no contato ${contact.id}: ${err.message}`);
      if (errors > 50) {
        console.error("[GHL standardize] >50 erros — abortando pra investigação");
        break;
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `\n[GHL standardize] FIM: processed=${processed} added=${totalAdded} removed=${totalRemoved} errors=${errors} elapsed=${elapsed}s`,
  );

  await logSyncRun({
    resource: only ? `tags_standardize:${only}` : "tags_standardize",
    startedAt: new Date(t0),
    finishedAt: new Date(),
    status: errors === 0 ? "success" : "partial",
    recordsProcessed: processed,
    errorMessage: errors > 0 ? `${errors} contatos com erro` : undefined,
  });
}

async function cleanupEmpty(): Promise<void> {
  const t0 = Date.now();
  console.log("[GHL standardize] === CLEANUP-EMPTY ===");

  const locationId = getLocationId();
  const allTags = await ghlListTags();
  console.log(`[GHL standardize] ${allTags.length} tags no GHL`);

  // Considera "vazia" se o snapshot mais recente tem 0 contatos OU se a tag
  // não aparece no snapshot (não foi vista no último sync). Snapshot é
  // atualizado pelo `runGhlDailyTagsSnapshot` via `npx tsx scripts/ghl-backfill.ts --resource=tags`.
  const snap = await db.execute<{ tag: string; contact_count: number }>(sql`
    SELECT tag, contact_count
    FROM cortex_core.ghl_tags_snapshot
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM cortex_core.ghl_tags_snapshot)
  `);
  const countByTag = new Map<string, number>();
  for (const r of (snap as any).rows) countByTag.set(r.tag, r.contact_count);

  let deleted = 0;
  let errors = 0;
  for (const tag of allTags) {
    const n = countByTag.get(tag.name) ?? 0;
    if (n > 0) continue;
    try {
      await ghlFetch(`/locations/${locationId}/tags/${tag.id}`, { method: "DELETE" });
      deleted++;
      console.log(`[GHL standardize] DELETED tag "${tag.name}" (id=${tag.id})`);
    } catch (err: any) {
      errors++;
      console.error(`[GHL standardize] erro deletando ${tag.name}: ${err.message}`);
    }
  }

  console.log(`\n[GHL standardize] cleanup: deleted=${deleted} errors=${errors}`);
  await logSyncRun({
    resource: "tags_cleanup_empty",
    startedAt: new Date(t0),
    finishedAt: new Date(),
    status: errors === 0 ? "success" : "partial",
    recordsProcessed: deleted,
    errorMessage: errors > 0 ? `${errors} tags com erro` : undefined,
  });
}

async function rollback(label: string): Promise<void> {
  const t0 = Date.now();
  console.log(`[GHL standardize] === ROLLBACK (label="${label}") ===`);

  const r = await db.execute<{ contact_id: string; tags: string[] }>(sql`
    SELECT DISTINCT ON (contact_id) contact_id, tags
    FROM cortex_core.ghl_contacts_tags_backup
    WHERE label = ${label}
    ORDER BY contact_id, backup_at DESC
  `);
  const backups = (r as any).rows as { contact_id: string; tags: string[] }[];
  console.log(`[GHL standardize] ${backups.length} contatos no backup`);

  let processed = 0;
  let errors = 0;

  for (const b of backups) {
    try {
      const cur = await db.execute<{ tags: string[] }>(sql`
        SELECT tags FROM cortex_core.ghl_contacts WHERE id = ${b.contact_id}
      `);
      const currentTags = ((cur as any).rows?.[0]?.tags as string[]) ?? [];
      const originalTags = b.tags;
      const add = originalTags.filter((t) => !currentTags.includes(t));
      const remove = currentTags.filter((t) => !originalTags.includes(t));

      if (add.length) {
        await ghlFetch(`/contacts/${b.contact_id}/tags`, {
          method: "POST",
          body: JSON.stringify({ tags: add }),
        });
      }
      if (remove.length) {
        await ghlFetch(`/contacts/${b.contact_id}/tags`, {
          method: "DELETE",
          body: JSON.stringify({ tags: remove }),
        });
      }
      await db.execute(sql`
        UPDATE cortex_core.ghl_contacts SET tags = ${originalTags}::text[] WHERE id = ${b.contact_id}
      `);
      processed++;
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`[GHL standardize] rollback processed=${processed} errors=${errors} elapsed=${elapsed}s`);
      }
    } catch (err: any) {
      errors++;
      console.error(`[GHL standardize] erro no rollback de ${b.contact_id}: ${err.message}`);
    }
  }

  console.log(`\n[GHL standardize] rollback FIM: processed=${processed} errors=${errors}`);
  await logSyncRun({
    resource: `tags_rollback:${label}`,
    startedAt: new Date(t0),
    finishedAt: new Date(),
    status: errors === 0 ? "success" : "partial",
    recordsProcessed: processed,
    errorMessage: errors > 0 ? `${errors} contatos com erro` : undefined,
  });
}

async function main() {
  const args = parseArgs();
  if (args.rollback) {
    const label = args.label;
    if (!label) {
      console.error("Erro: --rollback exige --label=<backup_label>");
      process.exit(1);
    }
    await rollback(label);
  } else if (args["cleanup-empty"]) {
    await cleanupEmpty();
  } else if (args.apply || args.only) {
    await applyMigration(args.only || null);
  } else {
    await dryRun();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[GHL standardize] Erro fatal:", err);
  process.exit(1);
});
