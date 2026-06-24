-- Cat 04: Contratos ATIVOS em ClickUp sem cliente correspondente no CAZ.
-- Status considerados ativos: ativo, entregue, em cancelamento, pausado.
WITH cup AS (
  SELECT ct.id_subtask, ct.servico, ct.valorr, ct.valorp, ct.data_inicio,
         cl.nome AS cliente_nome,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
),
caz AS (
  SELECT LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
)
SELECT
  c.id_subtask,
  c.cliente_nome AS cup_cliente_nome,
  c.cnpj_norm AS cnpj_clickup,
  c.servico,
  COALESCE(c.valorr, 0)::numeric AS valorr,
  COALESCE(c.valorp, 0)::numeric AS valorp,
  c.data_inicio,
  LEAST(12, GREATEST(0,
    DATE_PART('month', AGE(NOW(), c.data_inicio))::int
    + DATE_PART('year', AGE(NOW(), c.data_inicio))::int * 12
  )) AS meses_aberto,
  ROUND((
    COALESCE(c.valorr, 0) * LEAST(12, GREATEST(0,
      DATE_PART('month', AGE(NOW(), c.data_inicio))::int
      + DATE_PART('year', AGE(NOW(), c.data_inicio))::int * 12
    )) + COALESCE(c.valorp, 0)
  )::numeric, 2) AS impacto_estimado_rs
FROM cup c
WHERE c.cnpj_norm <> '00000000000000'
  AND NOT EXISTS (SELECT 1 FROM caz WHERE caz.cnpj_norm = c.cnpj_norm)
ORDER BY impacto_estimado_rs DESC;
