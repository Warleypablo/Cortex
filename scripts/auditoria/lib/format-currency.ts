export function formatBRL(value: number | null | undefined): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n).replace(/\u00A0/g, ' ');
}
