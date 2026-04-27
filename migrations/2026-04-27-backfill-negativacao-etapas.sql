-- Backfill: cards em protesto/negativação/ação judicial sem notificação
-- extrajudicial enviada voltam para 'notificacao'.
--
-- Motivação: a etapa só pode avançar legalmente após o envio da notificação
-- extrajudicial. Cards criados pelo TurboZap antes desta regra foram inseridos
-- diretamente nessas etapas com base apenas em dias de atraso.

UPDATE cortex_core.negativacao_acoes
SET etapa = 'notificacao',
    observacoes = COALESCE(observacoes, '') ||
                  CASE WHEN observacoes IS NULL OR observacoes = '' THEN '' ELSE ' | ' END ||
                  'Reposicionado para notificacao em ' || NOW()::date ||
                  ' (etapa anterior: ' || etapa || ' sem notificação extrajudicial registrada)',
    atualizado_em = NOW()
WHERE etapa IN ('protesto', 'negativacao', 'acao_judicial')
  AND status IN ('pendente', 'em_andamento')
  AND cliente_id NOT IN (
    SELECT DISTINCT cliente_id
    FROM cortex_core.notificacoes_extrajudiciais_enviadas
    WHERE status = 'enviado'
  );
