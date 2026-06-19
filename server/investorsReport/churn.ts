export interface ChurnRow {
  mes: string; // "YYYY-MM"
  mrr_churn: number | string;
  qtd: number | string;
}

export interface MrrFimRow {
  mes: string; // "YYYY-MM"
  mrr_fim: number | string | null;
}

export interface EvolucaoChurnItem {
  mes: string;
  mrrChurn: number;
  taxaChurn: number | null; // % (1 casa decimal) ou null sem denominador
  qtd: number;
}

/** Mês anterior de uma string "YYYY-MM", tratando a virada de ano. */
function mesAnterior(mes: string): string {
  const [year, month] = mes.split('-').map(Number);
  const ano = month === 1 ? year - 1 : year;
  const m = month === 1 ? 12 : month - 1;
  return `${ano}-${String(m).padStart(2, '0')}`;
}

/**
 * Combina o churn R$ mensal com o MRR de fim de mês (denominador) para produzir
 * a série de evolução do churn. Taxa do mês N = churn[N] / MRR do fim do mês N-1.
 * Sem denominador (mês anterior sem snapshot) ou denominador zero → taxa = null.
 */
export function computeEvolucaoChurn(
  churnRows: ChurnRow[],
  mrrFimRows: MrrFimRow[],
): EvolucaoChurnItem[] {
  const mrrFimPorMes = new Map<string, number>();
  for (const r of mrrFimRows) {
    mrrFimPorMes.set(r.mes, Number(r.mrr_fim) || 0);
  }

  return churnRows
    .map((r) => {
      const mrrChurn = Number(r.mrr_churn) || 0;
      const qtd = Number(r.qtd) || 0;
      const denom = mrrFimPorMes.get(mesAnterior(r.mes)) ?? 0;
      const taxaChurn = denom > 0 ? Math.round((mrrChurn / denom) * 1000) / 10 : null;
      return { mes: r.mes, mrrChurn, taxaChurn, qtd };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes));
}
