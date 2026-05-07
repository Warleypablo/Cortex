/**
 * Concede SELECT em meta_ads.meta_insights_by_platform_daily ao usuário da app.
 *
 * Resolve o "permission denied" silenciado em server/routes/growth.ts
 * (rota /api/growth/orcado-realizado/instagram) que faz Alcance Pago e
 * Visualizações Pagas ficarem zeradas na UI.
 *
 * Uso: npx tsx scripts/grant-meta-by-platform.ts [--user=growth_dev]
 *
 * IMPORTANTE: precisa rodar com um usuário que tenha permissão de GRANT.
 * O .env atual usa growth_dev (que é o que precisa receber o grant).
 * Para conceder, configure DB_USER temporariamente para um superuser, OU
 * rode o SQL direto no Cloud SQL via console do GCP.
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function parseArgs(): { user: string } {
  const args = process.argv.slice(2);
  let user = process.env.DB_USER || 'growth_dev';
  for (const a of args) {
    if (a.startsWith('--user=')) user = a.split('=')[1];
  }
  return { user };
}

async function main() {
  const { user } = parseArgs();
  console.log(`[grant-meta-by-platform] Concedendo permissões para "${user}" em meta_ads.*`);

  const stmts: Array<[string, string]> = [
    [
      'usage_schema',
      `GRANT USAGE ON SCHEMA meta_ads TO "${user}"`,
    ],
    [
      'select_by_platform',
      `GRANT SELECT ON meta_ads.meta_insights_by_platform_daily TO "${user}"`,
    ],
    [
      'select_insights',
      `GRANT SELECT ON meta_ads.meta_insights_daily TO "${user}"`,
    ],
    [
      'select_accounts',
      `GRANT SELECT ON meta_ads.meta_accounts TO "${user}"`,
    ],
    [
      'select_campaigns',
      `GRANT SELECT ON meta_ads.meta_campaigns TO "${user}"`,
    ],
    [
      'select_adsets',
      `GRANT SELECT ON meta_ads.meta_adsets TO "${user}"`,
    ],
    [
      'select_ads',
      `GRANT SELECT ON meta_ads.meta_ads TO "${user}"`,
    ],
    [
      'select_creatives',
      `GRANT SELECT ON meta_ads.meta_creatives TO "${user}"`,
    ],
  ];

  for (const [label, sql] of stmts) {
    try {
      await pool.query(sql);
      console.log(`  ✓ ${label}`);
    } catch (e: any) {
      console.warn(`  ✗ ${label}: ${e.message}`);
    }
  }

  // Verificar se o GRANT funcionou
  let needsManualGrant = false;
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM meta_ads.meta_insights_by_platform_daily WHERE date_start >= CURRENT_DATE - 30`
    );
    console.log(`\n[verify] Linhas dos últimos 30 dias em meta_insights_by_platform_daily: ${r.rows[0].n}`);
  } catch (e: any) {
    needsManualGrant = true;
    console.warn(`\n[verify] Ainda sem acesso: ${e.message}`);
  }

  if (needsManualGrant) {
    console.log(`\n========================================================================`);
    console.log(`AÇÃO NECESSÁRIA: a tabela meta_ads.meta_insights_by_platform_daily pertence`);
    console.log(`a 'postgres' e ${user} não tem GRANT OPTION para se auto-conceder.`);
    console.log(`\nConecte como 'postgres' (Cloud SQL Console → SQL → Studio) e rode:`);
    console.log(`\n  GRANT SELECT, INSERT, UPDATE ON meta_ads.meta_insights_by_platform_daily TO "${user}";`);
    console.log(`  GRANT USAGE ON SEQUENCE meta_ads.meta_insights_by_platform_daily_id_seq TO "${user}";`);
    console.log(`\nDepois rode novamente este script para verificar.`);
    console.log(`========================================================================\n`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  pool.end().finally(() => process.exit(1));
});
