WITH cup_active AS (
  SELECT cl.id, cl.nome AS cliente, cl.status AS status_cup,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT SUM(ct.valorr) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id AND ct.status IN ('ativo','entregue','em cancelamento','pausado')) AS valorr_clickup
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
),
last_p AS (
  SELECT cm.cnpj_norm, MAX(p.data_vencimento) AS ultima
  FROM "Conta Azul".caz_parcelas p
  JOIN (SELECT ids, LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm FROM "Conta Azul".caz_clientes) cm ON cm.ids::uuid = p.id_cliente
  WHERE p.tipo_evento = 'RECEITA'
  GROUP BY cm.cnpj_norm
)
SELECT
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.status_cup,
  lp.ultima AS ultima_parcela,
  GREATEST(0, DATE_PART('month', AGE(NOW(), lp.ultima))::int) AS meses_desde,
  ROUND(COALESCE(c.valorr_clickup, 0)::numeric, 2) AS valorr_clickup
FROM cup_active c
LEFT JOIN last_p lp ON lp.cnpj_norm = c.cnpj_norm
WHERE c.cnpj_norm <> '00000000000000'
  AND (lp.ultima IS NULL OR lp.ultima < NOW() - INTERVAL '6 months')
ORDER BY meses_desde DESC NULLS FIRST, valorr_clickup DESC;
