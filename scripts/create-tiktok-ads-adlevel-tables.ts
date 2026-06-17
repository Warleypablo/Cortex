/**
 * Migration: tabelas de MÍDIA PAGA do TikTok a NÍVEL DE ANÚNCIO em tiktok.*.
 *
 * Complementa create-tiktok-ads-tables.ts (nível campanha). Permite a aba Criativos
 * mostrar TikTok por anúncio (espelhando Meta/Google), casando vendas do Bitrix por
 * utm_content = __CID__ = ad_id.
 *
 * Idempotente — pode rodar várias vezes. Garante também o schema, advertisers e
 * ad_campaigns (caso create-tiktok-ads-tables.ts ainda não tenha rodado neste banco).
 *
 * Tabelas:
 *  - tiktok.ad_groups          — metadados de conjunto (adgroup) por campanha
 *  - tiktok.ads                — metadados de anúncio por adgroup
 *  - tiktok.ad_insights_daily  — gasto/impressões/cliques/conversões/video_views por ANÚNCIO por dia
 *
 * Uso:
 *   npx tsx scripts/create-tiktok-ads-adlevel-tables.ts
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

async function exec(label: string, sql: string, opts: { ignoreErrors?: boolean } = {}) {
  process.stdout.write(`  ${label} ... `);
  try {
    await pool.query(sql);
    console.log('✅');
  } catch (e: any) {
    if (opts.ignoreErrors) {
      console.log(`⚠️  ignorado (${e.code || e.message.split('\n')[0]})`);
      return;
    }
    console.log(`❌ ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log('Criando tabelas TikTok Ads (ad-level) em tiktok...\n');

  // CREATE SCHEMA exige privilégio no BANCO (não na schema). Como a schema tiktok já
  // existe (orgânico), basta ter CREATE na schema p/ as tabelas — ignoramos se falhar aqui.
  await exec('schema tiktok', `CREATE SCHEMA IF NOT EXISTS tiktok`, { ignoreErrors: true });

  // Pré-requisitos (idempotentes): advertisers + ad_campaigns — caso o script de campanha
  // não tenha rodado neste banco. Definições alinhadas com create-tiktok-ads-tables.ts.
  await exec('tiktok.advertisers (pré-req)', `
    CREATE TABLE IF NOT EXISTS tiktok.advertisers (
      advertiser_id  VARCHAR(40) PRIMARY KEY,
      advertiser_name TEXT,
      raw            JSONB,
      synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await exec('tiktok.ad_campaigns (pré-req)', `
    CREATE TABLE IF NOT EXISTS tiktok.ad_campaigns (
      campaign_id       VARCHAR(40) PRIMARY KEY,
      advertiser_id     VARCHAR(40) NOT NULL,
      campaign_name     TEXT,
      objective_type    TEXT,
      operation_status  TEXT,
      budget            NUMERIC,
      budget_mode       TEXT,
      raw               JSONB,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Conjuntos (adgroups). Sem FK explícita (tabelas-pai podem ser de outro owner no
  // banco; a integridade é garantida pelo sync, que insere os pais antes dos filhos).
  await exec('tiktok.ad_groups', `
    CREATE TABLE IF NOT EXISTS tiktok.ad_groups (
      adgroup_id        VARCHAR(40) PRIMARY KEY,
      campaign_id       VARCHAR(40) NOT NULL,
      advertiser_id     VARCHAR(40) NOT NULL,
      adgroup_name      TEXT,
      operation_status  TEXT,
      budget            NUMERIC,
      budget_mode       TEXT,
      raw               JSONB,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Anúncios.
  await exec('tiktok.ads', `
    CREATE TABLE IF NOT EXISTS tiktok.ads (
      ad_id             VARCHAR(40) PRIMARY KEY,
      adgroup_id        VARCHAR(40) NOT NULL,
      campaign_id       VARCHAR(40) NOT NULL,
      advertiser_id     VARCHAR(40) NOT NULL,
      ad_name           TEXT,
      operation_status  TEXT,
      ad_format         TEXT,
      landing_page_url  TEXT,
      raw               JSONB,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Métricas diárias por ANÚNCIO (report/integrated/get, data_level=AUCTION_AD).
  // spend/impressions/clicks/conversions/video_views são valores do DIA (não cumulativos).
  await exec('tiktok.ad_insights_daily', `
    CREATE TABLE IF NOT EXISTS tiktok.ad_insights_daily (
      ad_id         VARCHAR(40) NOT NULL,
      stat_date     DATE NOT NULL,
      advertiser_id VARCHAR(40) NOT NULL,
      spend         NUMERIC,
      impressions   BIGINT,
      clicks        BIGINT,
      conversions   NUMERIC,
      video_views   BIGINT,
      raw           JSONB,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (ad_id, stat_date)
    )`);

  await exec('idx_tt_ad_insights_date',
    `CREATE INDEX IF NOT EXISTS idx_tt_ad_insights_date ON tiktok.ad_insights_daily(stat_date)`);
  await exec('idx_tt_ad_insights_adv',
    `CREATE INDEX IF NOT EXISTS idx_tt_ad_insights_adv ON tiktok.ad_insights_daily(advertiser_id)`);
  await exec('idx_tt_ads_adgroup',
    `CREATE INDEX IF NOT EXISTS idx_tt_ads_adgroup ON tiktok.ads(adgroup_id)`);
  await exec('idx_tt_ads_campaign',
    `CREATE INDEX IF NOT EXISTS idx_tt_ads_campaign ON tiktok.ads(campaign_id)`);
  await exec('idx_tt_adgroups_campaign',
    `CREATE INDEX IF NOT EXISTS idx_tt_adgroups_campaign ON tiktok.ad_groups(campaign_id)`);

  console.log('\n✅ Tabelas TikTok Ads (ad-level) criadas.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
