-- scripts/backfill-capacity-black-clientes.sql
--
-- Migra a meta dos 7 registros categoria='Black' em cortex_core.capacity_metas de
-- cap_contas para cap_clientes.
--
-- Contexto: os 7 registros do Black têm cap_contas=25 e cap_clientes=NULL. Esse 25
-- sempre foi, semanticamente, meta de CLIENTES — a coluna "Contratos" do Black, até a
-- correção da query (server/routes/capacity.ts, CTE `cli`), na verdade contava
-- clientes distintos (não subtasks), e CAP_CONTAS_ACCOUNT (shared/capacityGrupos.ts)
-- sempre foi documentado como cap de clientes por account. Agora que "Contratos" conta
-- subtasks de verdade e "Clientes" é a coluna própria, sem este backfill a tela
-- passaria a exibir "Cap. Contratos = 25" contra 28-38 contratos reais (Δ negativo,
-- % vermelha) para uma meta que nunca foi de contratos.
--
-- Executado e validado no banco LOCAL em 2026-07-20 (7 linhas afetadas). Este script
-- roda a MESMA operação em produção — aguardando autorização do dono do projeto antes
-- de executar. NÃO rodar sem essa autorização.
--
-- Idempotente: só afeta linhas com cap_clientes IS NULL (não reaplica se já rodado).
BEGIN;

-- diagnóstico ANTES
\echo '== capacity_metas categoria=Black ANTES =='
SELECT id, nome, categoria, cap_contas, cap_clientes
FROM cortex_core.capacity_metas
WHERE categoria = 'Black'
ORDER BY nome;

UPDATE cortex_core.capacity_metas
   SET cap_clientes = cap_contas, cap_contas = NULL
 WHERE categoria = 'Black' AND cap_clientes IS NULL;

-- diagnóstico DEPOIS
\echo '== capacity_metas categoria=Black DEPOIS =='
SELECT id, nome, categoria, cap_contas, cap_clientes
FROM cortex_core.capacity_metas
WHERE categoria = 'Black'
ORDER BY nome;

COMMIT;
