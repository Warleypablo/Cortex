-- Cliente ativo no ClickUp sem nenhum deal correspondente no Bitrix (origem desconhecida).
WITH cup AS (
  SELECT DISTINCT ON (cnpj_norm)
         cl.task_id AS id_task, cl.nome AS cliente, cl.vendedor,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT MIN(ct.data_inicio) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id) AS data_inicio,
         (SELECT SUM(ct.valorr) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id AND ct.status IN ('ativo','entregue','em cancelamento','pausado')) AS valorr
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
  ORDER BY cnpj_norm, cl.task_id
),
bitrix_cnpjs AS (
  SELECT DISTINCT LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
)
SELECT
  c.id_task,
  c.cliente,
  c.cnpj_norm AS cnpj,
  ROUND(COALESCE(c.valorr, 0)::numeric, 2) AS valorr,
  c.vendedor,
  c.data_inicio
FROM cup c
WHERE c.cnpj_norm <> '00000000000000'
  AND NOT EXISTS (SELECT 1 FROM bitrix_cnpjs b WHERE b.cnpj_norm = c.cnpj_norm)
ORDER BY valorr DESC NULLS LAST;
