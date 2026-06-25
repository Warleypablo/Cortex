-- Migration: UTM v1 — adiciona colunas novas em Bitrix.crm_deal
-- Idempotente: ADD COLUMN IF NOT EXISTS não falha se coluna já existir
-- Pré-requisito: rodar ANTES do sync atualizado
-- Postgres ≥11: ADD COLUMN com default NULL é metadata-only (sem rewrite da tabela)

ALTER TABLE "Bitrix".crm_deal
    ADD COLUMN IF NOT EXISTS utm_medium  TEXT,
    ADD COLUMN IF NOT EXISTS fbclid      TEXT,
    ADD COLUMN IF NOT EXISTS gclid       TEXT,
    ADD COLUMN IF NOT EXISTS referrer    TEXT,
    ADD COLUMN IF NOT EXISTS user_agent  TEXT,
    ADD COLUMN IF NOT EXISTS ip          TEXT;

-- Sanity check: imprime colunas adicionadas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'Bitrix'
  AND table_name   = 'crm_deal'
  AND column_name IN ('utm_medium', 'fbclid', 'gclid', 'referrer', 'user_agent', 'ip')
ORDER BY column_name;
