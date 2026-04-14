import { describe, it, expect } from 'vitest';
import { normalizeCnpj } from '../normalize-cnpj';

describe('normalizeCnpj', () => {
  it('strips mask and zero-pads to 14', () => {
    expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190');
  });
  it('handles already-clean input', () => {
    expect(normalizeCnpj('12345678000190')).toBe('12345678000190');
  });
  it('zero-pads short input', () => {
    expect(normalizeCnpj('12345678')).toBe('00000012345678');
  });
  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeCnpj(null)).toBe('');
    expect(normalizeCnpj(undefined)).toBe('');
    expect(normalizeCnpj('')).toBe('');
    expect(normalizeCnpj('   ')).toBe('');
  });
});
