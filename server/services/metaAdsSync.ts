/**
 * Meta Ads Sync Service
 *
 * Busca dados da Meta Graph API e persiste no banco PostgreSQL.
 * Hierarquia: Account → Campaigns → AdSets → Ads → Creatives + Insights Daily
 */

import { Pool } from 'pg';
import { linkAdsByName } from './adsCreation/creativeAdLinker';

const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Account ID da Turbo Partners (hardcoded — único account)
const TURBO_ACCOUNT_ID = 'act_1331413260627780';

interface SyncResult {
  accounts: number;
  campaigns: number;
  adsets: number;
  ads: number;
  creatives: number;
  insights: number;
  byPlatformInsights: number;
  errors: string[];
  duration_ms: number;
}

interface MetaCredentials {
  accessToken: string;
  businessId: string;
}

interface ParsedInsightRow {
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  cpm: number;
  cpc: number;
  ctr: number;
  inlineLinkClicks: number;
  outboundClicks: number;
  videoPlay: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP100: number;
  video3Sec: number;
  videoThruplay: number;
  conversions: number;
  landingPageViews: number;
}

function parseInsightRow(row: any): ParsedInsightRow {
  let actionsLead = 0;
  let actionsPurchase = 0;
  let landingPageViews = 0;
  let video3Sec = 0;

  if (row.actions) {
    for (const a of row.actions) {
      if (a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead') {
        actionsLead += parseInt(a.value || '0');
      }
      if (a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase') {
        actionsPurchase += parseInt(a.value || '0');
      }
      if (a.action_type === 'landing_page_view') {
        landingPageViews += parseInt(a.value || '0');
      }
      // Meta UI "Reproduções do vídeo" = action_type 'video_view' = 3+ second video plays
      if (a.action_type === 'video_view') {
        video3Sec += parseInt(a.value || '0');
      }
    }
  }

  const getVideoMetric = (arr: any[] | undefined): number => {
    if (!arr) return 0;
    return arr.reduce((sum: number, v: any) => sum + parseInt(v.value || '0'), 0);
  };

  const outboundClicks = Array.isArray(row.outbound_clicks)
    ? row.outbound_clicks.reduce((sum: number, v: any) => sum + parseInt(v.value || '0'), 0)
    : parseInt(row.outbound_clicks || '0');

  return {
    impressions: parseInt(row.impressions || '0'),
    clicks: parseInt(row.clicks || '0'),
    spend: parseFloat(row.spend || '0'),
    reach: parseInt(row.reach || '0'),
    frequency: parseFloat(row.frequency || '0'),
    cpm: parseFloat(row.cpm || '0'),
    cpc: parseFloat(row.cpc || '0'),
    ctr: parseFloat(row.ctr || '0'),
    inlineLinkClicks: parseInt(row.inline_link_clicks || '0'),
    outboundClicks,
    videoPlay: getVideoMetric(row.video_play_actions),
    videoP25: getVideoMetric(row.video_p25_watched_actions),
    videoP50: getVideoMetric(row.video_p50_watched_actions),
    videoP75: getVideoMetric(row.video_p75_watched_actions),
    videoP100: getVideoMetric(row.video_p100_watched_actions),
    video3Sec,
    videoThruplay: getVideoMetric(row.video_thruplay_watched_actions),
    conversions: actionsLead + actionsPurchase,
    landingPageViews,
  };
}

