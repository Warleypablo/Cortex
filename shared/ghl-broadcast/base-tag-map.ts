/**
 * Mapeamento das "listas" nominais (linguagem da equipe de Marketing) para
 * as tags reais do CRM (GHL) onde os contatos estão classificados.
 *
 * Para cada lista, listamos:
 *  - `tagsAll`: contato qualifica somente se tem TODAS essas tags
 *  - `tagsAny`: contato qualifica se tem QUALQUER uma dessas tags
 *  - `tagsNot`: contato é excluído se tem qualquer uma dessas tags
 *
 * Pós-migração 2026-05-23, todas as tags seguem padrão `[categoria]_valor`.
 * Ver `docs/ghl-tag-standard.md`.
 *
 * NOTA: tagsAll exige TODAS as tags simultaneamente. Faixas de faturamento
 * são MUTUAMENTE EXCLUSIVAS (um contato tem só uma), então elas devem ir em
 * tagsAny — nunca em tagsAll.
 *
 * `LEGACY_TAG_ALIASES` mantém compatibilidade durante a janela de migração
 * (contatos que ainda têm tags antigas). Quando o cleanup confirmar que
 * nenhuma tag antiga sobrevive, remover o bloco e simplificar
 * `contatoSatisfazBase`.
 */

export interface BaseFiltro {
  tagsAny?: string[];
  tagsAll?: string[];
  tagsNot?: string[];
}

/**
 * Aliases: nome novo → nomes antigos que ainda podem aparecer em
 * `cortex_core.ghl_contacts.tags` durante a janela de migração.
 */
export const LEGACY_TAG_ALIASES: Record<string, string[]> = {
  // ── [lead] ──
  "[lead]_creators": ["[creators]", "[creators] lp", "tag criadores"],
  "[lead]_geral": ["[lead]", "forms"],
  "[lead]_geteducacao": ["[lead]_geteducação"],
  "[lead]_ecommerce": ["[lead]_e-commerce"],
  "[lead]_academia": ["leads academia", "leads academia v2"],
  "[lead]_estruturacao_comercial": [
    "reestruturacao_comercial",
    "estruturacao_grupo1",
    "estruturacao_grupo2",
    "estruturacao_grupo3",
  ],
  "[lead]_flashcrm": ["lead_flashcrm"],
  "[lead]_gestao_comunidade": ["[gestao_comunidade]"],
  "[lead]_implantacao_funil_vendas": ["[lead]_ifv", "[lead]_funil_de_vendas"],
  "[lead]_turbonews": ["[newsletter]_turbonews"],

  // ── [segmento] ──
  "[segmento]_ecommerce": ["[segmento]_e-commerce"],
  "[segmento]_servico": ["[segmento]_serviço"],
  "[segmento]_industria": ["[segmento]_indústria"],
  "[segmento]_es": ["[empresa-es]", "[espirito santo]"],
  "[segmento]_afiliado_dropshipper": [
    "[segmento]_afiliado/dropshipper",
    "[segmento]_afiliado-dropshipper",
  ],
  "[segmento]_agencia_marketing": ["[segmento]_agência de marketing"],
  "[segmento]_educacao": ["[segmento]_educação"],
  "[segmento]_financas": ["[segmento]_finanças"],
  "[segmento]_food_service": ["[segmento]_food service"],
  "[segmento]_energia_solar": ["[segmento]_energia solar"],
  "[segmento]_imobiliaria": ["[segmento]_imobiliária"],

  // ── [faturamento] ──
  "[faturamento]_0_30k": ["[faturamento] r$0 - r$30.000"],
  "[faturamento]_30k_50k": ["[faturamento] r$30.000 - r$50.000"],
  "[faturamento]_50k_100k": ["[faturamento] r$50.000 - r$100.000"],
  "[faturamento]_100k_500k": ["[faturamento] r$100.000 - r$500.000"],
  "[faturamento]_500k_1mi": [
    "[faturamento] r$500.000 - r$1 milhão",
    "[faturamento] r$500.000 - r$1.000.000",
    "[faturamento] r$ 500.000+",
  ],
  "[faturamento]_1mi_5mi": [
    "[faturamento] r$1 milhão - r$5 milhões",
    "[faturamento] r$1.000.000 - r$5.000.000",
  ],
  "[faturamento]_5mi_15mi": [
    "[faturamento] r$5 milhões - r$15 milhões",
    "[faturamento] r$5.000.000 - r$15.000.000",
  ],
  "[faturamento]_15mi_30mi": [
    "[faturamento] r$15 milhões - r$30 milhões",
    "[faturamento] r$15.000.000 - r$30.000.000",
  ],
  "[faturamento]_30mi_plus": [
    "[faturamento] mais de r$30 milhões",
    "[faturamento] mais de r$30.000.000",
  ],
  "[faturamento]_0_100k_legacy": ["abaixo de 100k"],

  // ── [status] ──
  "[status]_mql": [
    "[mql]",
    "ddd 027 - mqls",
    "[leads] mql's_ddd027",
    "ddd mqls - 028",
  ],
  "[status]_cliente": ["[cliente]", "[leads] clientes_ddd027"],
  "[status]_congelado": [
    "[congelados]",
    "[congelados] 31_07_25",
    "congelados hubspot",
    "congelados hubspot 3",
    "congelados hubspot ofc",
  ],
  "[status]_descartados": [
    "[chorume]",
    "[descartados]_mql_01-01_a_22-05_2025",
    "descartados_que_viu_nosso ad_da_natural_tec",
    "descartados_que_viu_nosso_ad_da_natural_tec",
  ],
  "[status]_churn": ["tag_[churn]"],
  "[status]_perdido": ["perdidos bitrix", "perdidos bitrix ofc"],
  "[status]_nao_convidar": ["[não convidar]"],
  "[status]_blacklist": ["blacklist"],
};

