/**
 * Migration: tabelas de MÍDIA PAGA do LinkedIn (Ads) em linkedin.*.
 *
 * Complementa create-linkedin-tables.ts (orgânico). Usa a credencial OAuth já
 * existente, AGORA com os escopos r_ads + r_ads_reporting (re-autorizar o admin
 * depois de subir os escopos). O app "Turbo Cortex" tem o produto Advertising API
 * habilitado (Development Tier — até 5 ad accounts). Ad account já vinculado: 510789514.
 *
 * As métricas de adAnalytics com timeGranularity=DAILY são DIÁRIAS REAIS → a leitura
 * agrega por SUM no range (igual TikTok Ads).
 *
 * Idempotente.
 *
 * Tabelas:
 *  - linkedin.ad_accounts      — contas de anúncio (sponsoredAccount)
 *  - linkedin.ad_campaigns     — campanhas (sponsoredCampaign)
 *  - linkedin.ad_metrics_daily — gasto/impressões/cliques/conversões por campanha/dia
 *
 * Uso:
 *   npx tsx scripts/create-linkedin-ads-tables.ts
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

async function exec(label: string, sql: string) {
  process.stdout.write(`  ${label} ... `);
  try {
    await pool.query(sql);
    console.log('✅');
  } catch (e: any) {
    console.log(`❌ ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log('Criando tabelas LinkedIn Ads em linkedin...\n');

  await exec('schema linkedin', `CREATE SCHEMA IF NOT EXISTS linkedin`);

  await exec('linkedin.ad_accounts', `
    CREATE TABLE IF NOT EXISTS linkedin.ad_accounts (
      account_id    VARCHAR(40) PRIMARY KEY,
      name          TEXT,
      currency      VARCHAR(10),
      status        TEXT,
      type          TEXT,
      credential_id INTEGER REFERENCES linkedin.credentials(id) ON DELETE SET NULL,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await exec('linkedin.ad_campaigns', `
    CREATE TABLE IF NOT EXISTS linkedin.ad_campaigns (
      campaign_id     VARCHAR(40) PRIMARY KEY,
      account_id      VARCHAR(40) NOT NULL REFERENCES linkedin.ad_accounts(account_id) ON DELETE CASCADE,
      campaign_name   TEXT,
      status          TEXT,
      type            TEXT,
      objective_type  TEXT,
      cost_type       TEXT,
      raw             JSONB,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // adAnalytics DAILY → valores do dia (não cumulativos). spend = costInLocalCurrency.
  await exec('linkedin.ad_metrics_daily', `
    CREATE TABLE IF NOT EXISTS linkedin.ad_metrics_daily (
      campaign_id   VARCHAR(40) NOT NULL REFERENCES linkedin.ad_campaigns(campaign_id) ON DELETE CASCADE,
      stat_date     DATE NOT NULL,
      account_id    VARCHAR(40) NOT NULL,
      spend         NUMERIC,
      impressions   BIGINT,
      clicks        BIGINT,
      conversions   NUMERIC,
      raw           JSONB,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (campaign_id, stat_date)
    )`);

  await exec('idx_li_ad_metrics_date',
    `CREATE INDEX IF NOT EXISTS idx_li_ad_metrics_date ON linkedin.ad_metrics_daily(stat_date)`);
  await exec('idx_li_ad_metrics_acc',
    `CREATE INDEX IF NOT EXISTS idx_li_ad_metrics_acc ON linkedin.ad_metrics_daily(account_id)`);

  console.log('\n✅ Tabelas LinkedIn Ads criadas.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
