import { describe, it, expect } from 'vitest';
import { computeEvolucaoChurn, type ChurnRow, type MrrFimRow } from './churn';

describe('computeEvolucaoChurn', () => {
  it('calcula a taxa como churn do mês ÷ MRR do fim do mês anterior', () => {
    const churn: ChurnRow[] = [{ mes: '2026-01', mrr_churn: '162431', qtd: '68' }];
    const mrrFim: MrrFimRow[] = [{ mes: '2025-12', mrr_fim: '1030089' }];
    expect(computeEvolucaoChurn(churn, mrrFim)).toEqual([
      { mes: '2026-01', mrrChurn: 162431, taxaChurn: 15.8, qtd: 68 },
    ]);
  });

  it('retorna taxaChurn null quando não há snapshot do mês anterior', () => {
    const churn: ChurnRow[] = [{ mes: '2025-11', mrr_churn: '92468', qtd: '38' }];
    const mrrFim: MrrFimRow[] = []; // out/2025 não existe
    expect(computeEvolucaoChurn(churn, mrrFim)).toEqual([
      { mes: '2025-11', mrrChurn: 92468, taxaChurn: null, qtd: 38 },
    ]);
  });

  it('retorna taxaChurn null quando o denominador é zero (evita divisão por zero)', () => {
    const churn: ChurnRow[] = [{ mes: '2026-03', mrr_churn: 1000, qtd: 2 }];
    const mrrFim: MrrFimRow[] = [{ mes: '2026-02', mrr_fim: 0 }];
    expect(computeEvolucaoChurn(churn, mrrFim)).toEqual([
      { mes: '2026-03', mrrChurn: 1000, taxaChurn: null, qtd: 2 },
    ]);
  });

  it('trata a virada de ano ao buscar o mês anterior (jan → dez do ano anterior)', () => {
    const churn: ChurnRow[] = [{ mes: '2026-01', mrr_churn: 50000, qtd: 5 }];
    const mrrFim: MrrFimRow[] = [{ mes: '2025-12', mrr_fim: 1000000 }];
    expect(computeEvolucaoChurn(churn, mrrFim)[0].taxaChurn).toBe(5);
  });

  it('ordena o resultado por mês ascendente', () => {
    const churn: ChurnRow[] = [
      { mes: '2026-02', mrr_churn: 100, qtd: 1 },
      { mes: '2026-01', mrr_churn: 200, qtd: 2 },
    ];
    expect(computeEvolucaoChurn(churn, []).map((r) => r.mes)).toEqual(['2026-01', '2026-02']);
  });
});
