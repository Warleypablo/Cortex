-- Cat 09: Contratos cup encerrados (data_encerramento != NULL) com parcelas abertas no CAZ
-- vencidas > 30 dias depois do encerramento.
WITH cup_closed AS (
  SELECT ct.id_subtask, ct.data_encerramento, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.data_encerramento IS NOT NULL
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  c.id_subtask,
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.data_encerramento,
  p.id AS parcela_id,
  p.data_vencimento AS parcela_vencimento,
  ROUND(p.valor_bruto::numeric, 2) AS valor_bruto,
  p.status AS status_parcela
FROM cup_closed c
JOIN caz_client cm ON cm.cnpj_norm = c.cnpj_norm
JOIN "Conta Azul".caz_parcelas p ON p.id_cliente = cm.ids::uuid
WHERE p.tipo_evento = 'RECEITA'
  AND p.data_vencimento > c.data_encerramento + INTERVAL '30 days'
  AND (p.status IS NULL OR UPPER(p.status) NOT IN ('PAGO', 'CANCELADO'))
  AND c.cnpj_norm <> '00000000000000'
ORDER BY p.valor_bruto DESC NULLS LAST;
