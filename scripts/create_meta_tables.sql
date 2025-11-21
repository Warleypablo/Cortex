-- Meta Ads Database Schema
-- Creates all necessary tables for Meta Ads analytics and CRM conversion tracking

-- 1. Meta Accounts Table
CREATE TABLE IF NOT EXISTS meta_accounts (
    account_id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL,
    currency TEXT DEFAULT 'BRL',
    timezone_name TEXT,
    created_time TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Meta Campaigns Table
CREATE TABLE IF NOT EXISTS meta_campaigns (
    campaign_id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES meta_accounts(account_id),
    campaign_name TEXT NOT NULL,
    objective TEXT,
    status TEXT,
    created_time TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Meta AdSets Table
CREATE TABLE IF NOT EXISTS meta_adsets (
    adset_id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES meta_campaigns(campaign_id),
    account_id TEXT REFERENCES meta_accounts(account_id),
    adset_name TEXT NOT NULL,
    optimization_goal TEXT,
    billing_event TEXT,
    bid_amount NUMERIC(12, 2),
    daily_budget NUMERIC(12, 2),
    lifetime_budget NUMERIC(12, 2),
    status TEXT,
    created_time TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Meta Ads Table
CREATE TABLE IF NOT EXISTS meta_ads (
    ad_id TEXT PRIMARY KEY,
    adset_id TEXT REFERENCES meta_adsets(adset_id),
    campaign_id TEXT REFERENCES meta_campaigns(campaign_id),
    account_id TEXT REFERENCES meta_accounts(account_id),
    ad_name TEXT NOT NULL,
    creative_id TEXT,
    status TEXT,
    created_time TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Meta Creatives Table
CREATE TABLE IF NOT EXISTS meta_creatives (
    creative_id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES meta_accounts(account_id),
    creative_name TEXT,
    title TEXT,
    body TEXT,
    image_url TEXT,
    video_url TEXT,
    call_to_action TEXT,
    object_type TEXT,
    created_time TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Meta Insights Daily Table (Performance Metrics)
CREATE TABLE IF NOT EXISTS meta_insights_daily (
    id SERIAL PRIMARY KEY,
    date_start DATE NOT NULL,
    account_id TEXT REFERENCES meta_accounts(account_id),
    campaign_id TEXT REFERENCES meta_campaigns(campaign_id),
    adset_id TEXT REFERENCES meta_adsets(adset_id),
    ad_id TEXT REFERENCES meta_ads(ad_id),
    creative_id TEXT REFERENCES meta_creatives(creative_id),
    
    -- Core Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend NUMERIC(12, 2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    frequency NUMERIC(10, 4) DEFAULT 0,
    
    -- Calculated Metrics (stored for performance)
    cpm NUMERIC(10, 4) DEFAULT 0,
    cpc NUMERIC(10, 4) DEFAULT 0,
    ctr NUMERIC(10, 4) DEFAULT 0,
    
    -- Video Metrics
    video_p25_watched INTEGER DEFAULT 0,
    video_p50_watched INTEGER DEFAULT 0,
    video_p75_watched INTEGER DEFAULT 0,
    video_p100_watched INTEGER DEFAULT 0,
    
    -- Conversion Metrics (Meta's own tracking)
    actions_lead INTEGER DEFAULT 0,
    actions_purchase INTEGER DEFAULT 0,
    action_values_purchase NUMERIC(12, 2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicates
    UNIQUE(date_start, ad_id, adset_id, campaign_id)
);

-- 7. CRM Deal Table (for conversion tracking via UTM)
CREATE TABLE IF NOT EXISTS crm_deal (
    deal_id TEXT PRIMARY KEY,
    deal_name TEXT,
    stage_name TEXT,
    pipeline_name TEXT,
    
    -- Financial
    valor_pontual NUMERIC(12, 2) DEFAULT 0,
    valor_recorrente NUMERIC(12, 2) DEFAULT 0,
    
    -- UTM Tracking (maps to Meta Ads)
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,  -- Maps to campaign_id
    utm_term TEXT,      -- Maps to adset_id
    utm_content TEXT,   -- Maps to ad_id
    
    -- Contact/Company
    contact_name TEXT,
    company_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    
    -- Timestamps
    created_date TIMESTAMP,
    close_date TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    owner_name TEXT,
    lead_source TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON meta_insights_daily(date_start);
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign ON meta_insights_daily(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_adset ON meta_insights_daily(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_ad ON meta_insights_daily(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_creative ON meta_insights_daily(creative_id);

CREATE INDEX IF NOT EXISTS idx_crm_deal_utm_campaign ON crm_deal(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_crm_deal_utm_term ON crm_deal(utm_term);
CREATE INDEX IF NOT EXISTS idx_crm_deal_utm_content ON crm_deal(utm_content);
CREATE INDEX IF NOT EXISTS idx_crm_deal_stage ON crm_deal(stage_name);
CREATE INDEX IF NOT EXISTS idx_crm_deal_created ON crm_deal(created_date);

-- Comments for documentation
COMMENT ON TABLE meta_insights_daily IS 'Daily performance metrics from Meta Ads API';
COMMENT ON TABLE crm_deal IS 'CRM deals with UTM tracking for Meta Ads attribution';
COMMENT ON COLUMN crm_deal.utm_campaign IS 'Maps to meta_campaigns.campaign_id';
COMMENT ON COLUMN crm_deal.utm_term IS 'Maps to meta_adsets.adset_id';
COMMENT ON COLUMN crm_deal.utm_content IS 'Maps to meta_ads.ad_id';
