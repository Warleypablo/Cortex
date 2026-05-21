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
  if (rows.length === 0) { console.log('(sem resultados)'); return; }
  console.table(rows);
}

async function main() {
  const sources = await pool.query(`
    SELECT COALESCE(NULLIF(utm_source, ''), '(vazio)') as utm_source, COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '90 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  `);
  print('1. Top utm_source (últimos 90 dias)', sources.rows);

  const cov = await pool.query(`
    SELECT
      COUNT(*) as total_deals,
      COUNT(NULLIF(utm_source, ''))   as com_source,
      COUNT(NULLIF(utm_campaign, '')) as com_campaign,
      COUNT(NULLIF(utm_content, ''))  as com_content,
      COUNT(NULLIF(utm_term, ''))     as com_term
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '90 days'
  `);
  print('3. Cobertura UTMs (últimos 90 dias) — utm_medium NÃO existe nessa tabela', cov.rows);

  const camp = await pool.query(`
    SELECT
      CASE
        WHEN utm_campaign ~ '^[0-9]{10,}$' THEN 'ID numérico (Meta)'
        WHEN utm_campaign LIKE '{{%' THEN 'placeholder não substituído'
        WHEN utm_campaign IS NULL OR utm_campaign = '' THEN '(vazio)'
        ELSE 'texto/slug'
      END as formato,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '90 days'
    GROUP BY 1 ORDER BY 2 DESC
  `);
  print('4. Padrão de utm_campaign', camp.rows);

  const cont = await pool.query(`
    SELECT
      CASE
        WHEN utm_content ~ '^[0-9]{10,}$' THEN 'ID numérico (Meta)'
        WHEN utm_content LIKE '{{%' THEN 'placeholder não substituído'
        WHEN utm_content IS NULL OR utm_content = '' THEN '(vazio)'
        ELSE 'texto/slug'
      END as formato,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '90 days'
    GROUP BY 1 ORDER BY 2 DESC
  `);
  print('5. Padrão de utm_content', cont.rows);

  const term = await pool.query(`
    SELECT
      CASE
        WHEN utm_term ~ '^[0-9]{10,}$' THEN 'ID numérico (Meta)'
        WHEN utm_term LIKE '{{%' THEN 'placeholder não substituído'
        WHEN utm_term IS NULL OR utm_term = '' THEN '(vazio)'
        ELSE 'texto/slug'
      END as formato,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '90 days'
    GROUP BY 1 ORDER BY 2 DESC
  `);
  print('6. Padrão de utm_term', term.rows);

  const samples = await pool.query(`
    SELECT utm_source, utm_campaign, utm_content, utm_term, date_create::date
    FROM "Bitrix".crm_deal
    WHERE utm_source = 'facebook' AND date_create >= NOW() - INTERVAL '30 days'
    ORDER BY date_create DESC LIMIT 5
  `);
  print('7. Amostra de leads com utm_source=facebook', samples.rows);

  const others = await pool.query(`
    SELECT utm_source, utm_campaign, COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '30 days'
      AND utm_source NOT IN ('facebook', 'google') AND utm_source IS NOT NULL AND utm_source != ''
    GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10
  `);
  print('8. Outros sources (top combinações)', others.rows);

  const placeholders = await pool.query(`
    SELECT utm_source, utm_campaign, utm_content, utm_term, COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE date_create >= NOW() - INTERVAL '90 days'
      AND (utm_campaign LIKE '{{%' OR utm_content LIKE '{{%' OR utm_term LIKE '{{%')
    GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT 10
  `);
  print('9. Placeholders não substituídos', placeholders.rows);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
