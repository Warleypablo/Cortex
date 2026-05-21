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

const sourceFilter = `d.source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')`;
const funilFilter = `d.fnl_ngc ILIKE 'Geral'`;

async function main() {
  const startDate = '2026-01-01';
  const endDate = '2026-05-31';

  // 1) Top URLs (lp_conversao)
  const byLp = await pool.query(`
    SELECT COALESCE(NULLIF(d.lp_conversao, ''), '(vazio)') as lp_conversao, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC LIMIT 40
  `, [startDate, endDate]);
  print('Top 40 lp_conversao (URL)', byLp.rows);

  // 2) Top lp_da_conversao
  const byLp2 = await pool.query(`
    SELECT COALESCE(NULLIF(d.lp_da_conversao, ''), '(vazio)') as lp_da_conversao, COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC LIMIT 40
  `, [startDate, endDate]);
  print('Top 40 lp_da_conversao', byLp2.rows);

  // 3) Cruzamento utm_source × lp_conversao (visão consolidada)
  const cruz = await pool.query(`
    SELECT
      LOWER(COALESCE(NULLIF(d.utm_source, ''), '(vazio)')) as utm_source,
      COALESCE(NULLIF(d.lp_conversao, ''), '(vazio)') as lp_conversao,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1,2 ORDER BY leads DESC LIMIT 50
  `, [startDate, endDate]);
  print('Cruzamento utm_source × lp_conversao (top 50)', cruz.rows);

  // 4) "fonte" e "funil" (campos antigos do Bitrix)
  const fontes = await pool.query(`
    SELECT
      COALESCE(NULLIF(d.fonte, ''), '(vazio)') as fonte,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('Por d.fonte', fontes.rows);

  // 5) Os 198 leads SEM utm_source: de onde vêm?
  const semUtm = await pool.query(`
    SELECT
      COALESCE(NULLIF(d.lp_conversao, ''), '(vazio)') as lp_conversao,
      COALESCE(NULLIF(d.lp_da_conversao, ''), '(vazio)') as lp_da_conversao,
      d.source,
      COALESCE(NULLIF(d.fonte, ''), '(vazio)') as fonte,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= $1::date AND d.created_at <= $2::date + INTERVAL '1 day'
      AND ${sourceFilter} AND ${funilFilter}
      AND (d.utm_source IS NULL OR d.utm_source = '')
    GROUP BY 1,2,3,4 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('Leads SEM utm_source (198 leads) — de onde vêm?', semUtm.rows);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
