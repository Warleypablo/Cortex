// Marcação de expansão de conta feita pelo comercial no CRM. Régua única de
// cross-sell/upsell do Cortex — substituiu `source='PARTNER'` em 2026-07-21,
// que dava R$ 0 em todo mês (1 deal em toda a base desde que crm_deal virou
// espelho do Synapse) e fazia o NRR sair idêntico ao Churn %.
//
// Vive em shared/ porque server/crm/expansao.ts e
// server/routes/ceoDashboard.movimentoReceita.ts precisam da MESMA string:
// duas cópias divergindo é a falha silenciosa que essa constante existe para
// impedir.
//
// Ainda na régua morta `source='PARTNER'` (cross-sell zerado em produção):
// server/okr2026/metricsAdapter.ts, server/routes/relatorioMensalSlides.ts,
// server/routes/reportsTrimestral.crosssell.ts e
// server/routes/scorecard.detalhe.helpers.ts. Migrá-las para `channel` é
// trabalho futuro deliberado (decisão 2026-07-21) — não um esquecimento.
export const CHANNEL_EXPANSAO = "Expansão de Conta";
