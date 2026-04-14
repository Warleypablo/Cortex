-- Cat 07: Deal ganho com valor_pontual > 0 sem parcela pontual no CAZ na janela ±60 dias do fechamento.
-- "Pontual" = não recorrente. Heurística: parcela RECEITA cujo valor_bruto está dentro de ±10% do valor_pontual,
-- e cuja data_vencimento cai em ±60 dias da data_fechamento do deal.
WITH won AS (
  SELECT id, title, company_name, data_fechamento, date_modify, valor_pontual,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
    AND valor_pontual IS NOT NULL AND valor_pontual > 0
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  w.id AS id_deal,
  w.title AS cliente,
  w.cnpj_norm AS cnpj,
  ROUND(w.valor_pontual::numeric, 2) AS valor_pontual_deal,
  COALESCE(w.data_fechamento, w.date_modify::date) AS data_fechamento,
  (
    SELECT p.valor_bruto
    FROM "Conta Azul".caz_parcelas p
    JOIN caz_client cm ON cm.ids::uuid = p.id_cliente
    WHERE cm.cnpj_norm = w.cnpj_norm
      AND p.tipo_evento = 'RECEITA'
      AND ABS(p.valor_bruto - w.valor_pontual) / NULLIF(w.valor_pontual, 0) < 0.10
      AND p.data_vencimento BETWEEN COALESCE(w.data_fechamento, w.date_modify::date) - INTERVAL '60 days'
                                AND COALESCE(w.data_fechamento, w.date_modify::date) + INTERVAL '60 days'
    LIMIT 1
  ) AS parcela_proxima_encontrada,
  ROUND(w.valor_pontual::numeric, 2) AS impacto_estimado_rs
FROM won w
WHERE NOT EXISTS (
  SELECT 1
  FROM "Conta Azul".caz_parcelas p
  JOIN caz_client cm ON cm.ids::uuid = p.id_cliente
  WHERE cm.cnpj_norm = w.cnpj_norm
    AND p.tipo_evento = 'RECEITA'
    AND ABS(p.valor_bruto - w.valor_pontual) / NULLIF(w.valor_pontual, 0) < 0.10
    AND p.data_vencimento BETWEEN COALESCE(w.data_fechamento, w.date_modify::date) - INTERVAL '60 days'
                              AND COALESCE(w.data_fechamento, w.date_modify::date) + INTERVAL '60 days'
)
ORDER BY impacto_estimado_rs DESC;
