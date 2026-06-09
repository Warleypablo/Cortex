import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const log = (title: string, rows: any[]) => {
    console.log(`\n=== ${title} ===`);
    if (rows.length === 0) { console.log('(no rows)'); return; }
    console.table(rows);
  };

  try {
    const conn = await pool.query(`
      SELECT id, ig_user_id, username, is_active, token_expires_at
      FROM cortex_core.instagram_connections
      WHERE is_active = true
    `);
    log('1) Conexões Instagram ativas', conn.rows);

    const snaps = await pool.query(`
      SELECT metric_date, followers, reach_day, impressions_day,
             follows_day, total_interactions,
             COALESCE(profile_links_taps, 0) AS profile_links_taps,
             COALESCE(accounts_engaged, 0) AS accounts_engaged
      FROM cortex_core.instagram_metrics_snapshots
      WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY metric_date DESC
      LIMIT 15
    `);
    log('2) Últimos snapshots IG (30d)', snaps.rows);

    const snapCount = await pool.query(`
      SELECT COUNT(*)::int AS total,
             MIN(metric_date) AS earliest,
             MAX(metric_date) AS latest
      FROM cortex_core.instagram_metrics_snapshots
    `);
    log('2b) Total snapshots IG (histórico completo)', snapCount.rows);

    const meta = await pool.query(`
      SELECT date_start::text AS date_start,
             COUNT(*)::int AS rows,
             SUM(impressions)::int AS impressions,
             SUM(reach)::int AS reach,
             ROUND(SUM(spend)::numeric, 2) AS spend
      FROM meta_ads.meta_insights_daily
      WHERE date_start >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date_start
      ORDER BY date_start DESC
      LIMIT 15
    `);
    log('3) Meta Ads últimos 30d (total agregado)', meta.rows);

    const metaCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'meta_ads' AND table_name = 'meta_insights_daily'
      ORDER BY ordinal_position
    `);
    log('3b) Colunas de meta_insights_daily', metaCols.rows);

    const bitrix = await pool.query(`
      SELECT
        COUNT(*)::int AS leads,
        SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END)::int AS mqls,
        SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END)::int AS vendas
      FROM "Bitrix".crm_deal
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND LOWER(COALESCE(utm_source, '')) LIKE '%instagram%'
    `);
    log('4) Bitrix leads com utm_source LIKE %instagram% (30d)', bitrix.rows);

    const bitrixSources = await pool.query(`
      SELECT utm_source, COUNT(*)::int AS n
      FROM "Bitrix".crm_deal
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND utm_source IS NOT NULL AND utm_source <> ''
      GROUP BY utm_source
      ORDER BY n DESC
      LIMIT 20
    `);
    log('4b) Top utm_sources no Bitrix (30d)', bitrixSources.rows);

    const byPlatformExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'meta_ads' AND table_name = 'meta_insights_by_platform_daily'
      ) AS exists
    `);
    log('5) Tabela meta_insights_by_platform_daily já existe?', byPlatformExists.rows);
  } catch (e: any) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
