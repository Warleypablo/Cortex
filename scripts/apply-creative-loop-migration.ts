/**
 * Aplica a migração do Loop de Inteligência de Criativos (aditiva, idempotente).
 * Uso: npx tsx scripts/apply-creative-loop-migration.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "../server/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sqlPath = path.join(__dirname, "..", "migrations", "2026-06-18-creative-intelligence-loop.sql");
  const sqlText = readFileSync(sqlPath, "utf8");

  console.log("[migration] aplicando", path.basename(sqlPath));
  await pool.query(sqlText);

  const check = await pool.query(`
    SELECT
      (SELECT count(*) FROM information_schema.tables
        WHERE table_schema='cortex_core'
          AND table_name IN ('creative_batches','creative_ad_links','creative_vocab'))::int AS tabelas_novas,
      (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='cortex_core' AND table_name='creatives_library'
          AND column_name IN ('body_tipo','cta_tipo','roteiro_url','clickup_task_id','drive_folder_id'))::int AS colunas_novas,
      (SELECT count(*) FROM cortex_core.creative_vocab)::int AS vocab_seed,
      (SELECT count(*) FROM cortex_core.creative_vocab WHERE kind='angulo')::int AS angulos
  `);
  console.log("[migration] OK:", check.rows[0]);
  await pool.end();
}

main().catch((e) => {
  console.error("[migration] FALHOU:", e);
  process.exit(1);
});
