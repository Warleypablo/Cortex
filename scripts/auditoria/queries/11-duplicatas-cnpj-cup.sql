SELECT
  LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj,
  ARRAY_AGG(id ORDER BY id) AS ids_clickup_array,
  ARRAY_AGG(nome ORDER BY id) AS nomes_array,
  COUNT(*) AS count
FROM "Clickup".cup_clientes
WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
GROUP BY LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0')
HAVING COUNT(*) > 1
ORDER BY count DESC;
