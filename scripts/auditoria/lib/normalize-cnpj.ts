export function normalizeCnpj(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.padStart(14, '0');
}
