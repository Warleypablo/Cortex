// server/routes/bp2026.cac.helpers.ts
// Helpers puros para a aba CAC do BP 2026: participação percentual de cada
// item no total e razão YTD. Sem acesso a banco.

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
