-- Adiciona coluna video_thruplay_watched_actions nas tabelas de insights da Meta,
-- base da métrica Video Hold (thruplay / impressoes).
--
-- Video Hook usa video_play_actions (campo já existente — Meta UI: "Reproduções do vídeo",
-- views ≥ 3 segundos). A Meta API v18 não expõe `video_3_sec_watched_actions`
-- como field separado — daí usarmos `video_play_actions`, que tem a mesma semântica.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- Reversível: DROP COLUMN para reverter.

ALTER TABLE meta_ads.meta_insights_daily
  ADD COLUMN IF NOT EXISTS video_thruplay_watched_actions BIGINT DEFAULT 0;

ALTER TABLE meta_ads.meta_insights_by_platform_daily
  ADD COLUMN IF NOT EXISTS video_thruplay_watched_actions BIGINT DEFAULT 0;

-- Limpa coluna criada na primeira tentativa (Meta API não expõe o field
-- como nome separado; usamos video_play_actions no lugar):
ALTER TABLE meta_ads.meta_insights_daily
  DROP COLUMN IF EXISTS video_3_sec_watched_actions;
ALTER TABLE meta_ads.meta_insights_by_platform_daily
  DROP COLUMN IF EXISTS video_3_sec_watched_actions;