async function ensureByPlatformTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_ads.meta_insights_by_platform_daily (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(50) NOT NULL,
      campaign_id VARCHAR(50),
      adset_id VARCHAR(50),
      ad_id VARCHAR(50),
      date_start DATE NOT NULL,
      date_stop DATE NOT NULL,
      publisher_platform VARCHAR(32) NOT NULL,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      spend DECIMAL(15,4) DEFAULT 0,
      reach INTEGER DEFAULT 0,
      frequency DECIMAL(10,4) DEFAULT 0,
      cpm DECIMAL(10,4) DEFAULT 0,
      cpc DECIMAL(10,4) DEFAULT 0,
      ctr DECIMAL(10,6) DEFAULT 0,
      inline_link_clicks INTEGER DEFAULT 0,
      outbound_clicks INTEGER DEFAULT 0,
      video_play_actions INTEGER DEFAULT 0,
      video_p25_watched_actions INTEGER DEFAULT 0,
      video_p50_watched_actions INTEGER DEFAULT 0,
      video_p75_watched_actions INTEGER DEFAULT 0,
      video_p100_watched_actions INTEGER DEFAULT 0,
      video_3_sec_watched_actions BIGINT DEFAULT 0,
      video_thruplay_watched_actions BIGINT DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      landing_page_views INTEGER DEFAULT 0,
      data_importacao TIMESTAMP DEFAULT NOW(),
      CONSTRAINT meta_insights_by_platform_unique UNIQUE
        (account_id, campaign_id, adset_id, ad_id, date_start, publisher_platform)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_insights_platform_date
    ON meta_ads.meta_insights_by_platform_daily (date_start, publisher_platform)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_insights_platform_account
    ON meta_ads.meta_insights_by_platform_daily (account_id, publisher_platform)
  `);
}

function getCredentials(): MetaCredentials {
  const accessToken = process.env.ACCESS_TOKEN_META_SYSTEM;
  const businessId = process.env.BUSINESS_ID_META;
  if (!accessToken) throw new Error('ACCESS_TOKEN_META_SYSTEM não configurado');
  if (!businessId) throw new Error('BUSINESS_ID_META não configurado');
  return { accessToken, businessId };
}

async function fetchMetaApi(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const creds = getCredentials();
  const url = new URL(`${META_API_BASE}/${endpoint}`);
  url.searchParams.set('access_token', creds.accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Meta API ${response.status}: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch all pages from a paginated Meta API endpoint.
 * Throws on pagination errors — silent breaks would return partial data and cause data gaps.
 */
async function fetchAllPages(endpoint: string, params: Record<string, string> = {}, pageLimit = 200): Promise<any[]> {
  const allData: any[] = [];
  let pageCount = 0;

  const firstPage = await fetchMetaApi(endpoint, { ...params, limit: String(pageLimit) });
  allData.push(...(firstPage.data || []));
  pageCount++;

  let url: string | null = firstPage.paging?.next || null;

  while (url) {
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Meta API pagination failed on page ${pageCount + 1} (HTTP ${response.status}): ${errorBody.slice(0, 200)}`);
    }
    const data = await response.json();
    allData.push(...(data.data || []));
    url = data.paging?.next || null;
    pageCount++;
  }

  console.log(`[MetaSync] fetchAllPages: ${pageCount} pages, ${allData.length} total rows`);
  return allData;
}

// ===================== SYNC FUNCTIONS =====================

async function syncAccount(pool: Pool): Promise<number> {
  console.log('[MetaSync] Syncing account...');
  const data = await fetchMetaApi(TURBO_ACCOUNT_ID, {
    fields: 'account_id,name,currency,timezone_name,account_status',
  });

  await pool.query(`
    INSERT INTO meta_ads.meta_accounts (account_id, account_name, currency, timezone_name, account_status, data_importacao, ativo)
    VALUES ($1, $2, $3, $4, $5, NOW(), true)
    ON CONFLICT (account_id) DO UPDATE SET
      account_name = EXCLUDED.account_name,
      currency = EXCLUDED.currency,
      timezone_name = EXCLUDED.timezone_name,
      account_status = EXCLUDED.account_status,
      updated_time = NOW()
  `, [TURBO_ACCOUNT_ID, data.name, data.currency, data.timezone_name, String(data.account_status)]);

  console.log(`[MetaSync] Account synced: ${data.name}`);
  return 1;
}

