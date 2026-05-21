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

// Faixas de faturamento_mensal que representam acima de R$ 50k
// (R$50k-R$100k incluída — a faixa começa em 50k; valores são predominantemente > 50k)
const FAIXAS_ACIMA_50K = [
  'R$50.000 - R$100.000',
  'R$100.000 - R$500.000',
  'R$500.000 - R$1.000.000',
  'R$500.000 - R$1 milhão',
  'R$1 milhão - R$5 milhões',
  'R$5 milhões - R$15 milhões',
  'R$15 milhões - R$30 milhões',
  'R$15.000.000 - R$30.000.000',
  'R$1.000.000 - R$5.000.000',
  'Mais de R$30 milhões',
  'Mais de R$30.000.000',
  'R$ 81 mil - R$ 360 mil',
  'R$ 360 mil - R$ 4,8 Mi',
  'R$ 360 mil - R$ 2,0 Mi',
  'R$ 2,0 Mi - R$ 4,8 Mi',
  'R$ 4,8 Mi - R$ 10 Mi',
  'R$ 10 Mi - R$ 25 Mi',
  'R$ 25 Mi - R$ 50 Mi',
  'R$ 50 Mi - R$ 100 Mi',
  'R$ 100 Mi - R$ 300 Mi',
  'R$ 300 Mi - R$ 1 Bi',
  'Acima de R$ 1 Bi',
  '51-80mil',
  '151-300mil',
];

const ECOM_FILTER = `REPLACE(LOWER(segmento), '-', '') = 'ecommerce'`;

async function main() {
  // Resumo final
  const resumo = await pool.query(`
    SELECT
      COUNT(*)                                                                       AS total_ecommerce_7d,
      SUM(CASE WHEN faturamento_mensal = ANY($1) THEN 1 ELSE 0 END)                  AS leads_ecommerce_acima_50k,
      SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END)  AS mqls_ecommerce_total,
      SUM(CASE
            WHEN faturamento_mensal = ANY($1)
             AND (mql::text = '1' OR LOWER(mql::text) = 'true')
            THEN 1 ELSE 0
          END)                                                                       AS mqls_ecommerce_acima_50k
    FROM "Bitrix".crm_deal
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND ${ECOM_FILTER}
  `, [FAIXAS_ACIMA_50K]);
  print('RESUMO FINAL — Ecommerce, últimos 7 dias', resumo.rows);

  // Quem são esses MQLs acima de 50k
  const detalhe = await pool.query(`
    SELECT
      id,
      created_at::date AS data,
      title,
      faturamento_mensal,
      stage_name,
      fnl_ngc
    FROM "Bitrix".crm_deal
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND ${ECOM_FILTER}
      AND faturamento_mensal = ANY($1)
      AND (mql::text = '1' OR LOWER(mql::text) = 'true')
    ORDER BY created_at DESC
  `, [FAIXAS_ACIMA_50K]);
  print('MQLs ecommerce >= 50k (detalhe)', detalhe.rows);

  // Quebra por faixa (só MQLs)
  const porFaixa = await pool.query(`
    SELECT faturamento_mensal, COUNT(*) AS qtd
    FROM "Bitrix".crm_deal
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND ${ECOM_FILTER}
      AND faturamento_mensal = ANY($1)
      AND (mql::text = '1' OR LOWER(mql::text) = 'true')
    GROUP BY faturamento_mensal
    ORDER BY qtd DESC
  `, [FAIXAS_ACIMA_50K]);
  print('MQLs ecommerce >= 50k por faixa', porFaixa.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
