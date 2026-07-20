-- Olimpo descontinuada (2026-07-20): as 3 pessoas passam a compor o squad Pulse.
-- A aba de /capacity-times é montada por cortex_core.capacity_metas.categoria,
-- então trocar a categoria já move as pessoas de aba.
--
-- Idempotente: rodar de novo afeta 0 linhas.
-- Sem risco de colidir com o UNIQUE(match_responsavel, categoria): Debora Mund,
-- Larissa Farias e Ana Clara Cordeiro não têm registro em Pulse.
--
-- Rodar em LOCAL e PROD.

BEGIN;

\echo 'ANTES:'
SELECT categoria, COUNT(*) FROM cortex_core.capacity_metas
 WHERE categoria IN ('Pulse', 'Olimpo') GROUP BY categoria ORDER BY categoria;

UPDATE cortex_core.capacity_metas
   SET categoria = 'Pulse'
 WHERE categoria = 'Olimpo';

\echo 'DEPOIS:'
SELECT categoria, COUNT(*) FROM cortex_core.capacity_metas
 WHERE categoria IN ('Pulse', 'Olimpo') GROUP BY categoria ORDER BY categoria;

COMMIT;
