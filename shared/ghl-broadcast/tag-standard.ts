/**
 * Padrão canônico de tags do GHL pós-migração.
 *
 * Use este módulo para validar tags antes de adicionar a contatos
 * via código (defesa contra criação de tags fora do padrão).
 *
 * Para o mapeamento old→new, ver `tag-migration-map.ts`.
 * Documento de padronização: `docs/ghl-tag-standard.md`.
 */

import { TAG_MIGRATION_MAP } from "./tag-migration-map";

export const VALID_CATEGORIES = [
  // Canônicas
  "[lead]",
  "[segmento]",
  "[faturamento]",
  "[status]",
  // Auxiliares preservadas
  "[sequencia]",
  "[evento]",
  "[motivo]",
  "[mg]",
  "[funnels]",
  "[produto]",
] as const;

export type TagCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Conjunto imutável das tags válidas pós-migração — derivado do
 * `TAG_MIGRATION_MAP` (todos os valores não-null + tags que já eram
 * canônicas e não precisam mapear).
 */
export const VALID_TAGS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const [oldTag, newTag] of Object.entries(TAG_MIGRATION_MAP)) {
    if (newTag) set.add(newTag);
    // Tag antiga que aponta pra si mesma também é válida (passou na migração).
    if (newTag === oldTag) set.add(oldTag);
  }
  return set;
})();

/**
 * Valida se uma tag segue o formato canônico.
 * Não verifica contra `VALID_TAGS` — apenas formato sintático.
 *
 * Regras:
 *   - Começa com `[categoria]` onde categoria é uma das 10 válidas
 *   - Após o bracket, separador é `_`
 *   - Apenas minúsculo, dígitos, `_` no valor
 *   - Sem acento, sem `/®+`, sem espaço
 */
export function isCanonicalFormat(tag: string): boolean {
  const match = tag.match(/^(\[[a-z]+\])(?:_([a-z0-9_]+))?$/);
  if (!match) return false;
  const cat = match[1];
  return (VALID_CATEGORIES as readonly string[]).includes(cat);
}

/**
 * Valida se a tag está na lista de tags pós-migração conhecidas.
 * Útil pra defender contra typos ou tags não autorizadas.
 */
export function isKnownValidTag(tag: string): boolean {
  return VALID_TAGS.has(tag);
}
