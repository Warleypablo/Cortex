import { describe, it, expect } from 'vitest';
import { formatarMesesEmAtraso } from './notificacao-extrajudicial';

describe('formatarMesesEmAtraso', () => {
  it('formata um único mês', () => {
    expect(formatarMesesEmAtraso(['2026-02-10'])).toBe('fevereiro/2026');
  });

  it('formata dois meses com "e"', () => {
    expect(formatarMesesEmAtraso(['2026-01-10', '2026-02-10']))
      .toBe('janeiro/2026 e fevereiro/2026');
  });

  it('formata três meses com vírgulas e "e"', () => {
    expect(formatarMesesEmAtraso(['2026-01-10', '2026-02-10', '2026-03-10']))
      .toBe('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('remove duplicatas do mesmo mês/ano', () => {
    expect(formatarMesesEmAtraso(['2026-01-05', '2026-01-15', '2026-02-10']))
      .toBe('janeiro/2026 e fevereiro/2026');
  });

  it('ordena cronologicamente mesmo com entrada fora de ordem', () => {
    expect(formatarMesesEmAtraso(['2026-03-10', '2026-01-10', '2026-02-10']))
      .toBe('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('lida com parcelas em anos diferentes', () => {
    expect(formatarMesesEmAtraso(['2025-12-10', '2026-01-10']))
      .toBe('dezembro/2025 e janeiro/2026');
  });

  it('retorna string vazia para array vazio', () => {
    expect(formatarMesesEmAtraso([])).toBe('');
  });
});
