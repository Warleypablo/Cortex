export interface QuarterWindow {
  trimestre: string;        // "2026-Q3"
  label: string;            // "Q3 2026"
  ano: number;
  quarter: number;          // 1..4
  startMonth: number;       // 1,4,7,10
  dataStart: string;        // "2026-07-01"
  dataEnd: string;          // "2026-10-01" (limite superior EXCLUSIVO)
  fotoDate: string;         // data do snapshot p/ métricas de estoque (YYYY-MM-DD)
  meses: string[];          // ["2026-07","2026-08","2026-09"]
  parcial: boolean;
  mesesComputados: string[];// meses ≤ mês corrente (decorridos)
  prev: {
    trimestre: string;
    label: string;
    dataStart: string;
    dataEnd: string;
    meses: string[];
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

function ym(ano: number, mes: number): string {
  return `${ano}-${pad(mes)}`;
}

export function parseTrimestre(trimestre: string): { ano: number; quarter: number } | null {
  if (!/^\d{4}-Q[1-4]$/.test(trimestre)) return null;
  const [anoStr, qStr] = trimestre.split("-Q");
  return { ano: parseInt(anoStr, 10), quarter: parseInt(qStr, 10) };
}

function quarterMeses(ano: number, quarter: number): string[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => ym(ano, startMonth + i));
}

function firstDayAfterQuarter(ano: number, quarter: number): { ano: number; mes: number } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 3; // 1º mês após o tri (pode ser 13 → jan do ano seguinte)
  if (endMonth > 12) return { ano: ano + 1, mes: endMonth - 12 };
  return { ano, mes: endMonth };
}

export function buildQuarterWindow(trimestre: string, hoje: Date): QuarterWindow {
  const parsed = parseTrimestre(trimestre);
  if (!parsed) throw new Error(`Trimestre inválido: ${trimestre}`);
  const { ano, quarter } = parsed;
  const startMonth = (quarter - 1) * 3 + 1;
  const meses = quarterMeses(ano, quarter);
  const after = firstDayAfterQuarter(ano, quarter);
  const dataStart = ymd(ano, startMonth, 1);
  const dataEnd = ymd(after.ano, after.mes, 1);

  const mesCorrente = ym(hoje.getFullYear(), hoje.getMonth() + 1); // "YYYY-MM"
  const parcial = meses.some((m) => m >= mesCorrente);
  const mesesComputados = meses.filter((m) => m <= mesCorrente);

  // Foto: se parcial, snapshot de hoje; se fechado, primeiro dia após o tri (fim exclusivo).
  const fotoDate = parcial
    ? ymd(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
    : dataEnd;

  // Trimestre anterior
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevAno = quarter === 1 ? ano - 1 : ano;
  const prevStartMonth = (prevQuarter - 1) * 3 + 1;
  const prevMeses = quarterMeses(prevAno, prevQuarter);
  const prevAfter = firstDayAfterQuarter(prevAno, prevQuarter);

  return {
    trimestre,
    label: `Q${quarter} ${ano}`,
    ano,
    quarter,
    startMonth,
    dataStart,
    dataEnd,
    fotoDate,
    meses,
    parcial,
    mesesComputados,
    prev: {
      trimestre: `${prevAno}-Q${prevQuarter}`,
      label: `Q${prevQuarter} ${prevAno}`,
      dataStart: ymd(prevAno, prevStartMonth, 1),
      dataEnd: ymd(prevAfter.ano, prevAfter.mes, 1),
      meses: prevMeses,
    },
  };
}

export function getDefaultTrimestre(hoje: Date): string {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  return `${hoje.getFullYear()}-Q${q}`;
}

export function getTrimestreOptions(hoje: Date, count: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let q = Math.floor(hoje.getMonth() / 3) + 1;
  let ano = hoje.getFullYear();
  for (let i = 0; i < count; i++) {
    options.push({ value: `${ano}-Q${q}`, label: `Q${q} ${ano}` });
    q -= 1;
    if (q === 0) { q = 4; ano -= 1; }
  }
  return options;
}
