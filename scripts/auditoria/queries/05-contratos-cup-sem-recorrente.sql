-- Cat 05: Contratos ativos no CUP, cliente existe no CAZ, mas zero parcelas RECEITA nos últimos 60 dias.
WITH cup_active AS (
  SELECT ct.id_subtask, ct.servico, ct.valorr, cl.nome AS cliente_nome,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
),
caz_match AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
),
last_recurring AS (
  SELECT id_cliente, MAX(data_vencimento) AS ultima
  FROM "Conta Azul".caz_parcelas
  WHERE tipo_evento = 'RECEITA'
  GROUP BY id_cliente
)
SELECT
  c.id_subtask,
  c.cliente_nome AS cliente,
  c.cnpj_norm AS cnpj,
  c.servico,
  COALESCE(c.valorr, 0)::numeric AS valorr,
  lr.ultima AS ultima_parcela_recorrente,
  GREATEST(0, EXTRACT(DAY FROM NOW() - lr.ultima)::int) AS dias_desde,
  ROUND((COALESCE(c.valorr, 0) * 2)::numeric, 2) AS impacto_estimado_rs
FROM cup_active c
JOIN caz_match cm ON cm.cnpj_norm = c.cnpj_norm
LEFT JOIN last_recurring lr ON lr.id_cliente = cm.ids::uuid
WHERE c.cnpj_norm <> '00000000000000'
  AND (lr.ultima IS NULL OR lr.ultima < NOW() - INTERVAL '60 days')
ORDER BY impacto_estimado_rs DESC;
