export interface MesValor {
  mes: number;
  orcado: number;
  realizado: number | null;
}

export type TipoAgregacao = "fluxo" | "estoque";

export function calcAtingimento(orcado: number, realizado: number | null): number | null {
  if (realizado === null || !orcado) return null;
  return realizado / orcado;
}

export function calcYtd(
  meses: MesValor[],
  mesAte: number,
  tipo: TipoAgregacao
): { orcado: number; realizado: number | null } {
  const ate = meses.filter((m) => m.mes <= mesAte);
  if (tipo === "estoque") {
    const orcado = ate.length ? ate[ate.length - 1].orcado : 0;
    const comDado = ate.filter((m) => m.realizado !== null);
    const realizado = comDado.length ? comDado[comDado.length - 1].realizado : null;
    return { orcado, realizado };
  }
  const orcado = ate.reduce((s, m) => s + m.orcado, 0);
  const comDado = ate.filter((m) => m.realizado !== null);
  const realizado = comDado.length
    ? comDado.reduce((s, m) => s + (m.realizado ?? 0), 0)
    : null;
  return { orcado, realizado };
}

export function ultimoDiaDoMes(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0));
  return d.toISOString().slice(0, 10);
}

// Rateio proporcional null-safe (usado para dividir o benefício entre CSV e SG&A
// pela fração orçada do mês). Denominador inválido => null, para expor erro de seed.
export function ratear(
  valor: number | null,
  numerador: number,
  denominador: number
): number | null {
  if (valor === null || !denominador) return null;
  return (valor * numerador) / denominador;
}

// Pré-condição: todos os arrays alinhados por posição (meses 1..12, mesmo comprimento).
export function subtrairMeses(
  minuendo: MesValor[],
  subtraendos: MesValor[][]
): MesValor[] {
  return minuendo.map((m, i) => {
    const partes = subtraendos.map((s) => s[i]);
    const orcado = partes.reduce((acc, p) => acc - p.orcado, m.orcado);
    const algumNull = m.realizado === null || partes.some((p) => p.realizado === null);
    const realizado = algumNull
      ? null
      : partes.reduce((acc, p) => acc - (p.realizado ?? 0), m.realizado ?? 0);
    return { mes: m.mes, orcado, realizado };
  });
}
