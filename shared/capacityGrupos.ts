// Fonte única dos grupos por função da aba Capacity (/capacity-times).
// A pessoa é classificada pelo CARGO em "Inhire".rh_pessoal (status = 'Ativo').
// Ajuste aqui quando o RH padronizar os nomes de cargo.

export type CapacityGrupoKey = "selva" | "black" | "squadra";

export interface CapacityGrupoDef {
  key: CapacityGrupoKey;
  label: string; // nome exibido na aba
  funcao: string; // descrição da função
  /** Régua de carteira: "squad" = via squad de CS (designers); "responsavel" = via campo responsavel. */
  carteira: "squad" | "responsavel";
}

export const CAPACITY_GRUPOS: Record<CapacityGrupoKey, CapacityGrupoDef> = {
  selva: { key: "selva", label: "Selva", funcao: "Designers", carteira: "squad" },
  black: { key: "black", label: "Black", funcao: "Accounts", carteira: "responsavel" },
  squadra: { key: "squadra", label: "Squadra", funcao: "GPs", carteira: "responsavel" },
};

export const CAPACITY_GRUPOS_ORDER: CapacityGrupoKey[] = ["selva", "black", "squadra"];

// Meta de contas que um designer comporta — usada para derivar a Cap. de
// faturamento da Selva (Cap R$ = Ticket Médio da carteira × META_CONTAS_DESIGNER).
// Calibrar com o time de operações; valor inicial é uma estimativa.
export const META_CONTAS_DESIGNER = 20;

// Aba Selva bloqueada temporariamente: poucos designers estão setados como
// responsável nas subtasks (carteira magra). Trocar para false quando o
// preenchimento no ClickUp estiver maduro.
export const SELVA_BLOQUEADA = true;
