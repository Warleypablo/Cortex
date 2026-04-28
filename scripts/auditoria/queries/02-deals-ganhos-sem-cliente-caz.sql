-- Cat 02: Deal ganho com CNPJ válido mas sem cliente no CAZ (nem por fuzzy match de nome).
-- pg_trgm requerido. Multi-empresa unificado.
WITH won_with_cnpj AS (
  SELECT id, title, company_name, valor_recorrente, valor_pontual,
         data_fechamento, date_modify,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz_norm AS (
  SELECT ids, nome, empresa,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
)
SELECT
  w.id AS id_deal,
  w.cnpj_norm AS cnpj_normalizado,
  w.title,
  w.company_name,
  (
    SELECT c.nome FROM caz_norm c
    ORDER BY similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, ''))) DESC
    LIMIT 1
  ) AS melhor_match_caz,
  (
    SELECT ROUND(similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, '')))::numeric, 3)
    FROM caz_norm c
    ORDER BY similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, ''))) DESC
    LIMIT 1
  ) AS similaridade,
  COALESCE(w.valor_recorrente, 0)::numeric AS valor_recorrente,
  COALESCE(w.valor_pontual, 0)::numeric    AS valor_pontual,
  ROUND(
    (COALESCE(w.valor_recorrente, 0) * LEAST(
      12,
      GREATEST(0,
        DATE_PART('month', AGE(NOW(), COALESCE(w.data_fechamento, w.date_modify::date)))::int
        + DATE_PART('year', AGE(NOW(), COALESCE(w.data_fechamento, w.date_modify::date)))::int * 12
      )
    ) + COALESCE(w.valor_pontual, 0))::numeric,
    2
  ) AS impacto_estimado_rs
FROM won_with_cnpj w
WHERE NOT EXISTS (
  SELECT 1 FROM caz_norm c WHERE c.cnpj_norm = w.cnpj_norm
)
AND NOT EXISTS (
  SELECT 1 FROM caz_norm c
  WHERE similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, ''))) > 0.6
)
ORDER BY impacto_estimado_rs DESC;
