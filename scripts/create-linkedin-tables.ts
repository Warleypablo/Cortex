/**
 * Migration: cria tabelas LinkedIn em linkedin (mesmo padrão YouTube/Instagram).
 *
 * Foco: analytics ORGÂNICO de Company Page (followers, page views, engajamento).
 * Idempotente — pode rodar várias vezes sem efeito colateral.
 *
 * Tabelas (todas em linkedin):
 *  - linkedin_credentials          — tokens OAuth encriptados, por membro LinkedIn que autorizou
 *  - linkedin_organizations        — metadata das Company Pages (Turbo Partners, etc)
 *  - linkedin_page_stats_daily     — page views por dia (organizationPageStatistics)
 *  - linkedin_follower_stats_daily — ganho/total de seguidores por dia (followerStatistics + networkSizes)
 *  - linkedin_share_stats_daily    — engajamento por dia (organizationalEntityShareStatistics)
 *  - linkedin_sync_runs            — audit das execuções de sync
 *
 * Uso:
 *   npx tsx scripts/create-linkedin-tables.ts
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
  console.log('Criando tabelas linkedin_* em linkedin...\n');

  await exec('schema linkedin', `CREATE SCHEMA IF NOT EXISTS linkedin`);

  // Tokens OAuth. LinkedIn: access_token ~60 dias, refresh_token ~365 dias.
  await exec('linkedin.credentials', `
    CREATE TABLE IF NOT EXISTS linkedin.credentials (
      id                  SERIAL PRIMARY KEY,
      member_id           VARCHAR(120) UNIQUE NOT NULL,
      member_email        TEXT,
      member_name         TEXT,
      access_token_enc    TEXT NOT NULL,
      refresh_token_enc   TEXT,
      access_expires_at   TIMESTAMPTZ,
      refresh_expires_at  TIMESTAMPTZ,
      scopes              TEXT,
      authorized_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at        TIMESTAMPTZ,
      active              BOOLEAN NOT NULL DEFAULT TRUE
    )`);

  // Company Pages que o membro administra.
  await exec('linkedin.organizations', `
    CREATE TABLE IF NOT EXISTS linkedin.organizations (
      org_id          BIGINT PRIMARY KEY,
      vanity_name     TEXT,
      name            TEXT,
      description     TEXT,
      logo_url        TEXT,
      follower_count  BIGINT,
      credential_id   INTEGER REFERENCES linkedin.credentials(id) ON DELETE SET NULL,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Page views por dia (organizationPageStatistics, time-bound).
  await exec('linkedin.page_stats_daily', `
    CREATE TABLE IF NOT EXISTS linkedin.page_stats_daily (
      id                   SERIAL PRIMARY KEY,
      org_id               BIGINT NOT NULL REFERENCES linkedin.organizations(org_id) ON DELETE CASCADE,
      stat_date            DATE NOT NULL,
      all_page_views       INTEGER,
      unique_page_views    INTEGER,
      desktop_page_views   INTEGER,
      mobile_page_views    INTEGER,
      raw                  JSONB,
      synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (org_id, stat_date)
    )`);

  // Seguidores por dia (organic/paid gain + total snapshot).
  await exec('linkedin.follower_stats_daily', `
    CREATE TABLE IF NOT EXISTS linkedin.follower_stats_daily (
      id                     SERIAL PRIMARY KEY,
      org_id                 BIGINT NOT NULL REFERENCES linkedin.organizations(org_id) ON DELETE CASCADE,
      stat_date              DATE NOT NULL,
      organic_follower_gain  INTEGER,
      paid_follower_gain     INTEGER,
      total_followers        BIGINT,
      raw                    JSONB,
      synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (org_id, stat_date)
    )`);

  // Engajamento por dia (impressões, cliques, likes, comments, shares, engagement).
  await exec('linkedin.share_stats_daily', `
    CREATE TABLE IF NOT EXISTS linkedin.share_stats_daily (
      id                  SERIAL PRIMARY KEY,
      org_id              BIGINT NOT NULL REFERENCES linkedin.organizations(org_id) ON DELETE CASCADE,
      stat_date           DATE NOT NULL,
      impressions         INTEGER,
      unique_impressions  INTEGER,
      clicks              INTEGER,
      likes               INTEGER,
      comments            INTEGER,
      shares              INTEGER,
      engagement          NUMERIC,
      raw                 JSONB,
      synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (org_id, stat_date)
    )`);

  // Posts publicados pela Company Page (Posts API, q=author). Exige r_organization_social.
  await exec('linkedin.posts', `
    CREATE TABLE IF NOT EXISTS linkedin.posts (
      post_urn          TEXT PRIMARY KEY,
      org_id            BIGINT NOT NULL REFERENCES linkedin.organizations(org_id) ON DELETE CASCADE,
      created_at        TIMESTAMPTZ,
      last_modified_at  TIMESTAMPTZ,
      lifecycle_state   TEXT,
      visibility        TEXT,
      commentary        TEXT,
      raw               JSONB,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await exec('linkedin.sync_runs', `
    CREATE TABLE IF NOT EXISTS linkedin.sync_runs (
      id            SERIAL PRIMARY KEY,
      kind          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'running',
      rows_upserted INTEGER DEFAULT 0,
      error         TEXT,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at   TIMESTAMPTZ
    )`);

  await exec('idx_li_page_stats_date',
    `CREATE INDEX IF NOT EXISTS idx_li_page_stats_date ON linkedin.page_stats_daily(org_id, stat_date)`);
  await exec('idx_li_follower_stats_date',
    `CREATE INDEX IF NOT EXISTS idx_li_follower_stats_date ON linkedin.follower_stats_daily(org_id, stat_date)`);
  await exec('idx_li_share_stats_date',
    `CREATE INDEX IF NOT EXISTS idx_li_share_stats_date ON linkedin.share_stats_daily(org_id, stat_date)`);
  await exec('idx_li_posts_created',
    `CREATE INDEX IF NOT EXISTS idx_li_posts_created ON linkedin.posts(org_id, created_at)`);

  console.log('\n✅ Tabelas LinkedIn criadas.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
