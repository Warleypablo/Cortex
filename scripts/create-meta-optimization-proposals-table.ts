/**
 * Cria a tabela meta_optimization_proposals (Otimização de Ads).
 *
 * Uso:
 *   npx tsx scripts/create-meta-optimization-proposals-table.ts
 *
 * Idempotente: usa IF NOT EXISTS, então pode ser re-executado sem efeito.
 * Não modifica nenhuma outra tabela.
 */

import "dotenv/config";
import { pool } from "../server/db";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_optimization_proposals (
        id                       SERIAL PRIMARY KEY,
        batch_id                 VARCHAR(50) NOT NULL,
        proposed_entity_type     VARCHAR(20) NOT NULL,
        proposed_entity_id       VARCHAR(50) NOT NULL,
        proposed_entity_name     VARCHAR(255),
        proposed_action          VARCHAR(30) NOT NULL,
        final_entity_type        VARCHAR(20),
        final_entity_id          VARCHAR(50),
        final_entity_name        VARCHAR(255),
        final_action             VARCHAR(30),
        produto                  VARCHAR(50),
        reason                   TEXT NOT NULL,
        current_metrics          JSONB NOT NULL,
        playbook_rule            VARCHAR(100),
        status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at               TIMESTAMP DEFAULT NOW(),
        reviewed_by              VARCHAR(255),
        reviewed_at              TIMESTAMP,
        edit_notes               TEXT,
        executed_at              TIMESTAMP,
        execution_error          TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_optimization_proposals_batch
        ON meta_optimization_proposals (batch_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_optimization_proposals_status
        ON meta_optimization_proposals (status)
    `);

    await client.query("COMMIT");
    console.log("✅ Tabela meta_optimization_proposals e índices garantidos.");
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
