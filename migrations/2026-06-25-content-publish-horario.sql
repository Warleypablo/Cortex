-- Painel "Orgânico" — Horário-por-card. Aditivo e idempotente sobre content_posts.
-- O agente passa a publicar no horário do PRÓPRIO card (campo "Horário" + "Data de
-- postagem"), em vez dos slots fixos 12h/17h30. Espelha shared/schema.ts.

-- 1) posting_time — horário EXPLÍCITO digitado no card (campo de texto "Horário"),
--    normalizado 'HH:MM'. NULL = card não preencheu → o agente usou o horário padrão.
ALTER TABLE cortex_core.content_posts
  ADD COLUMN IF NOT EXISTS posting_time VARCHAR(8);

-- 2) card_scheduled_at — horário-alvo derivado do card (Data de postagem + Horário),
--    em America/Sao_Paulo, escrito pelo worker a cada ciclo. Distinto de scheduled_at
--    (override manual do operador no painel).
--    Horário EFETIVO de publicação = COALESCE(scheduled_at, card_scheduled_at).
ALTER TABLE cortex_core.content_posts
  ADD COLUMN IF NOT EXISTS card_scheduled_at TIMESTAMPTZ;

-- índice p/ o endpoint /posts/due varrer agendados vencidos por horário do card
CREATE INDEX IF NOT EXISTS idx_content_posts_card_scheduled
  ON cortex_core.content_posts (platform, card_scheduled_at);

COMMENT ON COLUMN cortex_core.content_posts.posting_time IS
  'HH:MM explícito do card (campo Horário); NULL = usou horário padrão';
COMMENT ON COLUMN cortex_core.content_posts.card_scheduled_at IS
  'horário-alvo vindo do card (Data de postagem + Horário, America/Sao_Paulo); worker escreve a cada ciclo. Efetivo = COALESCE(scheduled_at, card_scheduled_at)';
