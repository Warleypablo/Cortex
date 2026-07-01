-- Impression Share do Google no NÍVEL DE AD GROUP (não existe por anúncio na API).
--
-- search_impression_share e variantes (top / absolute top) só são expostas pela
-- Google Ads API nos recursos campaign e ad_group — nunca em ad_group_ad. Por isso
-- guardamos por ad group + dia, e a aba Criativos mostra IS só nos níveis Campanha
-- e Conjunto (ponderado por impressões entre ad groups); no nível Anúncio fica "—".
--
-- Valores são frações 0..1 (a API retorna assim). Armazenamos como NUMERIC; a
-- conversão para % (×100) acontece na leitura.
--
-- Idempotente. Backfill: rodar syncGoogleTurbo no período após criar a tabela.

CREATE TABLE IF NOT EXISTS google.ad_group_daily_metrics (
  report_date                        DATE    NOT NULL,
  ad_group_id                        BIGINT  NOT NULL,
  impressions                        BIGINT  NOT NULL DEFAULT 0,
  search_impression_share            NUMERIC,
  search_top_impression_share        NUMERIC,
  search_absolute_top_impression_share NUMERIC,
  synced_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_date, ad_group_id)
);

CREATE INDEX IF NOT EXISTS idx_google_agm_date
  ON google.ad_group_daily_metrics(report_date);
