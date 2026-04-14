-- Cat 03: Deal ganho casado em caz_clientes mas sem parcela RECEITA aberta nos últimos 90 dias.
WITH won AS (
  SELECT id, title, company_name, valor_recorrente, data_fechamento, date_modify,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz AS (
  SELECT ids, nome,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
),
matched AS (
  SELECT w.id AS id_deal, w.cnpj_norm, c.nome AS cliente_caz_nome, c.ids AS caz_id,
         w.valor_recorrente, w.data_fechamento, w.date_modify
  FROM won w
  JOIN caz c ON c.cnpj_norm = w.cnpj_norm
),
last_parcela AS (
  SELECT id_cliente, MAX(data_vencimento) AS ultima_parcela
  FROM "Conta Azul".caz_parcelas
  WHERE tipo_evento = 'RECEITA'
  GROUP BY id_cliente
)
SELECT
  m.id_deal,
  m.cnpj_norm AS cnpj,
  m.cliente_caz_nome,
  lp.ultima_parcela AS ultima_parcela_data,
  GREATEST(0, DATE_PART('month', AGE(NOW(), COALESCE(lp.ultima_parcela, m.data_fechamento::timestamp)))::int) AS meses_sem_cobranca,
  COALESCE(m.valor_recorrente, 0)::numeric AS valor_recorrente,
  ROUND(
    (COALESCE(m.valor_recorrente, 0) * LEAST(12, GREATEST(0,
      DATE_PART('month', AGE(NOW(), COALESCE(lp.ultima_parcela, m.data_fechamento::timestamp)))::int
    )))::numeric,
    2
  ) AS impacto_estimado_rs
FROM matched m
LEFT JOIN last_parcela lp ON lp.id_cliente = m.caz_id::uuid
WHERE lp.ultima_parcela IS NULL OR lp.ultima_parcela < NOW() - INTERVAL '90 days'
ORDER BY impacto_estimado_rs DESC;
