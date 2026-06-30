-- Painel "Orgânico" (publicação de conteúdo orgânico) — contrato Postgres entre o worker
-- de publicação (automacoes/instagram-turbo) e o Cortex. Aditivo e idempotente.
-- Platform-agnóstico: a coluna `platform` faz IG/TikTok/YouTube/LinkedIn caberem no mesmo painel.
-- Espelha as tabelas content_* definidas em shared/schema.ts.

-- ============== content_publish_runs (1 linha/ciclo — saúde/heartbeat) ==============
CREATE TABLE IF NOT EXISTS cortex_core.content_publish_runs (
  id          SERIAL PRIMARY KEY,
  run_id      VARCHAR(16) NOT NULL,
  platform    VARCHAR(16) NOT NULL,
  dry_run     BOOLEAN NOT NULL DEFAULT true,
  status      VARCHAR(16) NOT NULL DEFAULT 'running',   -- running | ok | error
  counts      JSONB DEFAULT '{}'::jsonb,
  error_text  TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_content_publish_runs_platform_started
  ON cortex_core.content_publish_runs (platform, started_at);
CREATE INDEX IF NOT EXISTS idx_content_publish_runs_run_id
  ON cortex_core.content_publish_runs (run_id);

-- ============== content_posts (1 linha/task/dia — fila/status) ==============
CREATE TABLE IF NOT EXISTS cortex_core.content_posts (
  id                 SERIAL PRIMARY KEY,
  platform           VARCHAR(16) NOT NULL,
  clickup_task_id    VARCHAR(64) NOT NULL,
  clickup_list_id    VARCHAR(64),
  task_name          TEXT,
  parent_name        TEXT,                                 -- "Social Media - ABRIL"
  mes                VARCHAR(24),
  turbo_slug         VARCHAR(128),
  posting_date       DATE,
  slot               VARCHAR(8),                           -- '12h' | '18h'
  tipo_post          VARCHAR(16),                          -- single | reels | carousel
  asset_count        INTEGER DEFAULT 0,
  legenda_source     VARCHAR(24),                          -- doc | claude-precisa | ia | none
  legenda_len        INTEGER DEFAULT 0,
  legenda_empty      BOOLEAN DEFAULT false,
  legenda_preview    TEXT,
  state              VARCHAR(24) NOT NULL DEFAULT 'agendado', -- agendado | aguardando_ia | publicado | falhou | pulado
  skip_reason        TEXT,
  error_text         TEXT,
  published_media_id VARCHAR(64),                          -- ig media_id / tiktok publish_id
  permalink          TEXT,
  clickup_url        TEXT,
  last_run_id        VARCHAR(16),
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- chave de upsert do worker (NULLs em posting_date são distintos no Postgres — só fazemos
-- upsert de posts COM data; posts sem data ficam fora da fila)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_posts_platform_task_date
  ON cortex_core.content_posts (platform, clickup_task_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_content_posts_platform_date
  ON cortex_core.content_posts (platform, posting_date);
CREATE INDEX IF NOT EXISTS idx_content_posts_state
  ON cortex_core.content_posts (state);

-- ============== content_publish_commands (fila painel→worker) ==============
CREATE TABLE IF NOT EXISTS cortex_core.content_publish_commands (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(16) NOT NULL,
  clickup_task_id VARCHAR(64),                             -- null em comandos globais (pause/resume)
  action          VARCHAR(32) NOT NULL,                    -- publish_now | retry | skip | approve_caption | edit_caption | pause_agent | resume_agent
  payload         JSONB DEFAULT '{}'::jsonb,
  status          VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending | running | done | failed | canceled
  result          JSONB,
  error_text      TEXT,
  requested_by    VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at     TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_content_publish_commands_status
  ON cortex_core.content_publish_commands (status);
CREATE INDEX IF NOT EXISTS idx_content_publish_commands_platform_task
  ON cortex_core.content_publish_commands (platform, clickup_task_id);

-- ============== content_publish_settings (toggle por plataforma) ==============
CREATE TABLE IF NOT EXISTS cortex_core.content_publish_settings (
  platform      VARCHAR(16) PRIMARY KEY,                   -- instagram | tiktok | ...
  agent_enabled BOOLEAN NOT NULL DEFAULT true,
  dry_run       BOOLEAN NOT NULL DEFAULT true,             -- default seguro = não publica
  slots_config  JSONB,
  updated_by    VARCHAR(255),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- seed: 1 linha por plataforma já suportada (dry-run LIGADO por segurança)
INSERT INTO cortex_core.content_publish_settings (platform, agent_enabled, dry_run) VALUES
  ('instagram', true, true),
  ('tiktok',    true, true)
ON CONFLICT (platform) DO NOTHING;
