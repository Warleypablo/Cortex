/**
 * Cria tabela sidecar cortex_core.meta_insights_video_extras com as métricas
 * que o sync principal não traz: video_3_sec_watched_actions e
 * video_thruplay_watched_actions.
 *
 * O sync (server/services/metaAdsSync.ts) faz UPSERT aqui para cada linha
 * de insights, e growth.ts faz LEFT JOIN por (account_id, ad_id, date_start).
 *
 * Uso:
 *   npx tsx scripts/add-video-3sec-thruplay-columns.ts
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
      CREATE TABLE IF NOT EXISTS cortex_core.meta_insights_video_extras (
        account_id  VARCHAR(50) NOT NULL,
        ad_id       VARCHAR(50) NOT NULL,
        date_start  DATE NOT NULL,
        video_3_sec_watched_actions     INTEGER,
        video_thruplay_watched_actions  INTEGER,
        updated_at  TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (account_id, ad_id, date_start)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_extras_ad_date
        ON cortex_core.meta_insights_video_extras (ad_id, date_start)
    `);
    await client.query("COMMIT");
    console.log("✅ cortex_core.meta_insights_video_extras garantida.");
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
