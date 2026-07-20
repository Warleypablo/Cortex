// Fonte única dos grupos por função da aba Capacity (/capacity-times).
// A pessoa é classificada pelo CARGO em "Inhire".rh_pessoal (status = 'Ativo').
// Ajuste aqui quando o RH padronizar os nomes de cargo.

export type CapacityGrupoKey = "selva" | "black" | "squadra" | "cxcs";

export interface CapacityGrupoDef {
  key: CapacityGrupoKey;
  label: string; // nome exibido na aba
  funcao: string; // descrição da função
  /** Régua de carteira: "squad"; "responsavel"; "cs_responsavel"; "responsavel_geral" (clientes do account). */
  carteira: "squad" | "responsavel" | "cs_responsavel" | "responsavel_geral";
}

export const CAPACITY_GRUPOS: Record<CapacityGrupoKey, CapacityGrupoDef> = {
  selva: { key: "selva", label: "Selva", funcao: "Designers", carteira: "responsavel" },
  black: { key: "black", label: "Black", funcao: "Accounts", carteira: "responsavel_geral" },
  squadra: { key: "squadra", label: "Squadra", funcao: "GPs", carteira: "responsavel" },
  cxcs: { key: "cxcs", label: "CXCS", funcao: "Customer Success", carteira: "cs_responsavel" },
};

export const CAPACITY_GRUPOS_ORDER: CapacityGrupoKey[] = ["selva", "black", "squadra", "cxcs"];

// Black = lista explícita de Accounts (o cargo "Account" ainda não existe no RH).
// - match    = nome como aparece em cup_clientes.responsavel_geral (clientes que cuida)
// - rhNome   = nome em "Inhire".rh_pessoal, p/ removê-los dos grupos por cargo
//              (5 são GP → saem da Squadra; Aline é CXCS → sai do CXCS; Jônatas é GP).
// Carteira = soma de valorr + valorp de TODAS as subtasks dos clientes que cuidam.
export const BLACK_ACCOUNTS: { label: string; match: string; rhNome: string }[] = [
  { label: "Breno Pimenta",      match: "Breno Moscardini Abrão Pimenta", rhNome: "Breno Moscardini Abrão Pimenta" },
  { label: "Jônatas Cavalcante", match: "Jônatas Cavalcante",             rhNome: "Jônatas Cavalcante da Silva" },
  { label: "Leonardo Kruger",    match: "Leonardo Kruger",                rhNome: "Leonardo Kruger Soares" },
  { label: "Aline Souza",        match: "Aline Souza",                    rhNome: "Aline de Carvalho de Souza" },
  { label: "Felipe Vassallo",    match: "Felipe Vassallo",                rhNome: "Felipe Vassallo" },
  { label: "Victor Arpini",      match: "Victor Arpini",                  rhNome: "Victor Anderson Arpini Vianna" },
  { label: "Renan Fortunato",    match: "Renan Fortunato",                rhNome: "Renan Fortunato Silveira" },
];

// Meta de contas que um designer comporta — usada para derivar a Cap. de
// faturamento da Selva (Cap R$ = Ticket Médio da carteira × META_CONTAS_DESIGNER).
// Calibrar com o time de operações; valor inicial é uma estimativa.
export const META_CONTAS_DESIGNER = 20;

// Aba Selva liberada em 2026-07-20. Atenção: a carteira depende de o designer
// estar como responsável na subtask do ClickUp — quem não estiver aparece com
// carteira vazia, o que é falta de preenchimento, não ociosidade.
export const SELVA_BLOQUEADA = false;

// Capacity de contas (clientes) por Account na Black. Default; pode ser
// sobrescrito por pessoa via cap_clientes em cortex_core.capacity_metas (aba Configurar).
export const CAP_CONTAS_ACCOUNT = 25;

// Capacity de clientes por GP na Squadra. Default no código (e não UPDATE no banco)
// porque só 8 dos 14 GPs têm registro em capacity_metas — assim todos entram com meta,
// inclusive GPs novos. Override por pessoa continua valendo pela aba Configurar.
export const CAP_CLIENTES_SQUADRA = 25;

// Capacity de clientes por operador no squad Pulse. Mesmo racional da Squadra:
// nenhum registro do Pulse tem cap_clientes preenchido, então o default cobre todos.
export const CAP_CLIENTES_PULSE = 20;
