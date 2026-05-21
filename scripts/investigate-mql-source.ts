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
  // Valores distintos da coluna mql
  const distintos = await pool.query(`
    SELECT mql, COUNT(*) AS qtd
    FROM "Bitrix".crm_deal
    GROUP BY mql
    ORDER BY qtd DESC
  `);
  print('Valores distintos de mql (todos tempos)', distintos.rows);

  // Cruzamento mql x source/fnl_ngc para entender quando é marcado
  const cruz = await pool.query(`
    SELECT
      source,
      fnl_ngc,
      COUNT(*) AS total,
      SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) AS mqls,
      SUM(CASE WHEN mql IS NULL THEN 1 ELSE 0 END) AS mql_nulo
    FROM "Bitrix".crm_deal
    WHERE created_at >= '2026-05-01' AND created_at < '2026-06-01'
    GROUP BY source, fnl_ngc
    ORDER BY mqls DESC, total DESC
    LIMIT 30
  `);
  print('Maio/2026 — mqls por source x fnl_ngc', cruz.rows);

  // Última atualização nos registros — para ver se algo "atualiza" mql depois
  const updates = await pool.query(`
    SELECT
      CASE
        WHEN date_modify IS NULL THEN 'sem date_modify'
        WHEN date_modify::date = created_at::date THEN 'mesmo dia da criação'
        ELSE 'modificado depois'
      END AS estado,
      mql,
      COUNT(*) AS qtd
    FROM "Bitrix".crm_deal
    WHERE created_at >= '2026-05-01' AND created_at < '2026-06-01'
    GROUP BY 1, mql
    ORDER BY 1, qtd DESC
  `);
  print('Maio/2026 — quando mql é definido (criação vs modificação)', updates.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
