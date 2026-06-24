-- Catálogo de tags/grupos (pools) do Orçamento por Campanha.
-- Antes, as tags válidas (inbound/evento) eram uma constante no código
-- (CAMPAIGN_TAGS). Agora são configuráveis pela aba "Configuração" da tela
-- /growth/orcamento-campanhas — criar/renomear/arquivar uma tag não exige deploy.
--
-- `key` é o identificador ESTÁVEL (slug), referenciado por:
--   - cortex_core.campaign_tags.tag       (classificação da campanha)
--   - cortex_core.budget_pool_plan.pool   (total do mês)
--   - cortex_core.budget_stage_plan.pool  (alvo por etapa)
-- Por isso renomear (mudar `label`) NÃO quebra dados — só `key` é referência.
-- `active = false` arquiva a tag (some das abas) preservando os dados.

CREATE TABLE IF NOT EXISTS cortex_core.budget_tags (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT
);

-- Seed das tags que antes eram hardcoded, preservando os dados/planos já salvos.
INSERT INTO cortex_core.budget_tags (key, label, color, sort_order) VALUES
    ('inbound', 'Inbound', '#3b82f6', 1),
    ('evento',  'Evento',  '#f59e0b', 2)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE cortex_core.budget_tags IS
    'Catálogo de tags/grupos (pools) do Orçamento por Campanha. key: slug estável (referência), label: nome exibido, color: cor da aba/badge, active: false = arquivada.';
