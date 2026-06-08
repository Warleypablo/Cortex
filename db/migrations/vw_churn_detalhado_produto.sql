-- View 1: churn detalhado por produto × motivo (últimos 12 meses)
CREATE OR REPLACE VIEW cortex_core.vw_churn_detalhado_produto AS
SELECT
  COALESCE(produto, 'Não Identificado')           AS produto,
  COALESCE(motivo_cancelamento, 'Não Informado')  AS motivo_cancelamento,
  COUNT(*)                                         AS cancelamentos,
  SUM(valor_r)                                     AS mrr_perdido,
  AVG(valor_r)                                     AS ticket_medio,
  ROUND(
    COUNT(*) * 100.0
    / SUM(COUNT(*)) OVER (PARTITION BY COALESCE(produto, 'Não Identificado')),
    2
  )                                                AS pct_dentro_produto,
  ROUND(
    COUNT(*) * 100.0
    / SUM(COUNT(*)) OVER (),
    2
  )                                                AS pct_total
FROM cortex_core.vw_cup_churn_ajustado
WHERE ultimo_dia_operacao >= CURRENT_DATE - INTERVAL '12 months'
  AND valor_r > 0
GROUP BY
  COALESCE(produto, 'Não Identificado'),
  COALESCE(motivo_cancelamento, 'Não Informado');