async function syncCampaigns(pool: Pool): Promise<number> {
  console.log('[MetaSync] Syncing campaigns...');
  const campaigns = await fetchAllPages(`${TURBO_ACCOUNT_ID}/campaigns`, {
    fields: 'id,name,objective,status,configured_status,effective_status,daily_budget,lifetime_budget,budget_remaining,spend_cap,buying_type,bid_strategy,start_time,stop_time,created_time,updated_time',
  });

  for (const c of campaigns) {
    await pool.query(`
      INSERT INTO meta_ads.meta_campaigns (
        campaign_id, account_id, campaign_name, objective, status, configured_status, effective_status,
        buying_type, daily_budget, lifetime_budget, budget_remaining, spend_cap, bid_strategy,
        start_time, stop_time, created_time, updated_time, data_importacao, ativo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),true)
      ON CONFLICT (campaign_id) DO UPDATE SET
        campaign_name=EXCLUDED.campaign_name, objective=EXCLUDED.objective, status=EXCLUDED.status,
        configured_status=EXCLUDED.configured_status, effective_status=EXCLUDED.effective_status,
        buying_type=EXCLUDED.buying_type, daily_budget=EXCLUDED.daily_budget, lifetime_budget=EXCLUDED.lifetime_budget,
        budget_remaining=EXCLUDED.budget_remaining, spend_cap=EXCLUDED.spend_cap, bid_strategy=EXCLUDED.bid_strategy,
        start_time=EXCLUDED.start_time, stop_time=EXCLUDED.stop_time,
        updated_time=EXCLUDED.updated_time, data_atualizacao=NOW()
    `, [
      c.id, TURBO_ACCOUNT_ID, c.name, c.objective, c.status, c.configured_status, c.effective_status,
      c.buying_type, c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
      c.budget_remaining ? parseFloat(c.budget_remaining) / 100 : null,
      c.spend_cap ? parseFloat(c.spend_cap) / 100 : null,
      c.bid_strategy,
      c.start_time || null, c.stop_time || null,
      c.created_time || null, c.updated_time || null,
    ]);
  }

  console.log(`[MetaSync] ${campaigns.length} campaigns synced`);
  return campaigns.length;
}

async function syncAdsets(pool: Pool): Promise<number> {
  console.log('[MetaSync] Syncing adsets...');
  const adsets = await fetchAllPages(`${TURBO_ACCOUNT_ID}/adsets`, {
    fields: 'id,name,campaign_id,status,configured_status,effective_status,daily_budget,lifetime_budget,budget_remaining,bid_amount,bid_strategy,optimization_goal,billing_event,created_time,updated_time,start_time,end_time',
  });

  for (const a of adsets) {
    await pool.query(`
      INSERT INTO meta_ads.meta_adsets (
        adset_id, campaign_id, account_id, adset_name, status, configured_status, effective_status,
        daily_budget, lifetime_budget, budget_remaining, bid_amount, bid_strategy,
        optimization_goal, billing_event, created_time, updated_time, start_time, end_time,
        data_importacao, ativo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),true)
      ON CONFLICT (adset_id) DO UPDATE SET
        adset_name=EXCLUDED.adset_name, campaign_id=EXCLUDED.campaign_id, status=EXCLUDED.status,
        configured_status=EXCLUDED.configured_status, effective_status=EXCLUDED.effective_status,
        daily_budget=EXCLUDED.daily_budget, lifetime_budget=EXCLUDED.lifetime_budget,
        budget_remaining=EXCLUDED.budget_remaining, bid_amount=EXCLUDED.bid_amount,
        bid_strategy=EXCLUDED.bid_strategy, optimization_goal=EXCLUDED.optimization_goal,
        billing_event=EXCLUDED.billing_event, updated_time=EXCLUDED.updated_time,
        start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time, data_atualizacao=NOW()
    `, [
      a.id, a.campaign_id, TURBO_ACCOUNT_ID, a.name, a.status, a.configured_status, a.effective_status,
      a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
      a.lifetime_budget ? parseFloat(a.lifetime_budget) / 100 : null,
      a.budget_remaining ? parseFloat(a.budget_remaining) / 100 : null,
      a.bid_amount ? parseFloat(a.bid_amount) / 100 : null,
      a.bid_strategy, a.optimization_goal, a.billing_event,
      a.created_time || null, a.updated_time || null, a.start_time || null, a.end_time || null,
    ]);
  }

  console.log(`[MetaSync] ${adsets.length} adsets synced`);
  return adsets.length;
}

