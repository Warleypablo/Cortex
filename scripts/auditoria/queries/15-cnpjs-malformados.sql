WITH all_cnpjs AS (
  SELECT 'cup_clientes' AS fonte, id::text AS id, cnpj AS cnpj_original FROM "Clickup".cup_clientes WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
  UNION ALL
  SELECT 'caz_clientes', id::text, cnpj FROM "Conta Azul".caz_clientes WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
  UNION ALL
  SELECT 'crm_deal', id::text, cnpj FROM "Bitrix".crm_deal WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
)
SELECT
  fonte,
  id,
  cnpj_original AS cnpj_invalido,
  CASE
    WHEN LENGTH(REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g')) <> 14 THEN 'comprimento != 14'
    WHEN REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g') ~ '^(\d)\1+$' THEN 'todos dígitos iguais'
    ELSE 'outro'
  END AS motivo
FROM all_cnpjs
WHERE LENGTH(REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g')) <> 14
   OR REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g') ~ '^(\d)\1+$'
ORDER BY fonte, id;
