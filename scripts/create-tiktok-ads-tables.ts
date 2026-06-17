/**
 * Migration: tabelas de MÍDIA PAGA do TikTok (Ads) em tiktok.*.
 *
 * Complementa create-tiktok-tables.ts (orgânico). Usa a credencial do fluxo
 * 'advertiser' (Marketing API) já existente. As métricas vêm do endpoint
 * report/integrated/get com dimensão stat_time_day → são DIÁRIAS REAIS (não
 * cumulativas), então a leitura agrega por SUM no range (diferente do orgânico).
 *
 * Idempotente — pode rodar várias vezes.
 *
 * Tabelas:
 *  - tiktok.ad_campaigns      — metadados de campanha (nome, objetivo, status, budget)
 *  - tiktok.ad_metrics_daily  — gasto/impressões/cliques/conversões por campanha por dia
 *
 * Uso:
 *   npx tsx scripts/create-tiktok-ads-tables.ts
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
  console.log('Criando tabelas TikTok Ads em tiktok...\n');

  await exec('schema tiktok', `CREATE SCHEMA IF NOT EXISTS tiktok`);

  // Campanhas (metadados). Budget em centavos? Não — TikTok devolve na moeda da conta.
  await exec('tiktok.ad_campaigns', `
    CREATE TABLE IF NOT EXISTS tiktok.ad_campaigns (
      campaign_id       VARCHAR(40) PRIMARY KEY,
      advertiser_id     VARCHAR(40) NOT NULL REFERENCES tiktok.advertisers(advertiser_id) ON DELETE CASCADE,
      campaign_name     TEXT,
      objective_type    TEXT,
      operation_status  TEXT,
      budget            NUMERIC,
      budget_mode       TEXT,
      raw               JSONB,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Métricas diárias por campanha (report/integrated/get, data_level=AUCTION_CAMPAIGN).
  // spend/impressions/clicks/conversions são valores do DIA (não cumulativos).
  await exec('tiktok.ad_metrics_daily', `
    CREATE TABLE IF NOT EXISTS tiktok.ad_metrics_daily (
      campaign_id   VARCHAR(40) NOT NULL REFERENCES tiktok.ad_campaigns(campaign_id) ON DELETE CASCADE,
      stat_date     DATE NOT NULL,
      advertiser_id VARCHAR(40) NOT NULL,
      spend         NUMERIC,
      impressions   BIGINT,
      clicks        BIGINT,
      conversions   NUMERIC,
      raw           JSONB,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (campaign_id, stat_date)
    )`);

  await exec('idx_tt_ad_metrics_date',
    `CREATE INDEX IF NOT EXISTS idx_tt_ad_metrics_date ON tiktok.ad_metrics_daily(stat_date)`);
  await exec('idx_tt_ad_metrics_adv',
    `CREATE INDEX IF NOT EXISTS idx_tt_ad_metrics_adv ON tiktok.ad_metrics_daily(advertiser_id)`);

  console.log('\n✅ Tabelas TikTok Ads criadas.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
