// server/routes/bitrixSources.ts
// Nomes legíveis dos "source" do Bitrix (crm.status.list ENTITY_ID=SOURCE).
// Os códigos crus (CALL, WEBFORM, UC_*) são internos e às vezes enganosos
// (ex.: CALL = "Agendamento direto", não "ligação"), então exibimos o nome oficial.
export const SOURCE_LABELS: Record<string, string> = {
  CALL: "Agendamento direto",
  EMAIL: "Automação",
  WEB: "Contato - Instagram",
  ADVERTISING: "Contato recebido",
  PARTNER: "Crossell",
  RECOMMENDATION: "Eventos",
  TRADE_SHOW: "Inbound (LinkedIn)",
  WEBFORM: "Formulário",
  BOOKING: "Agendamento on-line",
  CALLBACK: "Indicação",
  RC_GENERATOR: "Indique e Ganhe",
  STORE: "Lead Calculadora",
  OTHER: "Lista - Wpp Marketing",
  REPEAT_SALE: "Vendas recorrentes",
  UC_YWZVA2: "Prospecção",
  UC_PTYW1Y: "Recomendação",
  UC_4VCKGM: "Social Selling - Instagram",
  UC_7WV0LW: "Upsell",
  UC_KYOYOW: "Workshop",
  UC_8HI30Y: "Recuperação de Churn",
  UC_HIBVO6: "Recuperação de Base",
};

// código do source → nome legível (fallback: o próprio código; vazio → "(não informado)")
export const sourceLabel = (s: string | null | undefined): string =>
  !s || s === "(não informado)" ? "(não informado)" : SOURCE_LABELS[s] || s;
