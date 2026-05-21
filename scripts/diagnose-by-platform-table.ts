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

async function main() {
  // 1) A tabela existe, independente de permissão? (pg_class mostra todas)
  const exists = await pool.query(`
    SELECT n.nspname as schema, c.relname as table, c.relkind, c.reltuples::bigint as approx_rows,
           pg_get_userbyid(c.relowner) as owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'meta_ads'
      AND c.relname LIKE '%platform%'
  `);
  console.log('\n=== Tabelas com "platform" no nome em meta_ads ===');
  if (exists.rows.length === 0) console.log('(nenhuma)');
  else console.table(exists.rows);

  // 2) Listar TODAS as tabelas reais em meta_ads (via pg_class, não filtradas por privilégio)
  const all = await pool.query(`
    SELECT c.relname as table, pg_get_userbyid(c.relowner) as owner, c.reltuples::bigint as approx_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'meta_ads' AND c.relkind = 'r'
    ORDER BY c.relname
  `);
  console.log('\n=== TODAS as tabelas físicas em meta_ads (incluindo as sem grant) ===');
  console.table(all.rows);

  // 3) Tem campanhas/anúncios sincronizados nos últimos 30 dias?
  try {
    const recent = await pool.query(`
      SELECT MIN(date_start) as primeira, MAX(date_start) as ultima, COUNT(*) as linhas
      FROM meta_ads.meta_insights_daily
      WHERE date_start >= CURRENT_DATE - INTERVAL '30 days'
    `);
    console.log('\n=== meta_insights_daily — últimos 30 dias ===');
    console.table(recent.rows);
  } catch (e: any) {
    console.log('\n  Erro lendo meta_insights_daily:', e.message);
  }

  // 4) Tentar criar a by_platform table (se já existe, IF NOT EXISTS é no-op)
  console.log('\n=== Testando se temos permissão de CREATE em meta_ads ===');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meta_ads._teste_permissao_create (id INT)
    `);
    await pool.query(`DROP TABLE IF EXISTS meta_ads._teste_permissao_create`);
    console.log('  ✅ growth_dev pode criar tabelas em meta_ads');
  } catch (e: any) {
    console.log('  ❌', e.message);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
