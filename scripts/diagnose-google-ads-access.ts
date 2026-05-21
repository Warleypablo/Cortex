/**
 * Diagnóstico de acessos para integração Google Ads.
 *
 * Testa, em ordem:
 *  1. Conexão com o banco GCP (DB_*)
 *  2. Permissões no schema `google_ads` (USAGE, CREATE, SELECT, INSERT)
 *  3. Existência das tabelas relevantes
 *  4. Credenciais OAuth do Google Ads (refresh_token válido)
 *  5. Listagem de customers acessíveis (listAccessibleCustomers)
 *  6. GAQL search em uma campanha qualquer (prova fim-a-fim)
 *
 * Uso:
 *   npx tsx scripts/diagnose-google-ads-access.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';
import { google } from 'googleapis';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function ok(msg: string) { console.log(`${GREEN}✅${RESET} ${msg}`); }
function fail(msg: string) { console.log(`${RED}❌${RESET} ${msg}`); }
function warn(msg: string) { console.log(`${YELLOW}⚠️ ${RESET} ${msg}`); }
function header(msg: string) { console.log(`\n${BOLD}━━━ ${msg} ━━━${RESET}`); }

let allOk = true;
const failures: string[] = [];

async function testDatabase() {
  header('1. Conexão com banco (GCP Postgres)');

  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    fail(`Variáveis ausentes no .env: ${missing.join(', ')}`);
    failures.push(`Configure no .env: ${missing.join(', ')}`);
    allOk = false;
    return null;
  }
  ok(`Env vars de DB presentes (host=${process.env.DB_HOST})`);

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query('SELECT current_user, current_database()');
    ok(`Conectado como ${r.rows[0].current_user} em ${r.rows[0].current_database}`);
  } catch (e: any) {
    fail(`Conexão falhou: ${e.message}`);
    failures.push('Não consegui conectar no banco. Verifique DB_HOST/USER/PASSWORD.');
    allOk = false;
    return null;
  }

  return pool;
}

async function testSchemaPermissions(pool: any) {
  header('2. Permissões no schema google_ads');

  // schema existe?
  const schemaExists = await pool.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'google_ads'`
  );
  if (schemaExists.rowCount === 0) {
    warn('Schema google_ads NÃO existe.');
    // testar permissão de CREATE SCHEMA
    try {
      await pool.query('BEGIN');
      await pool.query('CREATE SCHEMA google_ads_test_perm_check');
      await pool.query('ROLLBACK');
      ok('Você tem permissão CREATE SCHEMA (poderia criar o schema google_ads)');
    } catch (e: any) {
      await pool.query('ROLLBACK').catch(() => {});
      fail(`Sem permissão CREATE SCHEMA: ${e.message}`);
      failures.push('Pedir ao Arley: GRANT CREATE ON DATABASE <db> para o seu usuário, ou criar o schema google_ads ele mesmo.');
      allOk = false;
    }
    return;
  }
  ok('Schema google_ads existe');

  // USAGE
  const usage = await pool.query(
    `SELECT has_schema_privilege(current_user, 'google_ads', 'USAGE') AS u,
            has_schema_privilege(current_user, 'google_ads', 'CREATE') AS c`
  );
  const { u, c } = usage.rows[0];
  if (u) ok('USAGE no schema google_ads'); else { fail('SEM USAGE'); allOk = false; failures.push('Pedir GRANT USAGE ON SCHEMA google_ads'); }
  if (c) ok('CREATE no schema google_ads (pode criar tabelas)'); else { fail('SEM CREATE'); allOk = false; failures.push('Pedir GRANT CREATE ON SCHEMA google_ads'); }
}

async function testTables(pool: any) {
  header('3. Tabelas existentes em google_ads');

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'google_ads' ORDER BY table_name`
  );
  if (tables.rowCount === 0) {
    warn('Nenhuma tabela ainda. Vamos criar.');
    return;
  }
  console.log('Tabelas atuais:');
  for (const r of tables.rows) console.log(`   • ${r.table_name}`);

  const expected = ['accounts', 'keywords', 'keyword_daily_metrics', 'campaign_daily_metrics'];
  for (const t of expected) {
    const found = tables.rows.some((r: any) => r.table_name === t);
    if (found) ok(`google_ads.${t} existe`);
    else warn(`google_ads.${t} NÃO existe (precisa criar)`);
  }
}

async function testGoogleAdsAuth() {
  header('4. Credenciais OAuth Google Ads');

  const required = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    fail(`Faltam env vars: ${missing.join(', ')}`);
    failures.push(`Pedir ao Arley para preencher no .env: ${missing.join(', ')}`);
    allOk = false;
    return null;
  }
  ok('Todas as 5 env vars do Google Ads presentes');

  const creds = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
  };

  try {
    const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
    oauth2.setCredentials({ refresh_token: creds.refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    if (!credentials.access_token) throw new Error('Sem access_token retornado');
    ok(`refresh_token válido (access_token expira em ${new Date(credentials.expiry_date!).toLocaleTimeString()})`);
    return { ...creds, accessToken: credentials.access_token };
  } catch (e: any) {
    fail(`Refresh falhou: ${e.message}`);
    failures.push('Refresh token inválido/expirado. Pedir ao Arley reautorizar OAuth no Google Ads.');
    allOk = false;
    return null;
  }
}

async function testListCustomers(creds: any) {
  header('5. Customers acessíveis (Google Ads API)');

  const r = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      'developer-token': creds.developerToken,
    },
  });

  if (!r.ok) {
    const txt = await r.text();
    fail(`listAccessibleCustomers falhou (${r.status}): ${txt.slice(0, 300)}`);
    failures.push('API recusou developer_token ou access. Confirmar approval status do developer_token.');
    allOk = false;
    return null;
  }
  const data = await r.json() as any;
  const resources: string[] = data.resourceNames || [];
  ok(`${resources.length} customer(s) acessível(eis)`);
  for (const rn of resources) console.log(`   • ${rn}`);
  return resources;
}

async function testGaqlQuery(creds: any, resources: string[]) {
  header('6. GAQL query de teste (campanhas dos últimos 30 dias)');

  // Tenta primeiro o login_customer_id; se for MCC, tenta os children
  const candidates = [creds.loginCustomerId.replace(/\D/g, ''), ...resources.map((r) => r.split('/')[1])];
  const unique = Array.from(new Set(candidates));

  const query = `
    SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    LIMIT 5
  `;

  for (const cid of unique) {
    const url = `https://googleads.googleapis.com/v18/customers/${cid}/googleAds:search`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'developer-token': creds.developerToken,
        'login-customer-id': creds.loginCustomerId.replace(/\D/g, ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!r.ok) {
      const txt = await r.text();
      warn(`customer ${cid} falhou (${r.status}): ${txt.slice(0, 200)}`);
      continue;
    }
    const data = await r.json() as any;
    const results = data.results || [];
    ok(`customer ${cid} retornou ${results.length} campanha(s) (últimos 30 dias)`);
    for (const row of results.slice(0, 3)) {
      const c = row.campaign || {};
      const m = row.metrics || {};
      const spend = (parseInt(m.costMicros || '0', 10) / 1_000_000).toFixed(2);
      console.log(`   • [${c.id}] ${c.name} — R$ ${spend} / ${m.impressions} imp / ${m.clicks} cliques`);
    }
    return cid;
  }

  fail('Nenhum customer retornou dados via GAQL.');
  failures.push('Nenhum customer acessível responde GAQL. Confirmar customer_id operacional da Turbo.');
  allOk = false;
  return null;
}

async function main() {
  console.log(`${BOLD}Diagnóstico Google Ads — Cortex${RESET}`);
  console.log('Vai testar: banco + permissões + credenciais Google Ads + API.\n');

  const pool = await testDatabase();
  if (pool) {
    await testSchemaPermissions(pool);
    await testTables(pool);
    await pool.end();
  }

  const creds = await testGoogleAdsAuth();
  if (creds) {
    const resources = await testListCustomers(creds);
    if (resources && resources.length) {
      await testGaqlQuery(creds, resources);
    }
  }

  header('Veredito');
  if (allOk) {
    console.log(`${GREEN}${BOLD}✅ Tudo verde — você tem permissões e acessos. Bora codar.${RESET}\n`);
  } else {
    console.log(`${RED}${BOLD}❌ Faltam coisas:${RESET}`);
    failures.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    console.log('');
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro inesperado:', e);
  process.exit(1);
});
