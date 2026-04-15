-- Deal marcado como perdido no Bitrix mas o cliente está ativo no ClickUp.
WITH lost_deals AS (
  SELECT id, title, stage_name, comments AS lost_reason,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE stage_name ILIKE '%perdido%'
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
cup_active AS (
  SELECT cl.nome AS cliente, cl.status AS status_cup,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT SUM(ct.valorr) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id AND ct.status = 'ativo') AS valorr
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
)
SELECT
  ld.id AS id_deal,
  ld.title AS deal_title,
  ld.stage_name,
  ld.lost_reason,
  cu.cliente AS cliente_cup,
  cu.status_cup,
  ROUND(COALESCE(cu.valorr, 0)::numeric, 2) AS valorr
FROM lost_deals ld
JOIN cup_active cu ON cu.cnpj_norm = ld.cnpj_norm
ORDER BY valorr DESC NULLS LAST;
