-- Painel "Orgânico" — Fase OPERADOR (aprovar → soltar agora / agendar).
-- Aditivo e idempotente sobre as tabelas content_* de 2026-06-24.
-- Habilita: visão de APROVADOS, ação "Soltar post agora" (command publish_now)
-- e ação "Agendar post" (scheduled_at + command schedule).

-- 1) content_posts.scheduled_at — horário escolhido pelo OPERADOR p/ publicar ("Agendar post").
--    NULL = não agendado pelo operador. Distinto de posting_date (data planejada no ClickUp, sem hora).
ALTER TABLE cortex_core.content_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- índice p/ a visão "Agendados" e o poll de "vencidos" do worker
CREATE INDEX IF NOT EXISTS idx_content_posts_scheduled
  ON cortex_core.content_posts (platform, scheduled_at);

-- 2) Uma linha por TASK (cada card = um post). O upsert antigo por (platform, task, posting_date)
--    duplicava posts SEM data (NULL é distinto no Postgres) — logo posts "aprovados sem data
--    agendada" nem cabiam na fila. Esta unique permite upsert estável por task, com ou sem data.
--    (Mais estrita que a antiga; a de 2026-06-24 fica redundante e inofensiva.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_posts_platform_task
  ON cortex_core.content_posts (platform, clickup_task_id);

-- 3) Vocabulário novo (colunas são VARCHAR livres, sem CHECK — só atualiza os comentários):
--    content_posts.state             += 'aprovado'
--    content_publish_commands.action += 'schedule' | 'cancel_schedule'
COMMENT ON COLUMN cortex_core.content_posts.state IS
  'aprovado | agendado | aguardando_ia | publicado | falhou | pulado';
COMMENT ON COLUMN cortex_core.content_posts.scheduled_at IS
  'horário escolhido pelo operador p/ publicar (Agendar); NULL = não agendado pelo operador';
COMMENT ON COLUMN cortex_core.content_publish_commands.action IS
  'publish_now | schedule | cancel_schedule | retry | skip | approve_caption | edit_caption | pause_agent | resume_agent';
