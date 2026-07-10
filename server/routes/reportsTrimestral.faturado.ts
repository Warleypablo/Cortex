// Bloco "Faturado" do reporte trimestral — leitura contábil vinda do Conta Azul.
//
//   faturável (valor_bruto) − inadimplência (ATRASADO/PERDIDO) = faturado (valor_pago)
//
// A conta não fecha exatamente: entre o bruto e o pago existem ainda os status
// RENEGOCIADO e RECEBIDO_PARCIAL (R$ 82k no H1/2026). Faturado é o CAIXA que
// entrou (valor_pago), não `bruto − inadimplência` — senão renegociado e parcial
// contariam como recebido sem o dinheiro ter entrado.
//
// Fonte é caz_parcelas, e não caz_receber: esta última não sincroniza a TURBO
// FILIAL (~R$650k só no Q2/2026), subnotando o grupo.

import { getMetaFaturamento } from "../../shared/metas";

/** 1º mês cheio de "Conta Azul".caz_parcelas — antes disso a série é truncada. */
export const CAZ_PARCELAS_PRIMEIRO_MES = "2025-10";

export interface FaturadoTri {
  quarter: number;      // 1..4
  label: string;        // "Q1"
  faturavel: number;
  inadimplencia: number;
  faturado: number;
  parcial: boolean;     // trimestre ainda em andamento
}

export interface Faturado {
  ano: number;
  trimestres: FaturadoTri[];
  atual: FaturadoTri | null;
  ytdFaturado: number;
  meta: number | null;
  pctMeta: number | null;
  pctAnoDecorrido: number | null;
  coberturaParcial: boolean;
}

/** Linha crua da query agregada por trimestre. */
export interface FaturadoRow {
  quarter: number | string;
  faturavel: number | string;
  inadimplencia: number | string;
  faturado: number | string;
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function dayOfYear(d: Date): number {
  const inicio = Date.UTC(d.getUTCFullYear(), 0, 1);
  const hoje = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((hoje - inicio) / 86_400_000) + 1;
}

function diasNoAno(ano: number): number {
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  return bissexto ? 366 : 365;
}

/**
 * Monta o bloco `faturado` a partir das linhas agregadas por trimestre.
 *
 * @param rows      uma linha por trimestre do ano com dado (trimestres sem
 *                  movimento simplesmente não voltam da query)
 * @param ano       ano do trimestre selecionado no deck
 * @param quarter   trimestre selecionado (1..4) — limite superior das barras
 * @param hoje      data de referência (injetada para o teste ser determinístico)
 */
export function buildFaturado(
  rows: FaturadoRow[],
  ano: number,
  quarter: number,
  hoje: Date,
): Faturado {
  const anoCorrente = hoje.getFullYear();
  const quarterCorrente = Math.floor(hoje.getMonth() / 3) + 1;

  const porQuarter = new Map<number, FaturadoRow>();
  for (const r of rows) porQuarter.set(Number(r.quarter), r);

  // Um bar por trimestre do ano até o selecionado — inclusive os sem movimento,
  // que entram zerados em vez de sumir e deslocar o eixo.
  const trimestres: FaturadoTri[] = [];
  for (let q = 1; q <= quarter; q++) {
    const r = porQuarter.get(q);
    trimestres.push({
      quarter: q,
      label: `Q${q}`,
      faturavel: num(r?.faturavel),
      inadimplencia: num(r?.inadimplencia),
      faturado: num(r?.faturado),
      parcial: ano === anoCorrente && q === quarterCorrente,
    });
  }

  const atual = trimestres.find((t) => t.quarter === quarter) ?? null;
  const ytdFaturado = trimestres.reduce((a, t) => a + t.faturado, 0);

  const meta = getMetaFaturamento(ano);
  const pctMeta = meta && meta > 0 ? (ytdFaturado / meta) * 100 : null;

  // Ritmo esperado: quanto do ano já passou. Só faz sentido no ano corrente —
  // num ano fechado o esperado é 100% e o marcador não informa nada.
  const pctAnoDecorrido =
    meta === null ? null
    : ano < anoCorrente ? 100
    : ano > anoCorrente ? 0
    : (dayOfYear(hoje) / diasNoAno(ano)) * 100;

  // A série do Conta Azul começa em out/2025: qualquer ano anterior a 2026 tem
  // meses sem dado e as barras mentem por omissão.
  const coberturaParcial = `${ano}-01` < CAZ_PARCELAS_PRIMEIRO_MES;

  return { ano, trimestres, atual, ytdFaturado, meta, pctMeta, pctAnoDecorrido, coberturaParcial };
}
