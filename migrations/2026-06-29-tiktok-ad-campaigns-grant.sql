-- Correção definitiva do sync TikTok ad-level na aba Criativos.
--
-- Contexto: as tabelas de nível-campanha tiktok.ad_campaigns e tiktok.ad_metrics_daily
-- foram criadas com owner `postgres` e SEM grants para `growth_dev` (o role que a aplicação
-- usa). O sync (server/services/tiktokAdsSync.ts) escreve nessas tabelas no início do loop
-- de cada advertiser; sem permissão, a conta inteira abortava com "permission denied" e
-- nenhum anúncio da Turbo era gravado → aba Criativos vazia ao filtrar TikTok.
--
-- O fix de código (try/catch no nível-campanha) já evita o aborto, mas sem este GRANT o
-- nome da campanha e as métricas de campanha (orcado-realizado) ficam indisponíveis.
--
-- Rodar como `postgres` (owner) em produção. Idempotente.

GRANT SELECT, INSERT, UPDATE ON tiktok.ad_campaigns    TO growth_dev;
GRANT SELECT, INSERT, UPDATE ON tiktok.ad_metrics_daily TO growth_dev;

-- Alternativa mais robusta (alinha o owner com as tabelas irmãs ads/ad_groups/ad_insights_daily):
--   ALTER TABLE tiktok.ad_campaigns    OWNER TO growth_dev;
--   ALTER TABLE tiktok.ad_metrics_daily OWNER TO growth_dev;
