SELECT
  category_id,
  category_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE stage_semantic IS NOT NULL AND TRIM(stage_semantic) <> '') AS com_semantic,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_semantic IS NOT NULL AND TRIM(stage_semantic) <> '') / NULLIF(COUNT(*), 0), 2) AS pct
FROM "Bitrix".crm_deal
GROUP BY category_id, category_name
ORDER BY total DESC;
