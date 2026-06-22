-- Plano de orçamento por etapa do funil, usado pela tela
-- /growth/orcamento-campanhas (planejamento top-down).
--
-- Modelo: cada "pool" (valor de campaign_tags.tag, ex: inbound) tem um total
-- mensal (budget_pool_plan) que é distribuído entre as etapas do funil
-- (budget_stage_plan). O alvo de cada etapa pode ser definido em % do total
-- (unit='pct') ou em valor absoluto travado (unit='brl'). O investido e o
-- % atingido de cada etapa são calculados em runtime somando o gasto das
-- campanhas marcadas com aquela etapa.

CREATE TABLE IF NOT EXISTS cortex_core.budget_pool_plan (
    pool TEXT NOT NULL,
    month DATE NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    PRIMARY KEY (pool, month)
);

CREATE TABLE IF NOT EXISTS cortex_core.budget_stage_plan (
    pool TEXT NOT NULL,
    month DATE NOT NULL,
    stage TEXT NOT NULL,
    value NUMERIC(12, 2) NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('pct', 'brl')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    PRIMARY KEY (pool, month, stage)
);

COMMENT ON TABLE cortex_core.budget_pool_plan IS
    'Total mensal de investimento por pool (campaign_tags.tag). month: primeiro dia do mês.';
COMMENT ON TABLE cortex_core.budget_stage_plan IS
    'Alvo por etapa do funil dentro de um pool/mês. unit: pct (% do total do pool) ou brl (valor travado). stage validado no app.';
