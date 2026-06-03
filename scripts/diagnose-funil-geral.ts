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
  // 1) Distribuição de fnl_ngc no geral (últimos 90 dias) - para confirmar que "Geral" existe
  const distinctFunis = await pool.query(`
    SELECT
      COALESCE(NULLIF(fnl_ngc, ''), '(Vazio)') as fnl_ngc,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 30
  `);
  print('Distribuição de fnl_ngc (últimos 90 dias)', distinctFunis.rows);

  // 2) Sources dos deals com fnl_ngc = 'Geral'
  const sourcesGeral = await pool.query(`
    SELECT
      COALESCE(NULLIF(source, ''), '(Vazio)') as source,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1
    ORDER BY total DESC
  `);
  print('SOURCE dos deals com fnl_ngc = "Geral" (últimos 90 dias)', sourcesGeral.rows);

  // 3) UTM source dos deals com fnl_ngc = 'Geral'
  const utmSourcesGeral = await pool.query(`
    SELECT
      COALESCE(NULLIF(utm_source, ''), '(Vazio)') as utm_source,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 30
  `);
  print('UTM_SOURCE dos deals com fnl_ngc = "Geral" (últimos 90 dias)', utmSourcesGeral.rows);

  // 4) UTM source + campaign + content combinados
  const utmCombo = await pool.query(`
    SELECT
      COALESCE(NULLIF(utm_source, ''), '(Vazio)') as utm_source,
      COALESCE(NULLIF(utm_campaign, ''), '(Vazio)') as utm_campaign,
      COALESCE(NULLIF(utm_content, ''), '(Vazio)') as utm_content,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1,2,3
    ORDER BY total DESC
    LIMIT 25
  `);
  print('UTM source/campaign/content dos deals "Geral" (últimos 90 dias)', utmCombo.rows);

  // 5) Source + MQL flag combinados (porque a aba Orçado x Realizado filtra MQLs e source IN inbound)
  const inboundMqlGeral = await pool.query(`
    SELECT
      COALESCE(NULLIF(source, ''), '(Vazio)') as source,
      COALESCE(NULLIF(utm_source, ''), '(Vazio)') as utm_source,
      COUNT(*) FILTER (WHERE mql::text = '1' OR LOWER(mql::text) = 'true') as mql_count,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
      AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
    GROUP BY 1,2
    ORDER BY total DESC
    LIMIT 30
  `);
  print('Source + UTM_source dos MQLs INBOUND "Geral" (últimos 90 dias)', inboundMqlGeral.rows);

  // 6) Amostra de deals concretos para inspeção
  const amostra = await pool.query(`
    SELECT
      id, title, source, utm_source, utm_campaign, utm_content,
      mql, stage_name, created_at::date as criado
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND created_at >= (CURRENT_DATE - INTERVAL '30 days')
    ORDER BY created_at DESC
    LIMIT 15
  `);
  print('Amostra de deals "Geral" (últimos 30 dias)', amostra.rows);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
