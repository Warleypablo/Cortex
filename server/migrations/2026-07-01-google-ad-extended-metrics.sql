-- Amplia as métricas de Google Ads sincronizadas no NÍVEL DE ANÚNCIO
-- (google.ad_daily_metrics, lida pela aba Criativos via buildGoogleCriativos).
--
-- Todas são CONTADORES somáveis (razões são derivadas no frontend a partir das somas),
-- seguindo o mesmo princípio do Meta/TikTok: soma o bruto, calcula o percentual do total.
--
-- Disponíveis no recurso ad_group_ad da Google Ads API (ao contrário do Impression
-- Share, que só existe em campaign/ad_group — tratado à parte, nível Campanha/Conjunto).
--
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS). Backfill: reexecutar o sync do
-- período desejado (syncGoogleTurbo) após aplicar esta migração.

ALTER TABLE google.ad_daily_metrics ADD COLUMN IF NOT EXISTS view_through_conversions BIGINT   NOT NULL DEFAULT 0;
ALTER TABLE google.ad_daily_metrics ADD COLUMN IF NOT EXISTS all_conversions          NUMERIC  NOT NULL DEFAULT 0;
ALTER TABLE google.ad_daily_metrics ADD COLUMN IF NOT EXISTS interactions             BIGINT   NOT NULL DEFAULT 0;
ALTER TABLE google.ad_daily_metrics ADD COLUMN IF NOT EXISTS engagements              BIGINT   NOT NULL DEFAULT 0;

-- Verificação (esperado: 4 colunas novas presentes):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'google' AND table_name = 'ad_daily_metrics'
--     AND column_name IN ('view_through_conversions','all_conversions','interactions','engagements');
