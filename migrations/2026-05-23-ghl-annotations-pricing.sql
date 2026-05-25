-- Anotações manuais por broadcast (Feedback do SDR, override opcional de gasto)
-- e tabela de preços por canal/categoria pra calcular gasto dos broadcasts.

CREATE TABLE IF NOT EXISTS cortex_core.ghl_broadcast_annotations (
  broadcast_id     TEXT PRIMARY KEY,
  sdr_feedback     TEXT,
  manual_spend_brl DECIMAL(12, 2),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_by       TEXT
);

CREATE TABLE IF NOT EXISTS cortex_core.ghl_pricing (
  id               SERIAL PRIMARY KEY,
  channel          TEXT NOT NULL,        -- 'WhatsApp' | 'Email'
  message_category TEXT,                 -- 'Marketing' | 'Utility' | etc (opcional)
  unit_cost_brl    DECIMAL(10, 4) NOT NULL,
  effective_from   DATE NOT NULL,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS ghl_pricing_channel_date_idx
  ON cortex_core.ghl_pricing (channel, effective_from);

-- Seed inicial (idempotente — só insere se ainda não existir essa combinação channel+effective_from)
INSERT INTO cortex_core.ghl_pricing (channel, message_category, unit_cost_brl, effective_from, notes)
SELECT 'WhatsApp', 'Marketing', 0.33, '2025-07-01'::date,
       'Meta marketing template (BR) ~$0.0625 USD + ~5% margem GHL = ~R$0.33/msg'
WHERE NOT EXISTS (
  SELECT 1 FROM cortex_core.ghl_pricing
  WHERE channel = 'WhatsApp' AND effective_from = '2025-07-01'::date
);

INSERT INTO cortex_core.ghl_pricing (channel, message_category, unit_cost_brl, effective_from, notes)
SELECT 'Email', NULL, 0.01, '2025-07-01'::date,
       'Estimativa inicial — ajustar com valor real cobrado pelo GHL/Mailgun'
WHERE NOT EXISTS (
  SELECT 1 FROM cortex_core.ghl_pricing
  WHERE channel = 'Email' AND effective_from = '2025-07-01'::date
);
