SELECT
  category_id,
  category_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> '') AS com_cnpj,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> '') / NULLIF(COUNT(*), 0), 1) AS pct
FROM "Bitrix".crm_deal
GROUP BY category_id, category_name
ORDER BY total DESC;
