import { config } from 'dotenv';
config({ path: '.env' });
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int as total FROM meta_ads.meta_insights_by_platform_daily`);
    console.log('meta_insights_by_platform_daily linhas:', r.rows[0].total);
  } catch (e: any) {
    console.log('meta_insights_by_platform_daily:', e.message);
  }
  await pool.end();
}
main();
