export interface Janela {
  inicio: string;
  fim: string;
}

export interface Janelas {
  atual: Janela;
  anterior: Janela;
}

export type Direction = "up" | "down";

export interface Kpi {
  atual: number | null;
  anterior: number | null;
  variacaoPct: number | null;
  betterDirection: Direction;
}

// Trabalha em UTC sobre a data civil 'YYYY-MM-DD' para não sofrer com
// horário de verão / timezone do servidor.
function parseISO(d: string): Date {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function addDays(dt: Date, n: number): Date {
  return new Date(dt.getTime() + n * 86400000);
}

export function calcularJanelas(ate: string): Janelas {
  const fimAtual = parseISO(ate);
  const dow = fimAtual.getUTCDay(); // 0=domingo .. 6=sábado
  const diasAteSegunda = (dow + 6) % 7;
  const inicioAtual = addDays(fimAtual, -diasAteSegunda);
  return {
    atual: { inicio: fmt(inicioAtual), fim: fmt(fimAtual) },
    anterior: {
      inicio: fmt(addDays(inicioAtual, -7)),
      fim: fmt(addDays(fimAtual, -7)),
    },
  };
}

export function variacaoPct(
  atual: number | null,
  anterior: number | null,
): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function montarKpi(
  atual: number | null,
  anterior: number | null,
  betterDirection: Direction,
): Kpi {
  return { atual, anterior, variacaoPct: variacaoPct(atual, anterior), betterDirection };
}
