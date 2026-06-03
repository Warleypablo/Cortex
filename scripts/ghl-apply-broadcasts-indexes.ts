/**
 * Aplica a migration de índices auxiliares para a query de broadcasts
 * (aba Biblioteca em /ghl-marketing).
 *
 * Idempotente — todos os CREATE INDEX usam IF NOT EXISTS.
 *
 * Uso:
 *   DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/ghl-apply-broadcasts-indexes.ts
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  const sql = readFileSync(
    join(process.cwd(), 'migrations', '2026-05-23-ghl-broadcasts-indexes.sql'),
    'utf8',
  );
  console.log('Aplicando índices de broadcasts em cortex_core.ghl_*...');
  await pool.query(sql);
  console.log('OK');

  const idx = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'cortex_core'
      AND indexname IN (
        'ghl_messages_contact_dir_date_idx',
        'ghl_messages_outbound_marketing_idx',
        'ghl_email_events_campaign_type_idx'
      )
    ORDER BY indexname
  `);
  console.log(`Índices presentes (${idx.rows.length}/3):`);
  for (const row of idx.rows) console.log(`  - ${row.indexname}`);
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
