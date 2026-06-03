// Pure-TS reference implementation of the name normalization used pelo pipeline
// de atribuição de receita por squad. NÃO é consumido no runtime — a query em
// `receitaPorItens.ts` implementa a mesma lógica inline em SQL (via `unaccent`,
// `REGEXP_REPLACE`, `STOPWORDS_SQL`). Este módulo existe como:
//   1. Referência testável (matchPipeline.test.ts)
//   2. Consumidor futuro: admin UI pra gerenciar `item_alias_map`
//   3. Documentação viva das regras de normalização
// Se alterar as regras aqui, atualize também o SQL em receitaPorItens.ts.

export const STOPWORDS = new Set<string>([
  // Conectivos/fillers PT-BR (alguns já caem no filtro de length < 3, mantidos como defensivos)
  'para', 'com', 'por', 'sem', 'dos', 'das', 'mes', 'fee', 'uma',
  // Tiers de produto — ignorados no match item↔contrato porque o Conta Azul e o ClickUp divergem
  'starter', 'scale', 'enterprise', 'standard', 'premium',
  // Modificadores de oferta — não diferenciam o squad dono
  'pontual', 'recorrente', 'mensal', 'entrega', 'implantacao',
]);

function unaccent(s: string): string {
  // NFKD (compatibility decomposition) also breaks down characters like
  // 'ª' → 'a', which NFD preserves. This matches PG `unaccent` behavior
  // closer and satisfies the '1ª Entrega' → '1aentrega' test case.
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeNome(raw: string): string {
  if (!raw) return '';
  const lower = unaccent(raw.toLowerCase());
  const cleaned = lower.replace(/[^a-z0-9 ]/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function compactNome(raw: string): string {
  if (!raw) return '';
  return unaccent(raw.toLowerCase()).replace(/[^a-z0-9]/g, '');
}

export function tokenizeNome(raw: string): string[] {
  const norm = normalizeNome(raw);
  if (!norm) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of norm.split(' ')) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
