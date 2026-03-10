/**
 * Standalone Meta Ads Sync Script
 *
 * Usage:
 *   npx tsx scripts/sync-meta-ads.ts                  # Last 90 days
 *   npx tsx scripts/sync-meta-ads.ts 2026-01-01       # From date to today
 *   npx tsx scripts/sync-meta-ads.ts 2026-01-01 2026-03-10  # Date range
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import { syncMetaAds } from '../server/services/metaAdsSync';

config({ path: '.env' });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is required. Check your .env file.`);
  return val;
}

const pool = new Pool({
  host: requireEnv("DATABASE_HOST"),
  port: 5432,
  database: process.env.DATABASE_NAME || "dados_turbo",
  user: process.env.DATABASE_USER || "postgres",
  password: requireEnv("DATABASE_PASSWORD"),
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : { rejectUnauthorized: false },
});

async function main() {
  const since = process.argv[2] || undefined;
  const until = process.argv[3] || undefined;

  console.log('=== Meta Ads Sync ===');
  console.log(`Period: ${since || 'last 90 days'} → ${until || 'today'}`);
  console.log('');

  try {
    // Ensure meta_ads schema exists
    await pool.query('CREATE SCHEMA IF NOT EXISTS meta_ads');

    // Check if tables exist, create if needed
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'meta_ads' AND table_name = 'meta_accounts'
    `);

    if (rows.length === 0) {
      console.log('Creating meta_ads tables...');
      await createTables(pool);
    }

    const result = await syncMetaAds(pool, { since, until });

    console.log('\n=== Summary ===');
    console.log(`Accounts:  ${result.accounts}`);
    console.log(`Campaigns: ${result.campaigns}`);
    console.log(`AdSets:    ${result.adsets}`);
    console.log(`Ads:       ${result.ads}`);
    console.log(`Creatives: ${result.creatives}`);
    console.log(`Insights:  ${result.insights}`);
    console.log(`Duration:  ${(result.duration_ms / 1000).toFixed(1)}s`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    // Show record counts
    console.log('\n=== Record Counts ===');
    const tables = ['meta_accounts', 'meta_campaigns', 'meta_adsets', 'meta_ads', 'meta_creatives', 'meta_insights_daily'];
    for (const table of tables) {
      const { rows } = await pool.query(`SELECT COUNT(*) as count FROM meta_ads.${table}`);
      console.log(`${table}: ${rows[0].count} records`);
    }

  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function createTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_ads.meta_accounts (
      account_id VARCHAR(50) PRIMARY KEY,
      account_name VARCHAR(255),
      business_id VARCHAR(50),
      currency VARCHAR(10),
      timezone_name VARCHAR(100),
      account_status VARCHAR(50),
      created_time TIMESTAMP,
      updated_time TIMESTAMP,
      data_importacao TIMESTAMP,
      ativo VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS meta_ads.meta_campaigns (
      campaign_id VARCHAR(50) PRIMARY KEY,
      account_id VARCHAR(50) NOT NULL,
      campaign_name VARCHAR(255) NOT NULL,
      objective VARCHAR(100),
      status VARCHAR(50),
      configured_status VARCHAR(50),
      effective_status VARCHAR(50),
      buying_type VARCHAR(50),
      daily_budget DECIMAL(15,4),
      lifetime_budget DECIMAL(15,4),
      budget_remaining DECIMAL(15,4),
      spend_cap DECIMAL(15,4),
      bid_strategy VARCHAR(100),
      start_time TIMESTAMP,
      stop_time TIMESTAMP,
      created_time TIMESTAMP,
      updated_time TIMESTAMP,
      data_importacao TIMESTAMP,
      data_atualizacao TIMESTAMP,
      ativo VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS meta_ads.meta_adsets (
      adset_id VARCHAR(50) PRIMARY KEY,
      campaign_id VARCHAR(50) NOT NULL,
      account_id VARCHAR(50) NOT NULL,
      adset_name VARCHAR(255) NOT NULL,
      status VARCHAR(50),
      configured_status VARCHAR(50),
      effective_status VARCHAR(50),
      daily_budget DECIMAL(15,4),
      lifetime_budget DECIMAL(15,4),
      budget_remaining DECIMAL(15,4),
      bid_amount DECIMAL(15,4),
      bid_strategy VARCHAR(100),
      optimization_goal VARCHAR(100),
      billing_event VARCHAR(100),
      created_time TIMESTAMP,
      updated_time TIMESTAMP,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      targeting_age_min INTEGER,
      targeting_age_max INTEGER,
      learning_stage_status VARCHAR(100),
      learning_stage_conversions INTEGER,
      data_importacao TIMESTAMP,
      data_atualizacao TIMESTAMP,
      ativo VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS meta_ads.meta_ads (
      ad_id VARCHAR(50) PRIMARY KEY,
      adset_id VARCHAR(50) NOT NULL,
      campaign_id VARCHAR(50) NOT NULL,
      account_id VARCHAR(50) NOT NULL,
      ad_name VARCHAR(255) NOT NULL,
      status VARCHAR(50),
      configured_status VARCHAR(50),
      effective_status VARCHAR(50),
      bid_type VARCHAR(50),
      bid_amount DECIMAL(15,4),
      creative_id VARCHAR(50),
      created_time TIMESTAMP,
      updated_time TIMESTAMP,
      demolink_hash VARCHAR(255),
      preview_shareable_link TEXT,
      data_importacao TIMESTAMP,
      data_atualizacao TIMESTAMP,
      ativo VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS meta_ads.meta_creatives (
      creative_id VARCHAR(50) PRIMARY KEY,
      account_id VARCHAR(50) NOT NULL,
      creative_name VARCHAR(255),
      object_type VARCHAR(50),
      status VARCHAR(50),
      title VARCHAR(500),
      body TEXT,
      call_to_action_type VARCHAR(100),
      image_url TEXT,
      video_url TEXT,
      created_time TIMESTAMP,
      updated_time TIMESTAMP,
      data_importacao TIMESTAMP,
      ativo VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS meta_ads.meta_insights_daily (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(50) NOT NULL,
      campaign_id VARCHAR(50),
      adset_id VARCHAR(50),
      ad_id VARCHAR(50),
      date_start DATE NOT NULL,
      date_stop DATE NOT NULL,
      impressions INTEGER,
      clicks INTEGER,
      spend DECIMAL(15,4),
      reach INTEGER,
      frequency DECIMAL(10,4),
      cpm DECIMAL(10,4),
      cpc DECIMAL(10,4),
      ctr DECIMAL(10,6),
      cpp DECIMAL(10,4),
      inline_link_clicks INTEGER,
      inline_link_click_ctr DECIMAL(10,6),
      outbound_clicks INTEGER,
      outbound_clicks_ctr DECIMAL(10,6),
      unique_clicks INTEGER,
      unique_ctr DECIMAL(10,6),
      unique_inline_link_clicks INTEGER,
      unique_inline_link_click_ctr DECIMAL(10,6),
      conversions INTEGER,
      conversion_rate DECIMAL(10,6),
      cost_per_conversion DECIMAL(10,4),
      video_play_actions INTEGER,
      video_p25_watched_actions INTEGER,
      video_p50_watched_actions INTEGER,
      video_p75_watched_actions INTEGER,
      video_p100_watched_actions INTEGER,
      video_avg_time_watched_actions DECIMAL(10,2),
      purchase_roas DECIMAL(10,4),
      website_purchase_roas DECIMAL(10,4),
      quality_ranking VARCHAR(50),
      engagement_rate_ranking VARCHAR(50),
      conversion_rate_ranking VARCHAR(50),
      data_importacao TIMESTAMP,
      hash_dados VARCHAR(64),
      UNIQUE(date_start, ad_id, adset_id, campaign_id)
    );

    CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON meta_ads.meta_insights_daily(date_start);
    CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign ON meta_ads.meta_insights_daily(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_meta_insights_adset ON meta_ads.meta_insights_daily(adset_id);
    CREATE INDEX IF NOT EXISTS idx_meta_insights_ad ON meta_ads.meta_insights_daily(ad_id);
    CREATE INDEX IF NOT EXISTS idx_meta_insights_account ON meta_ads.meta_insights_daily(account_id);
  `);
  console.log('Tables created successfully');
}

main();
