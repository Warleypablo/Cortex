-- Dimensões da convenção de nome: formato de ad + proporção. Aditivo e idempotente.

ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS formato_ad VARCHAR(64);
ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS proporcao  VARCHAR(16);

-- Vocabulário starter de formato de ad (editável depois pela UI).
INSERT INTO cortex_core.creative_vocab (kind, value, label, sort_order) VALUES
  ('formato', 'react', 'React', 1),
  ('formato', 'caixinha-de-perguntas', 'Caixinha de perguntas', 2),
  ('formato', 'depoimento', 'Depoimento', 3),
  ('formato', 'pov', 'POV', 4),
  ('formato', 'tutorial', 'Tutorial', 5),
  ('formato', 'unboxing', 'Unboxing', 6)
ON CONFLICT (kind, value) DO NOTHING;
