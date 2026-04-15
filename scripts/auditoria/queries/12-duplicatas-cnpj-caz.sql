SELECT
  LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj,
  ARRAY_AGG(ids ORDER BY id) AS ids_caz_array,
  ARRAY_AGG(nome ORDER BY id) AS nomes_array,
  ARRAY_AGG(empresa ORDER BY id) AS empresas_array,
  COUNT(*) AS count
FROM "Conta Azul".caz_clientes
WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
GROUP BY LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0')
HAVING COUNT(*) > 1
ORDER BY count DESC;
