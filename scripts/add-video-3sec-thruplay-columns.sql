-- Adiciona colunas video_3_sec_watched_actions e video_thruplay_watched_actions
-- nas tabelas de insights da Meta. Base das métricas:
--   Video Hook = video_3_sec_watched_actions / impressões
--   Video Hold = video_thruplay_watched_actions / impressões
--
-- video_3_sec_watched_actions é populado pelo sync extraindo `actions[]` com
-- action_type='video_view' da Meta API (a Meta v18 não expõe o field
-- "video_3_sec_watched_actions" como nome separado — é via actions[]).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- Reversível: DROP COLUMN para reverter.

ALTER TABLE meta_ads.meta_insights_daily
  ADD COLUMN IF NOT EXISTS video_3_sec_watched_actions BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_thruplay_watched_actions BIGINT DEFAULT 0;

ALTER TABLE meta_ads.meta_insights_by_platform_daily
  ADD COLUMN IF NOT EXISTS video_3_sec_watched_actions BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_thruplay_watched_actions BIGINT DEFAULT 0;
