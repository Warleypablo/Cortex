import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST,
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
  database: process.env.DATABASE_NAME || process.env.DB_NAME,
  user: process.env.DATABASE_USER || process.env.DB_USER,
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const sql = readFileSync(join(__dirname, 'add-video-3sec-thruplay-columns.sql'), 'utf-8');
  console.log('[migration] Running add-video-3sec-thruplay-columns.sql...');
  await pool.query(sql);

  const check = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='meta_ads'
      AND table_name IN ('meta_insights_daily','meta_insights_by_platform_daily')
      AND column_name IN ('video_3_sec_watched_actions','video_thruplay_watched_actions')
    ORDER BY table_name, column_name`);

  console.log('[migration] Columns now present:');
  check.rows.forEach(r => console.log(` - ${r.table_name}.${r.column_name} (${r.data_type})`));

  await pool.end();
})().catch(e => { console.error('[migration] FAILED:', e.message); process.exit(1); });
