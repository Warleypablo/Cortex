/**
 * Backfill do campo video_thruplay_watched_actions em meta_ads.meta_insights_daily
 * (e meta_insights_by_platform_daily). Reaproveita o sync para repopular
 * video_play_actions (base da Video Hook) também em janelas históricas que estavam zeradas.
 *
 * Usa o serviço syncMetaAds existente. Assume schema/tables já existem
 * (não tenta CREATE SCHEMA — evita problema de permissão).
 *
 * Uso:
 *   npx tsx scripts/backfill-meta-video-fields.ts <since> <until>
 *   ex: npx tsx scripts/backfill-meta-video-fields.ts 2026-05-04 2026-05-11
 */

import { Pool } from 'pg';
import 'dotenv/config';
import { syncMetaAds } from '../server/services/metaAdsSync';

const pool = new Pool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST,
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
  database: process.env.DATABASE_NAME || process.env.DB_NAME,
  user: process.env.DATABASE_USER || process.env.DB_USER,
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const since = process.argv[2];
  const until = process.argv[3];
  if (!since || !until) {
    console.error('Uso: tsx scripts/backfill-meta-video-fields.ts <YYYY-MM-DD> <YYYY-MM-DD>');
    process.exit(1);
  }

  console.log(`[backfill] Sync ${since} → ${until}`);
  const t0 = Date.now();

  try {
    const result = await syncMetaAds(pool, { since, until });
    console.log('\n=== Summary ===');
    console.log(`Insights:           ${result.insights}`);
    console.log(`ByPlatformInsights: ${result.byPlatformInsights}`);
    console.log(`Duration:           ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (result.errors.length) {
      console.log('\nErrors:');
      result.errors.forEach(e => console.log('  -', e));
    }

    const check = await pool.query(`
      SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE video_play_actions > 0)             AS w_plays,
        COUNT(*) FILTER (WHERE video_thruplay_watched_actions > 0) AS w_thru,
        SUM(video_play_actions)             AS sum_plays,
        SUM(video_thruplay_watched_actions) AS sum_thru,
        SUM(impressions)                    AS sum_imps
      FROM meta_ads.meta_insights_daily
      WHERE date_start BETWEEN $1::date AND $2::date
    `, [since, until]);
    console.log('\nCoverage in window:');
    console.log(' ', check.rows[0]);
  } catch (e: any) {
    console.error('Backfill failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
