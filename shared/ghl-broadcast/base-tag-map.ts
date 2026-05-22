/**
 * Mapeamento das "bases" semânticas (linguagem da equipe de Marketing) para
 * as tags reais do GHL onde os contatos estão classificados.
 *
 * As bases vêm do dashboard-broadcast do estagiário (planilha de broadcasts).
 * As tags vieram do snapshot real do GHL da Turbo em 2026-05-22 (182 tags).
 *
 * Para cada base, listamos:
 *  - `tagsAny`: contato qualifica se tem QUALQUER uma dessas tags
 *  - `tagsAll`: contato qualifica somente se tem TODAS essas tags
 *  - `tagsNot`: contato é excluído se tem qualquer uma dessas tags
 *
 * Quando estiver disponível só tagsAny (caso simples), pode passar como string[].
 */

export interface BaseFiltro {
  tagsAny?: string[];
  tagsAll?: string[];
  tagsNot?: string[];
}

// Bases nominais conhecidas → filtro de tags GHL
// IMPORTANTE: este mapeamento é editável e provavelmente vai precisar refinar
// conforme a equipe de Marketing valide. Os valores aqui são best-effort com
// base nas tags observadas no snapshot de 2026-05-22.
export const BASE_TAG_MAP: Record<string, BaseFiltro> = {
  // ── Premium / MQL ─────────────────────────────────────────────────────
  "Mix da Nata": {
    tagsAny: ["[mql]"],
    tagsAll: ["[faturamento] r$500.000 - r$1 milhão", "[faturamento] r$1 milhão - r$5 milhões"],
  },
  "Show me the money": {
    tagsAny: ["[mql]"],
    tagsAll: ["[faturamento] r$100.000 - r$500.000"],
  },
  "Show me the money expandido": {
    tagsAny: ["[mql]", "[faturamento] r$50.000 - r$100.000"],
  },
  Clientes: {
    tagsAny: ["[cliente]"],
  },
  Congelados: {
    tagsAny: ["[congelados]", "[congelados] 31_07_25"],
  },

  // ── MQLs por funil ────────────────────────────────────────────────────
  "Geral - MQLs": {
    tagsAll: ["[mql]", "[lead]_geral"],
  },
  "Creators - MQLs": {
    tagsAll: ["[mql]", "[lead]_creators"],
  },
  "CRM - MQLs": {
    tagsAll: ["[mql]"],
    tagsAny: ["[lead]_ifv", "[lead]_funil_de_vendas"],
  },

  // ── Leads 30k-100k por funil ──────────────────────────────────────────
  "Geral - Entre 30k a 100k": {
    tagsAll: ["[lead]_geral"],
    tagsAny: ["[faturamento] r$30.000 - r$50.000", "[faturamento] r$50.000 - r$100.000"],
  },
  "Creators - Entre 30k a 100k": {
    tagsAll: ["[lead]_creators"],
    tagsAny: ["[faturamento] r$30.000 - r$50.000", "[faturamento] r$50.000 - r$100.000"],
  },

  // ── Leads abaixo de 30k ───────────────────────────────────────────────
  "Geral - Abaixo de 30k": {
    tagsAll: ["[lead]_geral"],
    tagsAny: ["[faturamento] r$0 - r$30.000", "abaixo de 100k"],
  },
  "Creators - Abaixo de 30k": {
    tagsAll: ["[lead]_creators"],
    tagsAny: ["[faturamento] r$0 - r$30.000"],
  },

  // ── Regional ──────────────────────────────────────────────────────────
  "Contatos Espírito Santo": {
    tagsAny: ["[espirito santo]", "[empresa-es]"],
  },

  // ── Funil IA ──────────────────────────────────────────────────────────
  "IA - MQLs": {
    tagsAll: ["[mql]", "[lead]_ia"],
  },
  "IA - Todos": {
    tagsAny: ["[lead]_ia"],
  },

  // ── Amplas ────────────────────────────────────────────────────────────
  "Geral - Todos": {
    tagsAny: ["[lead]_geral", "[lead]"],
  },
  "CRM - Todos": {
    tagsAny: ["[lead]_ifv", "[lead]_funil_de_vendas"],
  },
  "Creators - Todos": {
    tagsAny: ["[lead]_creators"],
  },
};

export const BASES_DISPONIVEIS = Object.keys(BASE_TAG_MAP);

/**
 * Gera SQL fragment pra filtrar contatos por base.
 * Use com `cortex_core.ghl_contacts` (coluna `tags TEXT[]`).
 *
 * Retorna SQL pronto pra usar em WHERE, ou null se a base não é conhecida.
 *
 * Exemplo:
 *   SELECT count(*) FROM cortex_core.ghl_contacts WHERE ${sqlFilterForBase(base)}
 */
export function getBaseFiltro(base: string): BaseFiltro | null {
  return BASE_TAG_MAP[base] || null;
}
