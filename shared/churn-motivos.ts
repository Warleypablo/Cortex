// Motivos de cancelamento excluídos das versões "ajustadas" de churn — são
// erro de venda/começo, não churn real (perda genuína de cliente satisfeito).
// Ver spec 2026-07-14 (NRR Bruto) para a origem da lista.
//
// Vive em shared/ porque server/services/resumoLideres.ts (mensagem diária dos
// líderes) e server/reportsSemanal/queries.ts (tela /reports/semanal) precisam
// da MESMA lista: divergirem seria a mesma falha silenciosa de duas réguas que
// já foi corrigida para `channel` (ver shared/crm-channel.ts) — a tela e a
// mensagem passariam a discordar sobre o que é "churn ajustado" sem que nada
// quebrasse no CI.
export const MOTIVOS_EXCLUIDOS_CHURN_AJUSTADO = [
  "Erro na Venda",
  "Não começou",
  "Inadimplente 1º Mês",
] as const;
