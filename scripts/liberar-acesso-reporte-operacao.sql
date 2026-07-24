-- Libera /reports/operacao para quem já usa os outros reportes — 2026-07-24
--
-- O QUE FAZ: adiciona '/reports/operacao' ao array allowed_routes de
-- cortex_core.auth_users para todo usuário que já tenha pelo menos uma das
-- rotas '/reports/mensal', '/reports/semanal' ou '/reports/trimestral' e
-- AINDA NÃO tenha '/reports/operacao'.
--
-- IDEMPOTENTE: pode rodar quantas vezes for preciso. Da segunda execução em
-- diante, a condição "NOT ('/reports/operacao' = ANY(...))" já exclui quem
-- ganhou a rota na rodada anterior — zero linhas afetadas, a rota nunca
-- duplica dentro do array.
--
-- Usa array_append, NÃO array_agg/reconstrução do array inteiro: a API de
-- usuários do Cortex SOBRESCREVE allowed_routes por completo a cada save
-- feito pela tela de admin, então rodar por fora com array_append é o único
-- jeito de ADICIONAR uma rota sem apagar as outras que o usuário já tinha.
--
-- PRECISA RODAR EM LOCAL E EM PRODUÇÃO — allowed_routes é uma coluna
-- independente em cada banco (ver reference_databases.md); rodar só num
-- ambiente libera o acesso só lá.
--
-- Cache: o app cacheia o usuário autenticado por ~5min (USER_CACHE_TTL_MS);
-- a rota nova aparece na tela após o cache expirar ou um novo login.

-- Conferência ANTES: quantos usuários já enxergam /reports/operacao
SELECT count(*) AS com_acesso_antes
FROM cortex_core.auth_users
WHERE '/reports/operacao' = ANY(COALESCE(allowed_routes, ARRAY[]::text[]));

UPDATE cortex_core.auth_users
SET allowed_routes = array_append(allowed_routes, '/reports/operacao')
WHERE allowed_routes && ARRAY['/reports/mensal', '/reports/semanal', '/reports/trimestral']::text[]
  AND NOT ('/reports/operacao' = ANY(COALESCE(allowed_routes, ARRAY[]::text[])));

-- Conferência DEPOIS: deve ser igual à contagem de quem tem pelo menos um
-- dos três reportes de origem (mensal/semanal/trimestral)
SELECT count(*) AS com_acesso_depois
FROM cortex_core.auth_users
WHERE '/reports/operacao' = ANY(COALESCE(allowed_routes, ARRAY[]::text[]));

SELECT count(*) AS elegiveis_pelos_reportes_de_origem
FROM cortex_core.auth_users
WHERE allowed_routes && ARRAY['/reports/mensal', '/reports/semanal', '/reports/trimestral']::text[];
