-- Amplia as métricas de TikTok Ads sincronizadas do report/integrated/get.
-- Confirmadas válidas via probe (scripts/probe-tiktok-metrics.ts) na conta Turbo.
-- Destaque: total_landing_page_view (LPV nativo) → habilita Connect Rate real do TikTok.
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS). raw (JSONB) já guarda tudo que é pedido.

-- Nível campanha (alimenta o Connect Rate na aba Orçado x Realizado)
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS landing_page_views BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS reach              BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS frequency          NUMERIC;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_views        BIGINT;   -- video_play_actions
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_watched_2s   BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_watched_6s   BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_views_p25    BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_views_p50    BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_views_p75    BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS video_views_p100   BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS average_video_play NUMERIC;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS likes              BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS comments           BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS shares             BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS follows            BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS profile_visits     BIGINT;
ALTER TABLE tiktok.ad_metrics_daily ADD COLUMN IF NOT EXISTS engagements        BIGINT;

-- Nível anúncio (aba Criativos)
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS landing_page_views BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS reach              BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS frequency          NUMERIC;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS video_watched_2s   BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS video_watched_6s   BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS video_views_p25    BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS video_views_p50    BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS video_views_p75    BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS video_views_p100   BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS average_video_play NUMERIC;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS likes              BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS comments           BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS shares             BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS follows            BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS profile_visits     BIGINT;
ALTER TABLE tiktok.ad_insights_daily ADD COLUMN IF NOT EXISTS engagements        BIGINT;
