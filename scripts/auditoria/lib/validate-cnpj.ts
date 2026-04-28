import { normalizeCnpj } from './normalize-cnpj';

export function validateCnpj(input: string | null | undefined): boolean {
  const cnpj = normalizeCnpj(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false; // all same digit

  const calc = (slice: string, weights: number[]): number => {
    const sum = slice.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  // Receita Federal Módulo 11 weights: ordered right-to-left, cycling positions 2..9.
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);

  return cnpj.endsWith(`${d1}${d2}`);
}
