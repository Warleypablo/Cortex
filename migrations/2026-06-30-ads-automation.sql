-- migrations/2026-06-30-ads-automation.sql
-- Automação semanal de subida de ads (ClickUp "Subir ad" → Meta).
-- Rastreia execuções (1 por semana) e lotes (1 por step) p/ o painel read-only no Cortex.
-- Idempotente: CREATE ... IF NOT EXISTS. Espelha o estilo de cortex_core.ghl_sync_runs.

CREATE TABLE IF NOT EXISTS cortex_core.ads_automation_runs (
  id                      SERIAL       PRIMARY KEY,
  status                  VARCHAR(20)  NOT NULL,                 -- running | success | partial | error
  triggered_by            VARCHAR(20)  NOT NULL DEFAULT 'schedule', -- schedule | manual | recovery
  week_of                 DATE         NOT NULL,                 -- segunda-feira da semana (idempotência)
  dry_run                 BOOLEAN      NOT NULL DEFAULT TRUE,
  lotes_total             INTEGER      NOT NULL DEFAULT 0,
  lotes_done              INTEGER      NOT NULL DEFAULT 0,
  lotes_awaiting_upload   INTEGER      NOT NULL DEFAULT 0,
  lotes_failed            INTEGER      NOT NULL DEFAULT 0,
  conjuntos_criados       INTEGER      NOT NULL DEFAULT 0,
  ads_criados             INTEGER      NOT NULL DEFAULT 0,
  error_message           TEXT,
  started_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at             TIMESTAMPTZ
);

-- 1 run por semana — guarda de idempotência do agendador
CREATE UNIQUE INDEX IF NOT EXISTS ads_automation_runs_week_of_idx
  ON cortex_core.ads_automation_runs (week_of);

CREATE INDEX IF NOT EXISTS ads_automation_runs_status_idx
  ON cortex_core.ads_automation_runs (status, started_at);

CREATE TABLE IF NOT EXISTS cortex_core.ads_automation_steps (
  id                      SERIAL       PRIMARY KEY,
  run_id                  INTEGER      NOT NULL
                            REFERENCES cortex_core.ads_automation_runs (id) ON DELETE CASCADE,
  ordem                   INTEGER      NOT NULL DEFAULT 0,
  clickup_task_id         VARCHAR(40)  NOT NULL,                 -- subtask "Subir ad" (gatilho)
  clickup_parent_id       VARCHAR(40),                           -- task mãe (fonte dos campos do lote)
  lote_nome               TEXT,
  clickup_url             TEXT,
  -- pending | running | done | failed | awaiting_manual_upload | skipped
  status                  VARCHAR(30)  NOT NULL DEFAULT 'pending',
  detalhe                 TEXT,
  warnings                JSONB,
  conjunto_id             VARCHAR(40),
  ad_ids                  JSONB,
  bookmark                JSONB,                                 -- uploadedMedia[] p/ retomar upload
  plan_snapshot           JSONB,                                 -- LotePlan serializado p/ retomar
  attempts                INTEGER      NOT NULL DEFAULT 0,
  clickup_status_moved    BOOLEAN      NOT NULL DEFAULT FALSE,
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ads_automation_steps_run_ordem_idx
  ON cortex_core.ads_automation_steps (run_id, ordem);

CREATE INDEX IF NOT EXISTS ads_automation_steps_status_idx
  ON cortex_core.ads_automation_steps (status);

-- 1 step por subtask dentro de um run — re-run não duplica
CREATE UNIQUE INDEX IF NOT EXISTS ads_automation_steps_run_task_idx
  ON cortex_core.ads_automation_steps (run_id, clickup_task_id);

COMMENT ON TABLE cortex_core.ads_automation_runs IS
  'Execuções semanais do agente de subida de ads (segunda-feira). 1 linha por semana (week_of UNIQUE).';
COMMENT ON TABLE cortex_core.ads_automation_steps IS
  'Lotes processados dentro de um run. plan_snapshot/bookmark permitem retomar após restart/quota.';
