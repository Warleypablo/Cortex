-- Workflows (automações) do GoHighLevel — sync via /workflows/?locationId=X
-- API só expõe metadata (id, name, status, version, dates). Detalhe individual,
-- lista de contatos por workflow e stats NÃO existem via REST público.

CREATE TABLE IF NOT EXISTS cortex_core.ghl_workflows (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  name        TEXT,
  status      TEXT,                    -- 'published' | 'draft'
  version     INTEGER,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  raw         JSONB,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ghl_workflows_status_idx ON cortex_core.ghl_workflows (status);
CREATE INDEX IF NOT EXISTS ghl_workflows_updated_idx ON cortex_core.ghl_workflows (updated_at);
