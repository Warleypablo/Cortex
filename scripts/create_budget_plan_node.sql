-- Árvore de metas genérica pra planejamento de orçamento, usada pela tela
-- /growth/orcamento-campanhas. Substitui budget_stage_plan (que continua
-- existindo, intocada, como rede de segurança de rollback).
--
-- Modelo: um nível (stage/product/platform) por linha. parent_key encadeia
-- a ancestralidade dentro do pool/mês ('' = raiz, o pai é budget_pool_plan.total;
-- senão 'type:key|type:key...') pra suportar "% do pai imediato" em qualquer
-- profundidade, não só "% do total do pool". level_type e level_key não têm
-- CHECK — são um enum extensível validado só em constante de app (mesmo
-- precedente de campaign_tags.tag/stage), pra não exigir migração cada vez
-- que um nível novo (ex: um 5º nível futuro) for adicionado.

CREATE TABLE IF NOT EXISTS cortex_core.budget_plan_node (
    pool TEXT NOT NULL,
    month DATE NOT NULL,
    level_type TEXT NOT NULL,
    level_key TEXT NOT NULL,
    parent_key TEXT NOT NULL DEFAULT '',
    value NUMERIC(12, 2) NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('pct', 'brl')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    PRIMARY KEY (pool, month, level_type, level_key, parent_key)
);

CREATE INDEX IF NOT EXISTS idx_budget_plan_node_month ON cortex_core.budget_plan_node(month);

-- Seed único e idempotente a partir da tabela legada (dado de stage vira nó
-- 'stage' na raiz da árvore). ON CONFLICT DO NOTHING garante que só popula
-- na primeira vez.
INSERT INTO cortex_core.budget_plan_node (pool, month, level_type, level_key, parent_key, value, unit, updated_at, updated_by)
SELECT pool, month, 'stage', stage, '', value, unit, updated_at, updated_by
FROM cortex_core.budget_stage_plan
ON CONFLICT (pool, month, level_type, level_key, parent_key) DO NOTHING;

COMMENT ON TABLE cortex_core.budget_plan_node IS
    'Árvore de metas de orçamento (stage/product/platform) por pool/mês. parent_key encadeia a ancestralidade ("" = raiz). unit: pct (% do pai imediato) ou brl (valor travado). level_type/level_key validados no app.';
