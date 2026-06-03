-- Integração GoHighLevel (GHL) — sublocation única "Turbo Partners"
-- Plano completo: docs/handover-ghl-integracao.md
-- Endpoints REST mapeados em 2026-05-22
-- Tabelas vão em cortex_core.* (mesmo padrão de YouTube e Instagram)

-- =============================================================================
-- Contatos (~48k registros esperados)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_contacts (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  contact_name    TEXT,
  first_name      TEXT,
  last_name       TEXT,
  company_name    TEXT,
  type            TEXT,
  source          TEXT,
  tags            TEXT[],
  country         TEXT,
  city            TEXT,
  state           TEXT,
  date_added      TIMESTAMPTZ,
  date_updated    TIMESTAMPTZ,
  attributions    JSONB,
  custom_fields   JSONB,
  raw             JSONB,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ghl_contacts_email_idx ON cortex_core.ghl_contacts (email);
CREATE INDEX IF NOT EXISTS ghl_contacts_phone_idx ON cortex_core.ghl_contacts (phone);
CREATE INDEX IF NOT EXISTS ghl_contacts_date_updated_idx ON cortex_core.ghl_contacts (date_updated);
CREATE INDEX IF NOT EXISTS ghl_contacts_tags_gin_idx ON cortex_core.ghl_contacts USING GIN (tags);

-- =============================================================================
-- Conversations (~46k registros, 7.2k WhatsApp)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_conversations (
  id                      TEXT PRIMARY KEY,
  location_id             TEXT NOT NULL,
  contact_id              TEXT,
  last_message_type       TEXT,        -- TYPE_EMAIL | TYPE_WHATSAPP | TYPE_SMS | TYPE_PHONE
  last_message_direction  TEXT,        -- inbound | outbound
  last_message_date       TIMESTAMPTZ,
  unread_count            INTEGER,
  date_added              TIMESTAMPTZ,
  date_updated            TIMESTAMPTZ,
  raw                     JSONB,
  synced_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ghl_conversations_contact_idx ON cortex_core.ghl_conversations (contact_id);
CREATE INDEX IF NOT EXISTS ghl_conversations_last_msg_date_idx ON cortex_core.ghl_conversations (last_message_date);
CREATE INDEX IF NOT EXISTS ghl_conversations_type_idx ON cortex_core.ghl_conversations (last_message_type);

-- =============================================================================
-- Mensagens individuais (puxadas só das conversas mais recentes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_messages (
  id                  TEXT PRIMARY KEY,
  conversation_id     TEXT NOT NULL,
  contact_id          TEXT,
  location_id         TEXT NOT NULL,
  direction           TEXT,            -- inbound | outbound
  message_type        TEXT,            -- TYPE_EMAIL | TYPE_WHATSAPP | ...
  status              TEXT,            -- sent (não atualiza pra delivered/read - vem via webhook)
  source              TEXT,            -- workflow | bulk | manual | api
  body                TEXT,
  subject             TEXT,
  email_message_id    TEXT,            -- meta.email.messageIds[0] - chave pro webhook event
  content_type        TEXT,
  date_added          TIMESTAMPTZ,
  meta                JSONB,
  synced_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ghl_messages_conv_idx ON cortex_core.ghl_messages (conversation_id);
CREATE INDEX IF NOT EXISTS ghl_messages_date_idx ON cortex_core.ghl_messages (date_added);
CREATE INDEX IF NOT EXISTS ghl_messages_type_dir_idx ON cortex_core.ghl_messages (message_type, direction);
CREATE INDEX IF NOT EXISTS ghl_messages_source_idx ON cortex_core.ghl_messages (source);
CREATE INDEX IF NOT EXISTS ghl_messages_email_msg_id_idx ON cortex_core.ghl_messages (email_message_id);

-- =============================================================================
-- Email campaigns (~191 esperadas) - do endpoint /emails/schedule
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_email_campaigns (
  id                  TEXT PRIMARY KEY,
  location_id         TEXT NOT NULL,
  name                TEXT,
  subject             TEXT,
  campaign_type       TEXT,            -- send_now | drip_schedule | schedule_later
  status              TEXT,            -- complete | scheduled | draft
  template_id         TEXT,
  template_type       TEXT,
  total_count         INTEGER,
  success_count       INTEGER,
  failed_count        INTEGER,
  error_count         INTEGER,
  processed_count     INTEGER,
  queued_count        INTEGER,
  has_tracking        BOOLEAN,
  has_utm_tracking    BOOLEAN,
  is_plain_text       BOOLEAN,
  scheduled_at        TIMESTAMPTZ,
  date_added          TIMESTAMPTZ,
  date_updated        TIMESTAMPTZ,
  raw                 JSONB,
  synced_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ghl_email_campaigns_scheduled_idx ON cortex_core.ghl_email_campaigns (scheduled_at);
CREATE INDEX IF NOT EXISTS ghl_email_campaigns_status_idx ON cortex_core.ghl_email_campaigns (status);

-- =============================================================================
-- Email events — opens, clicks, bounces, unsubscribes (chegam via webhook)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_email_events (
  id              SERIAL PRIMARY KEY,
  event_id        TEXT UNIQUE,
  message_id      TEXT,                -- match com cortex_core.ghl_messages.email_message_id
  contact_id      TEXT,
  campaign_id     TEXT,
  event_type      TEXT,                -- EmailDelivered|Opened|Clicked|Bounced|Unsubscribed|Complained|Dropped
  occurred_at     TIMESTAMPTZ,
  clicked_link    TEXT,
  payload         JSONB,
  received_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ghl_email_events_message_idx ON cortex_core.ghl_email_events (message_id);
CREATE INDEX IF NOT EXISTS ghl_email_events_type_date_idx ON cortex_core.ghl_email_events (event_type, occurred_at);
CREATE INDEX IF NOT EXISTS ghl_email_events_contact_idx ON cortex_core.ghl_email_events (contact_id);

-- =============================================================================
-- Snapshot diário de tags pra evolução temporal
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_tags_snapshot (
  snapshot_date   DATE NOT NULL,
  tag             TEXT NOT NULL,
  contact_count   INTEGER NOT NULL,
  PRIMARY KEY (snapshot_date, tag)
);

-- =============================================================================
-- Histórico de execuções de sync
-- =============================================================================
CREATE TABLE IF NOT EXISTS cortex_core.ghl_sync_runs (
  id                  SERIAL PRIMARY KEY,
  resource            TEXT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL,
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL,   -- success | partial | error
  records_processed   INTEGER,
  error_message       TEXT,
  cursor              TEXT
);
CREATE INDEX IF NOT EXISTS ghl_sync_runs_resource_idx ON cortex_core.ghl_sync_runs (resource, started_at);