async function syncAdsAndCreatives(pool: Pool): Promise<{ ads: number; creatives: number }> {
  console.log('[MetaSync] Syncing ads + creatives...');
  const ads = await fetchAllPages(`${TURBO_ACCOUNT_ID}/ads`, {
    fields: 'id,name,adset_id,campaign_id,status,configured_status,effective_status,creative{id,name,title,body,thumbnail_url,image_url,call_to_action_type,object_type,status},created_time,updated_time,preview_shareable_link',
  }, 50);

  const creativeIds = new Set<string>();
  let creativeCount = 0;

  for (const ad of ads) {
    // Upsert creative first (if present)
    if (ad.creative?.id && !creativeIds.has(ad.creative.id)) {
      creativeIds.add(ad.creative.id);
      const cr = ad.creative;
      await pool.query(`
        INSERT INTO meta_ads.meta_creatives (
          creative_id, account_id, creative_name, object_type, status, title, body,
          call_to_action_type, image_url, video_url, data_importacao, ativo
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),true)
        ON CONFLICT (creative_id) DO UPDATE SET
          creative_name=EXCLUDED.creative_name, object_type=EXCLUDED.object_type,
          status=EXCLUDED.status, title=EXCLUDED.title, body=EXCLUDED.body,
          call_to_action_type=EXCLUDED.call_to_action_type,
          image_url=COALESCE(EXCLUDED.image_url, meta_ads.meta_creatives.image_url),
          updated_time=NOW()
      `, [
        cr.id, TURBO_ACCOUNT_ID, cr.name || null, cr.object_type || null,
        cr.status || null, cr.title || null, cr.body || null,
        cr.call_to_action_type || null,
        cr.image_url || cr.thumbnail_url || null,
        null, // video_url not available via API subfield
      ]);
      creativeCount++;
    }

    // Upsert ad
    await pool.query(`
      INSERT INTO meta_ads.meta_ads (
        ad_id, adset_id, campaign_id, account_id, ad_name, status, configured_status,
        effective_status, creative_id, created_time, updated_time, preview_shareable_link,
        data_importacao, ativo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),true)
      ON CONFLICT (ad_id) DO UPDATE SET
        ad_name=EXCLUDED.ad_name, adset_id=EXCLUDED.adset_id, campaign_id=EXCLUDED.campaign_id,
        status=EXCLUDED.status, configured_status=EXCLUDED.configured_status,
        effective_status=EXCLUDED.effective_status, creative_id=EXCLUDED.creative_id,
        updated_time=EXCLUDED.updated_time, preview_shareable_link=EXCLUDED.preview_shareable_link,
        data_atualizacao=NOW()
    `, [
      ad.id, ad.adset_id, ad.campaign_id, TURBO_ACCOUNT_ID, ad.name,
      ad.status, ad.configured_status, ad.effective_status,
      ad.creative?.id || null, ad.created_time || null, ad.updated_time || null,
      ad.preview_shareable_link || null,
    ]);
  }

  console.log(`[MetaSync] ${ads.length} ads + ${creativeCount} creatives synced`);
  return { ads: ads.length, creatives: creativeCount };
}

