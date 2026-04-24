-- Notificações extrajudiciais enviadas — auditoria completa
CREATE TABLE IF NOT EXISTS cortex_core.notificacoes_extrajudiciais_enviadas (
  id SERIAL PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT,
  email_destino TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo_texto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  enviado_por TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sendgrid_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  erro TEXT,
  CONSTRAINT ck_notif_status CHECK (status IN ('enviado', 'erro', 'bounced'))
);

CREATE INDEX IF NOT EXISTS idx_notif_cliente_id
  ON cortex_core.notificacoes_extrajudiciais_enviadas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_notif_enviado_em
  ON cortex_core.notificacoes_extrajudiciais_enviadas(enviado_em DESC);
