import { describe, it, expect } from 'vitest';
import { validateCnpj } from '../validate-cnpj';

describe('validateCnpj', () => {
  it('validates real CNPJ', () => {
    expect(validateCnpj('11.222.333/0001-81')).toBe(true);
  });
  it('rejects all-same-digit CNPJ', () => {
    expect(validateCnpj('11111111111111')).toBe(false);
  });
  it('rejects too-short input', () => {
    expect(validateCnpj('12345')).toBe(false);
  });
  it('rejects empty/null', () => {
    expect(validateCnpj('')).toBe(false);
    expect(validateCnpj(null)).toBe(false);
  });
  it('rejects wrong checksum', () => {
    expect(validateCnpj('11.222.333/0001-99')).toBe(false);
  });
});
