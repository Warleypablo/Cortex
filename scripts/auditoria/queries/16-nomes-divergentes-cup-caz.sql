WITH cup AS (
  SELECT nome AS nome_clickup,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_clientes
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz AS (
  SELECT nome AS nome_caz,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
)
SELECT
  cup.cnpj_norm AS cnpj,
  cup.nome_clickup,
  caz.nome_caz,
  ROUND(similarity(LOWER(cup.nome_clickup), LOWER(caz.nome_caz))::numeric, 3) AS similaridade
FROM cup
JOIN caz ON caz.cnpj_norm = cup.cnpj_norm
WHERE similarity(LOWER(cup.nome_clickup), LOWER(caz.nome_caz)) < 0.3
ORDER BY similaridade ASC;