/**
 * Expande uma lista de tags canônicas para incluir os aliases antigos.
 * Use ao montar SQL/filtros durante a janela de migração.
 */
export function expandLegacyAliases(tags: string[]): string[] {
  const expanded = new Set<string>(tags);
  for (const t of tags) {
    const aliases = LEGACY_TAG_ALIASES[t];
    if (aliases) for (const a of aliases) expanded.add(a);
  }
  return Array.from(expanded);
}

// Faixas de faturamento agrupadas (nomes canônicos pós-migração).
// MUTUAMENTE EXCLUSIVAS — sempre vão em tagsAny, nunca tagsAll.
const FAT_500K_MAIS = [
  "[faturamento]_500k_1mi",
  "[faturamento]_1mi_5mi",
  "[faturamento]_5mi_15mi",
  "[faturamento]_15mi_30mi",
  "[faturamento]_30mi_plus",
];

const FAT_100K_A_500K = ["[faturamento]_100k_500k"];
const FAT_50K_A_100K = ["[faturamento]_50k_100k"];
const FAT_30K_A_50K = ["[faturamento]_30k_50k"];
const FAT_0_A_30K = ["[faturamento]_0_30k"];
const FAT_50K_MAIS = [...FAT_50K_A_100K, ...FAT_100K_A_500K, ...FAT_500K_MAIS];

