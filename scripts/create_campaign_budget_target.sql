-- Meta travada por campanha individual, usada pela tela
-- /growth/orcamento-campanhas. Suporta qualquer plataforma (Meta, Google,
-- TikTok, LinkedIn) — diferente de campaign_monthly_budget, que só cobre
-- Meta/Google e fica intocada/não usada pela UI nova (código legado).
--
-- Tabela separada de budget_plan_node de propósito: campaign_id não é um
-- enum estável como stage/produto/platform, e o pai de uma campanha (etapa/
-- produto/canal) já é 100% determinado por campaign_tags — duplicar isso
-- como parent_key aqui criaria uma segunda fonte de verdade que pode
-- dessincronizar se a classificação da campanha mudar depois de travada a meta.

CREATE TABLE IF NOT EXISTS cortex_core.campaign_budget_target (
    pool TEXT NOT NULL,
    month DATE NOT NULL,
    platform TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    value NUMERIC(12, 2) NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('pct', 'brl')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    PRIMARY KEY (pool, month, platform, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_budget_target_month ON cortex_core.campaign_budget_target(month);

COMMENT ON TABLE cortex_core.campaign_budget_target IS
    'Meta travada por campanha individual (qualquer plataforma). unit: pct (% do canal pai) ou brl (valor travado). Chave de classificação (etapa/produto/canal) vem de campaign_tags, não é duplicada aqui.';
