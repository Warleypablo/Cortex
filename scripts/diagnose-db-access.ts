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
  // 1) Quem somos e onde estamos conectados
  const ident = await pool.query(`
    SELECT current_user as usuario,
           current_database() as banco,
           inet_server_addr()::text as host_servidor,
           inet_server_port() as porta_servidor,
           version() as postgres_version
  `);
  console.log('\n=== Identidade da conexão ===');
  console.table(ident.rows);

  // 2) Schemas que existem no banco
  const schemas = await pool.query(`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
    ORDER BY schema_name
  `);
  console.log('\n=== Schemas disponíveis ===');
  console.table(schemas.rows);

  // 3) Tabelas no schema meta_ads
  const metaTables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'meta_ads'
    ORDER BY table_name
  `);
  console.log('\n=== Tabelas em meta_ads ===');
  console.table(metaTables.rows);

  // 4) Privilégios que TEMOS em cada tabela meta_ads
  const privs = await pool.query(`
    SELECT table_name, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = 'meta_ads'
      AND grantee = current_user
    ORDER BY table_name, privilege_type
  `);
  console.log('\n=== Privilégios do nosso usuário em meta_ads ===');
  if (privs.rows.length === 0) console.log('(nenhum privilégio direto encontrado)');
  else console.table(privs.rows);

  // 5) E em cortex_core?
  const privsCore = await pool.query(`
    SELECT table_name, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = 'cortex_core'
      AND grantee = current_user
      AND table_name IN ('instagram_metrics_snapshots','instagram_connections')
    ORDER BY table_name, privilege_type
  `);
  console.log('\n=== Privilégios em tabelas-chave de cortex_core ===');
  if (privsCore.rows.length === 0) console.log('(nenhum privilégio direto encontrado)');
  else console.table(privsCore.rows);

  // 6) Tentar SELECT em cada tabela meta_ads e reportar
  console.log('\n=== Teste de leitura em cada tabela meta_ads ===');
  for (const row of metaTables.rows) {
    const t = row.table_name;
    try {
      const r = await pool.query(`SELECT COUNT(*) as total FROM meta_ads.${t} LIMIT 1`);
      console.log(`  ✅ meta_ads.${t}: ${r.rows[0].total} linhas`);
    } catch (err: any) {
      console.log(`  ❌ meta_ads.${t}: ${err.message}`);
    }
  }

  // 7) Bitrix
  try {
    const b = await pool.query(`SELECT COUNT(*) as total FROM "Bitrix".crm_deal`);
    console.log(`\n  ✅ "Bitrix".crm_deal: ${b.rows[0].total} linhas`);
  } catch (err: any) {
    console.log(`\n  ❌ "Bitrix".crm_deal: ${err.message}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
