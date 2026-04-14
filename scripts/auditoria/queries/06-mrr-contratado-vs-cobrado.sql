-- Cat 06: MRR contratado em cup_contratos > média mensal das parcelas RECEITA do CAZ nos últimos 6 meses.
-- Diff > R$ 50/mês.
WITH cup_active AS (
  SELECT ct.id_subtask, ct.valorr AS valorr_contratado, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND ct.valorr > 0
),
caz_clients AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
),
mrr_cobrado AS (
  -- Soma os valores recorrentes "Receita de Serviços" por cliente no período, divide por meses observados.
  SELECT p.id_cliente,
         SUM(p.valor_bruto) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', p.data_vencimento)), 0) AS media_mensal
  FROM "Conta Azul".caz_parcelas p
  WHERE p.tipo_evento = 'RECEITA'
    AND (p.categoria_nome ILIKE '%03.01.01%' OR p.categoria_nome ILIKE '%Receita de Serviços%')
    AND p.data_vencimento >= NOW() - INTERVAL '6 months'
    AND p.id_cliente IS NOT NULL
  GROUP BY p.id_cliente
)
SELECT
  c.id_subtask,
  c.cliente,
  c.cnpj_norm AS cnpj,
  ROUND(c.valorr_contratado::numeric, 2) AS valorr_contratado,
  ROUND(COALESCE(m.media_mensal, 0)::numeric, 2) AS mrr_cobrado_avg,
  ROUND((c.valorr_contratado - COALESCE(m.media_mensal, 0))::numeric, 2) AS diff_mensal,
  12 AS meses,
  ROUND(((c.valorr_contratado - COALESCE(m.media_mensal, 0)) * 12)::numeric, 2) AS impacto_estimado_rs
FROM cup_active c
JOIN caz_clients cm ON cm.cnpj_norm = c.cnpj_norm
LEFT JOIN mrr_cobrado m ON m.id_cliente = cm.ids::uuid
WHERE c.cnpj_norm <> '00000000000000'
  AND (c.valorr_contratado - COALESCE(m.media_mensal, 0)) > 50
ORDER BY impacto_estimado_rs DESC;
