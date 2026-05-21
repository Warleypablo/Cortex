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

// Filtro EXATO do endpoint /ads quando funil "Geral" está selecionado:
// - source IN (...)
// - fnl_ngc ILIKE 'Geral'  (não aplica utmFilter, pois funil específico foi escolhido)
const sourceFilter = `d.source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')`;
const funilFilter = `d.fnl_ngc ILIKE 'Geral'`;

async function main() {
  const startDate = '2026-01-01';
  const endDate = '2026-05-31';

  // 0) Quais valores distintos de fnl_ngc existem (incluindo variantes "Geral")
  const variants = await pool.query(`
    SELECT fnl_ngc, COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
      AND fnl_ngc ILIKE '%geral%'
    GROUP BY fnl_ngc ORDER BY total DESC
  `, [startDate, endDate]);
  print('Variantes de fnl_ngc com "geral"', variants.rows);

  // 1) Total por mês
  const totalByMonth = await pool.query(`
    SELECT to_char(d.created_at, 'YYYY-MM') as mes, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY 1
  `, [startDate, endDate]);
  print('Leads fnl_ngc=Geral por mês (2026)', totalByMonth.rows);

  // 2) utm_source
  const bySource = await pool.query(`
    SELECT LOWER(COALESCE(NULLIF(d.utm_source, ''), '(vazio)')) as utm_source, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC
  `, [startDate, endDate]);
  print('Por utm_source', bySource.rows);

  // 3) utm_campaign top 30
  const byCampaign = await pool.query(`
    SELECT COALESCE(NULLIF(d.utm_campaign, ''), '(vazio)') as utm_campaign, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('Top 30 utm_campaign', byCampaign.rows);

  // 4) utm_term top 30
  const byTerm = await pool.query(`
    SELECT COALESCE(NULLIF(d.utm_term, ''), '(vazio)') as utm_term, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('Top 30 utm_term', byTerm.rows);

  // 5) utm_content top 30 (= ad_id)
  const byContent = await pool.query(`
    SELECT COALESCE(NULLIF(d.utm_content, ''), '(vazio)') as utm_content, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('Top 30 utm_content (ad_id)', byContent.rows);

  // 6) Source do Bitrix
  const byBitrixSource = await pool.query(`
    SELECT d.source, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC
  `, [startDate, endDate]);
  print('Por d.source (Bitrix)', byBitrixSource.rows);

  // 7) Listar TODAS colunas de crm_deal para identificar URL/landing
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'Bitrix' AND table_name = 'crm_deal'
    ORDER BY column_name
  `);
  print('TODAS colunas crm_deal', cols.rows);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
