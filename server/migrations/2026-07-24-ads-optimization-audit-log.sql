-- Log de auditoria das ações de OTIMIZAÇÃO de mídia paga (Google Ads, TikTok Ads).
-- Toda escrita que altera estado real de campanha passa por aqui — inclusive as que
-- falharam, porque saber o que foi TENTADO importa tanto quanto o que foi aplicado.
--
-- `before` guarda o estado anterior em JSONB: é o que permite desfazer uma ação
-- (repausar, devolver o orçamento antigo) sem depender de memória de ninguém.
--
-- Aditivo e idempotente.

CREATE SCHEMA IF NOT EXISTS ads_ops;

CREATE TABLE IF NOT EXISTS ads_ops.action_log (
  id             BIGSERIAL PRIMARY KEY,
  -- google | tiktok | meta (meta entra quando a feature de otimização cobrir ele)
  channel        TEXT        NOT NULL,
  -- id da conta no canal: customer_id (Google) ou advertiser_id (TikTok)
  account_id     TEXT        NOT NULL,
  -- campaign | adgroup | ad
  level          TEXT        NOT NULL,
  entity_id      TEXT        NOT NULL,
  entity_name    TEXT,
  -- set_status | set_budget | set_bid
  action_type    TEXT        NOT NULL,
  before_state   JSONB,
  after_state    JSONB,
  ok             BOOLEAN     NOT NULL,
  error          TEXT,
  -- TRUE = preview (validateOnly no Google / não-POST no TikTok). Nada mudou de fato.
  dry_run        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- email do aprovador autenticado que disparou a ação
  actor_email    TEXT        NOT NULL,
  -- agrupa as ações de um mesmo lote de execute, pra desfazer em conjunto
  batch_id       UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico é quase sempre lido "mais recente primeiro", filtrando por canal.
CREATE INDEX IF NOT EXISTS action_log_created_idx  ON ads_ops.action_log (created_at DESC);
CREATE INDEX IF NOT EXISTS action_log_channel_idx  ON ads_ops.action_log (channel, created_at DESC);
-- "o que eu fiz com ESTA campanha?" — usado ao montar o undo.
CREATE INDEX IF NOT EXISTS action_log_entity_idx   ON ads_ops.action_log (channel, level, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS action_log_batch_idx    ON ads_ops.action_log (batch_id);
