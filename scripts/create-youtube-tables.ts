/**
 * Migration: cria tabelas YouTube em youtube (mesmo padrão Instagram).
 *
 * Idempotente — pode rodar várias vezes sem efeito colateral.
 *
 * Tabelas criadas (todas em youtube):
 *  - youtube_credentials         — refresh_token OAuth encriptado, UMA credencial por canal
 *  - youtube_channels            — metadata dos canais (Turbocast, TurboPartners, André, Vitor)
 *  - youtube_videos              — vídeos publicados (snapshot de contadores cumulativos)
 *  - youtube_video_daily_metrics — métricas diárias por vídeo (Analytics API)
 *  - youtube_channel_daily_metrics — métricas diárias agregadas por canal
 *  - youtube_sync_runs           — audit das execuções de sync
 *
 * Uso:
 *   npx tsx scripts/create-youtube-tables.ts
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
  console.log('Criando tabelas em youtube...\n');

  await exec('schema youtube', `CREATE SCHEMA IF NOT EXISTS youtube`);

  await exec('youtube.credentials', `
    CREATE TABLE IF NOT EXISTS youtube.credentials (
      id                  SERIAL PRIMARY KEY,
      google_user_id      VARCHAR(100) NOT NULL,
      google_email        VARCHAR(255),
      channel_id          VARCHAR(50),
      refresh_token_enc   TEXT NOT NULL,
      scopes              TEXT NOT NULL,
      authorized_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at        TIMESTAMPTZ,
      active              BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  // --- Migração: credencial passa a ser POR CANAL (não por conta Google) ---
  // Motivo: uma conta (ex.: ferramentas@) gerencia vários canais Brand Account;
  // cada autorização traz o mesmo google_user_id mas um refresh_token distinto,
  // válido só para o canal selecionado. O UNIQUE(google_user_id) antigo fazia a
  // 2ª autorização sobrescrever a 1ª. Agora a chave é channel_id. Idempotente.
  await exec('migra credentials → channel_id', `
    ALTER TABLE youtube.credentials ADD COLUMN IF NOT EXISTS channel_id VARCHAR(50);
    ALTER TABLE youtube.credentials DROP CONSTRAINT IF EXISTS credentials_google_user_id_key;
  `);
  await exec('uq_yt_credentials_channel', `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_yt_credentials_channel
    ON youtube.credentials(channel_id)
  `);

  await exec('youtube.channels', `
    CREATE TABLE IF NOT EXISTS youtube.channels (
      channel_id                VARCHAR(50) PRIMARY KEY,
      title                     VARCHAR(255),
      custom_url                VARCHAR(255),
      description               TEXT,
      thumbnail_url             TEXT,
      country                   VARCHAR(10),
      published_at              TIMESTAMPTZ,
      subscriber_count          BIGINT,
      view_count                BIGINT,
      video_count               INTEGER,
      hidden_subscriber_count   BOOLEAN,
      credential_id             INTEGER REFERENCES youtube.credentials(id) ON DELETE SET NULL,
      synced_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await exec('youtube.videos', `
    CREATE TABLE IF NOT EXISTS youtube.videos (
      video_id                 VARCHAR(50) PRIMARY KEY,
      channel_id               VARCHAR(50) NOT NULL REFERENCES youtube.channels(channel_id) ON DELETE CASCADE,
      title                    VARCHAR(500),
      description              TEXT,
      published_at             TIMESTAMPTZ,
      thumbnail_url            TEXT,
      duration_seconds         INTEGER,
      tags                     JSONB,
      category_id              VARCHAR(20),
      default_language         VARCHAR(10),
      live_broadcast_content   VARCHAR(20),
      view_count               BIGINT,
      like_count               BIGINT,
      comment_count            BIGINT,
      favorite_count           BIGINT,
      synced_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec('idx_yt_videos_channel', `CREATE INDEX IF NOT EXISTS idx_yt_videos_channel ON youtube.videos(channel_id)`);
  await exec('idx_yt_videos_published', `CREATE INDEX IF NOT EXISTS idx_yt_videos_published ON youtube.videos(published_at)`);

  await exec('youtube.video_daily_metrics', `
    CREATE TABLE IF NOT EXISTS youtube.video_daily_metrics (
      id                          SERIAL PRIMARY KEY,
      video_id                    VARCHAR(50) NOT NULL REFERENCES youtube.videos(video_id) ON DELETE CASCADE,
      channel_id                  VARCHAR(50) NOT NULL,
      report_date                 DATE NOT NULL,
      views                       INTEGER,
      estimated_minutes_watched   INTEGER,
      average_view_duration       INTEGER,
      average_view_percentage     DECIMAL(5,2),
      likes                       INTEGER,
      dislikes                    INTEGER,
      comments                    INTEGER,
      shares                      INTEGER,
      subscribers_gained          INTEGER,
      subscribers_lost            INTEGER,
      card_clicks                 INTEGER,
      card_impressions            INTEGER,
      synced_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec('uq_yt_video_daily_video_date', `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_yt_video_daily_video_date
    ON youtube.video_daily_metrics(video_id, report_date)
  `);
  await exec('idx_yt_video_daily_date', `CREATE INDEX IF NOT EXISTS idx_yt_video_daily_date ON youtube.video_daily_metrics(report_date)`);
  await exec('idx_yt_video_daily_channel', `CREATE INDEX IF NOT EXISTS idx_yt_video_daily_channel ON youtube.video_daily_metrics(channel_id)`);

  await exec('youtube.channel_daily_metrics', `
    CREATE TABLE IF NOT EXISTS youtube.channel_daily_metrics (
      id                          SERIAL PRIMARY KEY,
      channel_id                  VARCHAR(50) NOT NULL REFERENCES youtube.channels(channel_id) ON DELETE CASCADE,
      report_date                 DATE NOT NULL,
      views                       INTEGER,
      estimated_minutes_watched   INTEGER,
      average_view_duration       INTEGER,
      subscribers_gained          INTEGER,
      subscribers_lost            INTEGER,
      likes                       INTEGER,
      comments                    INTEGER,
      shares                      INTEGER,
      synced_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec('uq_yt_channel_daily_channel_date', `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_yt_channel_daily_channel_date
    ON youtube.channel_daily_metrics(channel_id, report_date)
  `);
  await exec('idx_yt_channel_daily_date', `CREATE INDEX IF NOT EXISTS idx_yt_channel_daily_date ON youtube.channel_daily_metrics(report_date)`);

  await exec('youtube.sync_runs', `
    CREATE TABLE IF NOT EXISTS youtube.sync_runs (
      id                SERIAL PRIMARY KEY,
      job_type          VARCHAR(50) NOT NULL,
      channel_id        VARCHAR(50),
      status            VARCHAR(20) NOT NULL,
      started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at       TIMESTAMPTZ,
      items_processed   INTEGER,
      error_message     TEXT
    )
  `);

  console.log('\nVerificando estrutura final...');
  const r = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'youtube' AND table_name LIKE 'youtube_%'
    ORDER BY table_name
  `);
  console.log('\nTabelas youtube_* em youtube:');
  for (const row of r.rows) console.log(`   • ${row.table_name}`);

  await pool.end();
  console.log('\n✅ Migration concluída.');
}

main().catch(async (e) => {
  console.error('\n❌ Migration falhou:', e.message);
  await pool.end();
  process.exit(1);
});
