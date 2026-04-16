-- Aliases adicionados para reduzir órfãos identificados no diagnóstico de jan/2026.
-- Contexto: docs/superpowers/plans/2026-04-16-receita-squad-100pct-itens.md
-- Idempotência: usa WHERE NOT EXISTS pois a UNIQUE da tabela é parcial (WHERE active=true),
-- inviabilizando ON CONFLICT direto.
INSERT INTO cortex_core.item_alias_map (item_pattern, target_token, active)
SELECT item_pattern, target_token, true
FROM (VALUES
  ('account manegement',  'consultoria'),  -- typo Calebito
  ('account management',  'consultoria'),  -- forma correta (defensiva)
  ('agente ia',           'automacao'),    -- Grupo Fibra
  ('broadcast',           'email'),        -- SIOMARA Isadora Duncan
  ('mentoria',            'consultoria'),  -- Genesis Company (preventivo)
  ('criacao de conteudo', 'creators')      -- Agência Conteúdo (quando cadastrarem)
) AS v(item_pattern, target_token)
WHERE NOT EXISTS (
  SELECT 1 FROM cortex_core.item_alias_map m
  WHERE m.item_pattern = v.item_pattern AND m.active = true
);
