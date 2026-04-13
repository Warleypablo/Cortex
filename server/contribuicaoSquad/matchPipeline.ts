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
