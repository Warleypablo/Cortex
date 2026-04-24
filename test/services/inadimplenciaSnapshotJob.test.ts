import { describe, it, expect } from 'vitest';
import { isLastDayOfMonth } from '../../server/services/inadimplenciaSnapshotJob';

describe('isLastDayOfMonth', () => {
  it('retorna true para 30 de abril', () => {
    expect(isLastDayOfMonth(new Date(2026, 3, 30))).toBe(true);
  });

  it('retorna true para 31 de janeiro', () => {
    expect(isLastDayOfMonth(new Date(2026, 0, 31))).toBe(true);
  });

  it('retorna true para 28 de fevereiro (ano não-bissexto)', () => {
    expect(isLastDayOfMonth(new Date(2026, 1, 28))).toBe(true);
  });

  it('retorna true para 29 de fevereiro (ano bissexto)', () => {
    expect(isLastDayOfMonth(new Date(2024, 1, 29))).toBe(true);
  });

  it('retorna false para 28 de fevereiro (ano bissexto)', () => {
    expect(isLastDayOfMonth(new Date(2024, 1, 28))).toBe(false);
  });

  it('retorna false para dia do meio do mês', () => {
    expect(isLastDayOfMonth(new Date(2026, 3, 15))).toBe(false);
  });

  it('retorna false para dia 1', () => {
    expect(isLastDayOfMonth(new Date(2026, 3, 1))).toBe(false);
  });
});
