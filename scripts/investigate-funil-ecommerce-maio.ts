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
  // 1) Variantes de fnl_ngc com 'commerce' (cobrir 'E-commerce', 'Ecommerce', 'e-commerce'...)
  const variantes = await pool.query(`
    SELECT fnl_ngc, COUNT(*) AS qtd
    FROM "Bitrix".crm_deal
    WHERE created_at >= '2026-05-01'
      AND created_at <  '2026-06-01'
      AND LOWER(fnl_ngc) LIKE '%commerce%'
    GROUP BY fnl_ngc
    ORDER BY qtd DESC
  `);
  print('Variantes de fnl_ngc com "commerce" em maio/2026', variantes.rows);

  // 2) Resumo mensal — funil E-commerce (cobrindo variantes com REPLACE)
  const resumo = await pool.query(`
    SELECT
      COUNT(*)                                                                       AS total_leads_maio,
      SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END)  AS mqls_maio
    FROM "Bitrix".crm_deal
    WHERE created_at >= '2026-05-01'
      AND created_at <  '2026-06-01'
      AND REPLACE(LOWER(fnl_ngc), '-', '') = 'ecommerce'
  `);
  print('RESUMO — Funil E-commerce, maio/2026 (até hoje)', resumo.rows);

  // 3) Por dia (curva diária)
  const porDia = await pool.query(`
    SELECT
      created_at::date AS dia,
      COUNT(*) AS leads,
      SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) AS mqls
    FROM "Bitrix".crm_deal
    WHERE created_at >= '2026-05-01'
      AND created_at <  '2026-06-01'
      AND REPLACE(LOWER(fnl_ngc), '-', '') = 'ecommerce'
    GROUP BY 1
    ORDER BY 1
  `);
  print('Por dia (funil E-commerce, maio/2026)', porDia.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