export const BASE_TAG_MAP: Record<string, BaseFiltro> = {
  // ── Premium / MQL ─────────────────────────────────────────────────────
  "Mix da Nata": {
    tagsAll: ["[status]_mql"],
    tagsAny: FAT_500K_MAIS,
  },
  "Show me the money": {
    tagsAll: ["[status]_mql"],
    tagsAny: FAT_100K_A_500K,
  },
  "Show me the money expandido": {
    tagsAll: ["[status]_mql"],
    tagsAny: FAT_50K_MAIS,
  },
  Clientes: {
    tagsAny: ["[status]_cliente"],
  },
  Congelados: {
    tagsAny: ["[status]_congelado"],
  },

  // ── MQLs por funil ────────────────────────────────────────────────────
  "Geral - MQLs": {
    tagsAll: ["[status]_mql", "[lead]_geral"],
  },
  "Creators - MQLs": {
    tagsAll: ["[status]_mql", "[lead]_creators"],
  },
  "CRM - MQLs": {
    tagsAll: ["[status]_mql"],
    tagsAny: ["[lead]_implantacao_funil_vendas"],
  },

  // ── Leads 30k-100k por funil ──────────────────────────────────────────
  "Geral - Entre 30k a 100k": {
    tagsAll: ["[lead]_geral"],
    tagsAny: [...FAT_30K_A_50K, ...FAT_50K_A_100K],
  },
  "Creators - Entre 30k a 100k": {
    tagsAll: ["[lead]_creators"],
    tagsAny: [...FAT_30K_A_50K, ...FAT_50K_A_100K],
  },

  // ── Leads abaixo de 30k ───────────────────────────────────────────────
  "Geral - Abaixo de 30k": {
    tagsAll: ["[lead]_geral"],
    tagsAny: [...FAT_0_A_30K, "[faturamento]_0_100k_legacy"],
  },
  "Creators - Abaixo de 30k": {
    tagsAll: ["[lead]_creators"],
    tagsAny: FAT_0_A_30K,
  },

  // ── Regional ──────────────────────────────────────────────────────────
  "Contatos Espírito Santo": {
    tagsAny: ["[segmento]_es"],
  },

  // ── Funil IA ──────────────────────────────────────────────────────────
  "IA - MQLs": {
    tagsAll: ["[status]_mql", "[lead]_ia"],
  },
  "IA - Todos": {
    tagsAny: ["[lead]_ia"],
  },

  // ── Amplas ────────────────────────────────────────────────────────────
  "Geral - Todos": {
    tagsAny: ["[lead]_geral"],
  },
  "CRM - Todos": {
    tagsAny: ["[lead]_implantacao_funil_vendas"],
  },
  "Creators - Todos": {
    tagsAny: ["[lead]_creators"],
  },
};

export const BASES_DISPONIVEIS = Object.keys(BASE_TAG_MAP);

export function getBaseFiltro(base: string): BaseFiltro | null {
  return BASE_TAG_MAP[base] || null;
}

/**
 * Retorna o filtro de uma base já com aliases legacy expandidos em cada
 * lista. Use ao montar SQL ou avaliar JS-side durante a janela de
 * convivência (tags antigas + novas no mesmo contato).
 */
export function getBaseFiltroComAliases(base: string): BaseFiltro | null {
  const f = BASE_TAG_MAP[base];
  if (!f) return null;
  return {
    tagsAny: f.tagsAny ? expandLegacyAliases(f.tagsAny) : undefined,
    tagsAll: f.tagsAll ? expandLegacyAliases(f.tagsAll) : undefined,
    tagsNot: f.tagsNot ? expandLegacyAliases(f.tagsNot) : undefined,
  };
}

/**
 * Avalia se um contato (representado pelo array de tags dele) satisfaz uma base.
 * Aceita tanto tags antigas (via LEGACY_TAG_ALIASES) quanto novas.
 */
export function contatoSatisfazBase(contactTags: string[] | null | undefined, filtro: BaseFiltro): boolean {
  const tags = new Set((contactTags ?? []).map((t) => t.toLowerCase()));
  const has = (canonical: string) => {
    if (tags.has(canonical.toLowerCase())) return true;
    const aliases = LEGACY_TAG_ALIASES[canonical] ?? [];
    return aliases.some((a) => tags.has(a.toLowerCase()));
  };
  if (filtro.tagsAll && !filtro.tagsAll.every(has)) return false;
  if (filtro.tagsAny && !filtro.tagsAny.some(has)) return false;
  if (filtro.tagsNot && filtro.tagsNot.some(has)) return false;
  return true;
}
