-- Cat 01: Deals em estágio de fechamento sem CNPJ no Bitrix.
-- Universo: pipelines 0 (Geral) e 12 (Cross Sell e Upsell), stages "Negócio Ganho" e "Negócios Fechados".
-- Impacto = valor_recorrente * meses_aberto (cap 12) + valor_pontual.
WITH won AS (
  SELECT id, title, company_name, contact_name, closer, sdr,
         data_fechamento, date_modify, valor_recorrente, valor_pontual, cnpj
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
)
SELECT
  id AS id_deal,
  title,
  company_name,
  contact_name,
  closer,
  sdr,
  COALESCE(data_fechamento, date_modify::date) AS data_fechamento_ou_modify,
  COALESCE(valor_recorrente, 0)::numeric AS valor_recorrente,
  COALESCE(valor_pontual, 0)::numeric    AS valor_pontual,
  LEAST(
    12,
    GREATEST(
      0,
      DATE_PART('month', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int
      + DATE_PART('year', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int * 12
    )
  ) AS meses_aberto,
  ROUND(
    (COALESCE(valor_recorrente, 0) * LEAST(
      12,
      GREATEST(
        0,
        DATE_PART('month', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int
        + DATE_PART('year', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int * 12
      )
    ) + COALESCE(valor_pontual, 0))::numeric,
    2
  ) AS impacto_estimado_rs,
  'https://turbopartners.bitrix24.com.br/crm/deal/details/' || id || '/' AS link_bitrix
FROM won
WHERE cnpj IS NULL OR TRIM(cnpj) = ''
ORDER BY impacto_estimado_rs DESC NULLS LAST;
