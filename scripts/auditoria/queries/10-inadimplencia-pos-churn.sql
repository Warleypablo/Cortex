-- Cat 10: Parcelas vencidas há > 90 dias e não pagas, de clientes encerrados.
WITH cup_closed AS (
  SELECT cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         MAX(ct.data_encerramento) AS data_encerramento
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.data_encerramento IS NOT NULL
  GROUP BY cl.nome, LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0')
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.data_encerramento,
  p.id AS parcela_id,
  p.data_vencimento AS vencimento,
  ROUND(COALESCE(p.nao_pago, 0)::numeric, 2) AS nao_pago,
  EXTRACT(DAY FROM NOW() - p.data_vencimento)::int AS dias_atraso
FROM cup_closed c
JOIN caz_client cm ON cm.cnpj_norm = c.cnpj_norm
JOIN "Conta Azul".caz_parcelas p ON p.id_cliente = cm.ids::uuid
WHERE p.tipo_evento = 'RECEITA'
  AND p.data_vencimento < NOW() - INTERVAL '90 days'
  AND COALESCE(p.nao_pago, 0) > 0
  AND c.cnpj_norm <> '00000000000000'
ORDER BY nao_pago DESC;
