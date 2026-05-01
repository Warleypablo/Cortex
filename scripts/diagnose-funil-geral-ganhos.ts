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
  // 1) Source do Bitrix dos Negócio Ganho com fnl_ngc = 'Geral'
  const srcGanhos = await pool.query(`
    SELECT
      COALESCE(NULLIF(source, ''), '(Vazio)') as source,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND stage_name = 'Negócio Ganho'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1
    ORDER BY total DESC
  `);
  print('SOURCE dos Negócios Ganhos "Geral" (últimos 90d, base = created_at)', srcGanhos.rows);

  // 2) UTM source dos Negócio Ganho
  const utmGanhos = await pool.query(`
    SELECT
      COALESCE(NULLIF(utm_source, ''), '(Vazio)') as utm_source,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND stage_name = 'Negócio Ganho'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1
    ORDER BY total DESC
  `);
  print('UTM_SOURCE dos Negócios Ganhos "Geral" (últimos 90d)', utmGanhos.rows);

  // 3) UTM source/campaign/content
  const combo = await pool.query(`
    SELECT
      COALESCE(NULLIF(utm_source, ''), '(Vazio)') as utm_source,
      COALESCE(NULLIF(utm_campaign, ''), '(Vazio)') as utm_campaign,
      COALESCE(NULLIF(utm_content, ''), '(Vazio)') as utm_content,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND stage_name = 'Negócio Ganho'
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1,2,3
    ORDER BY total DESC
  `);
  print('UTM source/campaign/content dos GANHOS "Geral" (últimos 90d)', combo.rows);

  // 4) Lista detalhada dos deals Negócio Ganho (com cliente/empresa, valor, data fechamento)
  const lista = await pool.query(`
    SELECT
      d.id,
      d.title,
      d.source,
      COALESCE(NULLIF(d.utm_source, ''), '(Vazio)') as utm_source,
      COALESCE(NULLIF(d.utm_campaign, ''), '(Vazio)') as utm_campaign,
      COALESCE(NULLIF(d.utm_content, ''), '(Vazio)') as utm_content,
      d.mql,
      COALESCE(d.valor_recorrente, 0) as valor_recorrente,
      COALESCE(d.valor_pontual, 0) as valor_pontual,
      d.created_at::date as criado,
      d.data_fechamento::date as fechamento
    FROM "Bitrix".crm_deal d
    WHERE d.fnl_ngc ILIKE 'Geral'
      AND d.stage_name = 'Negócio Ganho'
      AND d.created_at >= (CURRENT_DATE - INTERVAL '90 days')
    ORDER BY d.data_fechamento DESC NULLS LAST, d.id DESC
  `);
  print('Lista de Negócios Ganhos "Geral" (últimos 90d - por created_at)', lista.rows);

  // 5) Mesma análise mas usando data_fechamento dentro do período
  // (porque a aba Orçado x Realizado usa data_fechamento para faturamento/contagem de ganhos)
  const utmFechados = await pool.query(`
    SELECT
      COALESCE(NULLIF(utm_source, ''), '(Vazio)') as utm_source,
      COUNT(*) as deals_ganhos,
      ROUND(SUM(COALESCE(valor_recorrente,0) + COALESCE(valor_pontual,0))::numeric, 2) as valor_total
    FROM "Bitrix".crm_deal
    WHERE fnl_ngc ILIKE 'Geral'
      AND stage_name = 'Negócio Ganho'
      AND data_fechamento >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY 1
    ORDER BY deals_ganhos DESC
  `);
  print('UTM_SOURCE dos Negócios Ganhos "Geral" (base = data_fechamento últimos 90d)', utmFechados.rows);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
