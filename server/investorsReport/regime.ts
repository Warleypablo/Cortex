// Regime contábil do Investors Report.
//
// A série mensal é HÍBRIDA: meses antes do corte seguem regime de COMPETÊNCIA
// (faturamento devido em caz_receber/caz_pagar — fonte histórica, repopulada até 2023);
// meses a partir do corte seguem regime de CAIXA (o que efetivamente entrou/saiu,
// em caz_parcelas por data_quitacao). O corte existe porque caz_parcelas (caixa) só
// tem dados desde set/out-2025; pré-2026 não existe em caixa.
//
// Esta função é PURA (recebe as linhas já consultadas, sem tocar no banco) para ser
// testável de forma isolada — o SQL fica no routes.ts, igual ao padrão de churn.ts.

export const REGIME_CUTOVER = '2026-01-01'; // 1º mês em regime de caixa

export type Fonte = 'competencia' | 'caixa';

export interface CompetenciaRow {
  mes: string; // "YYYY-MM"
  faturamento: number | string;
  despesas: number | string;
  inadimplencia: number | string;
}

export interface CaixaRow {
  mes: string; // "YYYY-MM"
  faturamento: number | string;
  despesas: number | string;
}

export interface MesRegime {
  mes: string;
  faturamento: number;
  despesas: number;
  inadimplencia: number; // só faz sentido em competência; 0 nos meses caixa
  fonte: Fonte;
}

export interface RegimeYTD {
  faturamentoAno: number;     // soma caixa jan..mês corrente (inclui mês parcial)
  faturamentoFechado: number; // soma caixa jan..último mês fechado
  despesasFechado: number;    // soma caixa despesa dos meses fechados
  margemAno: number;          // % = (fechado - despFechado)/fechado (0 se fechado=0)
  mesesFechados: number;
}

export interface RegimeResult {
  series: MesRegime[];          // ordenado por mês asc
  ytd: RegimeYTD;
  transicaoMes: string | null;  // primeiro mês 'caixa' (null se não há transição)
}

const n = (v: number | string | null | undefined): number => Number(v) || 0;

/**
 * Combina a série de competência (pré-corte) com a de caixa (pós-corte) numa série
 * única ordenada, marca a fonte de cada mês e calcula os agregados YTD em caixa.
 *
 * @param hojeYM mês corrente "YYYY-MM" — define o ano do YTD e qual mês é o parcial
 *               (excluído da margem fechada). Passado de fora para manter a função pura.
 */
export function buildRegime(
  competenciaRows: CompetenciaRow[],
  caixaRows: CaixaRow[],
  hojeYM: string,
): RegimeResult {
  const series: MesRegime[] = [
    ...competenciaRows.map((r): MesRegime => ({
      mes: r.mes,
      faturamento: n(r.faturamento),
      despesas: n(r.despesas),
      inadimplencia: n(r.inadimplencia),
      fonte: 'competencia',
    })),
    ...caixaRows.map((r): MesRegime => ({
      mes: r.mes,
      faturamento: n(r.faturamento),
      despesas: n(r.despesas),
      inadimplencia: 0,
      fonte: 'caixa',
    })),
  ].sort((a, b) => a.mes.localeCompare(b.mes));

  const transicaoMes = series.find(m => m.fonte === 'caixa')?.mes ?? null;

  const ano = hojeYM.slice(0, 4);
  const caixaAno = series.filter(m => m.fonte === 'caixa' && m.mes.slice(0, 4) === ano);
  const fechados = caixaAno.filter(m => m.mes < hojeYM);

  const faturamentoAno = caixaAno.reduce((s, m) => s + m.faturamento, 0);
  const faturamentoFechado = fechados.reduce((s, m) => s + m.faturamento, 0);
  const despesasFechado = fechados.reduce((s, m) => s + m.despesas, 0);
  const margemAno = faturamentoFechado > 0
    ? ((faturamentoFechado - despesasFechado) / faturamentoFechado) * 100
    : 0;

  return {
    series,
    ytd: {
      faturamentoAno,
      faturamentoFechado,
      despesasFechado,
      margemAno: Number(margemAno.toFixed(2)),
      mesesFechados: fechados.length,
    },
    transicaoMes,
  };
}
