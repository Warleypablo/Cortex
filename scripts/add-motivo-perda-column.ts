/**
 * Cria tabela sidecar cortex_core.deal_motivo_perda com o motivo de perda
 * de cada deal do Bitrix (UF_CRM_1753388460).
 *
 * O job scripts/sync-bitrix-motivo-perda.ts popula essa tabela, e growth.ts
 * faz LEFT JOIN por deal_id.
 *
 * Uso:
 *   npx tsx scripts/add-motivo-perda-column.ts
 *
 * Idempotente.
 */

import "dotenv/config";
import { pool } from "../server/db";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortex_core.deal_motivo_perda (
        deal_id      INTEGER PRIMARY KEY,
        motivo_perda TEXT,
        motivo_id    INTEGER,
        updated_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deal_motivo_perda
        ON cortex_core.deal_motivo_perda (motivo_perda)
    `);
    await client.query("COMMIT");
    console.log("✅ cortex_core.deal_motivo_perda garantida.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
