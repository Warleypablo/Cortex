-- AUDITORIA de 1 mês (junho de teste): por cliente ativo no snapshot, componentes do LTV FAT e DFC.
-- A mediana é calculada no TS (helper) a partir destas linhas; aqui validamos que ela bate com a célula.
\set mes 6

WITH alvo AS (SELECT make_date(2026, :mes, 1) AS m),
snap_ref AS MATERIALIZED (
  SELECT COALESCE(
    (SELECT data_snapshot FROM "Clickup".cup_data_hist, alvo WHERE data_snapshot = alvo.m LIMIT 1),
    (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist, alvo WHERE date_trunc('month', data_snapshot) = alvo.m)
  ) AS snap
),
ativos AS MATERIALIZED (
  SELECT h.id_task, MAX(sr.snap) AS snap,
    COALESCE(SUM(h.valorr) FILTER (WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0), 0) AS valorr_snap,
    COUNT(*) FILTER (WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0) AS n_rec_snap
  FROM snap_ref sr
  JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
  WHERE sr.snap IS NOT NULL
  GROUP BY h.id_task
  HAVING BOOL_OR(h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0)
),
click_norm AS MATERIALIZED (
  SELECT cl.task_id, regexp_replace(cl.cnpj::text, '\D', '', 'g') AS cnpj_norm
  FROM "Clickup".cup_clientes cl
  WHERE LENGTH(regexp_replace(cl.cnpj::text, '\D', '', 'g')) IN (11, 14)
),
caz_norm AS MATERIALIZED (
  SELECT c.ids, regexp_replace(c.cnpj::text, '\D', '', 'g') AS cnpj_norm
  FROM "Conta Azul".caz_clientes c
  WHERE LENGTH(regexp_replace(c.cnpj::text, '\D', '', 'g')) IN (11, 14)
),
caz_map AS MATERIALIZED (
  SELECT DISTINCT k.task_id, z.ids FROM click_norm k JOIN caz_norm z USING (cnpj_norm)
),
match_task AS MATERIALIZED (SELECT DISTINCT task_id FROM caz_map),
rec_stats AS MATERIALIZED (
  SELECT a.id_task,
    COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, a.snap), a.snap) - v.data_inicio)::numeric, 0) / 30.44), 0) AS rec_full,
    COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, DATE '2025-09-30'), DATE '2025-09-30') - v.data_inicio)::numeric, 0) / 30.44), 0) AS rec_pre,
    MIN(v.data_inicio) AS inicio_rec
  FROM ativos a
  LEFT JOIN cortex_core.vw_lt_contratos v
    ON v.id_task = a.id_task AND v.tipo_receita = 'recorrente' AND v.data_inicio IS NOT NULL
  GROUP BY a.id_task
),
pont_stats AS MATERIALIZED (
  SELECT a.id_task,
    COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < a.snap), 0) AS pont_full,
    COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < DATE '2025-10-01'), 0) AS pont_pre
  FROM ativos a
  JOIN "Clickup".cup_contratos co
    ON co.id_task = a.id_task AND co.valorp > 0 AND (co.valorr IS NULL OR co.valorr = 0) AND co.status = 'entregue'
  GROUP BY a.id_task
),
pago_stats AS MATERIALIZED (
  SELECT cm.task_id,
    SUM(pa.valor_pago) AS pago,
    COUNT(*) AS n_parcelas
  FROM caz_map cm
  JOIN "Conta Azul".caz_parcelas pa ON pa.id_cliente::text = cm.ids
  CROSS JOIN alvo
  WHERE pa.tipo_evento = 'RECEITA'
    AND pa.data_quitacao >= DATE '2025-10-01'
    AND pa.data_quitacao::date < alvo.m
  GROUP BY cm.task_id
),
linhas AS (
  SELECT a.id_task,
    COALESCE(c.nome, a.id_task) AS nome,
    mt.task_id IS NOT NULL AS tem_match,
    a.valorr_snap, a.n_rec_snap, r.inicio_rec,
    ROUND(r.rec_full, 2) AS rec_full,
    ROUND(r.rec_pre, 2) AS rec_pre,
    COALESCE(p.pont_full, 0) AS pont_full,
    COALESCE(p.pont_pre, 0) AS pont_pre,
    COALESCE(pg.pago, 0) AS pago,
    COALESCE(pg.n_parcelas, 0) AS n_parcelas,
    ROUND(r.rec_full + COALESCE(p.pont_full, 0), 2) AS ltv_fat,
    ROUND(CASE WHEN mt.task_id IS NOT NULL
      THEN r.rec_pre + COALESCE(p.pont_pre, 0) + COALESCE(pg.pago, 0)
      ELSE r.rec_full + COALESCE(p.pont_full, 0) END, 2) AS ltv_dfc
  FROM ativos a
  LEFT JOIN "Clickup".cup_clientes c ON c.task_id = a.id_task
  LEFT JOIN match_task mt ON mt.task_id = a.id_task
  LEFT JOIN rec_stats r ON r.id_task = a.id_task
  LEFT JOIN pont_stats p ON p.id_task = a.id_task
  LEFT JOIN pago_stats pg ON pg.task_id = a.id_task
)
SELECT COUNT(*) AS n,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_fat)::numeric, 0) AS mediana_fat,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_dfc)::numeric, 0) AS mediana_dfc
FROM linhas;
