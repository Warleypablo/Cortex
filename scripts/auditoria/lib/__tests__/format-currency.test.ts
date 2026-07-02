import { describe, it, expect } from 'vitest';
import { formatBRL } from '../format-currency';

describe('formatBRL', () => {
  it('formats round number', () => {
    expect(formatBRL(1234)).toBe('R$ 1.234,00');
  });
  it('formats with cents', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56');
  });
  it('formats large numbers', () => {
    expect(formatBRL(1234567.89)).toBe('R$ 1.234.567,89');
  });
  it('handles zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
  });
  it('handles null/undefined as zero', () => {
    expect(formatBRL(null)).toBe('R$ 0,00');
    expect(formatBRL(undefined)).toBe('R$ 0,00');
  });
});
