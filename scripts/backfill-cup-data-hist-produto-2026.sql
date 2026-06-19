-- scripts/backfill-cup-data-hist-produto-2026.sql
-- Repara o campo produto corrompido na janela 2026-01-28..2026-02-10 (falha de pipeline).
-- Fonte do valor correto por id_subtask: produto de 2026-02-11 (restaurado), fallback 2025-12-27.
-- Idempotente: só atualiza linhas onde o produto diverge da fonte.
BEGIN;

-- diagnóstico ANTES
\echo '== fill-rate ANTES (janela corrompida) =='
SELECT data_snapshot::date dia, COUNT(*) total,
       COUNT(*) FILTER (WHERE TRIM(COALESCE(produto,'')) <> '') com_produto
FROM "Clickup".cup_data_hist
WHERE data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'
GROUP BY 1 ORDER BY 1;

WITH fonte AS (
  SELECT id_subtask,
         COALESCE(
           (SELECT NULLIF(TRIM(f.produto),'') FROM "Clickup".cup_data_hist f
            WHERE f.id_subtask = h.id_subtask AND f.data_snapshot::date = '2026-02-11' LIMIT 1),
           (SELECT NULLIF(TRIM(d.produto),'') FROM "Clickup".cup_data_hist d
            WHERE d.id_subtask = h.id_subtask AND d.data_snapshot::date = '2025-12-27' LIMIT 1)
         ) AS produto_correto
  FROM (SELECT DISTINCT id_subtask FROM "Clickup".cup_data_hist
        WHERE data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10') h
)
UPDATE "Clickup".cup_data_hist t
SET produto = fonte.produto_correto
FROM fonte
WHERE t.id_subtask = fonte.id_subtask
  AND t.data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'
  AND fonte.produto_correto IS NOT NULL
  AND COALESCE(NULLIF(TRIM(t.produto),''), '') IS DISTINCT FROM fonte.produto_correto;

-- diagnóstico DEPOIS
\echo '== fill-rate DEPOIS =='
SELECT data_snapshot::date dia, COUNT(*) total,
       COUNT(*) FILTER (WHERE TRIM(COALESCE(produto,'')) <> '') com_produto
FROM "Clickup".cup_data_hist
WHERE data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'
GROUP BY 1 ORDER BY 1;

\echo '== MRR Performance jan (deve ser ~509.412) =='
WITH alvo AS (
  SELECT MAX(data_snapshot::date) d FROM "Clickup".cup_data_hist
  WHERE data_snapshot::date >= '2026-01-01' AND data_snapshot::date < '2026-02-01'
)
SELECT ROUND(SUM(h.valorr::numeric),0) mrr_performance_jan
FROM "Clickup".cup_data_hist h, alvo a
WHERE h.data_snapshot::date = a.d
  AND h.status IN ('ativo','onboarding','triagem')
  AND (CASE
        WHEN TRIM(COALESCE(h.produto,'')) = 'Performance' THEN 'performance'
        WHEN TRIM(COALESCE(h.produto,'')) = 'Creators' THEN 'creators'
        WHEN TRIM(COALESCE(h.produto,'')) = 'Social Media' THEN 'social'
        WHEN TRIM(COALESCE(h.produto,'')) = 'Gestão de Comunidade' THEN 'gc'
        WHEN TRIM(COALESCE(h.produto,'')) != '' THEN 'others'
        WHEN h.servico ILIKE '%performance%' THEN 'performance'
        ELSE 'others' END) = 'performance';

COMMIT;
