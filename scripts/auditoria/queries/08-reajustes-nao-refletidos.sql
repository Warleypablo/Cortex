-- Cat 08 (exploratório): reajustes contratados não refletidos no CAZ.
-- valorr atual em cup_contratos > valorr de 6 meses atrás em cup_data_hist + média mensal CAZ continua próxima do valor antigo.
WITH cup_now AS (
  SELECT ct.id_subtask, ct.id_task, ct.valorr AS valorr_atual, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND ct.valorr > 0
),
cup_6m_atras AS (
  SELECT DISTINCT ON (id_subtask) id_subtask, valorr AS valorr_6m
  FROM "Clickup".cup_data_hist
  WHERE data_snapshot BETWEEN NOW() - INTERVAL '7 months' AND NOW() - INTERVAL '5 months'
  ORDER BY id_subtask, data_snapshot DESC
),
caz_recent AS (
  SELECT cm.cnpj_norm,
         AVG(p.valor_bruto) AS media_mensal_caz
  FROM "Conta Azul".caz_parcelas p
  JOIN (
    SELECT ids, LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
    FROM "Conta Azul".caz_clientes
  ) cm ON cm.ids::uuid = p.id_cliente
  WHERE p.tipo_evento = 'RECEITA'
    AND (p.categoria_nome ILIKE '%03.01.01%' OR p.categoria_nome ILIKE '%Receita de Serviços%')
    AND p.data_vencimento >= NOW() - INTERVAL '3 months'
  GROUP BY cm.cnpj_norm
)
SELECT
  cn.id_subtask,
  cn.cliente,
  ROUND(cn.valorr_atual::numeric, 2) AS valorr_atual,
  ROUND(c6.valorr_6m::numeric, 2) AS valorr_6m_atras,
  ROUND(cr.media_mensal_caz::numeric, 2) AS valor_parcela_caz,
  ROUND((cn.valorr_atual - cr.media_mensal_caz)::numeric, 2) AS diff,
  ROUND(((cn.valorr_atual - cr.media_mensal_caz) * 6)::numeric, 2) AS impacto_estimado_rs
FROM cup_now cn
JOIN cup_6m_atras c6 ON c6.id_subtask = cn.id_subtask
LEFT JOIN caz_recent cr ON cr.cnpj_norm = cn.cnpj_norm
WHERE cn.valorr_atual > c6.valorr_6m * 1.05  -- subiu pelo menos 5%
  AND cr.media_mensal_caz IS NOT NULL
  AND cr.media_mensal_caz < c6.valorr_6m * 1.05  -- mas o CAZ não acompanhou
  AND (cn.valorr_atual - cr.media_mensal_caz) > 50
ORDER BY impacto_estimado_rs DESC;
