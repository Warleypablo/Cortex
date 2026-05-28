-- Atribuição lead-a-lead de broadcast (WhatsApp marketing).
--
-- Liga cada RESPOSTA de um lead ao DISPARO de origem (via conversationId do GHL) e ao
-- DEAL do Bitrix (via telefone → "Bitrix".crm_contact → crm_deal.contact_id).
--
-- As etapas de funil reunião marcada / compareceu / venda NÃO ficam aqui — são lidas
-- live de "Bitrix".crm_deal (data_reuniao_agendada / data_reuniao_realizada /
-- stage_name = 'Negócio Ganho'). Esta tabela guarda só a atribuição + a classificação
-- da resposta, com UNIQUE(reply_message_id) pra ser idempotente.
--
-- Em runtime esta tabela também é criada por initializeBroadcastLeadEventsTable() em
-- server/db.ts; este arquivo documenta/aplica a migração manualmente quando necessário.

CREATE TABLE IF NOT EXISTS cortex_core.broadcast_lead_events (
  id                SERIAL PRIMARY KEY,
  broadcast_id      TEXT NOT NULL,            -- formato wa-YYYYMMDD-source-hash8 (de listBroadcasts)
  conversation_id   TEXT,
  ghl_contact_id    TEXT,
  lead_phone        TEXT,
  lead_phone_norm   VARCHAR(20),              -- normalizePhoneBR (DDD + 8 dígitos)
  reply_message_id  TEXT NOT NULL UNIQUE,     -- id da mensagem inbound no GHL (idempotência)
  reply_body        TEXT,
  reply_at          TIMESTAMPTZ,
  sentiment         TEXT,                     -- positiva | negativa | neutra | opt_out
  sentiment_motivo  TEXT,
  sentiment_fonte   TEXT,                     -- regra | ia
  bitrix_contact_id INTEGER,
  bitrix_deal_id    INTEGER,
  attributed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS broadcast_lead_events_broadcast_idx
  ON cortex_core.broadcast_lead_events (broadcast_id);

CREATE INDEX IF NOT EXISTS broadcast_lead_events_phone_idx
  ON cortex_core.broadcast_lead_events (lead_phone_norm);

-- Contatos do Bitrix (telefone) — owner é scripts/sync-bitrix-contacts.ts, repetido aqui
-- pra a migração ser auto-suficiente.
CREATE TABLE IF NOT EXISTS "Bitrix".crm_contact (
  id               INTEGER PRIMARY KEY,
  name             TEXT,
  phone_raw        TEXT,
  phone_normalized VARCHAR(20),
  email            TEXT,
  company_name     TEXT,
  raw              JSONB,
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_contact_phone_norm_idx
  ON "Bitrix".crm_contact (phone_normalized);

-- Classificação por disparo: padrão de copy (IA) + base inferida pelas tags dos
-- destinatários. Cache pra não reprocessar a IA. Alimenta Resumo e Inteligência.
-- Também criada em runtime por initializeBroadcastClassificationTable() (server/db.ts).
CREATE TABLE IF NOT EXISTS cortex_core.broadcast_classification (
  broadcast_id   TEXT PRIMARY KEY,
  padrao         TEXT,               -- PadraoKey (Contraste, Loss Aversion…)
  padrao_motivo  TEXT,
  base           TEXT,               -- base inferida (base-tag-map)
  base_match_pct NUMERIC,            -- % dos destinatários que satisfazem a base
  classified_at  TIMESTAMPTZ DEFAULT NOW()
);
