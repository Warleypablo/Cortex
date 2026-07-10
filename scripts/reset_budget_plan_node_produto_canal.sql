-- Reset da árvore de metas ao remover o nível Etapa (stage) do Orçamento por
-- Campanha (modelo novo: Produto → Canal).
--
-- Os nós antigos estavam pendurados na etapa:
--   - level_type = 'stage'                       (o próprio nó de etapa)
--   - parent_key LIKE 'stage:%'                  (Produto sob stage, e Canal
--                                                 sob stage|product)
-- Sem a etapa, o Produto passa a ser raiz (parent_key = '') e o Canal fica sob
-- 'product:...'. Os nós órfãos acima nunca resolvem e só sujam a tabela, então
-- são apagados de uma vez.
--
-- NÃO toca em:
--   - cortex_core.budget_pool_plan       (total por pool/mês)
--   - cortex_core.campaign_budget_target (metas travadas por campanha)
--   - cortex_core.budget_stage_plan      (legado, rede de rollback)
--
-- Idempotente. Rodar uma vez no deploy desta mudança.

DELETE FROM cortex_core.budget_plan_node
WHERE level_type = 'stage'
   OR parent_key LIKE 'stage:%';
