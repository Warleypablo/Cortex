// server/routes/bp2026.cac.helpers.ts
// Helpers puros para a aba CAC do BP 2026: rateio do CAC por produto e
// participação percentual de cada item no total. Sem acesso a banco.

// Rateia uma série total entre chaves, proporcional aos pesos de cada chave por mês.
// total[i] === null OU Σ pesos do mês === 0  => alocação null naquele mês para todas as chaves.
export function ratearSeriePorPeso(
  total: (number | null)[],
  pesos: Record<string, (number | null)[]>,
): Record<string, (number | null)[]> {
  const chaves = Object.keys(pesos);
  const n = total.length;
  const out: Record<string, (number | null)[]> = {};
  for (const k of chaves) out[k] = [];
  for (let i = 0; i < n; i++) {
    const somaPesos = chaves.reduce((s, k) => s + (pesos[k]?.[i] ?? 0), 0);
    const t = total[i];
    for (const k of chaves) {
      if (t === null || somaPesos === 0) {
        out[k].push(null);
      } else {
        out[k].push((t * (pesos[k]?.[i] ?? 0)) / somaPesos);
      }
    }
  }
  return out;
}

// Participação de `parte` em `total`, mês a mês (null quando indefinido ou denominador 0).
export function participacaoPct(
  parte: (number | null)[],
  total: (number | null)[],
): (number | null)[] {
  return parte.map((p, i) => {
    const t = total[i];
    return p === null || t === null || !t ? null : p / t;
  });
}

// Razão de somas acumuladas até mesFechado: Σ num / Σ den (ignora posições null).
// Σ den === 0 ou mesFechado === 0 => null.
export function razaoYtd(
  num: (number | null)[],
  den: (number | null)[],
  mesFechado: number,
): number | null {
  if (mesFechado <= 0) return null;
  let somaNum = 0;
  let somaDen = 0;
  for (let i = 0; i < mesFechado; i++) {
    if (num[i] !== null) somaNum += num[i] as number;
    if (den[i] !== null) somaDen += den[i] as number;
  }
  return somaDen === 0 ? null : somaNum / somaDen;
}
