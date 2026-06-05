/**
 * Migration: cria tabelas TikTok em cortex_core (mesmo padrão YouTube/LinkedIn).
 *
 * Cobre os DOIS fluxos do app "Turbo Cortex" (Marketing API):
 *   - Advertiser   → Ads/reporting (campanhas, gasto, conversões)
 *   - Account holder → orgânico (perfil + vídeos + insights)
 *
 * Idempotente — pode rodar várias vezes sem efeito colateral.
 *
 * Tabelas (todas em cortex_core):
 *  - tiktok_credentials  — tokens OAuth encriptados (kind = 'advertiser' | 'account')
 *  - tiktok_advertisers  — contas de anúncio descobertas (fluxo advertiser)
 *  - tiktok_accounts     — perfis TikTok orgânicos descobertos (fluxo account)
 *  - tiktok_sync_runs    — audit das execuções de sync
 *
 * As tabelas de métricas (campanhas/dia, vídeos/dia) vêm na Fase B, depois de
 * validar o shape real das respostas das APIs.
 *
 * Uso:
 *   npx tsx scripts/create-tiktok-tables.ts
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
  console.log('Criando tabelas tiktok_* em cortex_core...\n');

  await exec('schema cortex_core', `CREATE SCHEMA IF NOT EXISTS cortex_core`);

  // Tokens OAuth. Advertiser (Marketing API): token longo, sem refresh.
  // Account (Login Kit): access ~24h + refresh ~365d.
  await exec('cortex_core.tiktok_credentials', `
    CREATE TABLE IF NOT EXISTS cortex_core.tiktok_credentials (
      id                  SERIAL PRIMARY KEY,
      kind                VARCHAR(20) NOT NULL,          -- 'advertiser' | 'account'
      identity            VARCHAR(120) NOT NULL,         -- open_id (account) ou marcador (advertiser)
      access_token_enc    TEXT NOT NULL,
      refresh_token_enc   TEXT,
      access_expires_at   TIMESTAMPTZ,
      refresh_expires_at  TIMESTAMPTZ,
      scopes              TEXT,
      authorized_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at        TIMESTAMPTZ,
      active              BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (kind, identity)
    )`);

  // Contas de anúncio (fluxo advertiser).
  await exec('cortex_core.tiktok_advertisers', `
    CREATE TABLE IF NOT EXISTS cortex_core.tiktok_advertisers (
      advertiser_id   VARCHAR(40) PRIMARY KEY,
      name            TEXT,
      company         TEXT,
      currency        VARCHAR(10),
      timezone        TEXT,
      status          TEXT,
      credential_id   INTEGER REFERENCES cortex_core.tiktok_credentials(id) ON DELETE SET NULL,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Perfis orgânicos (fluxo account holder).
  await exec('cortex_core.tiktok_accounts', `
    CREATE TABLE IF NOT EXISTS cortex_core.tiktok_accounts (
      open_id         VARCHAR(120) PRIMARY KEY,
      union_id        VARCHAR(120),
      display_name    TEXT,
      avatar_url      TEXT,
      follower_count  BIGINT,
      following_count BIGINT,
      likes_count     BIGINT,
      video_count     BIGINT,
      credential_id   INTEGER REFERENCES cortex_core.tiktok_credentials(id) ON DELETE SET NULL,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await exec('cortex_core.tiktok_sync_runs', `
    CREATE TABLE IF NOT EXISTS cortex_core.tiktok_sync_runs (
      id            SERIAL PRIMARY KEY,
      kind          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'running',
      rows_upserted INTEGER DEFAULT 0,
      error         TEXT,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at   TIMESTAMPTZ
    )`);

  console.log('\n✅ Tabelas TikTok criadas.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
