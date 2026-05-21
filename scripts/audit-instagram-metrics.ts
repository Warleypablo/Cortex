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

const TURBO_PARTNERS_ACCOUNT_ID = 'act_1331413260627780';

function arg(name: string, fallback?: string): string | undefined {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  return found ? found.slice(flag.length) : fallback;
}

function print(title: string, rows: any[]) {
  console.log(`\n=== ${title} ===`);
  if (!rows || rows.length === 0) { console.log('(sem resultados)'); return; }
  console.table(rows);
}

function fmtNumber(n: any): string {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-BR');
}

function fmtMoney(n: any): string {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function main() {
  const startDate = arg('start') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDate = arg('end') || new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  console.log(`\n📊 Auditoria de métricas Instagram — ${startDate} → ${endDate}`);
  console.log(`   Conta Meta Ads auditada: ${TURBO_PARTNERS_ACCOUNT_ID}\n`);

  // ─────────────────────────────────────────────────────────────
  // 1) META ADS — gasto pago por publisher_platform (Instagram)
  // ─────────────────────────────────────────────────────────────
  const adsByPlatform = await pool.query(
    `
    SELECT
      publisher_platform,
      COALESCE(SUM(spend), 0)::numeric(14,2) as spend,
      COALESCE(SUM(impressions), 0)::bigint as impressions,
      COALESCE(SUM(reach), 0)::bigint as reach_sum_daily,
      COALESCE(SUM(clicks), 0)::bigint as clicks
    FROM meta_ads.meta_insights_by_platform_daily
    WHERE date_start >= $1::date AND date_start <= $2::date
      AND account_id = $3
    GROUP BY publisher_platform
    ORDER BY spend DESC
    `,
    [startDate, endDate, TURBO_PARTNERS_ACCOUNT_ID]
  );
  print('1) Meta Ads — gasto/impressões/alcance por publisher_platform', adsByPlatform.rows.map((r: any) => ({
    plataforma: r.publisher_platform,
    investimento: fmtMoney(r.spend),
    impressoes: fmtNumber(r.impressions),
    'alcance (Σ diário)': fmtNumber(r.reach_sum_daily),
    cliques: fmtNumber(r.clicks),
  })));
  console.log('  ⚠️  Observação: "alcance (Σ diário)" é a soma de reach diário — NÃO é o alcance único do período (essa métrica é deduplicada).');
  console.log('  📋 Compare "investimento", "impressões" e "cliques" do Instagram com o Gerenciador da Meta filtrado por Plataforma de Publicação = Instagram.');

  // ─────────────────────────────────────────────────────────────
  // 2) INSTAGRAM INSIGHTS — métricas orgânicas (snapshots)
  // ─────────────────────────────────────────────────────────────
  const igConnections = await pool.query(
    `SELECT id, ig_username FROM cortex_core.instagram_connections WHERE is_active = true`
  );
  print('2a) Conexões Instagram ativas', igConnections.rows);

  if (igConnections.rows.length === 0) {
    console.log('   Nenhuma conexão IG ativa. Pulando análise orgânica.');
  } else {
    const connIds = igConnections.rows.map((r: any) => r.id);
    const igAgg = await pool.query(
      `
      SELECT
        COUNT(*) as snapshots,
        MIN(metric_date) as first_date,
        MAX(metric_date) as last_date,
        SUM(impressions_day) as impressions_day_sum,
        SUM(reach_day) as reach_day_sum_daily,
        SUM(profile_views) as profile_views_sum,
        SUM(profile_links_taps) as profile_links_taps_sum,
        SUM(website_clicks) as website_clicks_sum,
        SUM(accounts_engaged) as accounts_engaged_sum,
        SUM(total_interactions) as total_interactions_sum,
        SUM(follows_day) as follows_day_net
      FROM cortex_core.instagram_metrics_snapshots
      WHERE connection_id = ANY($1::uuid[])
        AND metric_date >= $2::date AND metric_date <= $3::date
      `,
      [connIds, startDate, endDate]
    );
    print('2b) Instagram Insights — agregados do período (snapshots diários)', igAgg.rows.map((r: any) => ({
      'snapshots gravados': r.snapshots,
      'janela coberta': `${r.first_date} → ${r.last_date}`,
      'impressões (Σ day)': fmtNumber(r.impressions_day_sum),
      'alcance (Σ day) ⚠️': fmtNumber(r.reach_day_sum_daily),
      'profile_views (Σ)': fmtNumber(r.profile_views_sum),
      'profile_links_taps (Σ)': fmtNumber(r.profile_links_taps_sum),
      'website_clicks (Σ)': fmtNumber(r.website_clicks_sum),
      'accounts_engaged (Σ)': fmtNumber(r.accounts_engaged_sum),
      'total_interactions (Σ)': fmtNumber(r.total_interactions_sum),
      'follows_day (saldo líquido)': fmtNumber(r.follows_day_net),
    })));
    console.log('  ⚠️  ALCANCE somado dia-a-dia é INFLADO (mesma pessoa pode ser contada N vezes). O Insights nativo do Instagram retorna alcance único do período, não a soma.');
    console.log('  ⚠️  profile_views foi descontinuado na IG API v22+. Se vier 0, o card "Visitas ao Perfil" cai no fallback accounts_engaged (que NÃO é equivalente).');

    // Seguidores início/fim
    const followers = await pool.query(
      `
      SELECT
        (SELECT followers FROM cortex_core.instagram_metrics_snapshots
         WHERE connection_id = ANY($1::uuid[]) AND metric_date >= $2::date
         ORDER BY metric_date ASC LIMIT 1) as primeiro_dia,
        (SELECT followers FROM cortex_core.instagram_metrics_snapshots
         WHERE connection_id = ANY($1::uuid[]) AND metric_date <= $3::date
         ORDER BY metric_date DESC LIMIT 1) as ultimo_dia
      `,
      [connIds, startDate, endDate]
    );
    const f = followers.rows[0];
    const delta = (Number(f.ultimo_dia) || 0) - (Number(f.primeiro_dia) || 0);
    print('2c) Seguidores início vs fim do período', [{
      'seguidores no início': fmtNumber(f.primeiro_dia),
      'seguidores no fim': fmtNumber(f.ultimo_dia),
      'delta': fmtNumber(delta),
    }]);
  }

  // ─────────────────────────────────────────────────────────────
  // 3) BITRIX CRM — leads por utm_source (atribuição da plataforma)
  // ─────────────────────────────────────────────────────────────
  const sourceFilter = `source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')`;

  const utmDistribution = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), '(vazio)') as utm_source,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter}
    GROUP BY 1
    ORDER BY leads DESC
    LIMIT 25
    `,
    [startDate, endDate]
  );
  print('3a) Distribuição de leads por utm_source (top 25, com filtro source allowlist)', utmDistribution.rows.map((r: any) => ({
    utm_source: r.utm_source,
    leads: fmtNumber(r.leads),
  })));

  // Leads classificados pela MESMA regra do endpoint funnel-by-platform
  const platformBreakdown = await pool.query(
    `
    WITH classified AS (
      SELECT
        CASE
          WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig' THEN 'instagram'
          WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin%' THEN 'linkedin'
          WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%youtube%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'yt' THEN 'youtube'
          WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%meta%' THEN 'meta_ads'
          WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%google%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%gads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%adwords%' THEN 'google_ads'
          ELSE 'outros'
        END as platform
      FROM "Bitrix".crm_deal
      WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
        AND ${sourceFilter}
    )
    SELECT platform, COUNT(*) as leads
    FROM classified
    GROUP BY platform
    ORDER BY leads DESC
    `,
    [startDate, endDate]
  );
  print('3b) Leads agrupados pela regra do endpoint funnel-by-platform', platformBreakdown.rows.map((r: any) => ({
    plataforma: r.platform,
    leads: fmtNumber(r.leads),
  })));

  // Leads que combinam IG no utm_medium/utm_campaign mas não no utm_source
  const igHidden = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), '(vazio)') as utm_source,
      COALESCE(NULLIF(LOWER(TRIM(utm_medium)), ''), '(vazio)') as utm_medium,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter}
      AND (
        LOWER(COALESCE(utm_medium, '')) LIKE '%instagram%' OR LOWER(COALESCE(utm_medium, '')) = 'ig' OR
        LOWER(COALESCE(utm_campaign, '')) LIKE '%instagram%' OR LOWER(COALESCE(utm_campaign, '')) = 'ig'
      )
      AND NOT (
        LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig'
      )
    GROUP BY 1, 2
    ORDER BY leads DESC
    LIMIT 15
    `,
    [startDate, endDate]
  );
  print('3c) Leads com sinal de IG em utm_medium/utm_campaign mas NÃO em utm_source (hoje vão pra outras plataformas)', igHidden.rows.map((r: any) => ({
    utm_source: r.utm_source,
    utm_medium: r.utm_medium,
    leads: fmtNumber(r.leads),
  })));

  // Leads sem o filtro de source allowlist — ver se algo está sendo descartado
  const igWithoutSourceFilter = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(source, ''), '(vazio)') as source,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
      AND (
        LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig'
      )
    GROUP BY 1
    ORDER BY leads DESC
    `,
    [startDate, endDate]
  );
  print('3d) Leads com utm_source ~ Instagram, AGRUPADOS POR source (mostra se algum está fora da allowlist)', igWithoutSourceFilter.rows.map((r: any) => ({
    source: r.source,
    leads: fmtNumber(r.leads),
    'incluso na allowlist?': ['CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM'].includes(r.source) ? 'sim' : '⚠️ NÃO — descartado pelo endpoint',
  })));

  // ─────────────────────────────────────────────────────────────
  // 4) RESUMO — o que o dashboard "Orçado x Realizado" mostra hoje
  // ─────────────────────────────────────────────────────────────
  const igRow = adsByPlatform.rows.find((r: any) => r.publisher_platform === 'instagram');
  const igLeadsRow = platformBreakdown.rows.find((r: any) => r.platform === 'instagram');
  const dashGasto = igRow ? Number(igRow.spend) : 0;
  const dashLeads = igLeadsRow ? Number(igLeadsRow.leads) : 0;
  const dashCpl = dashLeads > 0 ? dashGasto / dashLeads : null;

  console.log('\n=== 4) Como o dashboard exibe HOJE (Orçado x Realizado → Instagram) ===');
  console.log(`   Investimento Pago IG (= SUM spend onde publisher_platform='instagram'): ${fmtMoney(dashGasto)}`);
  console.log(`   Leads IG (= COUNT(*) onde utm_source ~ 'instagram'):                    ${fmtNumber(dashLeads)}`);
  console.log(`   CPL IG (= investimento / leads):                                        ${dashCpl ? fmtMoney(dashCpl) : 'n/d'}`);
  console.log('\n   👉 Compare cada linha acima com:');
  console.log('      • Gerenciador de Anúncios Meta filtrado por Plataforma=Instagram (investimento, impressões, alcance, CPM, CTR, resultados)');
  console.log('      • Insights nativos do Instagram (alcance, impressões, visitas ao perfil, cliques no link da bio, seguidores)');
  console.log('   Anote a divergência %, isso direciona qual ajuste aplicar (ver plano).\n');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
