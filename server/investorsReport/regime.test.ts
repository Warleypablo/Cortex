import { describe, it, expect } from 'vitest';
import { buildRegime, REGIME_CUTOVER, type CompetenciaRow, type CaixaRow } from './regime';

describe('buildRegime', () => {
  const comp: CompetenciaRow[] = [
    { mes: '2025-11', faturamento: '100', despesas: '60', inadimplencia: '10' },
    { mes: '2025-12', faturamento: '200', despesas: '150', inadimplencia: '20' },
  ];
  const caixa: CaixaRow[] = [
    { mes: '2026-01', faturamento: '300', despesas: '180' },
    { mes: '2026-02', faturamento: '400', despesas: '200' },
  ];

  it('cutover é 2026-01-01', () => {
    expect(REGIME_CUTOVER).toBe('2026-01-01');
  });

  it('taga competência antes do corte e caixa a partir do corte, ordenado', () => {
    const r = buildRegime(comp, caixa, '2026-02');
    expect(r.series.map(s => [s.mes, s.fonte])).toEqual([
      ['2025-11', 'competencia'], ['2025-12', 'competencia'],
      ['2026-01', 'caixa'], ['2026-02', 'caixa'],
    ]);
  });

  it('preserva inadimplência da competência e zera nos meses caixa', () => {
    const r = buildRegime(comp, caixa, '2026-02');
    expect(r.series.find(s => s.mes === '2025-11')?.inadimplencia).toBe(10);
    expect(r.series.find(s => s.mes === '2026-01')?.inadimplencia).toBe(0);
  });

  it('transicaoMes é o primeiro mês caixa', () => {
    expect(buildRegime(comp, caixa, '2026-02').transicaoMes).toBe('2026-01');
  });

  it('YTD agrega só caixa do ano corrente; margem usa só meses fechados (exclui mês corrente)', () => {
    // hoje = 2026-02 → fechado: só 2026-01
    const r = buildRegime(comp, caixa, '2026-02');
    expect(r.ytd.faturamentoAno).toBe(700);       // 300 + 400 (inclui corrente)
    expect(r.ytd.faturamentoFechado).toBe(300);   // só jan
    expect(r.ytd.despesasFechado).toBe(180);
    expect(r.ytd.mesesFechados).toBe(1);
    expect(r.ytd.margemAno).toBe(40);             // (300-180)/300*100
  });

  it('margemAno = 0 quando faturamento fechado é 0 (sem divisão por zero)', () => {
    const r = buildRegime([], [{ mes: '2026-01', faturamento: 0, despesas: 0 }], '2026-02');
    expect(r.ytd.margemAno).toBe(0);
  });

  it('sem meses caixa → transicaoMes null e YTD zerado', () => {
    const r = buildRegime(comp, [], '2025-12');
    expect(r.transicaoMes).toBeNull();
    expect(r.ytd.faturamentoAno).toBe(0);
    expect(r.ytd.mesesFechados).toBe(0);
  });
});
