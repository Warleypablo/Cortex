import { config } from 'dotenv';
config({ path: '.env' });
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  const q = async (label: string, sql: string) => {
    try {
      const r = await pool.query(sql);
      console.log(`\n=== ${label} ===`);
      console.table(r.rows);
    } catch (e: any) {
      console.log(`\n=== ${label} ===\nERRO: ${e.message}`);
    }
  };

  await q('Colunas de campaigns', `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='google_ads' AND table_name='campaigns'
    ORDER BY ordinal_position
  `);

  await q('Total de contas', `SELECT COUNT(*) AS total FROM google_ads.accounts`);
  await q('Todas as contas', `SELECT customer_id, descriptive_name FROM google_ads.accounts ORDER BY descriptive_name`);

  await q('Tem alguma conta com nome "Turbo"?', `
    SELECT customer_id, descriptive_name
    FROM google_ads.accounts
    WHERE descriptive_name ILIKE '%turbo%' OR descriptive_name ILIKE '%partner%'
  `);

  await q('Range de datas em campaign_daily_metrics', `
    SELECT MIN(report_date) AS data_min,
           MAX(report_date) AS data_max,
           COUNT(*) AS total_linhas,
           ROUND(SUM(cost_micros)/1000000.0, 2) AS investimento_total_brl
    FROM google_ads.campaign_daily_metrics
  `);

  await q('Últimas 7 datas com dados', `
    SELECT report_date, COUNT(*) AS linhas, ROUND(SUM(cost_micros)/1000000.0,2) AS investimento
    FROM google_ads.campaign_daily_metrics
    GROUP BY report_date
    ORDER BY report_date DESC
    LIMIT 7
  `);

  await pool.end();
}
main().catch(console.error);
