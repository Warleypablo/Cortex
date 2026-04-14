export function formatBRL(value: number | null | undefined): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  // Node ICU full-icu uses non-breaking space (U+00A0) as the BRL grouping/symbol separator;
  // normalise to regular space so string comparisons are predictable.
  .replace(/\u00A0/g, ' ');
}
