/**
 * Reprocessa a coluna `base` de cortex_core.broadcast_classification usando a
 * lógica atual de inferirBase (base mais específica por cobertura), SEM re-rodar
 * a classificação de padrão por IA (que custa API).
 *
 * Necessário porque enrichBroadcasts pula disparos já classificados — a correção
 * do inferirBase (deixar de sempre cair na "- Todos") só vale pra registros novos
 * até rodar este backfill nos antigos.
 *
 * Uso:
 *   DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/reclassify-broadcast-bases.ts          # dry-run (só mostra o que mudaria)
 *   DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/reclassify-broadcast-bases.ts --apply   # grava
 */

import { pool } from "../server/db";
import { inferirBase } from "../server/services/broadcastClassifier";

const APPLY = process.argv.includes("--apply");

async function main() {
  const { rows } = await pool.query(
    `SELECT broadcast_id, base FROM cortex_core.broadcast_classification ORDER BY broadcast_id`,
  );
  console.log(`${rows.length} disparos classificados. Modo: ${APPLY ? "APLICAR" : "DRY-RUN"}\n`);

  let changed = 0;
  const antes: Record<string, number> = {};
  const depois: Record<string, number> = {};
  const tally = (m: Record<string, number>, k: string | null) => { const key = k ?? "(null)"; m[key] = (m[key] ?? 0) + 1; };

  for (const { broadcast_id, base: baseAntes } of rows as { broadcast_id: string; base: string | null }[]) {
    const m = broadcast_id.match(/^wa-(\d{8})-(.+)-([0-9a-f]{8})$/);
    tally(antes, baseAntes);
    if (!m) { tally(depois, baseAntes); continue; } // formato inesperado: mantém
    const [, ymd, source, hash8] = m;
    const day = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

    const tagsRes = await pool.query(
      `SELECT c.tags FROM cortex_core.ghl_messages msg
       JOIN cortex_core.ghl_contacts c ON c.id = msg.contact_id
       WHERE msg.direction = 'outbound' AND msg.source = $1
         AND DATE_TRUNC('day', msg.date_added) = $2::date
         AND SUBSTR(MD5(COALESCE(msg.body, '')), 1, 8) = $3`,
      [source, day, hash8],
    );
    const recipientTags = (tagsRes.rows ?? []).map((r: any) => r.tags as string[] | null);
    const { base, matchPct } = inferirBase(recipientTags);
    tally(depois, base);

    if (base !== baseAntes) {
      changed++;
      console.log(`  ${broadcast_id}  ${baseAntes ?? "(null)"}  →  ${base ?? "(null)"}  (${(matchPct * 100).toFixed(0)}%)`);
      if (APPLY) {
        await pool.query(
          `UPDATE cortex_core.broadcast_classification SET base = $2, base_match_pct = $3 WHERE broadcast_id = $1`,
          [broadcast_id, base, matchPct],
        );
      }
    }
  }

  const dist = (m: Record<string, number>) =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `    ${k}: ${v}`).join("\n");
  console.log(`\n== Distribuição ANTES ==\n${dist(antes)}`);
  console.log(`\n== Distribuição ${APPLY ? "DEPOIS (gravado)" : "DEPOIS (simulado)"} ==\n${dist(depois)}`);
  console.log(`\n${changed} disparos ${APPLY ? "atualizados" : "mudariam"}.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
