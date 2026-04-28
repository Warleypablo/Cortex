-- migrations/2026-04-24_inadimplencia_snapshots.sql
-- Snapshot mensal de inadimplência total — 1 linha por mês, upsert por mes_referencia.

CREATE TABLE IF NOT EXISTS cortex_core.inadimplencia_snapshots (
  id                   SERIAL       PRIMARY KEY,
  mes_referencia       VARCHAR(7)   NOT NULL UNIQUE,
  data_snapshot        DATE         NOT NULL,
  valor_total          NUMERIC(14,2) NOT NULL,
  quantidade_clientes  INTEGER      NOT NULL,
  quantidade_parcelas  INTEGER      NOT NULL,
  ticket_medio         NUMERIC(14,2) NOT NULL,
  criado_em            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inadimplencia_snapshots_mes
  ON cortex_core.inadimplencia_snapshots (mes_referencia);

COMMENT ON TABLE cortex_core.inadimplencia_snapshots IS
  'Snapshot mensal do total de inadimplência (caz_parcelas.nao_pago). Registrado pelo job que roda ao meio-dia do último dia de cada mês.';
