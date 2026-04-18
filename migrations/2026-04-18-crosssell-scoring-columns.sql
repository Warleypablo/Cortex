-- Cross-sell opportunity scoring columns
-- Adds origin, priority, score details, and reason to oportunidades

ALTER TABLE cortex_core.crosssell_oportunidades
  ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS prioridade VARCHAR(10),
  ADD COLUMN IF NOT EXISTS score_detalhes JSONB,
  ADD COLUMN IF NOT EXISTS motivo TEXT;

-- Index for filtering by origem and prioridade
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_origem ON cortex_core.crosssell_oportunidades(origem);
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_prioridade ON cortex_core.crosssell_oportunidades(prioridade);
