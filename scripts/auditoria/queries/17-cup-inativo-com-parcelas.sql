WITH cup_inactive AS (
  SELECT cl.id, cl.nome AS cliente, cl.status AS status_cup,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT MAX(ct.data_encerramento) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id) AS data_inativacao_estimada
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('cancelado/inativo', 'não usar')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT DISTINCT ON (c.cliente, p.id)
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.status_cup,
  c.data_inativacao_estimada,
  p.id AS parcela_id,
  p.data_quitacao,
  ROUND(COALESCE(p.valor_pago, 0)::numeric, 2) AS valor_pago
FROM cup_inactive c
JOIN caz_client cm ON cm.cnpj_norm = c.cnpj_norm
JOIN "Conta Azul".caz_parcelas p ON p.id_cliente = cm.ids::uuid
WHERE p.tipo_evento = 'RECEITA'
  AND p.data_quitacao IS NOT NULL
  AND c.data_inativacao_estimada IS NOT NULL
  AND p.data_quitacao > c.data_inativacao_estimada + INTERVAL '30 days'
  AND COALESCE(p.valor_pago, 0) > 0
ORDER BY c.cliente, p.id, valor_pago DESC;
