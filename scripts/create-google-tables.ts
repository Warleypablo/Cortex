/**
 * Migration: schema `google` PRÓPRIO do Cortex (Turbo-only), separado da pipeline
 * multi-conta da agência (`google_ads.*`, do Warley).
 *
 * Foco: conta própria da Turbo Partners (customer_id 3795436039), via MCC
 * 5156174278 como login-customer-id. Tabelas SEM particionamento (volume pequeno).
 *
 * Tabelas (schema google):
 *  - accounts                — contas sincronizadas (só a Turbo por enquanto)
 *  - campaigns               — campanhas (chave natural campaign_id)
 *  - campaign_daily_metrics  — métricas por dia × campanha × device × network
 *  - sync_runs               — audit
 *
 * Idempotente. Uso: npx tsx scripts/create-google-tables.ts
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
  try { await pool.query(sql); console.log('✅'); }
  catch (e: any) { console.log(`❌ ${e.message}`); throw e; }
}

async function main() {
  console.log('Criando schema google (Turbo-only)...\n');

  await exec('schema google', `CREATE SCHEMA IF NOT EXISTS google`);

  await exec('google.accounts', `
    CREATE TABLE IF NOT EXISTS google.accounts (
      customer_id      VARCHAR(20) PRIMARY KEY,
      descriptive_name TEXT,
      currency_code    VARCHAR(10),
      time_zone        TEXT,
      status           TEXT,
      is_manager       BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await exec('google.campaigns', `
    CREATE TABLE IF NOT EXISTS google.campaigns (
      campaign_id                 BIGINT PRIMARY KEY,
      customer_id                 VARCHAR(20) NOT NULL REFERENCES google.accounts(customer_id) ON DELETE CASCADE,
      name                        TEXT,
      status                      TEXT,
      advertising_channel_type    TEXT,
      advertising_channel_subtype TEXT,
      bidding_strategy_type       TEXT,
      budget_amount_micros        BIGINT,
      start_date                  DATE,
      end_date                    DATE,
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  // idempotente p/ tabela já criada no #229
  await exec('google.campaigns +budget_amount_micros',
    `ALTER TABLE google.campaigns ADD COLUMN IF NOT EXISTS budget_amount_micros BIGINT`);

  await exec('google.ad_groups', `
    CREATE TABLE IF NOT EXISTS google.ad_groups (
      ad_group_id  BIGINT PRIMARY KEY,
      campaign_id  BIGINT NOT NULL REFERENCES google.campaigns(campaign_id) ON DELETE CASCADE,
      name         TEXT,
      status       TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await exec('google.keywords', `
    CREATE TABLE IF NOT EXISTS google.keywords (
      ad_group_id   BIGINT NOT NULL REFERENCES google.ad_groups(ad_group_id) ON DELETE CASCADE,
      criterion_id  BIGINT NOT NULL,
      text          TEXT,
      match_type    VARCHAR(20),
      status        VARCHAR(20),
      negative      BOOLEAN NOT NULL DEFAULT FALSE,
      quality_score INTEGER,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (ad_group_id, criterion_id)
    )`);

  await exec('google.keyword_daily_metrics', `
    CREATE TABLE IF NOT EXISTS google.keyword_daily_metrics (
      report_date      DATE NOT NULL,
      ad_group_id      BIGINT NOT NULL,
      criterion_id     BIGINT NOT NULL,
      device_type      VARCHAR(20) NOT NULL DEFAULT 'UNSPECIFIED',
      network_type     VARCHAR(30) NOT NULL DEFAULT 'UNSPECIFIED',
      impressions      BIGINT NOT NULL DEFAULT 0,
      clicks           BIGINT NOT NULL DEFAULT 0,
      cost_micros      BIGINT NOT NULL DEFAULT 0,
      conversions      NUMERIC NOT NULL DEFAULT 0,
      conversion_value NUMERIC NOT NULL DEFAULT 0,
      quality_score    INTEGER,
      synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_date, ad_group_id, criterion_id, device_type, network_type)
    )`);
  await exec('idx_google_kdm_date',
    `CREATE INDEX IF NOT EXISTS idx_google_kdm_date ON google.keyword_daily_metrics(report_date)`);
  await exec('idx_google_kw_adgroup',
    `CREATE INDEX IF NOT EXISTS idx_google_kw_adgroup ON google.keywords(ad_group_id)`);

  await exec('google.campaign_daily_metrics', `
    CREATE TABLE IF NOT EXISTS google.campaign_daily_metrics (
      report_date      DATE NOT NULL,
      campaign_id      BIGINT NOT NULL REFERENCES google.campaigns(campaign_id) ON DELETE CASCADE,
      device_type      VARCHAR(20) NOT NULL DEFAULT 'UNSPECIFIED',
      network_type     VARCHAR(30) NOT NULL DEFAULT 'UNSPECIFIED',
      impressions      BIGINT NOT NULL DEFAULT 0,
      clicks           BIGINT NOT NULL DEFAULT 0,
      cost_micros      BIGINT NOT NULL DEFAULT 0,
      conversions      NUMERIC NOT NULL DEFAULT 0,
      conversion_value NUMERIC NOT NULL DEFAULT 0,
      video_views      BIGINT NOT NULL DEFAULT 0,
      synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_date, campaign_id, device_type, network_type)
    )`);
  await exec('idx_google_cdm_date',
    `CREATE INDEX IF NOT EXISTS idx_google_cdm_date ON google.campaign_daily_metrics(report_date)`);

  // Anúncios individuais (ad_group_ad). Google não expõe preview compartilhável por
  // anúncio como o Meta — guardamos nome, tipo, URL final e textos (headlines/descrições).
  await exec('google.ads', `
    CREATE TABLE IF NOT EXISTS google.ads (
      ad_id        BIGINT PRIMARY KEY,
      ad_group_id  BIGINT NOT NULL REFERENCES google.ad_groups(ad_group_id) ON DELETE CASCADE,
      campaign_id  BIGINT,
      name         TEXT,
      ad_type      TEXT,
      status       TEXT,
      final_urls   TEXT,
      headlines    TEXT,
      descriptions TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await exec('idx_google_ads_adgroup',
    `CREATE INDEX IF NOT EXISTS idx_google_ads_adgroup ON google.ads(ad_group_id)`);
  await exec('idx_google_ads_campaign',
    `CREATE INDEX IF NOT EXISTS idx_google_ads_campaign ON google.ads(campaign_id)`);

  await exec('google.ad_daily_metrics', `
    CREATE TABLE IF NOT EXISTS google.ad_daily_metrics (
      report_date      DATE NOT NULL,
      ad_id            BIGINT NOT NULL REFERENCES google.ads(ad_id) ON DELETE CASCADE,
      device_type      VARCHAR(20) NOT NULL DEFAULT 'UNSPECIFIED',
      network_type     VARCHAR(30) NOT NULL DEFAULT 'UNSPECIFIED',
      impressions      BIGINT NOT NULL DEFAULT 0,
      clicks           BIGINT NOT NULL DEFAULT 0,
      cost_micros      BIGINT NOT NULL DEFAULT 0,
      conversions      NUMERIC NOT NULL DEFAULT 0,
      conversion_value NUMERIC NOT NULL DEFAULT 0,
      video_views      BIGINT NOT NULL DEFAULT 0,
      synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_date, ad_id, device_type, network_type)
    )`);
  await exec('idx_google_adm_date',
    `CREATE INDEX IF NOT EXISTS idx_google_adm_date ON google.ad_daily_metrics(report_date)`);

  await exec('google.sync_runs', `
    CREATE TABLE IF NOT EXISTS google.sync_runs (
      id          SERIAL PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'running',
      campaigns   INTEGER DEFAULT 0,
      metrics     INTEGER DEFAULT 0,
      since_date  DATE,
      until_date  DATE,
      error       TEXT,
      started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )`);

  console.log('\n✅ Schema google criado.');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
