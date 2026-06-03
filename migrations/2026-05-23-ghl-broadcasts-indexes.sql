-- Índices adicionais para suportar a query unificada de broadcasts
-- (aba Biblioteca = 1 linha por broadcast em /ghl-marketing)
--
-- Justificativa:
--  - "conversas geradas" faz JOIN de ghl_messages outbound do broadcast x
--    ghl_messages inbound dos MESMOS contact_ids em janela de 7d.
--    Sem (contact_id, direction, date_added) o planner faz seq scan.
--  - O agrupamento de WhatsApp broadcasts filtra direction='outbound' e
--    source IN ('workflow','bulk','campaign') antes do GROUP BY.
--    Índice parcial é o ideal — minoria das mensagens.
--  - Agregados de open/delivered/clicked precisam batidas rápidas em
--    ghl_email_events por (campaign_id, event_type).

CREATE INDEX IF NOT EXISTS ghl_messages_contact_dir_date_idx
  ON cortex_core.ghl_messages (contact_id, direction, date_added);

-- Source real no banco é 'bulk_actions' (não 'bulk', apesar de doc anterior).
DROP INDEX IF EXISTS cortex_core.ghl_messages_outbound_marketing_idx;
CREATE INDEX IF NOT EXISTS ghl_messages_outbound_marketing_idx
  ON cortex_core.ghl_messages (date_added, source)
  WHERE direction = 'outbound'
    AND source IN ('workflow', 'bulk_actions', 'campaign');

CREATE INDEX IF NOT EXISTS ghl_email_events_campaign_type_idx
  ON cortex_core.ghl_email_events (campaign_id, event_type);
