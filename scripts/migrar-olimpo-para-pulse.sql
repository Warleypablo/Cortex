-- Olimpo descontinuada (2026-07-20): as pessoas passam a compor o squad Pulse.
-- A aba de /capacity-times é montada por cortex_core.capacity_metas.categoria,
-- então trocar a categoria já move as pessoas de aba E faz elas herdarem a régua do
-- Pulse: CAP_CLIENTES_PULSE (20) entra via COALESCE(cap_clientes, CASE WHEN
-- categoria = 'Pulse' ...) — a coluna "Cap. Clientes" delas deixa de ser "—" — e a
-- Cap. FAT passa a usar o ticket médio da equipe unificada (finalizeSquad, por grupo).
-- O cap de contratos individual (cap_contas / cap_recorrente) é preservado.
--
-- Idempotente: rodar de novo afeta 0 linhas.
-- Sem risco de colidir com o UNIQUE(match_responsavel, categoria): Debora Mund,
-- Larissa Farias, Ana Clara Cordeiro e Geiziele não têm registro em Pulse.
--
-- Rodar em LOCAL e PROD. Aplicado em LOCAL 2026-07-20 (3 linhas) e em PROD
-- 2026-07-24 (4 linhas — Geiziele foi cadastrada depois, direto em prod).

BEGIN;

\echo 'ANTES:'
SELECT categoria, COUNT(*) FROM cortex_core.capacity_metas
 WHERE categoria IN ('Pulse', 'Olimpo') GROUP BY categoria ORDER BY categoria;

-- Geiziele foi cadastrada pela UI com ordem = 0; dentro do Pulse ela ficaria antes da
-- Brenda (ordem 1). Manda para o fim, junto com os demais ex-Olimpo (9, 10, 11).
UPDATE cortex_core.capacity_metas
   SET ordem = 12
 WHERE categoria = 'Olimpo' AND ordem = 0;

UPDATE cortex_core.capacity_metas
   SET categoria = 'Pulse'
 WHERE categoria = 'Olimpo';

\echo 'DEPOIS:'
SELECT categoria, COUNT(*) FROM cortex_core.capacity_metas
 WHERE categoria IN ('Pulse', 'Olimpo') GROUP BY categoria ORDER BY categoria;

COMMIT;
