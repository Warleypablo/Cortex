/**
 * Calendário de datas comerciais BR pra planejamento de broadcasts.
 *
 * Datas fixas (Natal, Namorados…) e móveis (Mães, Pais, Black Friday, Carnaval/Páscoa)
 * calculadas por ano. Cada data tem uma janela de antecedência recomendada pra começar
 * a comunicar. Editável: é só ajustar a lista DATAS_FIXAS / DATAS_MOVEIS.
 */

export interface DataComercial {
  nome: string;
  /** YYYY-MM-DD */
  data: string;
  /** dias antes da data em que faz sentido começar a comunicar */
  antecedenciaDias: number;
  /** dica de ângulo/oferta */
  dica?: string;
}

// ── Helpers de data ─────────────────────────────────────────────────────────

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** N-ésimo dia-da-semana (0=dom…6=sáb) de um mês. */
function nthWeekday(year: number, month1: number, weekday: number, n: number): Date {
  const d = new Date(Date.UTC(year, month1 - 1, 1));
  const shift = (7 + weekday - d.getUTCDay()) % 7;
  d.setUTCDate(1 + shift + (n - 1) * 7);
  return d;
}

/** Último dia-da-semana de um mês. */
function lastWeekday(year: number, month1: number, weekday: number): Date {
  const d = new Date(Date.UTC(year, month1, 0)); // último dia do mês
  const shift = (7 + d.getUTCDay() - weekday) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const toYmd = (d: Date) => ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

// ── Catálogo ──────────────────────────────────────────────────────────────

const DATAS_FIXAS: Array<Omit<DataComercial, "data"> & { mes: number; dia: number }> = [
  { nome: "Dia do Consumidor", mes: 3, dia: 15, antecedenciaDias: 10, dica: "Ofertas / urgência" },
  { nome: "Dia das Namoradas", mes: 6, dia: 12, antecedenciaDias: 14, dica: "Presente / casais" },
  { nome: "Dia do Cliente", mes: 9, dia: 15, antecedenciaDias: 10, dica: "Relacionamento / fidelização" },
  { nome: "Dia das Crianças", mes: 10, dia: 12, antecedenciaDias: 14, dica: "Infantil / família" },
  { nome: "Natal", mes: 12, dia: 25, antecedenciaDias: 21, dica: "Sazonal forte / fim de ano" },
  { nome: "Ano Novo", mes: 12, dia: 31, antecedenciaDias: 14, dica: "Recomeço / metas" },
];

/** Retorna todas as datas comerciais de um ano (fixas + móveis), ordenadas. */
export function datasComerciaisDoAno(ano: number): DataComercial[] {
  const movel = (nome: string, data: Date, antecedenciaDias: number, dica?: string): DataComercial => ({
    nome, data: toYmd(data), antecedenciaDias, dica,
  });
  const pascoa = easter(ano);
  const lista: DataComercial[] = [
    ...DATAS_FIXAS.map((f) => ({ nome: f.nome, data: ymd(ano, f.mes, f.dia), antecedenciaDias: f.antecedenciaDias, dica: f.dica })),
    movel("Carnaval", addDays(pascoa, -47), 14, "Pré-Carnaval / sazonal"),
    movel("Páscoa", pascoa, 14, "Sazonal / chocolates / família"),
    movel("Dia das Mães", nthWeekday(ano, 5, 0, 2), 21, "Presente / emocional"),
    movel("Dia dos Pais", nthWeekday(ano, 8, 0, 2), 21, "Presente / emocional"),
    movel("Black Friday", lastWeekday(ano, 11, 5), 21, "Maior pico de vendas do ano"),
    movel("Cyber Monday", addDays(lastWeekday(ano, 11, 5), 3), 21, "Cauda da Black Friday"),
  ];
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Datas comerciais nos próximos `horizonteDias` a partir de `ref` (default: hoje). */
export function proximasDatasComerciais(ref: Date, horizonteDias = 45): DataComercial[] {
  const refYmd = toYmd(ref);
  const limite = toYmd(addDays(ref, horizonteDias));
  const anos = [ref.getUTCFullYear(), ref.getUTCFullYear() + 1];
  return anos
    .flatMap((a) => datasComerciaisDoAno(a))
    .filter((d) => d.data >= refYmd && d.data <= limite)
    .sort((a, b) => a.data.localeCompare(b.data));
}