async function syncInsightsDaily(pool: Pool, since: string, until: string): Promise<number> {
  console.log(`[MetaSync] Syncing daily insights ${since} → ${until}...`);

  const timeRange = JSON.stringify({ since, until });
  const insights = await fetchAllPages(`${TURBO_ACCOUNT_ID}/insights`, {
    fields: 'campaign_id,adset_id,ad_id,impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,inline_link_clicks,outbound_clicks,actions,action_values,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions',
    time_range: timeRange,
    level: 'ad',
    time_increment: '1',
  });

  let count = 0;
  for (const row of insights) {
    const p = parseInsightRow(row);
    await pool.query(`
      INSERT INTO meta_ads.meta_insights_daily (
        account_id, campaign_id, adset_id, ad_id, date_start, date_stop,
        impressions, clicks, spend, reach, frequency, cpm, cpc, ctr,
        inline_link_clicks, outbound_clicks,
        video_play_actions, video_p25_watched_actions, video_p50_watched_actions,
        video_p75_watched_actions, video_p100_watched_actions,
        video_3_sec_watched_actions, video_thruplay_watched_actions,
        conversions, landing_page_views, data_importacao
      ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW())
      ON CONFLICT ON CONSTRAINT meta_insights_daily_account_id_campaign_id_adset_id_ad_id_d_key
      DO UPDATE SET
        impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend,
        reach=EXCLUDED.reach, frequency=EXCLUDED.frequency, cpm=EXCLUDED.cpm,
        cpc=EXCLUDED.cpc, ctr=EXCLUDED.ctr,
        inline_link_clicks=EXCLUDED.inline_link_clicks, outbound_clicks=EXCLUDED.outbound_clicks,
        video_play_actions=EXCLUDED.video_play_actions,
        video_p25_watched_actions=EXCLUDED.video_p25_watched_actions,
        video_p50_watched_actions=EXCLUDED.video_p50_watched_actions,
        video_p75_watched_actions=EXCLUDED.video_p75_watched_actions,
        video_p100_watched_actions=EXCLUDED.video_p100_watched_actions,
        video_3_sec_watched_actions=EXCLUDED.video_3_sec_watched_actions,
        video_thruplay_watched_actions=EXCLUDED.video_thruplay_watched_actions,
        conversions=EXCLUDED.conversions, landing_page_views=EXCLUDED.landing_page_views,
        data_importacao=NOW()
    `, [
      TURBO_ACCOUNT_ID, row.campaign_id || null, row.adset_id || null, row.ad_id || null,
      row.date_start,
      p.impressions, p.clicks, p.spend, p.reach,
      p.frequency, p.cpm, p.cpc, p.ctr,
      p.inlineLinkClicks, p.outboundClicks,
      p.videoPlay,
      p.videoP25, p.videoP50, p.videoP75, p.videoP100,
      p.video3Sec, p.videoThruplay,
      p.conversions, p.landingPageViews,
    ]);
    count++;
  }

  console.log(`[MetaSync] ${count} insight rows synced`);
  return count;
}

