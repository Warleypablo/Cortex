import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function print(title: string, rows: any[]) {
  console.log(`\n=== ${title} ===`);
  if (rows.length === 0) {
    console.log('(sem resultados)');
    return;
  }
  console.table(rows);
}

async function main() {
  const conns = await pool.query(`
    SELECT id, cliente_cnpj, username, account_type, is_active,
           created_at::date as created, updated_at::date as updated
    FROM cortex_core.instagram_connections
    ORDER BY is_active DESC, updated_at DESC
  `);
  print('1a. Conexões Instagram', conns.rows);

  const quality = await pool.query(`
    SELECT
      connection_id,
      COUNT(*) as total,
      MIN(metric_date)::text as primeiro,
      MAX(metric_date)::text as ultimo,
      SUM(CASE WHEN impressions_day IS NULL OR impressions_day = 0 THEN 1 ELSE 0 END) as dias_sem_impressions,
      SUM(CASE WHEN reach_day IS NULL OR reach_day = 0 THEN 1 ELSE 0 END) as dias_sem_reach,
      SUM(CASE WHEN total_interactions IS NULL OR total_interactions = 0 THEN 1 ELSE 0 END) as dias_sem_interactions,
      SUM(CASE WHEN profile_views IS NULL OR profile_views = 0 THEN 1 ELSE 0 END) as dias_sem_profile_views,
      SUM(CASE WHEN accounts_engaged IS NULL OR accounts_engaged = 0 THEN 1 ELSE 0 END) as dias_sem_accounts_engaged,
      SUM(CASE WHEN profile_links_taps IS NULL OR profile_links_taps = 0 THEN 1 ELSE 0 END) as dias_sem_link_taps,
      SUM(CASE WHEN follows_day IS NULL OR follows_day = 0 THEN 1 ELSE 0 END) as dias_follows_zerado
    FROM cortex_core.instagram_metrics_snapshots
    WHERE metric_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY connection_id
    ORDER BY connection_id
  `);
  print('1b. Qualidade dos snapshots (90 dias)', quality.rows);

  const start = '2026-03-01';
  const end = '2026-03-31';
  const agg = await pool.query(`
    WITH snaps AS (
      SELECT * FROM cortex_core.instagram_metrics_snapshots
      WHERE connection_id IN (SELECT id FROM cortex_core.instagram_connections WHERE is_active = true)
        AND metric_date BETWEEN $1::date AND $2::date
    )
    SELECT
      COUNT(*) as n_snaps,
      COUNT(DISTINCT connection_id) as n_contas,
      COUNT(DISTINCT metric_date) as n_dias,
      COALESCE(SUM(impressions_day), 0) as visualizacoes_totais,
      COALESCE(SUM(reach_day), 0) as alcance_total,
      COALESCE(SUM(COALESCE(profile_views, accounts_engaged, 0)), 0) as visitas_perfil,
      COALESCE(SUM(COALESCE(profile_links_taps, website_clicks, 0)), 0) as cliques_link_bio,
      COALESCE(SUM(total_interactions), 0) as interacoes,
      COALESCE(SUM(CASE WHEN follows_day > 0 THEN follows_day ELSE 0 END), 0) as comecaram,
      COALESCE(SUM(CASE WHEN follows_day < 0 THEN -follows_day ELSE 0 END), 0) as deixaram,
      (SELECT followers FROM snaps ORDER BY metric_date ASC, connection_id ASC LIMIT 1) as first_followers,
      (SELECT followers FROM snaps ORDER BY metric_date DESC, connection_id DESC LIMIT 1) as last_followers,
      (SELECT SUM(followers) FROM snaps WHERE metric_date = (SELECT MAX(metric_date) FROM snaps)) as sum_followers_last_date
    FROM snaps
  `, [start, end]);
  print(`2. Agregação replicando endpoint — ${start} a ${end}`, agg.rows);

  // Per connection breakdown for same period
  const perConn = await pool.query(`
    SELECT connection_id,
           COUNT(*) as n_dias,
           MIN(metric_date)::text as primeiro,
           MAX(metric_date)::text as ultimo,
           COALESCE(SUM(impressions_day), 0) as sum_impressions,
           COALESCE(SUM(reach_day), 0) as sum_reach,
           COALESCE(SUM(total_interactions), 0) as sum_interactions,
           MIN(followers) as min_followers,
           MAX(followers) as max_followers
    FROM cortex_core.instagram_metrics_snapshots
    WHERE metric_date BETWEEN $1::date AND $2::date
    GROUP BY connection_id
    ORDER BY connection_id
  `, [start, end]);
  print(`2b. Breakdown por conexão — ${start} a ${end}`, perConn.rows);

  try {
    const paid = await pool.query(`
      SELECT COALESCE(SUM(impressions), 0) as impressoes_pagas,
             COALESCE(SUM(reach), 0) as alcance_pago,
             COALESCE(SUM(spend), 0) as investimento_pago
      FROM meta_ads.meta_insights_by_platform_daily
      WHERE date_start BETWEEN $1::date AND $2::date
        AND publisher_platform = 'instagram'
    `, [start, end]);
    print(`2c. Meta Ads pagos (Instagram) — ${start} a ${end}`, paid.rows);
  } catch (e: any) {
    console.log('\n(meta_ads.meta_insights_by_platform_daily não disponível:', e.message, ')');
  }

  const sample = await pool.query(`
    SELECT connection_id, metric_date::text, followers,
           impressions_day, reach_day, total_interactions,
           profile_views, accounts_engaged, profile_links_taps,
           follows_day
    FROM cortex_core.instagram_metrics_snapshots
    WHERE metric_date >= CURRENT_DATE - INTERVAL '15 days'
    ORDER BY connection_id, metric_date DESC
    LIMIT 40
  `);
  print('3. Amostra: últimos 15 dias por conexão', sample.rows);

  await pool.end();
}

main().catch((err) => {
  console.error('Erro:', err);
  pool.end().finally(() => process.exit(1));
});
