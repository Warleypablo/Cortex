-- Adiciona colunas video_3_sec_watched_actions e video_thruplay_watched_actions
-- nas tabelas de insights da Meta, base das métricas Video Hook e Video Hold
-- (fórmula da Andre: 3sec/impressoes e thruplay/impressoes).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- Reversível: DROP COLUMN para reverter.

ALTER TABLE meta_ads.meta_insights_daily
  ADD COLUMN IF NOT EXISTS video_3_sec_watched_actions BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_thruplay_watched_actions BIGINT DEFAULT 0;

ALTER TABLE meta_ads.meta_insights_by_platform_daily
  ADD COLUMN IF NOT EXISTS video_3_sec_watched_actions BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_thruplay_watched_actions BIGINT DEFAULT 0;