async function syncInsightsDailyByPlatform(pool: Pool, since: string, until: string): Promise<number> {
  console.log(`[MetaSync] Syncing daily insights BY PLATFORM ${since} → ${until}...`);

  const timeRange = JSON.stringify({ since, until });
  const insights = await fetchAllPages(`${TURBO_ACCOUNT_ID}/insights`, {
    fields: 'campaign_id,adset_id,ad_id,impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,inline_link_clicks,outbound_clicks,actions,action_values,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions',
    time_range: timeRange,
    level: 'ad',
    time_increment: '1',
    breakdowns: 'publisher_platform',
  });

  let count = 0;
  for (const row of insights) {
    const platform: string = row.publisher_platform || 'unknown';
    const p = parseInsightRow(row);
    await pool.query(`
      INSERT INTO meta_ads.meta_insights_by_platform_daily (
        account_id, campaign_id, adset_id, ad_id, date_start, date_stop, publisher_platform,
        impressions, clicks, spend, reach, frequency, cpm, cpc, ctr,
        inline_link_clicks, outbound_clicks,
        video_p25_watched_actions, video_p50_watched_actions,
        video_p75_watched_actions, video_p100_watched_actions,
        video_3_sec_watched_actions, video_thruplay_watched_actions,
        conversions, landing_page_views, data_importacao
      ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW())
      ON CONFLICT ON CONSTRAINT meta_insights_by_platform_unique
      DO UPDATE SET
        impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend,
        reach=EXCLUDED.reach, frequency=EXCLUDED.frequency, cpm=EXCLUDED.cpm,
        cpc=EXCLUDED.cpc, ctr=EXCLUDED.ctr,
        inline_link_clicks=EXCLUDED.inline_link_clicks, outbound_clicks=EXCLUDED.outbound_clicks,
        video_p25_watched_actions=EXCLUDED.video_p25_watched_actions,
        video_p50_watched_actions=EXCLUDED.video_p50_watched_actions,
        video_p75_watched_actions=EXCLUDED.video_p75_watched_actions,
        video_p100_watched_actions=EXCLUDED.video_p100_watched_actions,
        video_3_sec_watched_actions=EXCLUDED.video_3_sec_watched_actions,
        video_thruplay_watched_actions=EXCLUDED.video_thruplay_watched_actions,
        conversions=EXCLUDED.conversions, landing_page_views=EXCLUDED.landing_page_views,
        data_importacao=NOW()
    `, [
      TURBO_ACCOUNT_ID, row.campaign_id || null, row.adset_id || null, row.ad_id || null,
      row.date_start, platform,
      p.impressions, p.clicks, p.spend, p.reach,
      p.frequency, p.cpm, p.cpc, p.ctr,
      p.inlineLinkClicks, p.outboundClicks,
      p.videoP25, p.videoP50, p.videoP75, p.videoP100,
      p.video3Sec, p.videoThruplay,
      p.conversions, p.landingPageViews,
    ]);
    count++;
  }

  console.log(`[MetaSync] ${count} by-platform insight rows synced`);
  return count;
}

// ===================== MAIN SYNC FUNCTION =====================

export async function syncMetaAds(pool: Pool, options?: { since?: string; until?: string }): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  const result: SyncResult = { accounts: 0, campaigns: 0, adsets: 0, ads: 0, creatives: 0, insights: 0, byPlatformInsights: 0, errors: [], duration_ms: 0 };

  // Default: last 7 days for insights (90/30 days caused too many API pages → HTTP 500 on page 8+)
  const today = new Date();
  const defaultSince = new Date(today);
  defaultSince.setDate(today.getDate() - 7);

  const since = options?.since || defaultSince.toISOString().split('T')[0];
  const until = options?.until || today.toISOString().split('T')[0];

  console.log(`[MetaSync] Starting full sync (${since} → ${until})...`);

  // Ensure landing_page_views column exists
  try {
    await pool.query(`ALTER TABLE meta_ads.meta_insights_daily ADD COLUMN IF NOT EXISTS landing_page_views INTEGER DEFAULT 0`);
  } catch (e) {
    // Column may already exist
  }

  // Ensure the per-platform breakdown table exists (isolated from meta_insights_daily)
  try {
    await ensureByPlatformTable(pool);
  } catch (e: any) {
    errors.push(`ByPlatform table: ${e.message}`);
    console.error('[MetaSync] Failed to ensure by-platform table:', e.message);
  }

  // 1. Account
  try {
    result.accounts = await syncAccount(pool);
  } catch (e: any) {
    errors.push(`Account: ${e.message}`);
    console.error('[MetaSync] Account sync failed:', e.message);
  }

  // 2. Campaigns
  try {
    result.campaigns = await syncCampaigns(pool);
  } catch (e: any) {
    errors.push(`Campaigns: ${e.message}`);
    console.error('[MetaSync] Campaigns sync failed:', e.message);
  }

  // 3. AdSets
  try {
    result.adsets = await syncAdsets(pool);
  } catch (e: any) {
    errors.push(`AdSets: ${e.message}`);
    console.error('[MetaSync] AdSets sync failed:', e.message);
  }

  // 4. Ads + Creatives
  try {
    const { ads, creatives } = await syncAdsAndCreatives(pool);
    result.ads = ads;
    result.creatives = creatives;
  } catch (e: any) {
    errors.push(`Ads/Creatives: ${e.message}`);
    console.error('[MetaSync] Ads/Creatives sync failed:', e.message);
  }

  // 5. Daily Insights
  try {
    result.insights = await syncInsightsDaily(pool, since, until);
  } catch (e: any) {
    errors.push(`Insights: ${e.message}`);
    console.error('[MetaSync] Insights sync failed:', e.message);
  }

  // 6. Daily Insights by publisher_platform (Instagram/Facebook/AN/Messenger)
  try {
    result.byPlatformInsights = await syncInsightsDailyByPlatform(pool, since, until);
  } catch (e: any) {
    errors.push(`InsightsByPlatform: ${e.message}`);
    console.error('[MetaSync] Insights by-platform sync failed:', e.message);
  }

  // 7. Vincula ad_id ↔ tpId da Biblioteca pelos ads batizados com prefixo TP## (nome_match).
  //    Cobre tanto ads criados via Cortex quanto subidos manualmente no Gerenciador.
  try {
    const r = await pool.query(`SELECT ad_id, ad_name FROM meta_ads.meta_ads WHERE ad_name ILIKE 'TP%'`);
    const link = await linkAdsByName(
      r.rows.map((x: any) => ({ adId: String(x.ad_id), adName: x.ad_name })),
      { source: 'name_match' },
    );
    console.log(`[MetaSync] Creative links: ${link.linked} novos vínculos (de ${r.rows.length} ads TP##)`);
  } catch (e: any) {
    errors.push(`CreativeLinks: ${e.message}`);
    console.error('[MetaSync] Creative linking failed:', e.message);
  }

  result.errors = errors;
  result.duration_ms = Date.now() - start;

  console.log(`[MetaSync] Sync complete in ${(result.duration_ms / 1000).toFixed(1)}s`);
  console.log(`[MetaSync] Results: ${result.accounts} accounts, ${result.campaigns} campaigns, ${result.adsets} adsets, ${result.ads} ads, ${result.creatives} creatives, ${result.insights} insights, ${result.byPlatformInsights} by-platform insights`);
  if (errors.length > 0) console.log(`[MetaSync] Errors: ${errors.join('; ')}`);

  return result;
}

