import { describe, it, expect } from 'vitest';
import { formatarMesesEmAtraso, formatarValoresDescricao } from './notificacao-extrajudicial';

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

describe('formatarValoresDescricao', () => {
  it('usa formato "cada uma" quando todas as parcelas têm mesmo valor', () => {
    const parcelas = [
      { naoPago: 6000, dataVencimento: '2026-01-10' },
      { naoPago: 6000, dataVencimento: '2026-02-10' },
      { naoPago: 6000, dataVencimento: '2026-03-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00 cada uma');
  });

  it('tolera diferenças de até R$ 0,01 como mesmo valor', () => {
    const parcelas = [
      { naoPago: 6000.00, dataVencimento: '2026-01-10' },
      { naoPago: 6000.001, dataVencimento: '2026-02-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00 cada uma');
  });

  it('usa formato de lista quando valores variam', () => {
    const parcelas = [
      { naoPago: 5000, dataVencimento: '2026-01-10' },
      { naoPago: 5000, dataVencimento: '2026-02-10' },
      { naoPago: 3200, dataVencimento: '2026-03-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('sendo R$ 5.000,00 com vencimento em 10/01/2026, R$ 5.000,00 com vencimento em 10/02/2026 e R$ 3.200,00 com vencimento em 10/03/2026');
  });

  it('retorna string vazia para lista vazia', () => {
    expect(formatarValoresDescricao([])).toBe('');
  });

  it('usa "no valor de R$ X" para parcela única', () => {
    const parcelas = [{ naoPago: 6000, dataVencimento: '2026-01-10' }];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00');
  });
});
