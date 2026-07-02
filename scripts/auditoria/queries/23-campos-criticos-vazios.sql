WITH stats AS (
  SELECT 'cup_clientes.cnpj' AS campo, COUNT(*) FILTER (WHERE cnpj IS NULL OR TRIM(cnpj)='') AS vazios, COUNT(*) AS total
    FROM "Clickup".cup_clientes
  UNION ALL
  SELECT 'cup_clientes.responsavel', COUNT(*) FILTER (WHERE responsavel IS NULL OR TRIM(responsavel)=''), COUNT(*)
    FROM "Clickup".cup_clientes
  UNION ALL
  SELECT 'cup_clientes.vendedor', COUNT(*) FILTER (WHERE vendedor IS NULL OR TRIM(vendedor)=''), COUNT(*)
    FROM "Clickup".cup_clientes
  UNION ALL
  SELECT 'cup_contratos.valorr', COUNT(*) FILTER (WHERE valorr IS NULL OR valorr=0), COUNT(*)
    FROM "Clickup".cup_contratos
  UNION ALL
  SELECT 'cup_contratos.data_inicio', COUNT(*) FILTER (WHERE data_inicio IS NULL), COUNT(*)
    FROM "Clickup".cup_contratos
  UNION ALL
  SELECT 'caz_clientes.cnpj', COUNT(*) FILTER (WHERE cnpj IS NULL OR TRIM(cnpj)=''), COUNT(*)
    FROM "Conta Azul".caz_clientes
  UNION ALL
  SELECT 'crm_deal.cnpj', COUNT(*) FILTER (WHERE cnpj IS NULL OR TRIM(cnpj)=''), COUNT(*)
    FROM "Bitrix".crm_deal
  UNION ALL
  SELECT 'crm_deal.empresa', COUNT(*) FILTER (WHERE empresa IS NULL OR TRIM(empresa)=''), COUNT(*)
    FROM "Bitrix".crm_deal
  UNION ALL
  SELECT 'crm_deal.stage_semantic', COUNT(*) FILTER (WHERE stage_semantic IS NULL OR TRIM(stage_semantic)=''), COUNT(*)
    FROM "Bitrix".crm_deal
  UNION ALL
  SELECT 'crm_deal.data_fechamento', COUNT(*) FILTER (WHERE data_fechamento IS NULL), COUNT(*)
    FROM "Bitrix".crm_deal
)
SELECT
  campo,
  vazios,
  total,
  ROUND(100.0 * vazios / NULLIF(total, 0), 1) AS pct_vazio
FROM stats
ORDER BY pct_vazio DESC;
