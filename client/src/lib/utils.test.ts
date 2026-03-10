import { describe, it, expect } from 'vitest';
import {
  formatDecimal,
  formatPercent,
  formatCurrency,
  formatCurrencyWithDecimals,
  formatCurrencyNoDecimals,
  formatCurrencyCompact,
} from './utils';

describe('formatDecimal', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatDecimal(10)).toBe('10');
    expect(formatDecimal(0)).toBe('0');
  });

  it('preserves 1 decimal place', () => {
    expect(formatDecimal(10.5)).toBe('10.5');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatDecimal(10.556)).toBe('10.56');
    expect(formatDecimal(10.554)).toBe('10.55');
  });

  it('removes trailing zeros', () => {
    expect(formatDecimal(10.10)).toBe('10.1');
    expect(formatDecimal(10.00)).toBe('10');
  });

  it('handles null/undefined/NaN as 0', () => {
    expect(formatDecimal(NaN)).toBe('0');
    expect(formatDecimal(null as any)).toBe('0');
    expect(formatDecimal(undefined as any)).toBe('0');
  });

  it('respects custom maxDecimals', () => {
    expect(formatDecimal(10.1234, 3)).toBe('10.123');
    expect(formatDecimal(10.1234, 1)).toBe('10.1');
  });

  it('handles negative numbers', () => {
    expect(formatDecimal(-10.5)).toBe('-10.5');
    expect(formatDecimal(-0.123)).toBe('-0.12');
  });
});

describe('formatPercent', () => {
  it('appends % to formatted number', () => {
    expect(formatPercent(10)).toBe('10%');
    expect(formatPercent(10.5)).toBe('10.5%');
    expect(formatPercent(10.556)).toBe('10.56%');
  });

  it('handles zero and negative', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(-5.5)).toBe('-5.5%');
  });
});

describe('formatCurrency', () => {
  it('formats as BRL with up to 2 decimals', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });

  it('omits decimals for whole numbers', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1.000');
    expect(result).not.toContain(',00');
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('handles null/NaN', () => {
    expect(formatCurrency(NaN)).toBe('R$ 0');
    expect(formatCurrency(null as any)).toBe('R$ 0');
  });

  it('handles negative values', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500');
  });
});

describe('formatCurrencyWithDecimals', () => {
  it('always shows 2 decimal places', () => {
    const result = formatCurrencyWithDecimals(1000);
    expect(result).toContain('1.000,00');
  });

  it('handles NaN', () => {
    expect(formatCurrencyWithDecimals(NaN)).toBe('R$ 0,00');
  });
});

describe('formatCurrencyNoDecimals', () => {
  it('rounds to whole number', () => {
    const result = formatCurrencyNoDecimals(1234.56);
    expect(result).toContain('1.235');
    expect(result).not.toContain(',');
  });

  it('handles NaN', () => {
    expect(formatCurrencyNoDecimals(NaN)).toBe('R$ 0');
  });
});

describe('formatCurrencyCompact', () => {
  it('formats billions', () => {
    expect(formatCurrencyCompact(1500000000)).toBe('R$ 1.5B');
  });

  it('formats millions', () => {
    expect(formatCurrencyCompact(2500000)).toBe('R$ 2.5M');
  });

  it('formats thousands', () => {
    expect(formatCurrencyCompact(15000)).toBe('R$ 15K');
  });

  it('uses full format for values under 1000', () => {
    const result = formatCurrencyCompact(500);
    expect(result).toContain('500');
    expect(result).toContain('R$');
  });

  it('handles NaN', () => {
    expect(formatCurrencyCompact(NaN)).toBe('R$ 0');
  });

  it('handles negative values', () => {
    expect(formatCurrencyCompact(-2500000)).toBe('R$ -2.5M');
  });
});
