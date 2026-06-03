-- Índice em cup_data_hist(data_snapshot)
-- Resolve timeout no endpoint /api/dashboard/evolucao-mensal (100s+ → ~200ms)
-- Tabela tem 261k+ rows e era full-scanned em todas as subqueries.
-- Aplicado em prod (GCP) e local em 2026-05-22.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cup_data_hist_data_snapshot
  ON "Clickup".cup_data_hist (data_snapshot);

ANALYZE "Clickup".cup_data_hist;
