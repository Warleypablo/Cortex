/**
 * Cria a tabela meta_creation_drafts (Criação de Campanhas Meta Ads).
 *
 * Uso:
 *   npx tsx scripts/create-meta-creation-drafts-table.ts
 *
 * Idempotente: usa IF NOT EXISTS, então pode ser re-executado sem efeito.
 */

import "dotenv/config";
import { pool } from "../server/db";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_creation_drafts (
        id                  SERIAL PRIMARY KEY,
        user_email          VARCHAR(255) NOT NULL,
        ad_account_id       VARCHAR(50)  NOT NULL,
        status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
        briefing            JSONB        NOT NULL,
        drive_folder_url    TEXT,
        result              JSONB,
        error_message       TEXT,
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW(),
        executed_at         TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_creation_drafts_user
        ON meta_creation_drafts (user_email)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_creation_drafts_status
        ON meta_creation_drafts (status)
    `);

    await client.query("COMMIT");
    console.log("✅ Tabela meta_creation_drafts e índices garantidos.");
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