/**
 * Detects gaps in meta_insights_daily and backfills them from the Meta API.
 * Scans the last `lookbackDays` days and syncs any date that is missing data.
 */
export async function backfillMetaInsightsGaps(pool: Pool, lookbackDays = 14): Promise<{ filled: string[]; errors: string[] }> {
  const today = new Date();
  const filled: string[] = [];
  const errors: string[] = [];

  // Find which dates have data in the last N days
  const result = await pool.query(`
    SELECT DISTINCT date_start::text FROM meta_ads.meta_insights_daily
    WHERE date_start >= (CURRENT_DATE - INTERVAL '${lookbackDays} days')::date
    ORDER BY date_start
  `);
  const datesWithData = new Set(result.rows.map((r: any) => r.date_start));

  // Find missing dates (including today)
  const missingDates: string[] = [];
  for (let i = lookbackDays; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (!datesWithData.has(dateStr)) missingDates.push(dateStr);
  }

  if (missingDates.length === 0) {
    console.log('[MetaSync] Backfill: no gaps detected');
    return { filled, errors };
  }

  console.log(`[MetaSync] Backfill: found ${missingDates.length} missing dates: ${missingDates.join(', ')}`);

  // Sync each missing date individually to avoid large API windows
  for (const date of missingDates) {
    try {
      const count = await syncInsightsDaily(pool, date, date);
      const countPlatform = await syncInsightsDailyByPlatform(pool, date, date);
      console.log(`[MetaSync] Backfill ${date}: ${count} insight rows, ${countPlatform} by-platform rows`);
      filled.push(date);
    } catch (e: any) {
      console.error(`[MetaSync] Backfill ${date} failed:`, e.message);
      errors.push(`${date}: ${e.message}`);
    }
  }

  return { filled, errors };
}
