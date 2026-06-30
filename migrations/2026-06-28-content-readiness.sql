-- Painel "Orgânico" — Fase 1: prontidão AUTORITATIVA vinda do worker.
-- Aditivo e idempotente sobre content_posts. Espelha shared/schema.ts.
--
-- O worker passa a emitir, no MESMO código que decide publicar, um veredito único
-- de "vai sair?" — pra o front só PINTAR, nunca inferir de snapshot (o cálculo no
-- front ignorava dry-run e podia mentir "verde").

-- readiness: ready | blocked | published | failed
ALTER TABLE cortex_core.content_posts
  ADD COLUMN IF NOT EXISTS readiness VARCHAR(16);

-- block_reasons: quando blocked, lista de códigos do que falta
-- (legenda | midia | horario | google | erro | pulado | dry_run)
ALTER TABLE cortex_core.content_posts
  ADD COLUMN IF NOT EXISTS block_reasons JSONB;

COMMENT ON COLUMN cortex_core.content_posts.readiness IS
  'prontidao autoritativa calculada pelo worker: ready | blocked | published | failed';
COMMENT ON COLUMN cortex_core.content_posts.block_reasons IS
  'quando blocked: codigos do que falta (legenda|midia|horario|google|erro|pulado|dry_run)';
